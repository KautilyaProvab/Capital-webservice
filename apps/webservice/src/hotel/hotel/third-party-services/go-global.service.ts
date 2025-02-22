import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { GOGLOBAL_HOTEL_BOOKING_SOURCE, logStoragePath, META_TL_HOTEL_COURSE } from "../../../constants";
import { goGlobalRequestTypes } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { GoGlobalTransformService } from "./go-global-transform.service";

@Injectable()
export class GoGlobalService extends HotelApi {

    apiCred: any;
    apiCredCached: boolean = false;

    constructor(
        private readonly httpService: HttpService,
        private hotelDbService: HotelDbService,
        private goGlobalTransformService: GoGlobalTransformService,
        private redisServerService: RedisServerService) {
        super()
    }

    throwSoapError(jsonResponse: any) {
        if (getPropValue(jsonResponse, 'Header.OperationType') == 'Error') {
            throw new HttpException(getPropValue(jsonResponse, 'Main.Error.Message'), 400);
        }
    }

    async setApiCredentials(): Promise<any> {
        if (this.apiCredCached) {
            return this.apiCred;
        }
        const apiQuery = `SELECT * FROM ws_api_credentials 
        WHERE status=true AND ws_api_id IN(SELECT id FROM ws_apis 
            WHERE source_key='${GOGLOBAL_HOTEL_BOOKING_SOURCE}' 
            AND meta_course_key='${META_TL_HOTEL_COURSE}')`;
        const result = await this.manager.query(apiQuery);
        this.apiCred = result.map(t => {
            t.config = t.config.replace(/'/g, '"');
            const tempData = {
                config: JSON.parse(t.config)
            }
            return this.getApiCredentialsUniversal(tempData);
        });
        this.apiCredCached = true;
        return this.apiCred[0];
    }

    async getAPIHeader(operation: any) {
        this.apiCred = await this.setApiCredentials();
        const GOGLOBAL_HEADER = {
            "Content-Type": "application/soap+xml",
            // "Content-Length": xmlRequest.length,
            "API-Operation": operation,
            "API-AgencyID": this.apiCred['AgencyId']
        }
        return GOGLOBAL_HEADER;
    }

    async getHeader(operation: any, operationType: any) {
        this.apiCred = await this.setApiCredentials();
        const header = `
            <Header>
                <Agency>${this.apiCred['AgencyId']}</Agency>
                <User>${this.apiCred['UserName']}</User>
                <Password>${this.apiCred['PassWord']}</Password>
                <Operation>${operation}</Operation>
                <OperationType>${operationType}</OperationType>
            </Header>`
        return header;
    }

    async getHotelInfoRequest(hotelSearchCode: any) {
        const header = await this.getHeader('HOTEL_INFO_REQUEST', 'Request');
        const hotelInfoReq = `<?xml version="1.0" encoding="utf-8"?>
            <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
                <soap12:Body>
                    <MakeRequest xmlns="http://www.goglobal.travel/">
                        <requestType>${goGlobalRequestTypes['HOTEL_INFO_REQUEST']}</requestType>
                        <xmlRequest><![CDATA[
                            <Root>
                                ${header}
                                <Main Version="2.3">
                                    <HotelSearchCode>${hotelSearchCode}</HotelSearchCode>
                                </Main>
                            </Root>
                        ]]></xmlRequest>
                    </MakeRequest>
                </soap12:Body>
            </soap12:Envelope>
        `;
        return hotelInfoReq;
    }

    async search(body: any): Promise<any> {
        const header = await this.getHeader('HOTEL_SEARCH_REQUEST', 'Request');
        const nights = noOfNights(body['CheckIn'], body['CheckOut']);
        let markup: any;
        if (body['UserType'] && body['UserId']) {
            markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
        }
        let rooms = `<Rooms>`;
        body['RoomGuests'].forEach(element => {
            rooms += `<Room Adults="${element.NoOfAdults}" RoomCount="${1}" ChildCount="${element.NoOfChild}">`;
            if (element.NoOfChild > 0) {
                let childAge = 3;
                for (let i = 1; i <= element.NoOfChild; i++) {
                    rooms += `<ChildAge>${childAge}</ChildAge>`;
                    childAge = childAge + 2;
                }
            }
            rooms += `</Room>`;
        });
        rooms += `</Rooms>`;
        let jsonResponse:any = [];
        const requestBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <MakeRequest xmlns="http://www.goglobal.travel/">
                    <requestType>${goGlobalRequestTypes['HOTEL_SEARCH_REQUEST']}</requestType>
                    <xmlRequest><![CDATA[
                        <Root>
                            ${header}
                            <Main Version="2.3" Currency="${body.Currency}" ResponseFormat="JSON" IncludeGeo="false">
                                <HotelFacilities>True</HotelFacilities>
                                <RoomFacilities>True</RoomFacilities>
                                <IncludeCommission>True</IncludeCommission>
                                <CityCode>${body.CityIds[0]}</CityCode>
                                <ArrivalDate>${body.CheckIn}</ArrivalDate>
                                <Nights>${nights}</Nights>
                                ${rooms}
                            </Main>
                        </Root>
                        ]]></xmlRequest>
                </MakeRequest>
            </soap12:Body>
        </soap12:Envelope>`;
        const xmlRequest = requestBody.replace(/\n/g, "").replace(/>\s+</g, "><");
        const xmlHeader = await this.getAPIHeader('HOTEL_SEARCH_REQUEST');
        const xmlResponse = await this.httpService.post(
            "http://talon.xml.goglobal.travel/xmlwebservice.asmx",
            xmlRequest, {
            headers: xmlHeader
        }).toPromise();
        if (xmlResponse == undefined) {
            return [];
        }
        if (this.isLogXml) {
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/searchRequest.xml`, (xmlRequest));
            fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/searchResponse.xml`, (xmlResponse));
        }
        jsonResponse =await this.xmlToJson(xmlResponse);
        const result = JSON.parse(jsonResponse['soap:Envelope']['soap:Body']['MakeRequestResponse']['MakeRequestResult']['$t']);
        this.throwSoapError(result);
        if (result.Hotels) {
            return Promise.all(
                result.Hotels.map(async (t: any) => {
                    const hotelInfoReq = await this.getHotelInfoRequest(t.Offers[0].HotelSearchCode);
                    const hotelInfoRes = await this.httpService.post(
                        "http://talon.xml.goglobal.travel/xmlwebservice.asmx",
                        hotelInfoReq, {
                        headers: xmlHeader
                    }).toPromise();
                    const hotelInfo =await this.xmlToJson(hotelInfoRes);
                    const hotelInfoJson =await this.xmlToJson(hotelInfo['soap:Envelope']['soap:Body']['MakeRequestResponse']['MakeRequestResult']['$t']);
                    const tempData = {
                        ...t,
                        hotelInfo: hotelInfoJson['Root']['Main']
                    }
                    return this.goGlobalTransformService.getHotelSearchUniversalFormat(body, markup, tempData);
                })
            )
        }
    }

    async getPriceBreakdownRequestXml(hotelSearchCode: any) {
        const header = await this.getHeader('PRICE_BREAKDOWN_REQUEST', 'Request');
        const req = `<?xml version="1.0" encoding="utf-8"?>
            <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
                <soap12:Body>
                    <MakeRequest xmlns="http://www.goglobal.travel/">
                        <requestType>${goGlobalRequestTypes['PRICE_BREAKDOWN_REQUEST']}</requestType>
                        <xmlRequest><![CDATA[
                            <Root>
                                ${header}
                                <Main Version="2.3">
                                    <HotelSearchCode>${hotelSearchCode}</HotelSearchCode>
                                </Main>
                            </Root>
                        ]]></xmlRequest>
                    </MakeRequest>
                </soap12:Body>
            </soap12:Envelope>
        `;
        return req;
    }

    async getHotelDetails(body: any): Promise<any> {
        const data = await this.redisServerService.read_list(body["ResultToken"]);
        const result = JSON.parse(data);
        result["ResultIndex"] = body["ResultToken"];
        result["booking_source"] = body.booking_source
        const xmlHeader = await this.getAPIHeader('PRICE_BREAKDOWN_REQUEST');
        const finalResult = await Promise.all(
            result.RoomDetails.map(async (t) => {
                const request = await this.getPriceBreakdownRequestXml(t.HotelSearchCode);
                const responseXml = await this.httpService.post(
                    "http://talon.xml.goglobal.travel/xmlwebservice.asmx",
                    request, {
                    headers: xmlHeader
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/priceBreakDownRequest.xml`, (request));
                    fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/priceBreakDownResponse.xml`, (responseXml));
                }                
                const priceInfo =await this.xmlToJson(responseXml);
                const priceInfoJson =await this.xmlToJson(priceInfo['soap:Envelope']['soap:Body']['MakeRequestResponse']['MakeRequestResult']['$t']);
                this.throwSoapError(priceInfoJson);
                const tempData = {
                    ...t,
                    priceInfo: priceInfoJson['Root']['Main']
                }
                return this.goGlobalTransformService.getHotelDetailsUniversalFormat(body, tempData);
            })
        )
        result["RoomDetails"] = finalResult;
        return result;
    }

    async hotelsValuation(body: any): Promise<any> {
        const hotelData = await this.redisServerService.read_list(body["HotelResultToken"]);
        const hotelDetail = JSON.parse(hotelData);
        const roomData = await this.redisServerService.read_list(body["RoomResultToken"]);
        const roomDetail = JSON.parse(roomData);
        const header = await this.getHeader('BOOKING_VALUATION_REQUEST', 'Request');
        const xmlHeader = await this.getAPIHeader('BOOKING_VALUATION_REQUEST');
        const request = `<?xml version="1.0" encoding="utf-8"?>
            <soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
                <soap12:Body>
                    <MakeRequest xmlns="http://www.goglobal.travel/">
                        <requestType>${goGlobalRequestTypes['BOOKING_VALUATION_REQUEST']}</requestType>
                        <xmlRequest><![CDATA[
                            <Root>
                                ${header}
                                <Main Version="2.3">
                                    <HotelSearchCode>${roomDetail['AgencyToken']}</HotelSearchCode>
                                    <ArrivalDate>${hotelDetail['CheckIn']}</ArrivalDate>
                                </Main>
                            </Root>
                        ]]></xmlRequest>
                    </MakeRequest>
                </soap12:Body>
            </soap12:Envelope>
        `;
        const responseXml = await this.httpService.post(
            "http://talon.xml.goglobal.travel/xmlwebservice.asmx",
            request, {
            headers: xmlHeader
        }).toPromise();
        if (this.isLogXml) {
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/bookingValuationRequest.xml`, (request));
            fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/bookingValuationResponse.xml`, (responseXml));
        }      
        const valuationResp =await this.xmlToJson(responseXml);
        const valuationRespJson =await this.xmlToJson(valuationResp['soap:Envelope']['soap:Body']['MakeRequestResponse']['MakeRequestResult']['$t']);
        const result = valuationRespJson['Root']['Main'];
        let markup: any;
        if (result['Rates'].hasOwnProperty('$t')) {
            let arr = [...result['Rates']['$t']];
            hotelDetail['Price'] = {
                Price: arr[0],
                Currency: arr[1],
                Commission: 0
            }
        } else {
            hotelDetail['Price'] = roomDetail['Price'];
        }
        hotelDetail['CancelPenalties'] = {
            CancelPenalty: result['CancellationDeadline']['$t']
        }
        hotelDetail['Remarks'] = result['Remarks']['$t'];
        hotelDetail['AgencyToken'] = roomDetail['AgencyToken'];
        hotelDetail['RoomDetails'] = roomDetail;
        // if (body['UserType'] && body['UserId']) {
        //     markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId']);
        // }
        // if (markup && markup.markup_currency == hotelDetail['Price']['Currency']) {
        //     if (markup.value_type == 'percentage') {
        //         let percentVal = (hotelDetail['Price']['Amount'] * markup['value']) / 100;
        //         hotelDetail['Price']['Amount'] += percentVal;
        //         hotelDetail['Price']['Amount'] = parseFloat(result['Price']['Amount'].toFixed(2));
        //     } else if (markup.value_type == 'plus') {
        //         hotelDetail['Price']['Amount'] += markup['value'];
        //     }
        // }
        const token = this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(hotelDetail));
        hotelDetail["ResultIndex"] = response["access_key"];
        hotelDetail["booking_source"] = body.booking_source
        return hotelDetail;
    }

    formatReservationRequestGo(paxes: any, room: any , searchRequest) {
        let guests = [];
        paxes.pop();
        searchRequest.forEach((r, i) => {
        paxes.forEach((element, index) => {
                if (r["NoOfAdults"] > index && element.pax_type==="Adult" ) {
                    let pax = {
                        roomCandidateId: i + 1,
                        paxId: index + 1,
                        paxType :"Adult",
                        givenName: element.first_name,
                        surname: element.last_name
                    }
                    guests.push(pax);
                }
                let l = guests.filter(element => element.roomCandidateId==i+1)
                if ((r["NoOfChild"]+r["NoOfAdults"]) > l.length && element.pax_type==="Child") {
                    let pax = {
                        roomCandidateId: i + 1,
                        paxId: index + 1,
                        paxType :"Child",
                        givenName: element.first_name,
                        surname: element.last_name
                    }
                    guests.push(pax);
                }               
            });          
            var count = 0;
            let AdultArray = paxes.filter(ele=>ele.pax_type ==="Adult")
            let ChildArray = paxes.filter(ele=>ele.pax_type === "Child")
            while (count < r["NoOfAdults"]) {
                AdultArray.splice(0,1);
                if(count < r["NoOfChild"]){
                    ChildArray.splice(0,1)
                }
                count++;                
        }
        paxes = [...AdultArray,...ChildArray]
    });
        return guests
    }


    async formatReservationRequest(booking: any, pax: any, room: any,body) {
        const header = await this.getHeader('BOOKING_INSERT_REQUEST', 'Request');
        const xmlHeader = await this.getAPIHeader('BOOKING_INSERT_REQUEST');
        const nights = noOfNights(parseInt(booking[0]['hotel_check_in']), parseInt(booking[0]['hotel_check_out']));
        const ArrivalDate =new Date( parseInt(booking[0]['hotel_check_in']))
        //change date data
        const ArrivalDateRequest = formatDate(ArrivalDate)
        const passengerData = pax;
        let searchRequest = JSON.parse(booking[0]['attributes'].replace(/'/g,'"')).RoomGuests;
        let passengers = this.formatReservationRequestGo(pax , room , searchRequest)
        const group = passengers.reduce((acc, item) => {
        if (!acc[item.roomCandidateId]) {
            acc[item.roomCandidateId] = [];
        }
        acc[item.roomCandidateId].push(item);
        return acc;
        }, {})    
        passengers = Object.values(group)
        var passengerDetails = "<Rooms>"
        passengers.forEach((element,index) => {
            passengerDetails = passengerDetails+`<RoomType Adults="${searchRequest[index].NoOfAdults}"><Room RoomID="${index+1}">`
            element.forEach((element1,index) => {
                if(element1.paxType == "Adult"){
            passengerDetails = passengerDetails + `<PersonName PersonID="${index+1}" Title="MR." FirstName="${element1.givenName}" LastName="${element1
                .surname}"/>`
            }
            if(element1.paxType=="Child"){
                passengerDetails = passengerDetails + `<ExtraBed PersonID="${index+1}" Title="MR." FirstName="${element1.givenName}" LastName="${element1
                    .surname}" ChildAge="${3}"/>`  
            }
            })
            passengerDetails= passengerDetails+"</Room></RoomType>"
        });
        passengerDetails = `${passengerDetails} </Rooms>`
        const request = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
            <soap12:Body>
                <MakeRequest xmlns="http://www.goglobal.travel/">
                    <requestType>${goGlobalRequestTypes['BOOKING_INSERT_REQUEST']}</requestType>
                    <xmlRequest><![CDATA[
                        <Root>
                            ${header}
                            <Main Version="2.0">
                                <AgentReference>Test AgRef</AgentReference>
                                <HotelSearchCode>${room[0].room_id}</HotelSearchCode>
                                <ArrivalDate>${ArrivalDateRequest}</ArrivalDate>
                                <Nights>${nights}</Nights>
                                <NoAlternativeHotel>1</NoAlternativeHotel>
                                <Leader LeaderPersonID="1"/>
                                ${passengerDetails}
                            </Main>
                        </Root>
                    ]]></xmlRequest>
                </MakeRequest>
            </soap12:Body>
        </soap12:Envelope>`;
        const responseXml = await this.httpService.post(
            "http://talon.xml.goglobal.travel/xmlwebservice.asmx",
            request, {
            headers: xmlHeader
        }).toPromise();
        if (this.isLogXml) {
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/${body["AppReference"]}-reservationRequest.xml`, (request));
            fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/${body["AppReference"]}-reservationResponse.xml`, (responseXml));
        }
        // const responseXml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><MakeRequestResponse xmlns="http://www.goglobal.travel/"><MakeRequestResult>&lt;Root&gt;&lt;Header&gt;&lt;Agency&gt;124246&lt;/Agency&gt;&lt;User&gt;TALONXMLTEST&lt;/User&gt;&lt;Password&gt;XSG9HMRGMCHL&lt;/Password&gt;&lt;Operation&gt;BOOKING_INSERT_RESPONSE&lt;/Operation&gt;&lt;OperationType&gt;Response&lt;/OperationType&gt;&lt;/Header&gt;&lt;Main&gt;&lt;GoBookingCode&gt;18779336&lt;/GoBookingCode&gt;&lt;GoReference&gt;GO17328763-18779336-A(INT)&lt;/GoReference&gt;&lt;ClientBookingCode&gt;Test AgRef&lt;/ClientBookingCode&gt;&lt;BookingStatus&gt;C&lt;/BookingStatus&gt;&lt;TotalPrice&gt;396&lt;/TotalPrice&gt;&lt;Currency&gt;EUR&lt;/Currency&gt;&lt;HotelId&gt;&lt;![CDATA[623891]]&gt;&lt;/HotelId&gt;&lt;HotelName&gt;&lt;![CDATA[NEW BEDFORD HARBOR HOTEL]]&gt;&lt;/HotelName&gt;&lt;HotelSearchCode&gt;13752803/6574339798810938729/9&lt;/HotelSearchCode&gt;&lt;RoomType&gt;&lt;![CDATA[]]&gt;&lt;/RoomType&gt;&lt;RoomBasis&gt;&lt;![CDATA[BB]]&gt;&lt;/RoomBasis&gt;&lt;ArrivalDate&gt;2021-07-10&lt;/ArrivalDate&gt;&lt;CancellationDeadline&gt;2021-07-08&lt;/CancellationDeadline&gt;&lt;Nights&gt;2&lt;/Nights&gt;&lt;NoAlternativeHotel&gt;1&lt;/NoAlternativeHotel&gt;&lt;Leader LeaderPersonID="1"/&gt;&lt;Rooms&gt;&lt;RoomType Adults="2" &gt;&lt;Room RoomID="1" Category="Room King Size Bed"&gt;&lt;PersonName PersonID="1" Title="MR." FirstName="RAJESH" LastName="MALAKAR" /&gt;&lt;PersonName PersonID="2" Title="MR." FirstName="RAMESH" LastName="MALAKAR" /&gt;&lt;/Room&gt;&lt;/RoomType&gt;&lt;/Rooms&gt;&lt;Preferences&gt;&lt;AdjoiningRooms&gt;&lt;![CDATA[]]&gt;&lt;/AdjoiningRooms&gt;&lt;ConnectingRooms&gt;&lt;![CDATA[]]&gt;&lt;/ConnectingRooms&gt;&lt;LateArrival&gt;&lt;![CDATA[]]&gt;&lt;/LateArrival&gt;&lt;/Preferences&gt;&lt;Remark&gt;&lt;![CDATA[NO AMENDMENTS POSSIBLE. IF NEEDED, PLEASE CANCEL AND REBOOK!!
//  CXL charges apply as follows:  STARTING 08/07/2021 CXL-PENALTY FEE IS 100.00% OF BOOKING PRICE.,  As a result of local government measures and guidelines put in place by services providers – including hotels and ancillaries – guests 
// may find that some facilities or services are not available.Please visit https://static-sources.s3-eu-west-1.amazonaws.com/policy/index.html for further information (18/05/2020 - 31/12/2021).,  STARTING 08/07/2021 CXL-PENALTY FEE IS 100.00% OF BOOKING PRICE.,  As a result of local government measures and guidelines put in place by services providers – including hotels and ancillaries – guests may find that some facilities or services are not available.Please visit https://static-sources.s3-eu-west-1.amazonaws.com/policy/index.html for further information (18/05/2020 - 31/12/2021)., Accommodation category: 2 STARS. Reference: 255-4014109]]&gt;&lt;/Remark&gt;&lt;/Main&gt;&lt;/Root&gt;</MakeRequestResult></MakeRequestResponse></soap:Body></soap:Envelope>`
        const valuationResp =await this.xmlToJson(responseXml);
        const converted =await this.xmlToJson(valuationResp['soap:Envelope']['soap:Body']['MakeRequestResponse']['MakeRequestResult']['$t'])                    
        return this.goGlobalTransformService.updateData(converted['Root']['Main'],body, booking ,passengerData,room);
    }

    async hotelsReservation(body: any): Promise<any> {
        let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
        let paxDetails = await this.hotelDbService.getHotelBookingPaxDetails(body);
        let roomDetails = await this.hotelDbService.getHotelBookingItineraryDetails(body);
        let formattedRequest = this.formatReservationRequest(bookingDetails, paxDetails, roomDetails,body);
        return formattedRequest;
    }

    async cancelReservation(body:any){
        const header = await this.getHeader('BOOKING_CANCEL_REQUEST', 'Request');
        const xmlHeader = await this.getAPIHeader('BOOKING_CANCEL_REQUEST');
        const request = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
        <soap12:Body>
            <MakeRequest xmlns="http://www.goglobal.travel/">
                <requestType>${goGlobalRequestTypes['BOOKING_CANCEL_REQUEST']}</requestType>
                <xmlRequest><![CDATA[
                    <Root>
                        ${header}
                        <Main>
                        <GoBookingCode>62101</GoBookingCode>
                        </Main>
                    </Root>
                ]]></xmlRequest>
            </MakeRequest>
        </soap12:Body>
    </soap12:Envelope>`;

    const responseXml = await this.httpService.post(
        "http://talon.xml.goglobal.travel/xmlwebservice.asmx",
        request, {
        headers: xmlHeader
    }).toPromise();
    if (this.isLogXml) {
        const fs = require('fs');
        fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/${body["AppReference"]}-CancelRQ.json`, JSON.stringify(request));
        fs.writeFileSync(`${logStoragePath}/hotels/goGlobal/${body["AppReference"]}-CancelRS.json`, JSON.stringify(responseXml));
    }

    const cancllationData =await this.xmlToJson(responseXml);
    const converted =await this.xmlToJson(cancllationData['soap:Envelope']['soap:Body']['MakeRequestResponse']['MakeRequestResult']['$t'])                    
    return this.goGlobalTransformService.updateCancelledData(converted['Root']['Main'],body);


    }
    
}

