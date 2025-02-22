import { Injectable, HttpService, HttpException, BadRequestException } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import * as moment from "moment";
import { getPropValue, getPropValueOrEmpty, undefinedToSkip, debug } from "../../../app.helper";
import {
    ProviderCode,
    TRAVELPORT_VERSION,
    TRAVELPORT_SCHEMA,
    TRAVELPORT_AIR_URL,
    TargetBranch,
    MaxSolutions,
    TRAVELPORT_API_URL,
    TRAVELPORT_HEADERS,
    TRAVELPORT_USERNAME,
    TRAVELPORT_UNIVERSAL_URL,
    logStoragePath,
    TRAVELPORT_FLIGHT_BOOKING_SOURCE,

} from "../../../constants";
import { DB_SAFE_SEPARATOR, RedisServerService } from "../../../shared/redis-server.service";
import { RequestResponseLogService } from "../../../shared/request-response-log.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { TravelportTransformService } from "./travelport-transform.service";
import { CommonService } from "apps/webservice/src/common/common/common.service";
// import { forceObjectToArray, airlineWiseBlockRBD, format_air_pricing_solution, delayForGettingCodes } from "./helper";
const fs = require('fs');

@Injectable()
export class TravelportApiService extends FlightApi {
    constructor(
        private httpService: HttpService,
        private travelportTransformService: TravelportTransformService,
        private readonly redisServerService: RedisServerService,
        private readonly requestResponseLogService: RequestResponseLogService,
        private readonly flightDbService: FlightDbService,
        private readonly commonService:CommonService
    ) {
        super();
    }

    throwSoapError(jsonResponse: any) {
        if (getPropValue(jsonResponse, 'SOAP:Envelope.SOAP:Body.SOAP:Fault')) {
            throw new HttpException(getPropValue(jsonResponse, 'SOAP:Envelope.SOAP:Body.SOAP:Fault.faultstring.$t'), 400);
        }
        if (getPropValue(jsonResponse, 'SOAP-ENV:Envelope.SOAP-ENV:Body.SOAP-ENV:Fault')) {
            throw new HttpException(getPropValue(jsonResponse, 'SOAP-ENV:Envelope.SOAP-ENV:Body.SOAP-ENV:Fault.SOAP-ENV:faultstring.$t'), 400);
        }
    }

    async search(body: any): Promise<any> {
        let jsonResponse:any = [];
        const TraceId = Buffer.from(Date.now() + '' + process.hrtime()[1]).toString('base64');
        const BookingRefObj = { ADT: [], CHD: [], INF: [], TraceId };
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/LowFareSearchRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const start1: any = new Date();
            let SearchAirLeg = '';
           
            let PlusMinus3Days = ``;
            if (getPropValue(body, 'PlusMinus3Days')) {
                PlusMinus3Days = `<SearchExtraDays
							xmlns="${TRAVELPORT_SCHEMA}" DaysBefore="3" DaysAfter="3" />
						`;
            }
            

            if (body.JourneyType == "OneWay") {
                let AirLegModifiers = '';
                AirLegModifiers = `<AirLegModifiers>
        <PermittedCabins>
            <CabinClass xmlns="${TRAVELPORT_SCHEMA}" Type="${body.Segments[0]['CabinClass'].replace(/\s/g, '')}" />
        </PermittedCabins>
    </AirLegModifiers>`;
                SearchAirLeg += `
    <SearchAirLeg>
        <SearchOrigin>
            <CityOrAirport xmlns="${TRAVELPORT_SCHEMA}" Code="${body.Segments[0]['Origin']}"  PreferCity="true" />
        </SearchOrigin>
        <SearchDestination>
            <CityOrAirport xmlns="${TRAVELPORT_SCHEMA}" Code="${body.Segments[0]['Destination']}"  PreferCity="true" />
        </SearchDestination>
        <SearchDepTime PreferredTime="${body.Segments[0]['DepartureDate']}" >
        ${PlusMinus3Days}
        </SearchDepTime>
        ${AirLegModifiers}
    </SearchAirLeg>`;
            } else if (body.JourneyType == "Return") {
                for (let i = 0; i < 2; i++) {
                    const origin = i
                        ? body.Segments[i - 1]['Destination']
                        : body.Segments[i]['Origin'];
                    const destination = i
                        ? body.Segments[i - 1]['Origin']
                        : body.Segments[i]['Destination'];
                    const departure = i
                        ? body.Segments[i - 1]['ReturnDate']
                        : body.Segments[i]['DepartureDate'];
                    const cabinClass = i
                        ? body.Segments[i - 1]['CabinClassReturn'].replace(/\s/g, '')
                        : body.Segments[i]['CabinClassOnward'].replace(/\s/g, '');
                    let AirLegModifiers = '';
                    AirLegModifiers = `<AirLegModifiers>
<PermittedCabins>
    <CabinClass xmlns="${TRAVELPORT_SCHEMA}" Type="${cabinClass}" />
</PermittedCabins>
</AirLegModifiers>`;
                    SearchAirLeg += `
    <SearchAirLeg>
        <SearchOrigin>
            <CityOrAirport xmlns="${TRAVELPORT_SCHEMA}" Code="${origin}"  PreferCity="true" />
        </SearchOrigin>
        <SearchDestination>
            <CityOrAirport xmlns="${TRAVELPORT_SCHEMA}" Code="${destination}"  PreferCity="true" />
        </SearchDestination>
        <SearchDepTime PreferredTime="${departure}" >
        ${PlusMinus3Days}
        </SearchDepTime>
        ${AirLegModifiers}
    </SearchAirLeg>`;
                }
            } else {
                for (let i = 0; i < body.Segments.length; i++) {
                    let AirLegModifiers = '';
                    AirLegModifiers = `<AirLegModifiers>
<PermittedCabins>
    <CabinClass xmlns="${TRAVELPORT_SCHEMA}" Type="${body.Segments[0]['CabinClass'].replace(/\s/g, '')}" />
</PermittedCabins>
</AirLegModifiers>`;
                    SearchAirLeg += `
    <SearchAirLeg>
        <SearchOrigin>
            <CityOrAirport xmlns="${TRAVELPORT_SCHEMA}" Code="${body.Segments[i]['Origin']}"  PreferCity="true" />
        </SearchOrigin>
        <SearchDestination>
            <CityOrAirport xmlns="${TRAVELPORT_SCHEMA}" Code="${body.Segments[i]['Destination']}"  PreferCity="true" />
        </SearchDestination>
        <SearchDepTime PreferredTime="${body.Segments[i]['DepartureDate']}">
        ${PlusMinus3Days}
        </SearchDepTime>
        ${AirLegModifiers}
    </SearchAirLeg>`;
                }
            }
            let SearchPassenger = '';
            for (let x = 0; x < Number(body.AdultCount); x++) {
                // const BookingRef = Buffer.from('1' + Math.floor(Math.random() * (99 - 10 + 1) + 10) + '' + Date.now()).toString('base64');
                const PHR = process.hrtime();
                const BookingRef = Buffer.from('1' + PHR[0] + '' + PHR[1]).toString('base64');
                BookingRefObj.ADT.push(BookingRef);
                SearchPassenger += `<SearchPassenger xmlns="${TRAVELPORT_SCHEMA}" Code="ADT" BookingTravelerRef="${BookingRef}" />`;
            }
            for (let y = 0; y < Number(body.ChildCount); y++) {
                // const BookingRef = Buffer.from('2' + Math.floor(Math.random() * (99 - 10 + 1) + 10) + '' + Date.now()).toString('base64');
                const PHR = process.hrtime();
                const BookingRef = Buffer.from('2' + PHR[0] + '' + PHR[1]).toString('base64');
                BookingRefObj.CHD.push(BookingRef);
                const Age = ('' + this.getPassengeTypeByDOB(body.childDOB[y]).age).padStart(2, '0');
                SearchPassenger += `<SearchPassenger xmlns="${TRAVELPORT_SCHEMA}" Code="CNN" Age="${Age}" BookingTravelerRef="${BookingRef}" />`;
            }
            for (let z = 0; z < Number(body.InfantCount); z++) {
                // const BookingRef = Buffer.from('3' + Math.floor(Math.random() * (99 - 10 + 1) + 10) + '' + Date.now()).toString('base64');
                const PHR = process.hrtime();
                const BookingRef = Buffer.from('3' + PHR[0] + '' + PHR[1]).toString('base64');
                BookingRefObj.INF.push(BookingRef);
                const Age = ('' + this.getPassengeTypeByDOB(body.infantDOB[z]).age)
                SearchPassenger += `<SearchPassenger xmlns="${TRAVELPORT_SCHEMA}" Code="INF" Age="${Age}" BookingTravelerRef="${BookingRef}" />`;
            }

          
            let PermittedCarriers = '';

            if (body.PreferredAirlines.length) {
                PermittedCarriers = '<PermittedCarriers>';
                for (let z = 0; z < body.PreferredAirlines.length; z++) {
                    PermittedCarriers += `<Carrier xmlns="${TRAVELPORT_SCHEMA}" Code="${body.PreferredAirlines[z]}"/>`;
                }
                PermittedCarriers += '</PermittedCarriers>';
            }
            let NonStopDirects = '';
            if (getPropValue(body, 'NonStopFlights')) {
                NonStopDirects = '<FlightType NonStopDirects="true" />';
            }


            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Header>
            <Action xmlns="http://schemas.microsoft.com/ws/2005/05/addressing/none" s:mustUnderstand="1">localhost:8080/kestrel/AirService</Action>
        </s:Header>
        <s:Body xmlns:xsd="http://www.w3.org/2001/xmlschema" xmlns:xsi="http://www.w3.org/2001/xmlschema-instance">
            <LowFareSearchReq xmlns="${TRAVELPORT_AIR_URL}" SolutionResult="true" AuthorizedBy="${TRAVELPORT_USERNAME}" TraceId="${TraceId}" TargetBranch="${TargetBranch}" >
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="UAPI" />
                ${SearchAirLeg}
                <AirSearchModifiers MaxSolutions="${MaxSolutions}">
                <PreferredProviders>
                    <Provider xmlns="${TRAVELPORT_SCHEMA}" Code="${ProviderCode}" />
                </PreferredProviders>
                ${PermittedCarriers}${NonStopDirects}
                </AirSearchModifiers>
                ${SearchPassenger}
                <AirPricingModifiers FaresIndicator="AllFares" ETicketability="Yes"/>
            </LowFareSearchReq>
        </s:Body>
    </s:Envelope>`;
            /* 
            6) AirPricingModifiers/@CurrencyType - You have used CurrencyType="BDT" in your request. The CurrencyType in AirPricingModifiers is passed to the provider, which affects the currency that is returned for Equivalent Base Price, Base Price, Taxes, and Total Price. In your case default currency for the PCC is BDT only, so there is no need to send CurrencyType in LowFareSearchReq, as you are using the PCC default currency type in your request.
            <AirPricingModifiers FaresIndicator="AllFares" ETicketability="Yes" CurrencyType="BDT"/>
            to 
            <AirPricingModifiers FaresIndicator="AllFares" ETicketability="Yes"/>
            */

            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
            const end1: any = new Date();
         console.log("For Third party request Format time:", (end1 - start1));

         const start2: any = new Date();
            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/LowFareSearchReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/LowFareSearchRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post(TRAVELPORT_API_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                const { Origin, Destination } = body.Segments[0];
                fs.writeFileSync(`${logStoragePath}/flights/travelport/LowFareSearchReq(${Origin}-${Destination}).xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/LowFareSearchRes(${Origin}-${Destination}).xml`, xmlResponse);
            }
          
            jsonResponse =await this.xmlToJson(xmlResponse);
            fs.writeFileSync(`${logStoragePath}/flights/travelport/LowFareSearchResJsonNew.json`, JSON.stringify(jsonResponse));
            const end2: any = new Date();
            console.log("Third party response time:", (end2 - start2));
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);
       

        const start3: any = new Date();
        const FlightDataList = await this.travelportTransformService.finalData(jsonResponse, body, BookingRefObj);
        const end3: any = new Date();
        
        console.log("Response format time:", (end3 - start3));
        // return { result: FlightDataList, message: '' };
        return FlightDataList;
    }

    async fareQuote(body: any): Promise<any> {
        let jsonResponse:any = [];
        let xmlResponse: any = {};
        const FlightDetail = await this.redisServerService.read_list(body['ResultToken']);
        const FlightDetailParsed = JSON.parse(FlightDetail[0]);
        const Key = body['ResultToken'].split(DB_SAFE_SEPARATOR);
        const BookingTravelerRefToken = Key[0] + DB_SAFE_SEPARATOR + 1 + DB_SAFE_SEPARATOR + 9999;
        const BookingTravelerRefObj = await this.redisServerService.read_list(BookingTravelerRefToken);
        FlightDetailParsed['BookingTravelerRefObj'] = JSON.parse(BookingTravelerRefObj[0]);
        FlightDetailParsed['SearchData'].UserId=body.UserId;
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/AirPriceRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            let xmlLoop = '';
            let AirSegmentPricingModifiers = '';
            const SearchDataTemp = FlightDetailParsed['SearchData'];
            const adults = this.travelportTransformService.pax_xml_for_fare_quote(SearchDataTemp['AdultCount'], "ADT", 0, "");
            const childs = this.travelportTransformService.pax_xml_for_fare_quote(SearchDataTemp['ChildCount'], "CNN", adults['paxId'], SearchDataTemp['childDOB']);
            const infants = this.travelportTransformService.pax_xml_for_fare_quote(SearchDataTemp['InfantCount'], "INF", childs['paxId'], SearchDataTemp["infantDOB"]);
            const SearchPassenger = adults['pax_xml'] + childs['pax_xml'] + infants['pax_xml'];
            let seg_token_key = 0;
            const exp_conn = FlightDetailParsed['Connection'].split(',');
            for (let i = 0; i < FlightDetailParsed['FlightList'].length; i++) {
                for (let j = 0; j < FlightDetailParsed['FlightList'][i].length; j++) {
                    const loopData = FlightDetailParsed['FlightList'][i][j];
                    let connection_indc = '';
                    if (FlightDetailParsed['FlightList'][i].length > 1 && exp_conn.includes('' + seg_token_key) /*in_array( flight_key, exp_conn )*/) {
                        connection_indc = '<Connection />';
                    }
                    xmlLoop += `
    <AirSegment 
        Key="${loopData['Key']}" 
        Group="${loopData['Group']}" 
        Carrier="${loopData['Carrier']}" 
        FlightNumber="${loopData['FlightNumber']}" 
        ProviderCode="${ProviderCode}" 
        Origin="${loopData['Origin']}" 
        Destination="${loopData['Destination']}" 
        DepartureTime="${loopData['DepartureTime']}" 
        ArrivalTime="${loopData['ArrivalTime']}" 
        FlightTime="${loopData['FlightTime']}" 
        ChangeOfPlane="${loopData['ChangeOfPlane']}" 
        OptionalServicesIndicator="${loopData['OptionalServicesIndicator']}" 
        AvailabilityDisplayType="${loopData['AvailabilityDisplayType']}" 
        ${undefinedToSkip(loopData, "Distance")} 
        ${undefinedToSkip(loopData, "Equipment")} 
        ${undefinedToSkip(loopData, "AvailabilitySource")} 
        ${undefinedToSkip(loopData, "ParticipantLevel")} 
        ${undefinedToSkip(loopData, "PolledAvailabilityOption")} 
        ${undefinedToSkip(loopData, "ETicketability")} 
        ${undefinedToSkip(loopData, "LinkAvailability")}>
        <AirAvailInfo ProviderCode="${ProviderCode}">
            <BookingCodeInfo BookingCounts="${loopData['BookingCount']}"></BookingCodeInfo>
        </AirAvailInfo>
        <FlightDetails Equipment="${loopData['Equipment']}" Destination="${loopData['Destination']}" Origin="${loopData['Origin']}" Key="${loopData['air:FlightDetailsRef']['Key']}" FlightTime="${loopData['FlightTime']}" ArrivalTime="${loopData['ArrivalTime']}" DepartureTime="${loopData['DepartureTime']}" />
        ${connection_indc}
        </AirSegment>
    `;
                    AirSegmentPricingModifiers += `<AirSegmentPricingModifiers AirSegmentRef="${loopData['Key']}">
    <PermittedBookingCodes>
        <BookingCode Code="${loopData['BookingCode']}" />
    </PermittedBookingCodes>
    </AirSegmentPricingModifiers>`;
                    seg_token_key++;
                }
            }

            const CabinClass = getPropValue(SearchDataTemp['Segments'][0], 'CabinClass') || getPropValue(SearchDataTemp['Segments'][0], 'CabinClassOnward');
            let PermittedCabins = '';
            PermittedCabins = `<PermittedCabins>
    <CabinClass xmlns="${TRAVELPORT_SCHEMA}" Type="${CabinClass.replace(/\s/g, '')}"/>
</PermittedCabins>`;
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Header>
            <Action xmlns="http://schemas.microsoft.com/ws/2005/05/addressing/none" s:mustUnderstand="1">http://tlntrip.com/WDMR/tlntrip/index.php/flight/lost</Action>
        </s:Header>
        <s:Body xmlns:xsd="http://www.w3.org/2001/xmlschema" xmlns:xsi="http://www.w3.org/2001/xmlschema-instance">
            <AirPriceReq xmlns="${TRAVELPORT_AIR_URL}" xmlns:common_${TRAVELPORT_VERSION}="${TRAVELPORT_SCHEMA}" TargetBranch="${TargetBranch}" CheckOBFees="All" AuthorizedBy="${TRAVELPORT_USERNAME}" TraceId="${FlightDetailParsed['BookingTravelerRefObj']['TraceId']}">
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="UAPI" />
                <AirItinerary>
                    ${xmlLoop}
                </AirItinerary>
                <AirPricingModifiers FaresIndicator="AllFares" InventoryRequestType="DirectAccess">
                    ${PermittedCabins}
                </AirPricingModifiers>
                ${SearchPassenger}
                <AirPricingCommand>
                    ${AirSegmentPricingModifiers}
                </AirPricingCommand>
            </AirPriceReq>
        </s:Body>
    </s:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
           
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/AirPriceReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/AirPriceRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post(TRAVELPORT_API_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
                if (xmlResponse == undefined) {
                    return [];
                }
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/AirPriceReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/AirPriceRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
            fs.writeFileSync(`${logStoragePath}/flights/travelport/AirPriceRes.json`, JSON.stringify(jsonResponse));
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);

        const fareQuoteDetail = await this.travelportTransformService.fareQuoteDataFormat(jsonResponse, body, FlightDetailParsed, xmlResponse);
        return { result: fareQuoteDetail, message: '' };
    }

    async seatAvailability(body: any): Promise<any> {
        const FlightDetail = await this.redisServerService.read_list(body['ResultToken']);
        const FlightDetailParsed = JSON.parse(FlightDetail[0]);
        let data_x = await this.xmlToJson(FlightDetailParsed.KeyData.key.price_xml);

        console.log("================seat===========");
        console.log((data_x['root']['$t']));
                console.log("================seatend===========");
        let data = JSON.parse(data_x['root']['$t']);

        const xmlResponses = [];
        let xmlRequest;
        const promises = [];
        const airSegments = Array.isArray(data['AirPricingSolution']['AirSegment'])
            ? data['AirPricingSolution']['AirSegment']
            : [data['AirPricingSolution']['AirSegment']];

        for (const segment of airSegments) {            // destructure the segment object to get its properties
            const { Key, Group, Carrier, FlightNumber, ProviderCode, Origin, Destination, DepartureTime, ArrivalTime, FlightTime, TravelTime,
                Distance, ClassOfService, Equipment, ChangeOfPlane, OptionalServicesIndicator, AvailabilitySource, ParticipantLevel,
                LinkAvailability, PolledAvailabilityOption, AvailabilityDisplayType, CodeshareInfo, AirAvailInfo, FlightDetails, Connection
            } = segment;

            // create the XML request body for this segment
            const xmlBodyDataFormat = `
            <air:AirSegment 
                Key="${Key}" 
                Group="${Group}" 
                Carrier="${Carrier}" 
                FlightNumber="${FlightNumber}" 
                ProviderCode="${ProviderCode}" 
                Origin="${Origin}" 
                Destination="${Destination}"
                DepartureTime="${DepartureTime}" 
                ArrivalTime="${ArrivalTime}" 
                FlightTime="${FlightTime}" 
                Distance="${Distance}" 
                Equipment="${Equipment}" 
                ClassOfService="${ClassOfService}" 
                ChangeOfPlane="${ChangeOfPlane}" 
                OptionalServicesIndicator="${OptionalServicesIndicator}" 
                AvailabilitySource="${AvailabilitySource}"
                ParticipantLevel="${ParticipantLevel}"
                ${LinkAvailability ? `LinkAvailability="${LinkAvailability}"` : ''}
                PolledAvailabilityOption="${PolledAvailabilityOption}"
                AvailabilityDisplayType="${AvailabilityDisplayType}">
                <air:AirAvailInfo ProviderCode="${ProviderCode}" />
                <air:FlightDetails Key="${Key}" 
                Origin="${Origin}" 
                Destination="${Destination}" 
                DepartureTime="${DepartureTime}" 
                ArrivalTime="${ArrivalTime}" 
                FlightTime="${FlightTime}"  
                Distance="${Distance}" />
            </air:AirSegment>`;


            // create the full XML request with the request body and necessary headers
            const xmlData = `
            <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
            <soapenv:Header/>
            <soapenv:Body>
            <air:SeatMapReq TargetBranch="${TargetBranch}" TraceId="${FlightDetailParsed['BookingTravelerRefObj']['TraceId']}" ReturnSeatPricing="false" AuthorizedBy="uAPI" xmlns:com="http://www.travelport.com/schema/common_v51_0" xmlns:univ="http://www.travelport.com/schema/universal_v52_0" xmlns:air="http://www.travelport.com/schema/air_v52_0">
            <BillingPointOfSaleInfo OriginApplication="UAPI" xmlns="http://www.travelport.com/schema/common_v51_0"/>
                ${xmlBodyDataFormat}
                </air:SeatMapReq>
        </soapenv:Body>
        </soapenv:Envelope>`;

            // clean up the XML request string
            xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            // send the XML request and store the response in the xmlResponses array
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/AirPriceReq.xml`, xmlRequest);
                fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/AirPriceRes.xml`, 'utf-8');
            } else {
                const promise = this.httpService.post(TRAVELPORT_API_URL, xmlRequest, { headers: TRAVELPORT_HEADERS }).toPromise().then(response => {
                    xmlResponses.push(response);
                    if (this.isLogXml) {
                        fs.writeFileSync(`${logStoragePath}/flights/travelport/seatAvailabiltyReq(${Origin}-${Destination}).xml`, xmlRequest);
                        fs.writeFileSync(`${logStoragePath}/flights/travelport/seatAvailabiltyRes(${Origin}-${Destination}).xml`, response);
                    }
                });
                promises.push(promise);
            }
        }

        // wait for all the promises to resolve and return the xmlResponses array
        let xmlresponse = await Promise.all(promises).then(() => xmlResponses);

        let jsonResponse = []
        console.log("xmlresponse-",xmlresponse);
        xmlresponse.map(async (data: any) => {
            jsonResponse.push(this.xmlToJson2(data));

        })
        console.log("jsonResponse-",jsonResponse);
        // let jsonFinalResponse = await this.travelportTransformService.seatAvailabilityDataFormat(jsonResponse);

        // return jsonFinalResponse;
    }

    async ssrDetails(body: any): Promise<any> {
        const data = await this.getGraphData(
            `query {
                    flightSsrDetails(
                        take: 500
                    ) {
                        id
                        booking_source_fk,
                        type,
                        code,
                        description,
                        domestic,
                        international
                    }
                }
                `,
            "flightSsrDetails"
        );
        return data;
    }

    // async commitBooking(body: any): Promise<any> {

    //     const flightBookings = await this.getGraphData(`query{flightBookings(where:{app_reference:{eq:"${body['AppReference']}"}}){app_reference}}`, 'flightBookings');
    //     if (flightBookings.length) {
    //         return { result: [], message: 'AppReference already exist!' };
    //     }
    //     const fareQuoteData = await this.redisServerService.read_list(body['ResultToken']);
    //     const LeadPax = body['Passengers'].find((t) => t.IsLeadPax) || {};
    //     const fareQuoteDataParsed = JSON.parse(fareQuoteData[0]);
    //     body['BookingTravelerRefObj'] = getPropValueOrEmpty(fareQuoteDataParsed, 'BookingTravelerRefObj');
    //     let Exchange_Price = {};
    //     if (fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price']) {
    //         Exchange_Price = fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price'];
    //     } else {
    //         Exchange_Price = fareQuoteDataParsed['JourneyList'][0][0]['Price'];
    //     }
    //     const Price = fareQuoteDataParsed['JourneyList'][0][0]['Price'];
    //     const JourneyList = fareQuoteDataParsed['JourneyList'];
    //     const flight_booking_transactions = [];
    //     const CabinClass = getPropValue(fareQuoteDataParsed['SearchData']['Segments'][0], 'CabinClass') || getPropValue(fareQuoteDataParsed['SearchData']['Segments'][0], 'CabinClassOnward');
    //     const flightDetail = {
    //         domain_origin: "travelport",
    //         booking_from: body["BookingFrom"],
    //         app_reference: body['AppReference'],
    //         booking_source: body['BookingSource'],
    //         api_code: body['booking_source'],
    //         subagent_id: body["subagent_id"],
    //         trip_type: fareQuoteDataParsed['SearchData']['JourneyType'],
    //         phone_code: LeadPax['PhoneCode'],
    //         phone: LeadPax['ContactNo'],
    //         alternate_number: LeadPax['ContactNo'],
    //         email: LeadPax['Email'] || LeadPax['email'],
    //         journey_start:
    //             fareQuoteDataParsed['SearchData']['Segments'][0]['DepartureDate'],
    //         journey_end:
    //             fareQuoteDataParsed['SearchData']['Segments'][
    //             fareQuoteDataParsed['SearchData']['Segments'].length - 1
    //             ]['DepartureDate'],
    //         journey_from: fareQuoteDataParsed['SearchData']['Segments'][0]['Origin'],
    //         journey_to:
    //             fareQuoteDataParsed['SearchData']['Segments'][
    //             fareQuoteDataParsed['SearchData']['Segments'].length - 1
    //             ]['Destination'],
    //         from_loc: '',
    //         to_loc: '',
    //         cabin_class: CabinClass,
    //         is_lcc: 0,
    //         payment_mode: "online",
    //         convinence_value: 0,
    //         convinence_value_type: "plus",
    //         convinence_per_pax: 0,
    //         convinence_amount: 0,
    //         discount: 0,
    //         promo_code: '',
    //         currency: Price['Currency'],
    //         currency_conversion_rate: 1,
    //         version: 1,
    //         attributes: body["Remark"] || " ",
    //         gst_details: '',
    //         created_by_id: body['UserId'],
    //         booking_status: "BOOKING_INPROGRESS",
    //         BookingTravelerRefObj: JSON.stringify(body['BookingTravelerRefObj'])
    //     };

    //     // for (let i = 0; i < JourneyList.length; i++) {
    //     // for (let j = 0; j < JourneyListTemp.length; j++) {
    //     const flight_booking_transaction_data = {
    //         app_reference: body['AppReference'],
    //         pnr: '',
    //         // status: "BOOKING_INPROGRESS",
    //         status_description: '',
    //         gds_pnr: '',
    //         source: '',
    //         ref_id: '',
    //         total_fare: Price["TotalDisplayFare"],
    //         admin_commission: (Price['PriceBreakup']["CommissionDetails"]['AdminCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AdminCommission'] : 0,
    //         agent_commission: (Price['PriceBreakup']["CommissionDetails"]['AgentCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AgentCommission'] : 0,
    //         admin_tds: 0,
    //         agent_tds: 0,
    //         admin_markup: (Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup'] : 0,
    //         agent_markup: (Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup'] : 0,
    //         currency: Price['Currency'],
    //         getbooking_StatusCode: '',
    //         getbooking_Description: '',
    //         getbooking_Category: '',
    //         attributes: JSON.stringify(Price).replace(/'/g, '"'),
    //         sequence_number: "0",
    //         hold_ticket_req_status: "0",
    //         created_by_id: body['UserId'] ? body['UserId'] : 0,
    //     };
    //     const passengersArray = [];
    //     // const PassengersTemp = body['Passengers'];
    //     const itineraries = [];
    //     let PassengerContactDetails = {};
    //     const PassengersTemp = body['Passengers'].map(p => ({ ...p, PaxTypeSort: p.PaxType == 2 ? 3 : p.PaxType == 3 ? 2 : 1 }));
    //     const Passengers = PassengersTemp.sort((a, b) => a.PaxTypeSort - b.PaxTypeSort);
    //     for (let m = 0; m < Passengers.length; m++) {
    //         if (!moment(Passengers[m]['DateOfBirth']).isValid() || (Passengers[m]['PassportExpiryDate'] != "" && !moment(Passengers[m]['PassportExpiryDate']).isValid())) {
    //             throw new BadRequestException('DateOfBirth or PassportExpiryDate is Invalid Date');
    //         }
    //         if (Passengers[m]['IsLeadPax'] == 1) {
    //             PassengerContactDetails = {
    //                 Email: Passengers[m]['Email'],
    //                 Phone: Passengers[m]['ContactNo'],
    //                 PhoneExtension: LeadPax['PhoneCode']
    //             }
    //         };
    //         // const PassengeTypeByDOB: any = this.getPassengeTypeByDOB(Passengers[m]['DateOfBirth']);
    //         // const PassengerType = PassengeTypeByDOB['text'];
    //         const PassengerType = Passengers[m]['PaxType'] == 1 ? 'Adult' : Passengers[m]['PaxType'] == 2 ? 'Child' : 'Infant';
    //         const GenderType = ['Mr', 'Mstr'].includes(Passengers[m]['Title']) ? 'Male' : 'Female';
    //         if (!['Mr', 'Ms', 'Mrs', 'Mstr', 'Miss'].includes(Passengers[m]['Title'])) {
    //             throw new BadRequestException('Title is invalid');
    //         }
    //         // let Title = 'Mr';
    //         // if (GenderType == 'Male') {
    //         //     if (PassengeTypeByDOB.id > 1) {
    //         //         Title = 'Mstr';
    //         //     }
    //         // } else {
    //         //     if (PassengeTypeByDOB.id > 1) {
    //         //         Title = 'Miss';
    //         //     } else {
    //         //         Title = 'Ms';
    //         //     }
    //         // }
    //         let full_name = '';
    //         if (Passengers[m]['MiddleName'] != '') {
    //             full_name = Passengers[m]['FirstName'] + " " + Passengers[m]['MiddleName'];
    //         } else {
    //             full_name = Passengers[m]['FirstName'];
    //         }
    //         const passenger = {
    //             app_reference: body['AppReference'],
    //             passenger_type: PassengerType,
    //             is_lead: Passengers[m]['IsLeadPax'],
    //             title: Passengers[m]['Title'],
    //             first_name: Passengers[m]['FirstName'],
    //             middle_name: Passengers[m]['MiddleName'] || '',
    //             last_name: Passengers[m]['LastName'],
    //             date_of_birth: Passengers[m]['DateOfBirth'],
    //             gender: GenderType,
    //             passenger_nationality: Passengers[m]['CountryCode'],
    //             passport_number: Passengers[m]['PassportNumber'] || '',
    //             passport_issuing_country: Passengers[m]['PassportIssuingCountry'] || '',
    //             passport_expiry_date: Passengers[m]['PassportExpiryDate'],
    //             full_name,
    //             // status: "BOOKING_INPROGRESS",
    //             attributes: "[]",
    //         };

    //         passengersArray.push(passenger);

    //         Passengers[m]['PaxType'] = PassengerType;
    //         Passengers[m]['Gender'] = GenderType;
    //         // allPassengers.push(Passengers[m]);

    //     }
    //     for (let k = 0; k < JourneyList[0][0]['FlightDetails']['Details'].length; k++) {
    //         const FlightDetails = JourneyList[0][0]['FlightDetails']['Details'][k];

    //         for (let l = 0; l < FlightDetails.length; l++) {
    //             let att = {
    //                 Duration: FlightDetails[l]['Duration']
    //             };
    //             const itinerary = {
    //                 app_reference: body['AppReference'],
    //                 airline_pnr: '',
    //                 segment_indicator: 0,
    //                 airline_code: FlightDetails[l]['OperatorCode'],
    //                 airline_name: FlightDetails[l]['OperatorName'],
    //                 flight_number: FlightDetails[l]['FlightNumber'],
    //                 fare_class: Price['PriceBreakup']['RBD'],
    //                 from_airport_code: FlightDetails[l]['Origin']['AirportCode'],
    //                 from_airport_name: FlightDetails[l]['Origin']['AirportName'],
    //                 to_airport_code: FlightDetails[l]['Destination']['AirportCode'],
    //                 to_airport_name: FlightDetails[l]['Destination']['AirportName'],
    //                 departure_datetime: FlightDetails[l]['Origin']['DateTime'],
    //                 arrival_datetime: FlightDetails[l]['Destination']['DateTime'],
    //                 cabin_baggage: FlightDetails[l]['Attr']['CabinBaggage'],
    //                 checkin_baggage: FlightDetails[l]['Attr']['Baggage'],
    //                 is_refundable: '0',
    //                 equipment: FlightDetails[l]['Equipment'],
    //                 // status: '',
    //                 operating_carrier: FlightDetails[l]['OperatorCode'], FareRestriction: 0,
    //                 FareBasisCode: 0,
    //                 FareRuleDetail: 0,
    //                 attributes: JSON.stringify(att),
    //                 departure_terminal: FlightDetails[l]['Origin']['Terminal'],
    //                 arrival_terminal: FlightDetails[l]['Destination']['Terminal'],
    //             };
    //             itineraries.push(itinerary);
    //         }
    //     }
    //     // }
    //     // }

    //     const booking = {
    //         ...flightDetail,
    //         flightBookingTransactions: [
    //             {
    //                 ...flight_booking_transaction_data,
    //                 flightBookingTransactionItineraries: itineraries,
    //                 flightBookingTransactionPassengers: passengersArray,
    //             },
    //         ],
    //     };

    //     const flight_booking_itineraries = await this.setGraphData(
    //         'FlightBookings',
    //         booking
    //     );

    //     const allPassengers = await this.getGraphData(`
    //         query {
    //             flightBookingTransactionPassengers(
    //                 where: {
    //                     app_reference: {
    //                         eq: "${body['AppReference']}"
    //                     }
    //                 }
    //             ) {
    //                 PassengerId: id,
    //                 PassengerType: passenger_type,
    //                 Title: title,
    //                 FirstName: first_name,
    //                 MiddleName: middle_name,
    //                 LastName: last_name,
    //                 DateOfBirth: date_of_birth,
    //                 Gender: gender,
    //                 PassportNumber: passport_number,
    //                 PassportIssuingCountry: passport_issuing_country,
    //                 PassportExpiryDate: passport_expiry_date
    //             }
    //         }
    //     `, 'flightBookingTransactionPassengers');

    //     const flightDetails = [];
    //     const seatFormatData = [];
    //     let totalSeatPrice: any = 0;
    //     for (const transaction of booking.flightBookingTransactions) {
    //         for (const itinerary of transaction.flightBookingTransactionItineraries) {
    //             const flight = {
    //                 from_airport_code: itinerary.from_airport_code,
    //                 to_airport_code: itinerary.to_airport_code,
    //                 airline_code: itinerary.airline_code,
    //                 flight_number: itinerary.flight_number,
    //             };
    //             flightDetails.push(flight);
    //         }
    //     }

    //     await Promise.all(Passengers.map(async (passenger: any, ind: any) => {
    //         const seatResultToken = passenger.SeatId;
    //         if (seatResultToken.length > 0) {
    //             await Promise.all(seatResultToken.map(async (token: any, index: any) => {
    //                 if (token === null) {
    //                     // Skip processing if the token is null
    //                     return;
    //                 }
    //                 const FlightSeatData = await this.redisServerService.read_list(token);
    //                 const FlightSeatDataParsed = JSON.parse(FlightSeatData[0]);

    //                 const passengerId = allPassengers[ind].PassengerId;

    //                 const seatCharge = parseFloat(FlightSeatDataParsed.SeatCharge) || 0;
    //                 totalSeatPrice += seatCharge;

    //                 const result = {
    //                     ...flightDetails[index],
    //                     flight_booking_passenger_id: passengerId,
    //                     type: FlightSeatDataParsed.Type,
    //                     code: FlightSeatDataParsed.SeatCode,
    //                     price: FlightSeatDataParsed.SeatCharge ?? 0,
    //                     description: fareQuoteDataParsed.KeyData.key.Air_segment_key_list[index],
    //                     created_by_id: body['UserId'] ? body['UserId'] : 0,
    //                 };
    //                 seatFormatData.push(result);
    //             }));
    //         }
    //     }));

    //     let seatData: any;
    //     if (seatFormatData.length > 0) {
    //         seatData = await Promise.all(seatFormatData.map(async (data) => {
    //             const mutation = `
    //             mutation {
    //                 createFlightBookingSeat(flightBookingSeat: {
    //                     flight_booking_passenger_id: "${data.flight_booking_passenger_id}"
    //                     from_airport_code: "${data.from_airport_code}"
    //                     to_airport_code: "${data.to_airport_code}"
    //                     airline_code: "${data.airline_code}"
    //                     flight_number: "${data.flight_number}"
    //                     description: "${data.description}",
    //                     price: "${data.price}"
    //                     code: "${data.code}"
    //                     type: "${data.type}"
    //                     created_by_id: ${data.created_by_id}
    //                 }) {
    //                     id
    //                     status
    //                     flight_booking_passenger_id
    //                     from_airport_code
    //                     to_airport_code
    //                     airline_code
    //                     flight_number
    //                     description
    //                     price
    //                     code
    //                     type
    //                     created_by_id
    //                     created_at
    //                 }
    //             }
    //         `;
    //             const result = await this.getGraphData(mutation, 'createFlightBookingSeat');
    //             return result;
    //         }));
    //     }

    //     const result = {
    //         CommitBooking: {
    //             BookingDetails: {
    //                 BookingId: '',
    //                 PNR: '',
    //                 GDSPNR: '',
    //                 PassengerContactDetails,
    //                 PassengerDetails: allPassengers.map((passenger: any) => {
    //                     const matchingSeats = seatData ? seatData.filter((seat: any) => seat.flight_booking_passenger_id === String(passenger.PassengerId)) : [];
    //                     const SeatInfo = matchingSeats.map((matchingSeat: any) => ({
    //                         FromAirportCode: matchingSeat.from_airport_code,
    //                         ToAirportCode: matchingSeat.to_airport_code,
    //                         AirlineCode: matchingSeat.airline_code,
    //                         FlightNumber: matchingSeat.flight_number,
    //                         Code: matchingSeat.code
    //                     }));
    //                     return {
    //                         ...passenger,
    //                         SeatInfo
    //                     };
    //                 }),
    //                 JourneyList: {
    //                     FlightDetails: fareQuoteDataParsed['FlightInfo']['FlightDetails'],
    //                 },
    //                 Price: { ...Price, TotalSeatPrice: parseFloat(totalSeatPrice.toFixed(2)) },
    //                 Attr: '',
    //                 ResultToken: body['ResultToken'],
    //                 AppReference: body['AppReference'],
    //                 booking_source: TRAVELPORT_FLIGHT_BOOKING_SOURCE
    //             },
    //         },
    //     };

    //     return { result, message: '' };
    // }

    async commitBooking(body: any): Promise<any> {

        const flightBookings = await this.getGraphData(`query{flightBookings(where:{app_reference:{eq:"${body['AppReference']}"}}){app_reference}}`, 'flightBookings');
        if (flightBookings.length) {
            return { result: [], message: 'AppReference already exist!' };
        }
        const fareQuoteData = await this.redisServerService.read_list(body['ResultToken']);
        const LeadPax = body['Passengers'].find((t) => t.IsLeadPax) || {};
        const fareQuoteDataParsed = JSON.parse(fareQuoteData[0]);
        console.log("fareQuoteDataParsed:",fareQuoteDataParsed)
        body['BookingTravelerRefObj'] = getPropValueOrEmpty(fareQuoteDataParsed, 'BookingTravelerRefObj');
        let Exchange_Price = {};
        if (fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price']) {
            Exchange_Price = fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price'];
            fareQuoteDataParsed['JourneyList'][0][0]['Price'] = Exchange_Price;
        } else {
            Exchange_Price = fareQuoteDataParsed['JourneyList'][0][0]['Price'];
        }
        
        const Price = fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price'];
        const JourneyList = fareQuoteDataParsed['JourneyList'];
        const flight_booking_transactions = [];
        const CabinClass = getPropValue(fareQuoteDataParsed['SearchData']['Segments'][0], 'CabinClass') || getPropValue(fareQuoteDataParsed['SearchData']['Segments'][0], 'CabinClassOnward');
        let discountValue=0;
        const bodyPromoCode=body.PromoCode;

        const currencyDetails = Price['Currency'] !== "GBP" ? await this.formatPriceDetailToSelectedCurrency(Price['Currency']) : { value: 1, currency: "GBP" };

        if(bodyPromoCode != undefined || bodyPromoCode!=''){
            let promoCodeDetails=await this.commonService.getPromoCodeInfo({promocode:bodyPromoCode});
            promoCodeDetails=promoCodeDetails[0];
            if (promoCodeDetails && promoCodeDetails != "") {
                if (promoCodeDetails.discount_type == "percentage") {
                    let amount: number
                    amount = (promoCodeDetails.discount_value / 100);
                    discountValue = Price.TotalDisplayFare * amount;
                }
                if (promoCodeDetails.discount_type == "plus") {

                    discountValue = Number((promoCodeDetails.discount_value * currencyDetails.value).toFixed(2));
                }
            }
            else {
                discountValue = 0;
            }
        }

        const flightDetail = {
            domain_origin: "travelport",
            booking_from: body["BookingFrom"],
            app_reference: body['AppReference'],
            booking_source: body['BookingSource'],
            api_code: body['booking_source'],
            subagent_id: body["subagent_id"],
            trip_type: fareQuoteDataParsed['SearchData']['JourneyType'],
            phone_code: LeadPax['PhoneCode'],
            phone: LeadPax['ContactNo'],
            alternate_number: LeadPax['ContactNo'],
            email: LeadPax['Email'] || LeadPax['email'],
            journey_start:
                fareQuoteDataParsed['SearchData']['Segments'][0]['DepartureDate'],
            journey_end:
                fareQuoteDataParsed['SearchData']['Segments'][
                fareQuoteDataParsed['SearchData']['Segments'].length - 1
                ]['DepartureDate'],
            journey_from: fareQuoteDataParsed['SearchData']['Segments'][0]['Origin'],
            journey_to:
                fareQuoteDataParsed['SearchData']['Segments'][
                fareQuoteDataParsed['SearchData']['Segments'].length - 1
                ]['Destination'],
            from_loc: '',
            to_loc: '',
            cabin_class: CabinClass,
            is_lcc: 0,
            payment_mode: "online",
            convinence_value: 0,
            convinence_value_type: "plus",
            convinence_per_pax: 0,
            convinence_amount: `${Price.ConvinenceFee}`,
            discount: `${discountValue}`,
            promo_code: '',
            currency: Price['Currency'],
            currency_conversion_rate: 1,
            version: 1,
            attributes: body["Remark"] || " ",
            gst_details: '',
            created_by_id: body['UserId'],
            booking_status: "BOOKING_INPROGRESS",
            BookingTravelerRefObj: JSON.stringify(body['BookingTravelerRefObj'])
        };

        // for (let i = 0; i < JourneyList.length; i++) {
        // for (let j = 0; j < JourneyListTemp.length; j++) {
        const flight_booking_transaction_data = {
            app_reference: body['AppReference'],
            pnr: '',
            // status: "BOOKING_INPROGRESS",
            status_description: '',
            gds_pnr: '',
            source: '',
            ref_id: '',
            total_fare: Price["TotalDisplayFare"],
            admin_commission: (Price['PriceBreakup']["CommissionDetails"]['AdminCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AdminCommission'] : 0,
            agent_commission: (Price['PriceBreakup']["CommissionDetails"]['AgentCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AgentCommission'] : 0,
            admin_tds: 0,
            agent_tds: 0,
            admin_markup: (Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup'] : 0,
            agent_markup: (Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup'] : 0,
            currency: Price['Currency'],
            getbooking_StatusCode: '',
            getbooking_Description: '',
            getbooking_Category: '',
            attributes: JSON.stringify(Price).replace(/'/g, '"'),
            sequence_number: "0",
            hold_ticket_req_status: "0",
            created_by_id: body['UserId'] ? body['UserId'] : 0,
        };
        const passengersArray = [];
        // const PassengersTemp = body['Passengers'];
        const itineraries = [];
        let PassengerContactDetails = {};
        const PassengersTemp = body['Passengers'].map(p => ({ ...p, PaxTypeSort: p.PaxType == 2 ? 3 : p.PaxType == 3 ? 2 : 1 }));
        const Passengers = PassengersTemp.sort((a, b) => a.PaxTypeSort - b.PaxTypeSort);
        for (let m = 0; m < Passengers.length; m++) {
            if (!moment(Passengers[m]['DateOfBirth']).isValid() || (Passengers[m]['PassportExpiryDate'] != "" && !moment(Passengers[m]['PassportExpiryDate']).isValid())) {
                throw new BadRequestException('DateOfBirth or PassportExpiryDate is Invalid Date');
            }
            if (Passengers[m]['IsLeadPax'] == 1) {
                PassengerContactDetails = {
                    Email: Passengers[m]['Email'],
                    Phone: Passengers[m]['ContactNo'],
                    PhoneExtension: LeadPax['PhoneCode']
                }
            };
            // const PassengeTypeByDOB: any = this.getPassengeTypeByDOB(Passengers[m]['DateOfBirth']);
            // const PassengerType = PassengeTypeByDOB['text'];
            const PassengerType = Passengers[m]['PaxType'] == 1 ? 'Adult' : Passengers[m]['PaxType'] == 2 ? 'Child' : 'Infant';
            const GenderType = ['Mr', 'Mstr'].includes(Passengers[m]['Title']) ? 'Male' : 'Female';
            if (!['Mr', 'Ms', 'Mrs', 'Mstr', 'Miss'].includes(Passengers[m]['Title'])) {
                throw new BadRequestException('Title is invalid');
            }
            // let Title = 'Mr';
            // if (GenderType == 'Male') {
            //     if (PassengeTypeByDOB.id > 1) {
            //         Title = 'Mstr';
            //     }
            // } else {
            //     if (PassengeTypeByDOB.id > 1) {
            //         Title = 'Miss';
            //     } else {
            //         Title = 'Ms';
            //     }
            // }
            let full_name = '';
            if (Passengers[m]['MiddleName'] != '') {
                full_name = Passengers[m]['FirstName'] + " " + Passengers[m]['MiddleName'];
            } else {
                full_name = Passengers[m]['FirstName'];
            }
            const passenger = {
                app_reference: body['AppReference'],
                passenger_type: PassengerType,
                is_lead: Passengers[m]['IsLeadPax'],
                title: Passengers[m]['Title'],
                first_name: Passengers[m]['FirstName'],
                middle_name: Passengers[m]['MiddleName'] || '',
                last_name: Passengers[m]['LastName'],
                date_of_birth: Passengers[m]['DateOfBirth'],
                gender: GenderType,
                passenger_nationality: Passengers[m]['CountryCode'],
                passport_number: Passengers[m]['PassportNumber'] || '',
                passport_issuing_country: Passengers[m]['PassportIssuingCountry'] || '',
                passport_expiry_date: Passengers[m]['PassportExpiryDate'],
                full_name,
                // status: "BOOKING_INPROGRESS",
                attributes: "[]",
            };

            passengersArray.push(passenger);

            Passengers[m]['PaxType'] = PassengerType;
            Passengers[m]['Gender'] = GenderType;
            // allPassengers.push(Passengers[m]);

        }
        for (let k = 0; k < JourneyList[0][0]['FlightDetails']['Details'].length; k++) {
            const FlightDetails = JourneyList[0][0]['FlightDetails']['Details'][k];

            for (let l = 0; l < FlightDetails.length; l++) {
                let att = {
                    Duration: FlightDetails[l]['Duration']
                };
                const itinerary = {
                    app_reference: body['AppReference'],
                    airline_pnr: '',
                    segment_indicator: 0,
                    airline_code: FlightDetails[l]['OperatorCode'],
                    airline_name: FlightDetails[l]['OperatorName'],
                    flight_number: FlightDetails[l]['FlightNumber'],
                    fare_class: Price['PriceBreakup']['RBD'],
                    from_airport_code: FlightDetails[l]['Origin']['AirportCode'],
                    from_airport_name: FlightDetails[l]['Origin']['AirportName'],
                    to_airport_code: FlightDetails[l]['Destination']['AirportCode'],
                    to_airport_name: FlightDetails[l]['Destination']['AirportName'],
                    departure_datetime: FlightDetails[l]['Origin']['DateTime'],
                    arrival_datetime: FlightDetails[l]['Destination']['DateTime'],
                    cabin_baggage: FlightDetails[l]['Attr']['CabinBaggage'],
                    checkin_baggage: FlightDetails[l]['Attr']['Baggage'],
                    is_refundable: '0',
                    equipment: FlightDetails[l]['Equipment'],
                    // status: '',
                    operating_carrier: FlightDetails[l]['OperatorCode'], FareRestriction: 0,
                    FareBasisCode: 0,
                    FareRuleDetail: 0,
                    attributes: JSON.stringify(att),
                    departure_terminal: FlightDetails[l]['Origin']['Terminal'],
                    arrival_terminal: FlightDetails[l]['Destination']['Terminal'],
                };
                itineraries.push(itinerary);
            }
        }
        // }
        // }

        const booking = {
            ...flightDetail,
            flightBookingTransactions: [
                {
                    ...flight_booking_transaction_data,
                    flightBookingTransactionItineraries: itineraries,
                    flightBookingTransactionPassengers: passengersArray,
                },
            ],
        };

        const flight_booking_itineraries = await this.setGraphData(
            'FlightBookings',
            booking
        );
        const flightBookingTransactions = await this.getGraphData(`
        query {
            flightBookingTransactions(
                where: {
                    app_reference: {
                        eq: "${body['AppReference']}"
                    }
                }
            ) {
               id,
               app_reference
               
            }
        }
    `, 'flightBookingTransactions');
        let totalSeatPrice: any = 0;
        let totalBaggagePrice: any = 0;
        let totalMealPrice: any = 0;

        const allPassengers = await this.getGraphData(`
            query {
                flightBookingTransactionPassengers(
                    where: {
                        app_reference: {
                            eq: "${body['AppReference']}"
                        }
                    }
                ) {
                    PassengerId: id,
                    PassengerType: passenger_type,
                    Title: title,
                    FirstName: first_name,
                    MiddleName: middle_name,
                    LastName: last_name,
                    DateOfBirth: date_of_birth,
                    Gender: gender,
                    PassportNumber: passport_number,
                    PassportIssuingCountry: passport_issuing_country,
                    PassportExpiryDate: passport_expiry_date,
                    Nationality: passenger_nationality
                }
            }
        `, 'flightBookingTransactionPassengers');
        // let totalSeatPrice: any = 0;
        let updateTotalPrice = Price.TotalDisplayFare + totalSeatPrice + totalBaggagePrice + totalMealPrice - discountValue;
        let updateAgentTotalPrice = Price.AgentNetFare + totalSeatPrice + totalBaggagePrice + totalMealPrice;
            
            // if (fareQuoteDataParsed.SearchData.UserType === 'B2C') {
            //   updateTotalPrice += Price.ConvinenceFee;
            //   updateAgentTotalPrice += Price.ConvinenceFee;
            // }
            if (body.BookingSource === 'B2C') {
                updateTotalPrice += Price.ConvinenceFee;
                updateAgentTotalPrice += Price.ConvinenceFee;
            }
        fareQuoteDataParsed.FlightInfo.Exchange_Price.TotalDisplayFare = parseFloat((updateTotalPrice).toFixed(2));
        fareQuoteDataParsed.FlightInfo.Exchange_Price.AgentNetFare = parseFloat((updateAgentTotalPrice).toFixed(2));
        Price.TotalDisplayFare = parseFloat((updateTotalPrice).toFixed(2))
        
        console.log(flightBookingTransactions[0])
        await this.getGraphData(
            `mutation {
                updateFlightBookingTransaction(id:${flightBookingTransactions[0].id},flightBookingTransactionPartial:{
                  total_fare: "${updateTotalPrice}",
                    attributes :"${JSON.stringify(fareQuoteDataParsed.FlightInfo.Exchange_Price).replace(/"/g, "'")}"
                      })
                  }`,
            "updateFlightBookingTransaction"
        );

        const flightDetails = [];
        const seatFormatData = [];
        // let totalSeatPrice: any = 0;
        for (const transaction of booking.flightBookingTransactions) {
            for (const itinerary of transaction.flightBookingTransactionItineraries) {
                const flight = {
                    from_airport_code: itinerary.from_airport_code,
                    to_airport_code: itinerary.to_airport_code,
                    airline_code: itinerary.airline_code,
                    flight_number: itinerary.flight_number,
                };
                flightDetails.push(flight);
            }
        }

        await Promise.all(Passengers.map(async (passenger: any, ind: any) => {
            const seatResultToken = passenger.SeatId;
            if (seatResultToken.length > 0) {
                await Promise.all(seatResultToken.map(async (token: any, index: any) => {
                    if (token === null) {
                        // Skip processing if the token is null
                        return;
                    }
                    const FlightSeatData = await this.redisServerService.read_list(token);
                    const FlightSeatDataParsed = JSON.parse(FlightSeatData[0]);

                    const passengerId = allPassengers[ind].PassengerId;

                    const seatCharge = parseFloat(FlightSeatDataParsed.SeatCharge) || 0;
                    totalSeatPrice += seatCharge;

                    const result = {
                        ...flightDetails[index],
                        flight_booking_passenger_id: passengerId,
                        type: FlightSeatDataParsed.Type,
                        code: FlightSeatDataParsed.SeatCode,
                        price: FlightSeatDataParsed.SeatCharge ?? 0,
                        description: fareQuoteDataParsed.KeyData.key.Air_segment_key_list[index],
                        created_by_id: body['UserId'] ? body['UserId'] : 0,
                    };
                    seatFormatData.push(result);
                }));
            }
        }));

        let seatData: any;
        if (seatFormatData.length > 0) {
            seatData = await Promise.all(seatFormatData.map(async (data) => {
                const mutation = `
                mutation {
                    createFlightBookingSeat(flightBookingSeat: {
                        flight_booking_passenger_id: "${data.flight_booking_passenger_id}"
                        from_airport_code: "${data.from_airport_code}"
                        to_airport_code: "${data.to_airport_code}"
                        airline_code: "${data.airline_code}"
                        flight_number: "${data.flight_number}"
                        description: "${data.description}",
                        price: "${data.price}"
                        code: "${data.code}"
                        type: "${data.type}"
                        created_by_id: ${data.created_by_id}
                    }) {
                        id
                        status
                        flight_booking_passenger_id
                        from_airport_code
                        to_airport_code
                        airline_code
                        flight_number
                        description
                        price
                        code
                        type
                        created_by_id
                        created_at
                    }
                }
            `;
                const result = await this.getGraphData(mutation, 'createFlightBookingSeat');
                return result;
            }));
        }

        const result = {
            CommitBooking: {
                BookingDetails: {
                    BookingId: '',
                    PNR: '',
                    GDSPNR: '',
                    PassengerContactDetails,
                    PassengerDetails: allPassengers.map((passenger: any) => {
                        const matchingSeats = seatData ? seatData.filter((seat: any) => seat.flight_booking_passenger_id === String(passenger.PassengerId)) : [];
                        const SeatInfo = matchingSeats.map((matchingSeat: any) => ({
                            FromAirportCode: matchingSeat.from_airport_code,
                            ToAirportCode: matchingSeat.to_airport_code,
                            AirlineCode: matchingSeat.airline_code,
                            FlightNumber: matchingSeat.flight_number,
                            Code: matchingSeat.code
                        }));
                        return {
                            ...passenger,
                            SeatInfo
                        };
                    }),
                    JourneyList: {
                        FlightDetails: fareQuoteDataParsed['FlightInfo']['FlightDetails'],
                    },
                    Price: { ...Price, TotalSeatPrice: parseFloat(totalSeatPrice.toFixed(2)) },
                    PromoCode: bodyPromoCode ?? "",
                    discount: discountValue,
                    Attr: '',
                    ResultToken: body['ResultToken'],
                    AppReference: body['AppReference'],
                    booking_source: TRAVELPORT_FLIGHT_BOOKING_SOURCE
                },
            },
        };
        // console.log("result.CommitBooking.BookingDetails.Price:",result.CommitBooking.BookingDetails.Price)

        return { result, message: '' };
    }

    async updateLostBaggageProtectionPrice(body) {
        const transactionData = await this.getGraphData(`
        {
            flightBookingTransactions(where:{
              app_reference:{
                eq:"${body.app_reference}"
              }
            }){
              id
              app_reference
              total_fare
              attributes
            }
          }`, `flightBookingTransactions`)
        const passengerData = await this.getGraphData(`{
            flightBookingTransactionPassengers(where:{
              app_reference:{
                eq:"${body.app_reference}"
              }
            }){
                  app_reference
            }
          }`, `flightBookingTransactionPassengers`)
        if (transactionData) {
            const updatedTotalPrice = (parseFloat(transactionData[0]['total_fare']) + (body.baggagePrice * passengerData.length)).toFixed(2)
            //  console.log("updatedTotalPrice",updatedTotalPrice)
            //  console.log("Updated Attributes",transactionData[0].attributes.replace(/'/g, '"'))

            var attributes = JSON.parse(transactionData[0].attributes.replace(/'/g, '"'));
            attributes.TotalDisplayFare = updatedTotalPrice;
            attributes.PriceBreakup.TotalLostBaggageProtection = (body.baggagePrice * passengerData.length) > 0 ? (body.baggagePrice * passengerData.length) : 0
            const updateTransaction = await this.getGraphData(`mutation{
                updateFlightBookingTransaction(flightBookingTransactionPartial:{
                  total_fare: "${updatedTotalPrice}"
                  attributes:"${JSON.stringify(attributes).replace(/"/g, "'")}"
                },id:${transactionData[0]['id']})
              }`, `updateFlightBookingTransaction`);

            if (updateTransaction) {
                let updatedTransactionData = await this.getGraphData(`
                {
                    flightBookingTransactions(where:{
                      app_reference:{
                        eq:"${body.app_reference}"
                      }
                    }){
                      id
                      currency
                      app_reference
                      total_fare
                      attributes
                    }
                  }`, `flightBookingTransactions`)
                updatedTransactionData = { Price: JSON.parse(updatedTransactionData[0].attributes.replace(/'/g, '"')) }
                return updatedTransactionData;
            }
        }
    }

    async reservation(body: any): Promise<any> {

        let jsonResponse:any = [];
        const commitBookingData = await this.redisServerService.read_list(body['ResultToken']);
        const commitBookingDataParsed = JSON.parse(commitBookingData[0]);
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}AirCreateReservationRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);

        } else {
            const flightBookings = await this.getGraphData(
                `query {
                    flightBookings(
                        where: {
                            app_reference: {
                                eq: "${body['AppReference']}"
                            }
                        }
                    ){
                        email
                        phone
                        attributes
                    }
                }
                `, 'flightBookings'
            );

            const flightBookingTransactionPassengers = await this.getGraphData(
                `query {flightBookingTransactionPassengers(where:{
                        app_reference:{eq:"${body['AppReference']}"}
                    }){
                            id
                            app_reference
                            first_name
                            middle_name
                            last_name
                            title
                            gender
                            date_of_birth
                            passenger_type
                            passenger_nationality
                            passport_number
                            passport_issuing_country
                            passport_expiry_date   
                            full_name                         
                }}`,
                'flightBookingTransactionPassengers'
            );
            commitBookingDataParsed['BookingTravelerRefObj'] = getPropValueOrEmpty(commitBookingDataParsed, 'BookingTravelerRefObj');
            

          
            let AirPricingSolutionTemp =await this.xmlToJson(
                commitBookingDataParsed['KeyData']['key']['price_xml']
            );
            
            // let NewAirPricingSolutionTemp =await this.xmlToJson3(
            //     commitBookingDataParsed['xml']
            // );
           
            // fs.writeFileSync(`${logStoragePath}/flights/travelport/NewAirPricingSolutionTemp.json`, AirPricingSolutionTemp);
       
            AirPricingSolutionTemp = JSON.parse(AirPricingSolutionTemp['root']['$t']);
        //     let  AirPricingSolutionTemp = fs.readFileSync(`${logStoragePath}/flights/travelport/AirPricingSolutionTemp.json`, 'utf-8');
        //    AirPricingSolutionTemp = JSON.parse(AirPricingSolutionTemp)
           
            let AirPricingInfoKey = AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo']['Key']
            let AirPricingTicketingModifiers = ``;
            if (AirPricingInfoKey != "undefined") {
                let airlineCommission = 0;
                // let getAirlineCommission = await this.getAirlineCommission(body['AppReference']);
                // if (getAirlineCommission['value']) {
                //     airlineCommission = getAirlineCommission['value'];
                // }
                let AirPricingTicketingModifiers = `<AirPricingTicketingModifiers xmlns="http://www.travelport.com/schema/air_v51_0">
                    <AirPricingInfoRef Key="${AirPricingInfoKey}" />
                                <TicketingModifiers>
                                <Commission xmlns="http://www.travelport.com/schema/common_v51_0" Level="Fare" Type="PercentBase" Percentage="${airlineCommission}" />
                                </TicketingModifiers>
                            </AirPricingTicketingModifiers>`;
            }

            delete AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][
                'FareCalc'
            ];
            const SearchData = commitBookingDataParsed['SearchData'];
            // AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo']['PassengerType'] = [];
            const PassengerTypeArray = {};
            let ADT_INC = 0;
            let CNN_INC = 0;
            let INF_INC = 0;
            let passengerData = '';
            const air_line_pcode = commitBookingDataParsed['FlightInfo']['FlightDetails']['Details'][0][0]['OperatorCode'];
            let address = `<Address>
                            <AddressName>Provab</AddressName>
                            <Street>Hosur Road; 130</Street>
                            <City>Bangalore</City>
                            <State>Karnataka</State>
                            <PostalCode>1215</PostalCode>
                            <Country>IN</Country>
                            </Address>`;
            for (let i = 0; i < flightBookingTransactionPassengers.length; i++) {
                const P = flightBookingTransactionPassengers[i];
                let gender = P['gender'] == "Male" ? "M" : "F";
                let TravelerType = '';
                // const KEY_UUID = Buffer.from(Math.floor(Math.random() * (999 - 100 + 1) + 100) + '' + Date.now()).toString('base64');
                let KEY_UUID = '';
                let genderI = '';
                let SSR_DOCS = '';
                let NameRemark = '';
                const dob_inf = moment(P['date_of_birth']).format('DDMMMYY')/*.toUpperCase()*/;
                const passport_expiry_date = moment(P['passport_expiry_date']).format('DDMMMYY')/*.toUpperCase()*/;

                const Age = ('' + this.getPassengeTypeByDOB(P['date_of_birth']).age).padStart(2, '0');
           
                if (P['passenger_type'] == "Adult") {
                    KEY_UUID = commitBookingDataParsed['BookingTravelerRefObj']['ADT'][ADT_INC];
                    TravelerType = 'ADT';
                    ADT_INC++;
                } else if (P['passenger_type'] == "Child") {
                    KEY_UUID = commitBookingDataParsed['BookingTravelerRefObj']['CHD'][CNN_INC];
                    TravelerType = 'CNN';
                    // NameRemark = '<NameRemark Category="AIR"><RemarkData>P-C10</RemarkData></NameRemark>';
                    NameRemark = `<NameRemark Category="AIR"><RemarkData>${dob_inf}</RemarkData></NameRemark>`;
                    CNN_INC++;
                } else {
                    KEY_UUID = commitBookingDataParsed['BookingTravelerRefObj']['INF'][INF_INC];
                    TravelerType = 'INF';
                    NameRemark = `<NameRemark Category="AIR"><RemarkData>${dob_inf}</RemarkData></NameRemark>`;
                    genderI = 'I';
                    INF_INC++;
                }
                if (P['passport_number']) {

                    if (air_line_pcode == "BS") {
                        const query = `SELECT * FROM core_countries cc where cc.code="${P['passenger_nationality']}"`;
                        let country = await this.manager.query(query);
                        let tow_country_code = JSON.parse(JSON.stringify(country));
                        if (tow_country_code[0])
                            P['passenger_nationality'] = tow_country_code[0]['two_code'];

                        const query_c = `SELECT * FROM core_countries cc where cc.code="${P['passport_issuing_country']}"`;
                        let country_i = await this.manager.query(query_c);
                        let tow_country_code_i = JSON.parse(JSON.stringify(country_i));
                        if (tow_country_code_i[0])
                            P['passport_issuing_country'] = tow_country_code_i[0]['two_code'];
                    }

                    SSR_DOCS = `<SSR Carrier="${air_line_pcode}" FreeText="P/${P['passenger_nationality']}/${P['passport_number']}/${P['passport_issuing_country']}/${dob_inf}/${gender}${genderI}/${passport_expiry_date}/${P['last_name']}/${P['first_name']}" Status="HK" Type="DOCS"></SSR>`;
                } else {
                    SSR_DOCS = `<SSR Carrier="${air_line_pcode}" FreeText="P////${dob_inf}/${gender}${genderI}//${P['last_name']}/${P['first_name']}" Status="HK" Type="DOCS"></SSR>`;
                }

                if (i) {
                    address = '';
                    if (ProviderCode == 'ACH') {
                        address = '<Address />';
                    }
                }
                if (flightBookingTransactionPassengers.length > 1) {
                    // AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]['PassengerType'] = {};
                    // AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]['PassengerType'] = { Code: TravelerType, BookingTravelerRef: KEY_UUID, Age };
                } else {
                    // AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo']['PassengerType'] = { Code: TravelerType, BookingTravelerRef: KEY_UUID, Age };
                }
                if (PassengerTypeArray[TravelerType]) {
                    PassengerTypeArray[TravelerType].push({ Code: TravelerType, BookingTravelerRef: KEY_UUID, Age:Age });
                } else {
                    PassengerTypeArray[TravelerType] = [];
                    PassengerTypeArray[TravelerType].push({ Code: TravelerType, BookingTravelerRef: KEY_UUID, Age:Age });
                }
                
                if (i == 0) {
                    passengerData += `
                    <BookingTraveler xmlns="${TRAVELPORT_SCHEMA}" Key="${KEY_UUID}" TravelerType="${TravelerType}" DOB="${P['date_of_birth']}" Age="${Age}" Gender="${gender}">
                        <BookingTravelerName Prefix="${P['title']}" First="${P['full_name']}" Last="${P['last_name']}" />
                        
                        <PhoneNumber Number="${flightBookings[0]['phone']}" Type="Mobile" />
                        <Email EmailID="${flightBookings[0]['email']}" Type="P" />
                        <SSR Type="CTCM" Status="HK" FreeText="${flightBookings[0]['phone']}" Carrier="${air_line_pcode}" />
                        <SSR Type="CTCE" Status="HK" FreeText="${flightBookings[0]['email'].replace(/@/g, '//').replace(/_/g, '..')}" Carrier="${air_line_pcode}" />
                        ${SSR_DOCS}
                        ${NameRemark}
                        ${address}
                    </BookingTraveler>`;
                } else {
                    passengerData += `
                    <BookingTraveler xmlns="${TRAVELPORT_SCHEMA}" Key="${KEY_UUID}" TravelerType="${TravelerType}" DOB="${P['date_of_birth']}" Age="${Age}" Gender="${gender}">
                        <BookingTravelerName Prefix="${P['title']}" First="${P['full_name']}" Last="${P['last_name']}" />
                        <SSR Type="CTCM" Status="HK" FreeText="${flightBookings[0]['phone']}" Carrier="${air_line_pcode}" />
                        <SSR Type="CTCE" Status="HK" FreeText="${flightBookings[0]['email'].replace(/@/g, '//').replace(/_/g, '..')}" Carrier="${air_line_pcode}" />
                       
                        ${SSR_DOCS}
                        ${NameRemark}
                        ${address}
                    </BookingTraveler>`;
                }
            }
            AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'] = this.forceObjectToArray(AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo']);
          
            // if (PassengerTypeArray["ADT"]) {
            //     AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][0]['PassengerType'] = PassengerTypeArray["ADT"];
            // }
            // if (PassengerTypeArray["CNN"]) {
            //     if (PassengerTypeArray["INF"]) {
            //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][2]['PassengerType'] = PassengerTypeArray["CNN"];
            //     } else {
            //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][1]['PassengerType'] = PassengerTypeArray["CNN"];
            //     }
            // }
            // if (PassengerTypeArray["INF"]) {
            //     if (PassengerTypeArray["CNN"]) {
            //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][1]['PassengerType'] = PassengerTypeArray["INF"];
            //     } else {
            //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][1]['PassengerType'] = PassengerTypeArray["INF"];
            //     }
            // }

            let CNNIndex = 0;
            let INFIndex = 0;
            if (PassengerTypeArray["ADT"]) {
                AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][0]['PassengerType'] = PassengerTypeArray["ADT"];
            }
            // for (let i = 0; i < AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'].length; i++) {
            //     const passengerTypeCode = AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"]["Code"];
            //     if (passengerTypeCode === "CNN") {
            //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"] = PassengerTypeArray["CNN"][CNNIndex];
            //         CNNIndex++;
            //     } else if (passengerTypeCode === "INF") {
            //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"] = PassengerTypeArray["INF"][INFIndex];
            //         INFIndex++;
            //     }
            // }
            
            console.log("PassengerTypeArray-",PassengerTypeArray);
            console.log("Length-",AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'].length)
            for (let i = 0; i < AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'].length; i++) {
                const passengerTypeCode = AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]['PassengerType'][0]['Code'];
                
                if (passengerTypeCode === "CNN") {
               
                    AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"] = PassengerTypeArray["CNN"];
                }
                else if (passengerTypeCode === "INF") {
                    AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"] = PassengerTypeArray["INF"];
                }
            }

            // AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo']['PassengerType'] = PassengerTypeArray;
            fs.writeFileSync(`${logStoragePath}/flights/travelport/AAirPricingSolutionTemp.json`, JSON.stringify(AirPricingSolutionTemp));
           
            //Request Formating From Json Start
            let AirSegment=``;
            AirPricingSolutionTemp['AirPricingSolution']['AirSegment'].forEach(AirSeg => {
                AirSegment+= `<AirSegment Key="${AirSeg['Key']}" Group="${AirSeg['Group']}" Carrier="${AirSeg['Carrier']}" FlightNumber="${AirSeg['FlightNumber']}" ProviderCode="${AirSeg['ProviderCode']}" Origin="${AirSeg['Origin']}" Destination="${AirSeg['Destination']}" DepartureTime="${AirSeg['DepartureTime']}" ArrivalTime="${AirSeg['ArrivalTime']}" FlightTime="${AirSeg['FlightTime']}" TravelTime="${AirSeg['TravelTime']}" Distance="${AirSeg['Distance']}" ClassOfService="${AirSeg['ClassOfService']}" Equipment="${AirSeg['Equipment']}" ChangeOfPlane="${AirSeg['ChangeOfPlane']}" OptionalServicesIndicator="${AirSeg['OptionalServicesIndicator']}" AvailabilitySource="${AirSeg['AvailabilitySource']}" ParticipantLevel="${AirSeg['ParticipantLevel']}" LinkAvailability="${AirSeg['LinkAvailability']}" PolledAvailabilityOption="${AirSeg['PolledAvailabilityOption']}" AvailabilityDisplayType="${AirSeg['AvailabilityDisplayType']}">`;
                 if(AirSeg['CodeshareInfo']['OperatingCarrier']){
                AirSegment+= `<CodeshareInfo OperatingCarrier="${AirSeg['CodeshareInfo']['OperatingCarrier']}"></CodeshareInfo>`;
                 }
                 let AirAvailInfo_ProviderCode=``;
                 if(AirSeg['AirAvailInfo']['ProviderCode']){
                    AirAvailInfo_ProviderCode = ` ProviderCode="${AirSeg['AirAvailInfo']['ProviderCode']}"`;
                 }

                 let BookingCounts=``;
                 if(AirSeg['AirAvailInfo']['BookingCodeInfo']['BookingCounts']){
                    BookingCounts = `  BookingCounts="${AirSeg['AirAvailInfo']['BookingCodeInfo']['BookingCounts']}"`;
                 }
                AirSegment+= `<AirAvailInfo ${AirAvailInfo_ProviderCode}>
                    <BookingCodeInfo ${BookingCounts}></BookingCodeInfo>
                </AirAvailInfo>
                <FlightDetails Key="${AirSeg['FlightDetails']['Key']}" Origin="${AirSeg['FlightDetails']['Origin']}" Destination="${AirSeg['FlightDetails']['Destination']}" DepartureTime="${AirSeg['FlightDetails']['DepartureTime']}" ArrivalTime="${AirSeg['FlightDetails']['ArrivalTime']}" FlightTime="${AirSeg['FlightDetails']['FlightTime']}" TravelTime="${AirSeg['FlightDetails']['TravelTime']}" Distance="${AirSeg['FlightDetails']['Distance']}"></FlightDetails>
                <Connection/>
            </AirSegment>`;;
              });

              let AirPricing=``;
              AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'].forEach(AirPrice => {
                let EquivalentBasePrice=``;
                if(AirPrice['EquivalentBasePrice']){
                    EquivalentBasePrice=`EquivalentBasePrice="${AirPrice['EquivalentBasePrice']}"`;
                }

                let ApproximateBasePrice=``;
                if(AirPrice['ApproximateBasePrice']){
                    ApproximateBasePrice=`ApproximateBasePrice="${AirPrice['ApproximateBasePrice']}"`;
                }

                let ApproximateTaxes=``;
                if(AirPrice['ApproximateTaxes']){
                    ApproximateTaxes=`ApproximateTaxes="${AirPrice['ApproximateTaxes']}"`;
                }

              
                AirPricing+=`<AirPricingInfo Key="${AirPrice['Key']}" TotalPrice="${AirPrice['TotalPrice']}" BasePrice="${AirPrice['BasePrice']}" ApproximateTotalPrice="${AirPrice['ApproximateTotalPrice']}" ${ApproximateBasePrice} ${EquivalentBasePrice} ${ApproximateTaxes} Taxes="${AirPrice['Taxes']}" LatestTicketingTime="${AirPrice['LatestTicketingTime']}" PricingMethod="${AirPrice['PricingMethod']}" IncludesVAT="${AirPrice['IncludesVAT']}" ETicketability="${AirPrice['ETicketability']}" PlatingCarrier="${AirPrice['PlatingCarrier']}" ProviderCode="${AirPrice['ProviderCode']}">`;
                AirPrice['FareInfo'].forEach(FareInfo => {
                    let NotValidBefore=``;
                    if(FareInfo['NotValidBefore']){
                        NotValidBefore=`NotValidBefore="${FareInfo['NotValidBefore']}"`; 
                    }

                    let NotValidAfter=``;
                    if(FareInfo['NotValidAfter']){
                        NotValidAfter=`NotValidAfter="${FareInfo['NotValidAfter']}"`; 
                    }
               
                    AirPricing+= `<FareInfo Key="${FareInfo['Key']}" FareBasis="${FareInfo['FareBasis']}" PassengerTypeCode="${FareInfo['PassengerTypeCode']}" Origin="${FareInfo['Origin']}" Destination="${FareInfo['Destination']}" EffectiveDate="${FareInfo['EffectiveDate']}" DepartureDate="${FareInfo['DepartureDate']}" Amount="${FareInfo['Amount']}" ${NotValidBefore} ${NotValidAfter}>`;
                    if(FareInfo['FareTicketDesignator']){
                        AirPricing+= `<FareTicketDesignator Value="${FareInfo['FareTicketDesignator']['Value']}" />`;
                    }
                    if(FareInfo['FareRuleKey']){
                     AirPricing+= `<FareRuleKey FareInfoRef="${FareInfo['FareRuleKey']['FareInfoRef']}" ProviderCode="${FareInfo['FareRuleKey']['ProviderCode']}">${FareInfo['FareRuleKey']['$t']}</FareRuleKey>`
                    }
                     AirPricing+= `</FareInfo>`;   
               
                    });
                    
                    AirPrice['BookingInfo'].forEach(BookingInfo => {
                        AirPricing+=`<BookingInfo BookingCode="${BookingInfo['BookingCode']}" CabinClass="${BookingInfo['CabinClass']}" FareInfoRef="${BookingInfo['FareInfoRef']}" SegmentRef="${BookingInfo['SegmentRef']}" HostTokenRef="${BookingInfo['HostTokenRef']}"></BookingInfo>`;  
                });
                if(AirPrice['TaxInfo']){
                AirPrice['TaxInfo'].forEach(TaxInfo => {
                    AirPricing+= `<TaxInfo Category="${TaxInfo['Category']}" Amount="${TaxInfo['Amount']}" Key="${TaxInfo['Key']}" />`;
                });
            }
                if(AirPrice['FareCalc']){
                     AirPricing+= `<FareCalc>${AirPrice['FareCalc']['$t']}</FareCalc>`;
                }
                AirPrice['PassengerType'].forEach(PassengerType => {
                    AirPricing+=`<PassengerType Code="${PassengerType['Code']}" BookingTravelerRef="${PassengerType['BookingTravelerRef']}" Age="${PassengerType['Age']}"></PassengerType>`;
                });
               
                if(AirPrice['ChangePenalty']){    
                AirPricing+=`<ChangePenalty>`;
                    if(AirPrice['ChangePenalty']['Amount']){
						AirPricing+=`<Amount>${AirPrice['ChangePenalty']['Amount']['$t']['$t']}</Amount>`;
                    }
                    if(AirPrice['ChangePenalty']['Percentage']){
						AirPricing+=`<Percentage>${AirPrice['ChangePenalty']['Percentage']['$t']['$t']}</Percentage>`;
                    }
                    
					AirPricing+=`</ChangePenalty>`;
                    }

                    if(AirPrice['CancelPenalty']){    
                        AirPricing+=`<CancelPenalty>`;
                            if(AirPrice['CancelPenalty']['Amount']){
                                AirPricing+=`<Amount>${AirPrice['CancelPenalty']['Amount']['$t']['$t']}</Amount>`;
                            }
                            if(AirPrice['CancelPenalty']['Percentage']){
                                AirPricing+=`<Percentage>${AirPrice['CancelPenalty']['Percentage']['$t']['$t']}</Percentage>`;
                            }
                            
                            AirPricing+=`</CancelPenalty>`;
                            }
					//  AirPricing+=`<CancelPenalty>
					// 	<Amount>${AirPrice['CancelPenalty']['Amount']['$t']['$t']}</Amount>
					// </CancelPenalty>`;
                    
                    if(AirPrice['BaggageAllowances']){   
                AirPricing+=`<BaggageAllowances>`;
                AirPrice['BaggageAllowances']['BaggageAllowanceInfo'].forEach(BaggageAllowanceInfo => {
                    AirPricing+=`<BaggageAllowanceInfo TravelerType="${BaggageAllowanceInfo['TravelerType']}" Origin="${BaggageAllowanceInfo['Origin']}" Destination="${BaggageAllowanceInfo['Destination']}" Carrier="${BaggageAllowanceInfo['Carrier']}">`;
                    
                    if(BaggageAllowanceInfo['URLInfo']){
                    AirPricing+=`<URLInfo>
								<URL>${BaggageAllowanceInfo['URLInfo']['URL']['$t']['$t']}</URL>
							</URLInfo>`;
                    }
                          AirPricing+=`<TextInfo>`;   
                            BaggageAllowanceInfo['TextInfo'].forEach(TextInfo => {
                                AirPricing+=`<Text>${TextInfo['Text']['$t']['$t']}</Text>`;
                            });
                            AirPricing+=`</TextInfo>`;  
                            BaggageAllowanceInfo['BagDetails'].forEach(BagDetails => {
                    AirPricing+=`<BagDetails ApplicableBags="${BagDetails['ApplicableBags']}">
								<BaggageRestriction>
									<TextInfo>
										<Text>${BagDetails['BaggageRestriction']['TextInfo']['Text']['$t']['$t']}</Text>
									</TextInfo>
								</BaggageRestriction>
							</BagDetails>
							`;
                        });
                AirPricing+=`</BaggageAllowanceInfo>`;
                    });
                    if(AirPrice['BaggageAllowances']['CarryOnAllowanceInfo']){
                    AirPrice['BaggageAllowances']['CarryOnAllowanceInfo'].forEach(CarryOnAllowanceInfo => {
            
                        AirPricing+=`<CarryOnAllowanceInfo Origin="${CarryOnAllowanceInfo['Origin']}" Destination="${CarryOnAllowanceInfo['Destination']}" Carrier="${CarryOnAllowanceInfo['Carrier']}">`;
                
                  AirPricing+=`<TextInfo>`;
                CarryOnAllowanceInfo['TextInfo'].forEach(TextInfo => {
                    AirPricing+=`<Text>${TextInfo['Text']['$t']['$t']}</Text>`;
            });
            AirPricing+=`</TextInfo>`;
                CarryOnAllowanceInfo['CarryOnDetails'].forEach(CarryOnDetails => {
					AirPricing+=`<CarryOnDetails ApplicableCarryOnBags="${CarryOnDetails['ApplicableCarryOnBags']}">
								<BaggageRestriction>
                                <TextInfo>
                    <Text>${CarryOnDetails['BaggageRestriction']['TextInfo']['Text']['$t']['$t']}</Text>
                </TextInfo>
                </BaggageRestriction>
			</CarryOnDetails>`;
                              });
                AirPricing+=`</CarryOnAllowanceInfo>`;
                            
                    });
                }
                AirPricing+=`</BaggageAllowances>`;
                    }
                   AirPricing+=` </AirPricingInfo>`;
                });
               

                let HostToken=``;
                

                   
                    for (let index = 0; index < AirPricingSolutionTemp['AirPricingSolution']['HostToken'].length; index++) {
                        const element = AirPricingSolutionTemp['AirPricingSolution']['HostToken'][index];

                        HostToken+=`<HostToken xmlns="${element['xmlns']}" Key="${element['Key']}">${element['$t']}</HostToken>`;
                        
                    }
                    
                    let AirPricingSolution_EquivalentBasePrice=``;
                if(AirPricingSolutionTemp['AirPricingSolution']['EquivalentBasePrice']){
                    AirPricingSolution_EquivalentBasePrice=`EquivalentBasePrice="${AirPricingSolutionTemp['AirPricingSolution']['EquivalentBasePrice']}"`;
                }

                let AirPricingSolution_ApproximateBasePrice='';
                if(AirPricingSolutionTemp['AirPricingSolution']['ApproximateBasePrice']){
                    AirPricingSolution_ApproximateBasePrice=`ApproximateBasePrice="${AirPricingSolutionTemp['AirPricingSolution']['ApproximateBasePrice']}"`;
                }

                let AirPricingSolution_ApproximateTaxes=``;
                if(AirPricingSolutionTemp['AirPricingSolution']['ApproximateTaxes']){
                    AirPricingSolution_ApproximateTaxes=`ApproximateTaxes="${AirPricingSolutionTemp['AirPricingSolution']['ApproximateTaxes']}"`;
                }

                let AirPricingSolutionXml=`<AirPricingSolution xmlns="${AirPricingSolutionTemp['AirPricingSolution']['xmlns']}" Key="${AirPricingSolutionTemp['AirPricingSolution']['Key']}" TotalPrice="${AirPricingSolutionTemp['AirPricingSolution']['TotalPrice']}" BasePrice="${AirPricingSolutionTemp['AirPricingSolution']['BasePrice']}" ApproximateTotalPrice="${AirPricingSolutionTemp['AirPricingSolution']['ApproximateTotalPrice']}" ${AirPricingSolution_ApproximateBasePrice} ${AirPricingSolution_EquivalentBasePrice} Taxes="${AirPricingSolutionTemp['AirPricingSolution']['Taxes']}" ${AirPricingSolution_ApproximateTaxes} QuoteDate="${AirPricingSolutionTemp['AirPricingSolution']['QuoteDate']}">
                ${AirSegment} 
                ${AirPricing}
                ${HostToken}
                </AirPricingSolution>`;

                //Request Formatting From Json End
                
          
            //Old Code Start     

            //     let AirPricingSolution =this.jsonToXml(AirPricingSolutionTemp);

            
            // AirPricingSolution= AirPricingSolution.replace(/<\$t>/g, '');;
            // AirPricingSolution= AirPricingSolution.replace(/<\/\$t>/g, '');;

          
            // /* BOF remove </Connection> */
            // AirPricingSolution = AirPricingSolution.replace(/<\/Connection>/g, '');
            // AirPricingSolution = AirPricingSolution.replace(/<Connection>/g, '<Connection/>');
            // AirPricingSolutionXml = AirPricingSolutionXml.replace(/<Connection\/>/g, '');
            // AirPricingSolutionXml = AirPricingSolutionXml.replace(/<Connection>/g, '<Connection/>');        
            
            /* EOF remove </Connection> */
                    //Old Code End
            /* 
            RetainReservation="None" for live
            RetainReservation="Both" for testing    
            */

            const seatData = await Promise.all(flightBookingTransactionPassengers.map(async (passenger: any) => {
                const query = `SELECT * FROM flight_booking_seats fbs WHERE fbs.flight_booking_passenger_id = '${passenger.id}'`;
                const response = await this.manager.query(query);
                return response.map((seat: any) => ({ ...seat, passenger_type: passenger.passenger_type }));
            }));

            let SpecificSeatAssignment: any = ''; // Initialize SpecificSeatAssignment variable outside the loop

            if (Array.isArray(seatData) && seatData.every(subArray => Array.isArray(subArray) && subArray.length > 0)) {
                let ADT_INC = 0;
                let CNN_INC = 0;
                let INF_INC = 0;
                seatData.forEach((seatArray: any) => {
                    seatArray.forEach((seat: any) => {
                        let KEY_UUID: any;
                        const strSeatNo = seat.code.replace(/-/g, '');
                        const strSegRef = seat.description ? seat.description.replace(/['"]/g, '') : null;

                        if (seat['passenger_type'] == "Adult") {
                            KEY_UUID = commitBookingDataParsed['BookingTravelerRefObj']['ADT'][ADT_INC];
                            ADT_INC++;
                        } else if (seat['passenger_type'] == "Child") {
                            KEY_UUID = commitBookingDataParsed['BookingTravelerRefObj']['CHD'][CNN_INC];
                            CNN_INC++;
                        } else {
                            KEY_UUID = commitBookingDataParsed['BookingTravelerRefObj']['INF'][INF_INC];
                            INF_INC++;
                        }
                        if (strSegRef !== undefined && strSegRef !== null) {
                            SpecificSeatAssignment += `<SpecificSeatAssignment xmlns="http://www.travelport.com/schema/air_v52_0"  SeatId="${strSeatNo}" BookingTravelerRef="${KEY_UUID}" SegmentRef="${strSegRef}" ></SpecificSeatAssignment>`;
                        }
                    });
                });
            }

            const xmlData = `<?xml version="1.0" encoding="utf-8"?>
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Header />
        <s:Body>
        <univ:AirCreateReservationReq xmlns:common_${TRAVELPORT_VERSION}="${TRAVELPORT_SCHEMA}" xmlns:univ="http://www.travelport.com/schema/universal_${TRAVELPORT_VERSION}" AuthorizedBy="${TRAVELPORT_USERNAME}" RetainReservation="None" xmlns="${TRAVELPORT_AIR_URL}" TraceId="${commitBookingDataParsed['BookingTravelerRefObj']['TraceId']}" TargetBranch="${TargetBranch}">
            <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="UAPI"></BillingPointOfSaleInfo>
            ${passengerData}
            <GeneralRemark TypeInGds="Basic" UseProviderNativeMode="false" xmlns="http://www.travelport.com/schema/common_${TRAVELPORT_VERSION}">
            <RemarkData>${flightBookings[0]['attributes']}</RemarkData>
            </GeneralRemark>
            <ContinuityCheckOverride xmlns="http://www.travelport.com/schema/common_${TRAVELPORT_VERSION}" Key="1">pass</ContinuityCheckOverride>
            <FormOfPayment xmlns="${TRAVELPORT_SCHEMA}" Type="Cash"></FormOfPayment>
            ${AirPricingSolutionXml}
            <ActionStatus ProviderCode="${ProviderCode}" TicketDate="T*" Type="ACTIVE" QueueCategory="01" xmlns="${TRAVELPORT_SCHEMA}"></ActionStatus>
            ${SpecificSeatAssignment} 
            ${AirPricingTicketingModifiers}      
            </univ:AirCreateReservationReq>
        </s:Body>
    </s:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
         
            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:AirCreateReservationReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:AirCreateReservationRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post(TRAVELPORT_API_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}AirCreateReservationReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}AirCreateReservationRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);

        let result = '';

        result = await this.travelportTransformService.formatReservationResponse(
            jsonResponse['SOAP:Envelope'],
            body,
            commitBookingDataParsed
        );
        let message = '';

        if (!result) {
            message = 'Booking Failed!';
        } else {

            // let param = {};
            // param['AppReference'] = body['AppReference'];
            // result = await this.pnrRetrieve(param);
        }
        return { result, message };
    }
    async getAirlineCommission(app_reference: any) {

        //  Add airline commission start
        const flightDetails = await this.getGraphData(`query {
            flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
              journey_from
              journey_to
              trip_type
              flightBookingTransactions {
                  flightBookingTransactionItineraries{
                      airline_code
                  }
              }
            }
          }`, 'flightBookings');

        if (!flightDetails[0]['journey_to']) {
            console.log('need to throw error');
        }
        let AirlineCode = '';
        let GdsCommission: any = {};

        AirlineCode = flightDetails[0]['flightBookingTransactions'][0]['flightBookingTransactionItineraries'][0]['airline_code'];
        const flight_id = await this.manager.query(
            `Select id from flight_airlines WHERE code = "${AirlineCode}";`
        );
        const BangladeshAirport = ["DAC", "CGP", "ZYL"];
        const AirlineList = ["SQ", "MU", "CZ"]
        if (!BangladeshAirport.includes(flightDetails[0]['journey_from'])) {
            if (AirlineList.includes(AirlineCode)) {
                return GdsCommission["value"] = 0;
            }
        }
        let FlightId = flight_id[0].id;
        let flight_airline_id: any = '';
        if (FlightId) {
            flight_airline_id = `where:{flight_airline_id:{ in: "${FlightId},0"},user_type:{eq:"API"}}`;
        }
        const gdscommission = await this.getGraphData(`
            query {
              flightGdsCommissions (take:1000,${flight_airline_id}
                  ) {
                  id
                  value
                  value_type
                  segment_list
                  flight_airline_id
                  flightAirline{
                      code
                      name
                  }
              }
            }
        `,
            'flightGdsCommissions');


        if (gdscommission.length > 0) {
            GdsCommission = gdscommission.find(element => element.flightAirline.code === AirlineCode);
            if (!GdsCommission) {
                GdsCommission = gdscommission.find(element => element.flightAirline.code === 'ALL');
            } else {
                if (GdsCommission["segment_list"]) {
                    const segment_list = JSON.parse(GdsCommission["segment_list"].replace(/'/g, '"'));
                    const search_seg = flightDetails[0]['journey_from'] + "-" + flightDetails[0]['journey_to'];
                    if (search_seg in segment_list) {
                        let seg_com = segment_list[search_seg];
                        GdsCommission["value"] = seg_com;
                    }
                }
            }
        }
        //  Add airline commission end
        return GdsCommission
    }
    async void(body: any): Promise<any> {
        let jsonResponse:any = [];
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const flightBookings = await this.getGraphData(`query {
                flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
                  BookingTravelerRefObj
                  UniversalRecordLocatorCode
                  AirReservationLocatorCode
                }
              }`, 'flightBookings');
            if (!flightBookings[0]['UniversalRecordLocatorCode']) {
                console.log('need to throw error');
            }

            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header />
        <soapenv:Body>
            <UniversalRecordRetrieveReq xmlns="${TRAVELPORT_UNIVERSAL_URL}" TraceId="394d96c00971c4545315e49584609ff6" AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}">
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="uAPI" />
                <UniversalRecordLocatorCode>${flightBookings[0]['UniversalRecordLocatorCode']}</UniversalRecordLocatorCode>
            </UniversalRecordRetrieveReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}UniversalRecRetReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}UniversalRecRetRes.xml`, xmlResponse);
            }
            // return xmlResponse;
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);
        let pnr_result = await this.travelportTransformService.formatPnrRetrieveResponse(
            jsonResponse['SOAP:Envelope'],
            body, false
        );
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordVoidRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const flightBookings = await this.getGraphData(`query {
                flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
                  BookingTravelerRefObj
                  UniversalRecordLocatorCode
                  AirReservationLocatorCode
                  flightBookingTransactions{gds_pnr}
                }
              }`, 'flightBookings');
            if (!flightBookings[0]['UniversalRecordLocatorCode']) {
                console.log('need to throw error');
            }
            const flightPassengersDetails = await this.getGraphData(`query {
                flightBookingTransactionPassengers(where:{app_reference:{eq:"${body['AppReference']}"}}){
                    ticket_no
              }
            }`, 'flightBookingTransactionPassengers')
            let ticketInfo = ""
            flightPassengersDetails.forEach(element => {
                ticketInfo += `<air:VoidDocumentInfo DocumentNumber="${element.ticket_no}" DocumentType="E-Ticket"/>`
            });

            // const BookingTravelerRefObj = JSON.parse(flightBookings[0]['BookingTravelerRefObj']);
            const BookingTravelerRefObj = { TraceId: "MTYxMzk3MTM5MTQyNjY3NDcwNzEwMA==" };
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
            <soapenv:Header/>
            <soapenv:Body>
                <air:AirVoidDocumentReq xmlns:air="http://www.travelport.com/schema/air_v45_0" xmlns:com="http://www.travelport.com/schema/common_v45_0" TraceId="${BookingTravelerRefObj['TraceId']}" AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}" ShowETR="true" ProviderCode="1G" ProviderLocatorCode="${flightBookings[0]['flightBookingTransactions'][0]['gds_pnr']}">
                    <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>
                    ${ticketInfo}
                </air:AirVoidDocumentReq>
            </soapenv:Body>
        </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}UniversalRecordCancelReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}UniversalRecordCancelRes.xml`, 'utf-8');
            } else {
                /* xmlResponse = await this.httpService.post(TRAVELPORT_UNIVERSAL_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise(); */
                xmlResponse = await this.httpService.post('https://apac.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
                if (xmlResponse == undefined) {
                    return [];

                }
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}VoidReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}VoidRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);

        const result = this.travelportTransformService.updateReservationVoid(body['AppReference'], jsonResponse['SOAP:Envelope']['SOAP:Body'])

        return result;
    }

    async cancellation(body: any): Promise<any> {
        let jsonResponse:any = [];
        let result: any = {}
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordCancelRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const flightBookings = await this.getGraphData(`query {
                flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
                  BookingTravelerRefObj
                  UniversalRecordLocatorCode
                  AirReservationLocatorCode
                }
              }`, 'flightBookings');
            if (!flightBookings[0]['UniversalRecordLocatorCode']) {
                console.log('need to throw error');
            }

            // const BookingTravelerRefObj = JSON.parse(flightBookings[0]['BookingTravelerRefObj']);
            const BookingTravelerRefObj = { TraceId: "MTYxMzk3MTM5MTQyNjY3NDcwNzEwMA==" };
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header />
        <soapenv:Body>
            <univ:UniversalRecordCancelReq AuthorizedBy="${TRAVELPORT_USERNAME}" TraceId="${BookingTravelerRefObj['TraceId']}" TargetBranch="${TargetBranch}" UniversalRecordLocatorCode="${flightBookings[0]['UniversalRecordLocatorCode']}" Version="1">
                <com:BillingPointOfSaleInfo OriginApplication="uAPI" />
            </univ:UniversalRecordCancelReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}UniversalRecordCancelReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}UniversalRecordCancelRes.xml`, 'utf-8');
            } else {
                /* xmlResponse = await this.httpService.post(TRAVELPORT_UNIVERSAL_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise(); */
                xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
                if (xmlResponse == undefined) {
                    return [];
                }
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordCancelReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordCancelRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
            result = this.travelportTransformService.updateReservationCancellation(body['AppReference'], jsonResponse['SOAP:Envelope']['SOAP:Body'])
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);
        return result;
    }

    async ticketingRequest(body: any, app_reference: any): Promise<any> {
        let jsonResponse:any = [];
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${app_reference}:AirTicketingRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            /* const flightBookings: any = this.getGraphData(`query{flightBookings(where:{app_reference:{eq:"${body['AppReference']}"}}){booking_status}}`, 'flightBookings');
            if (!flightBookings.length) {
                throw new HttpException('App Reference does not exist!', 400);
            }
            if (flightBookings[0]['booking_status'] != 'BOOKING_HOLD') {
                throw new HttpException('Booking status does not match(BOOKING_HOLD)!', 400);
            } */
            const xmlData = `<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header/>
        <soapenv:Body>
            <air:AirTicketingReq BulkTicket="false" ReturnInfoOnFail="true" TargetBranch="${TargetBranch}" xmlns:air="${TRAVELPORT_AIR_URL}">
                <com:BillingPointOfSaleInfo OriginApplication="UAPI"/>
                <air:AirReservationLocatorCode>${body['FinalBooking']['BookingDetails']['AirReservationLocatorCode']}</air:AirReservationLocatorCode>
            </air:AirTicketingReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
            let xmlResponse: any = {};
            if (this.isNotHitApi) { // this.isNotHitApi
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${app_reference}:AirTicketingReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${app_reference}:AirTicketingRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post(TRAVELPORT_API_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
                if (xmlResponse == undefined) {
                    return [];
                }
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${app_reference}AirTicketingReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${app_reference}AirTicketingRes.xml`, xmlResponse);
            }
            if (this.isLogXml) {
                //     fs.writeFileSync(`${logStoragePath}/flights/travelport/AirTicketingReq.xml`, xmlRequest);
                //     fs.writeFileSync(`${logStoragePath}/flights/travelport/AirTicketingRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        const Body = jsonResponse['SOAP:Envelope']['SOAP:Body'];
        if (Body['SOAP:Fault']) {
            throw new HttpException(Body['SOAP:Fault']['faultstring']['$t'], 400);
        } else {

        }
        const TicketFailureInfo = Body['air:AirTicketingRsp']['air:TicketFailureInfo'];
        if (TicketFailureInfo) {
            throw new HttpException(TicketFailureInfo['Message'], 400);
        }

        return { data: { ticket_response: Body['air:AirTicketingRsp'] }, message: '' };
    }

    async pnrRetrieve(body: any): Promise<any> {

        let jsonResponse:any = [];
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const flightBookings = await this.getGraphData(`query {
                flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
                  BookingTravelerRefObj
                  UniversalRecordLocatorCode
                  AirReservationLocatorCode
                }
              }`, 'flightBookings');
            if (!flightBookings[0]['UniversalRecordLocatorCode']) {
                console.log('need to throw error');
            }

            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header />
        <soapenv:Body>
            <UniversalRecordRetrieveReq xmlns="${TRAVELPORT_UNIVERSAL_URL}" TraceId="394d96c00971c4545315e49584609ff6" AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}">
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="uAPI" />
                <UniversalRecordLocatorCode>${flightBookings[0]['UniversalRecordLocatorCode']}</UniversalRecordLocatorCode>
            </UniversalRecordRetrieveReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}UniversalRecRetReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}UniversalRecRetrRes.xml`, xmlResponse);
            }
            // return xmlResponse;
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);
        let is_ticketed: boolean = false;

        let pnr_result = await this.travelportTransformService.formatPnrRetrieveResponse(
            jsonResponse['SOAP:Envelope'],
            body, is_ticketed
        );

        let ticketRes = await this.ticketingRequest(pnr_result, body['AppReference']);
        if (ticketRes['data']['ticket_response']['air:ETR'] != undefined) {
            await this.travelportTransformService.formatTicketingRequestResponse(ticketRes['data']['ticket_response'], body);
            is_ticketed = true;
        }
        console.log(pnr_result);
        return await this.travelportTransformService.formatPnrRetrieveResponse(
            jsonResponse['SOAP:Envelope'],
            body, is_ticketed
        );
    }

    async fareRule(body: any): Promise<any> {
        const FlightDetail = await this.redisServerService.read_list(body['ResultToken']);
        const FlightDetailParsed = JSON.parse(FlightDetail[0]);
        const Key = body['ResultToken'].split(DB_SAFE_SEPARATOR);
        const BookingTravelerRefToken = Key[0] + DB_SAFE_SEPARATOR + 1 + DB_SAFE_SEPARATOR + 9999;
        const BookingTravelerRefObj = await this.redisServerService.read_list(BookingTravelerRefToken);
        FlightDetailParsed['BookingTravelerRefObj'] = JSON.parse(BookingTravelerRefObj[0]);
        body['BookingTravelerRefObj'] = getPropValueOrEmpty(FlightDetailParsed, 'BookingTravelerRefObj');
        let jsonResponse:any = [];
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/AirFareRulesRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            let xmlData = '';
            if (FlightDetailParsed['FlightList'][0][0]['air:AirAvailInfo']['ProviderCode'] == '1G') {
                let FareRuleKeys = '';
                const FareInfoRefArray = [];
                for (const FlightList of FlightDetailParsed['FlightList']) {
                    for (const flight of FlightList) {
                        if (getPropValue(flight['air:AirAvailInfo'], 'ProviderCode') && !FareInfoRefArray.includes(flight['FareInfo']['air:FareRuleKey']['FareInfoRef'])) {
                            const strProviderCode = flight['air:AirAvailInfo']['ProviderCode'];
                            const strFareInfoRef = flight['FareInfo']['air:FareRuleKey']['FareInfoRef'];
                            FareInfoRefArray.push(strFareInfoRef);
                            const strFarerulesref = flight['FareInfo']['air:FareRuleKey']['$t'];
                            FareRuleKeys += `<ns2:FareRuleKey ProviderCode="${strProviderCode}" FareInfoRef="${strFareInfoRef}">${strFarerulesref}</ns2:FareRuleKey>`;
                        }
                    }
                }
                xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
	<soapenv:Header />
	<soapenv:Body>
        <ns2:AirFareRulesReq xmlns="${TRAVELPORT_SCHEMA}" xmlns:ns2="${TRAVELPORT_AIR_URL}" FareRuleType="long" TraceId="${body['BookingTravelerRefObj']['TraceId']}" TargetBranch="${TargetBranch}" AuthorizedBy="${TRAVELPORT_USERNAME}">
            <BillingPointOfSaleInfo OriginApplication="uAPI" />
            ${FareRuleKeys}
        </ns2:AirFareRulesReq>
	</soapenv:Body>
</soapenv:Envelope>`;
            } else {
                let strRequest = '';
                if (getPropValue(FlightDetailParsed['FlightList'][0][0]['air:AirAvailInfo'], 'ProviderCode')) {
                    const flight = FlightDetailParsed['FlightList'][0][0];
                    const strProviderCode = flight['air:AirAvailInfo']['ProviderCode'];
                    const strFareInfoRef = flight['FareInfo']['Key'];
                    const strFarerulesref = flight['FareInfo']['Amount'];
                    strRequest += `
<air:FareRuleKey ProviderCode="${strProviderCode}" FareInfoRef="${strFareInfoRef}">${strFarerulesref}</air:FareRuleKey>
<air:AirFareRulesModifier>
    <air:AirFareRuleCategory FareInfoRef="${strFareInfoRef}">
        <air:CategoryCode>CHG</air:CategoryCode>
    </air:AirFareRuleCategory>
</air:AirFareRulesModifier>`;
                }
                xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Header/>
    <soapenv:Body>
        <air:AirFareRulesReq xmlns="${TRAVELPORT_SCHEMA}" xmlns:air="${TRAVELPORT_AIR_URL}" FareRuleType="long" TraceId="${body['BookingTravelerRefObj']['TraceId']}" TargetBranch="${TargetBranch}" AuthorizedBy="${TRAVELPORT_USERNAME}">
            <BillingPointOfSaleInfo OriginApplication="uAPI" />
            ${strRequest}
        </air:AirFareRulesReq>
    </soapenv:Body>
</soapenv:Envelope>`;
            }
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/AirFareRulesReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/AirFareRulesRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post(TRAVELPORT_API_URL, xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/AirFareRulesReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/AirFareRulesRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);
        return this.travelportTransformService.formatFareRuleResponse(jsonResponse['SOAP:Envelope']['SOAP:Body'], FlightDetailParsed);
    }

    async importPNR(body: any): Promise<any> {

        let jsonResponse:any = [];
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const flightBookings = await this.getGraphData(`query {
                flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
                  BookingTravelerRefObj
                  UniversalRecordLocatorCode
                  AirReservationLocatorCode
                }
              }`, 'flightBookings');
            if (!flightBookings[0]['UniversalRecordLocatorCode']) {
                console.log('need to throw error');
            }

            // flightBookings[0]['UniversalRecordLocatorCode'] = 'YF308I';
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header />
        <soapenv:Body>
            <UniversalRecordRetrieveReq xmlns="${TRAVELPORT_UNIVERSAL_URL}" TraceId="394d96c00971c4545315e49584609ff6" AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}">
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="uAPI" />
                <UniversalRecordLocatorCode>${flightBookings[0]['UniversalRecordLocatorCode']}</UniversalRecordLocatorCode>
            </UniversalRecordRetrieveReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}RetrieveReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}RetrieveRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);
        }

        let reservation = jsonResponse['SOAP:Envelope']['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['air:AirReservation'];
        if (reservation['air:DocumentInfo']) {
            if (reservation['air:DocumentInfo']['air:TicketInfo']) {
                let ticker_res = this.forceObjectToArray(reservation['air:DocumentInfo']['air:TicketInfo']);
                let flag = 0;
                for (let i = 0; i < ticker_res.length; i++) {
                    let f_name = ticker_res[i]['common_v51_0:Name']['First'];
                    const query1 = `UPDATE flight_booking_transaction_passengers SET 
                    booking_status = "BOOKING_CONFIRMED" ,
                   
                    ticket_no = "${ticker_res[i]['Number']}" 
                    WHERE full_name="${f_name.trim()}" 
                    and last_name="${ticker_res[i]['common_v51_0:Name']['Last']}" 
                    and app_reference = "${body['AppReference']}"`;
                    await this.manager.query(query1);
                    flag = 1;
                }
                // ticket_issue_date = CURRENT_TIMESTAMP  ,
                if (flag == 1) {
                    const query1 = `UPDATE flight_bookings SET 
                    booking_status = "BOOKING_CONFIRMED",
                    ticket_issue_date = CURRENT_TIMESTAMP  , 
                    WHERE app_reference = "${body["AppReference"]}"`;
                    await this.manager.query(query1);
                    const query2 = `UPDATE flight_booking_transactions SET 
                    booking_status = "BOOKING_CONFIRMED" 
                    WHERE app_reference = "${body["AppReference"]}"`;
                    await this.manager.query(query2);
                    const query3 = `UPDATE flight_booking_transaction_itineraries SET 
                    booking_status = "BOOKING_CONFIRMED" 
                    WHERE app_reference = "${body["AppReference"]}"`;
                    await this.manager.query(query3);
                }
            }
        }



        let remarks = this.forceObjectToArray(jsonResponse['SOAP:Envelope']['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['common_v51_0:GeneralRemark']);
        let flag: number = 0;
        let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        let months_num = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        let last_ticketing_date = '';
        const d = new Date();
        let current_year: any = '';
        current_year = d.getFullYear() + '';
        remarks.forEach(element => {
            if (element['common_v51_0:RemarkData']['$t'] != undefined && flag == 0) {
                let split_msg = element['common_v51_0:RemarkData']['$t'].split(' ');
                split_msg.forEach((word, w) => {
                    months.forEach((mon, m) => {
                        if (word.includes(mon)) {
                            let split_word = word.split(mon);
                            let year: any;
                            if (split_word[1] != undefined) {
                                if (split_word[1].length < 4) {
                                    year = current_year.substring(0, 2) + split_word[1];
                                } else {
                                    year = split_word[1];
                                }
                            }
                            last_ticketing_date = split_word[0] + '/' + months_num[m] + '/' + year + ' ' + split_msg[w + 1].substring(0, 2) + ":" + split_msg[w + 1].substring(2, 4);
                            flag = 1;
                        }
                    });
                });
            }
        });
        if (last_ticketing_date != '') {
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBooking",
                { LastDateToTicket: last_ticketing_date }
            );
        }
        // console.log(last_ticketing_date);
        // console.log(JSON.stringify(jsonResponse));
        return jsonResponse;

    }

    async directImportPNR(body: any): Promise<any> {
        try {
            let jsonResponse:any = [];

            if (!body['PNR']) {
                throw new Error(`kindly enter the UniversalRecordLocatorCode`)
            }

            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header />
        <soapenv:Body>
            <UniversalRecordRetrieveReq xmlns="${TRAVELPORT_UNIVERSAL_URL}" TraceId="394d96c00971c4545315e49584609ff6" AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}">
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="uAPI" />
                <UniversalRecordLocatorCode>${body['PNR']}</UniversalRecordLocatorCode>
            </UniversalRecordRetrieveReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}RetrieveReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}RetrieveRes.xml`, xmlResponse);
            }
            jsonResponse =await this.xmlToJson(xmlResponse);

            if (jsonResponse ?.['SOAP:Envelope'] ?.['SOAP:Body'] ?.['SOAP:Fault'] ?.faultstring ?.$t) {
                throw new Error(`400 ` + jsonResponse ?.['SOAP:Envelope'] ?.['SOAP:Body'] ?.['SOAP:Fault'] ?.faultstring ?.$t);
            }
            else {

                let result = await this.travelportTransformService.formatImportPnrResponse(jsonResponse, body)
                return result;
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async directSaveImportPNR(body: any): Promise<any> {

        try {

            let booking = await this.redisServerService.read_list(body["ResultToken"]);
            booking = JSON.parse(booking)
            const UniversalRecordLocatorCode = booking.booking.UniversalRecordLocatorCode;
            const query = `SELECT * FROM flight_bookings WHERE UniversalRecordLocatorCode = "${UniversalRecordLocatorCode}"`;
            const result = await this.manager.query(query);
            if (result.length < 1) {
                const flight_booking_itineraries = await this.setGraphData(
                    'FlightBookings',
                    booking.booking
                );
                    

                if (flight_booking_itineraries.length >= 1) {
                    return booking

                } else {
                    throw new Error("400 Data is not saved in DB!!");
                }
            }
            else {
                throw new Error("400 Duplicate PNR!!");
            }

        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    async pnrRetrieveWithPricing(body: any): Promise<any> {
        let jsonResponse:any = [];
        if (this.isDevelopment) {
            const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            jsonResponse =await this.xmlToJson(xmlResponse);
        } else {
            const flightBookings = await this.getGraphData(`query {
                flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
                  BookingTravelerRefObj
                  UniversalRecordLocatorCode
                  AirReservationLocatorCode
                }
              }`, 'flightBookings');
            if (!flightBookings[0]['UniversalRecordLocatorCode']) {
                console.log('need to throw error');
            }

            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="${TRAVELPORT_SCHEMA}" xmlns:univ="${TRAVELPORT_UNIVERSAL_URL}">
        <soapenv:Header />
        <soapenv:Body>
            <UniversalRecordRetrieveReq xmlns="${TRAVELPORT_UNIVERSAL_URL}" TraceId="394d96c00971c4545315e49584609ff6" AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}">
                <BillingPointOfSaleInfo xmlns="${TRAVELPORT_SCHEMA}" OriginApplication="uAPI" />
                <UniversalRecordLocatorCode>${flightBookings[0]['UniversalRecordLocatorCode']}</UniversalRecordLocatorCode>
            </UniversalRecordRetrieveReq>
        </soapenv:Body>
    </soapenv:Envelope>`;
            const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");

            let xmlResponse: any = {};
            if (this.isNotHitApi) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveReq.xml`, xmlRequest);
                xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
            } else {
                xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService', xmlRequest, {
                    headers: TRAVELPORT_HEADERS
                }).toPromise();
            }
            if (this.isLogXml) {
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}UniversalRecRetReq.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}UniversalRecRetrRes.xml`, xmlResponse);
            }
            // return xmlResponse;
            jsonResponse =await this.xmlToJson(xmlResponse);
        }
        /* if (jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']) {
            throw new HttpException(jsonResponse['SOAP:Envelope']['SOAP:Body']['SOAP:Fault']['faultstring']['$t'], 400);
        } */
        this.throwSoapError(jsonResponse);
        let is_ticketed: boolean = false;


        // Re-pricing request start
        let segments = this.forceObjectToArray(jsonResponse['SOAP:Envelope']['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['air:AirReservation']['air:AirSegment']);
        let air_segments: any = '';
        let from: any = '';
        let to: any = '';
        let total_segment_count = segments.length - 1;
        segments.forEach((element, index) => {
            if (index == 0) {
                from = element['Origin'];
            }
            if (index == total_segment_count) {
                to = element['Destination'];
            }

            air_segments += '<air:AirSegment Key="' + element['Key'] + '" Group="' + element['Group'] + '" Carrier="' + element['Carrier'] + '" FlightNumber="' + element['FlightNumber'] + '" Origin="' + element['Origin'] + '" Destination="' + element['Destination'] + '" DepartureTime="' + element['DepartureTime'] + '" ArrivalTime="' + element['ArrivalTime'] + '" ETicketability="' + element['ETicketability'] + '" Equipment="' + element['Equipment'] + '" ChangeOfPlane="' + element['ChangeOfPlane'] + '' + '" OptionalServicesIndicator="' + element['OptionalServicesIndicator'] + '" ProviderCode="' + element['ProviderCode'] + '" ClassOfService="' + element['ClassOfService'] + '">';
            // air_segments += '<air:CodeshareInfo OperatingCarrier="' + element['Carrier'] + '">' + element['Carrier'] + '</air:CodeshareInfo>';
            air_segments += '</air:AirSegment>';
        });

        let booking_traveller = this.forceObjectToArray(jsonResponse['SOAP:Envelope']['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['common_v51_0:BookingTraveler']);
        let traveller: any = '';
        booking_traveller.forEach((element, index) => {
            if (element['TravelerType']) {
                traveller += '<SearchPassenger Key="' + (index + 1) + '" Code="' + element['TravelerType'] + '" xmlns="' + TRAVELPORT_SCHEMA + '" />';
            } else {
                traveller += '<SearchPassenger Key="' + (index + 1) + '" Code="ADT" xmlns="' + TRAVELPORT_SCHEMA + '"/>';
            }
        });

        let xmlData = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
        <air:AirPriceReq AuthorizedBy="${TRAVELPORT_USERNAME}" TargetBranch="${TargetBranch}" FareRuleType="long" xmlns:air="${TRAVELPORT_AIR_URL}">
        <BillingPointOfSaleInfo OriginApplication="UAPI" xmlns="${TRAVELPORT_SCHEMA}"/>
        <air:AirItinerary>
        ${air_segments}
        </air:AirItinerary>
        <air:AirPricingModifiers TicketingCity="${to}" SellCity="${from}"/>
        ${traveller}
        <air:AirPricingCommand/>
        </air:AirPriceReq>
        </soap:Body>
        </soap:Envelope>`;


        const xmlRequest = xmlData.replace(/\n/g, '').replace(/>\s+</g, "><");
        let jsonAirPricingResponse: any = '';
        let xmlResponse: any = {};
        if (this.isNotHitApi) {
            fs.writeFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveReq.xml`, xmlRequest);
            xmlResponse = fs.readFileSync(`${logStoragePath}/flights/travelport/not-hit-api/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
        } else {
            xmlResponse = await this.httpService.post('https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService', xmlRequest, {
                headers: TRAVELPORT_HEADERS
            }).toPromise();
        }
        if (this.isLogXml) {
            fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}TicketingAirpringReq.xml`, xmlRequest);
            fs.writeFileSync(`${logStoragePath}/flights/travelport/${body['AppReference']}TicketingAirpringRes.xml`, xmlResponse);
        }
        // return xmlResponse;
        jsonAirPricingResponse =await this.xmlToJson(xmlResponse);
        // Re-pricing request end
        return false;

        let pnr_result = await this.travelportTransformService.formatPnrRetrieveResponse(
            jsonResponse['SOAP:Envelope'],
            body, is_ticketed
        );

        // let ticketRes = await this.ticketingRequest(pnr_result, body['AppReference']);
        // if (ticketRes['data']['ticket_response']['air:ETR'] != undefined) {
        //     await this.travelportTransformService.formatTicketingRequestResponse(ticketRes['data']['ticket_response'], body);
        //     is_ticketed = true;
        // }
        // console.log(pnr_result);
        return await this.travelportTransformService.formatPnrRetrieveResponse(
            jsonResponse['SOAP:Envelope'],
            body, is_ticketed
        );
    }

    async formatPriceDetailToSelectedCurrency(currency: any) {
        try {
            const currencyDetails = await this.getGraphData(`
				query {
					cmsCurrencyConversions(where: {
                        currency: {
                            eq:"${currency}"
                        } 
                    }
                    ) {
						id
						currency
						value
						status
					}
			  	}
			`, "cmsCurrencyConversions"
            );
            if (currencyDetails.length < 1) {
                throw new Error("400 No Currency Conversion Found");
            }
            return currencyDetails[0];
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
}
