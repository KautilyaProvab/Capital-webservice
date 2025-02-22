import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import {  HOTELBEDS_URL,HOTELBEDS_HOTEL_BOOKING_SOURCE, logStoragePath, META_TL_HOTEL_COURSE , HOTELBEDS_APIKEY, HOTELBEDS_SECRET , HOTELBEDS_B2B_APIKEY, HOTELBEDS_B2B_SECRET, ExchangeRate_1_GBP_to_USD, BASE_CURRENCY,GIATA_IMAGE_BASE_URL } from "../../../constants";
import { goGlobalRequestTypes } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { HotelBedsTransformService } from "./hotelbeds-transform.service";
import * as moment from "moment";
const crypto = require('crypto');

@Injectable()
export class HotelBedsService extends HotelApi {

    apiCred: any;
    apiCredCached: boolean = false;

    constructor(
        private readonly httpService: HttpService,
        private hotelDbService: HotelDbService,
        private HotelBedsTransformService: HotelBedsTransformService,
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
            WHERE source_key='${HOTELBEDS_HOTEL_BOOKING_SOURCE}' 
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
        var seconds = new Date().getTime() / 1000;
        const token = crypto.createHash('sha256').update(HOTELBEDS_APIKEY + '_' + HOTELBEDS_SECRET+'_'+seconds).digest("hex");
        const HOTELBEDS_HEADER = {
            'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'Api-key': HOTELBEDS_APIKEY,
                    'X-Signature': token,
                    'Content-Type': 'application/json',
                    'Accept-Encoding':'gzip'
        }
        return HOTELBEDS_HEADER;
    }

    async getHeader(operation: any, operationType: any, userType: any) {
        this.apiCred = await this.setApiCredentials();
        var seconds = new Date().getTime() / 1000;
        console.log(Math.floor(seconds));
        let apiKey = ``;
        let secret = ``;

        if(userType=='B2B'){
            apiKey=HOTELBEDS_B2B_APIKEY;
            secret=HOTELBEDS_B2B_SECRET;
        }else{
            apiKey=HOTELBEDS_APIKEY;
            secret=HOTELBEDS_SECRET;
        }
        const token = crypto.createHash('sha256').update(apiKey+secret+Math.floor(seconds)).digest("hex");
        const HOTELBEDS_HEADER = {
            'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'Api-key': apiKey,
                    'X-Signature': token,
                    'Content-Type': 'application/json',
                    'Accept-Encoding':'gzip',
                    'X-Originating-Ip': '14.141.47.106'
        }
        return HOTELBEDS_HEADER;
    }

    async getHeaderXML(operation: any, operationType: any, userType: any ) {
        this.apiCred = await this.setApiCredentials();
        let apiKey = ``;
        let secret = ``;

        if(userType=='B2B'){
            apiKey=HOTELBEDS_B2B_APIKEY;
            secret=HOTELBEDS_B2B_SECRET;
        }else{
            apiKey=HOTELBEDS_APIKEY;
            secret=HOTELBEDS_SECRET;
        }
        var seconds = new Date().getTime() / 1000;
        console.log(Math.floor(seconds));
        const token = crypto.createHash('sha256').update(apiKey+secret+Math.floor(seconds)).digest("hex");
        const HOTELBEDS_HEADER = {
            'Accept': 'application/xhtml+xml,application/xml,text/xml,application/xml',
                    'Accept-Language': 'en',
                    'Api-key': apiKey,
                    'X-Signature': token,
                    'Content-Type': 'application/xml',
                    'Accept-Encoding':'gzip',
                    'X-Originating-Ip': '14.141.47.106'
        }
        return HOTELBEDS_HEADER;
    }

    async getHotelInfoRequest(hotelSearchCode: any) {
        const header = await this.getHeader('HOTEL_INFO_REQUEST', 'Request','B2C');
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

    async searchRequest(body: any): Promise<any> {
        
        // var hotelcode= await this.hotelDbService.HotelbedsHotelCode(body['CityIds'][0]); 
        
        var hotelcode= await this.hotelDbService.getHotelIdsByGiataId(body['CityIds'][0],HOTELBEDS_HOTEL_BOOKING_SOURCE);
       
        let hotelcodes= JSON.parse(JSON.stringify(hotelcode));
        
        // let hotelcodes: any=[];
        // console.log("hotelcode-",hotelcode);return;
        // for (let index = 0; index < hotelcode.length; index++) {
        //     hotelcodes.push(hotelcode[index].hotel_code);
      
        // }
       
        let newRoom: any =[];
        for (let room = 0; room < body['RoomGuests'].length; room++) {
            if(typeof newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild] == "undefined"){
                newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild]=body['RoomGuests'][room];
                newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild].Rooms=1;
            }else{
                newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild].Rooms+=1;
            }
        }
        newRoom= Object.values(newRoom);
        let roomList: any=[];
        for (let roomNew = 0; roomNew < newRoom.length; roomNew++) {
            let pax: any =[];
           for (let adult = 0; adult < newRoom[roomNew].NoOfAdults; adult++) {
            const paxAge = {
                type: "AD",
                age: "30"
              }
            pax.push(paxAge);
           }

           for (let childAgeIndex = 0; childAgeIndex < newRoom[roomNew].ChildAge.length; childAgeIndex++) {
            const paxAge = {
                type: "CH",
                age: newRoom[roomNew].ChildAge[childAgeIndex]
              }
            pax.push(paxAge);
           }
            
          var rooms={
            rooms: newRoom[roomNew].Rooms,
            adults: newRoom[roomNew].NoOfAdults,
            children: newRoom[roomNew].NoOfChild,
            paxes: pax
          }

          roomList.push(rooms);
                       
        }
            

        let searchRequest: any = {
            stay: {
                checkIn: moment(body.CheckIn).format('YYYY-MM-DD'),
                checkOut: moment(body.CheckOut).format('YYYY-MM-DD'),
            },
            keywords: {
                allIncluded: true
            },
            reviews: [
                {
                  type: "TRIPADVISOR",
                  maxRate: "5",
                  minReviewCount: "1"
                }
              ],
              filter: {
        paymentType: "AT_WEB"
    },
            occupancies: roomList,
            hotels: {
                hotel: JSON.parse(JSON.stringify(hotelcodes))
            }
        }

       
        // console.log(searchRequest);return;
        return searchRequest;
    }

    async detailsRequest(body: any, Hotelcode : any): Promise<any> {
        
              
        let hotelcodes: any=[];
      
            hotelcodes.push(Hotelcode);
      
            let newRoom: any =[];
            for (let room = 0; room < body['RoomGuests'].length; room++) {
                if(typeof newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild] == "undefined"){
                    newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild]=body['RoomGuests'][room];
                    newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild].Rooms=1;
                }else{
                    newRoom[body['RoomGuests'][room].NoOfAdults+"_"+body['RoomGuests'][room].NoOfChild].Rooms+=1;
                }
            }
            newRoom= Object.values(newRoom);
            let roomList: any=[];
            for (let roomNew = 0; roomNew < newRoom.length; roomNew++) {
                let pax: any =[];
               for (let adult = 0; adult < newRoom[roomNew].NoOfAdults; adult++) {
                const paxAge = {
                    type: "AD",
                    age: "30"
                  }
                pax.push(paxAge);
               }
    
               for (let childAgeIndex = 0; childAgeIndex < newRoom[roomNew].ChildAge.length; childAgeIndex++) {
                const paxAge = {
                    type: "CH",
                    age: newRoom[roomNew].ChildAge[childAgeIndex]
                  }
                pax.push(paxAge);
               }
                
              var rooms={
                rooms: newRoom[roomNew].Rooms,
                adults: newRoom[roomNew].NoOfAdults,
                children: newRoom[roomNew].NoOfChild,
                paxes: pax
              }
    
              roomList.push(rooms);
                           
            }
            

        let searchRequest: any = {
            stay: {
                checkIn: moment(body.CheckIn).format('YYYY-MM-DD'),
                checkOut: moment(body.CheckOut).format('YYYY-MM-DD'),
            },
            keywords: {
                allIncluded: true
            },
            reviews: [
                {
                  type: "TRIPADVISOR",
                  maxRate: "5",
                  minReviewCount: "1"
                }
              ],
              filter: {
        paymentType: "AT_WEB"
            },
            occupancies: roomList,
            hotels: {
                hotel:JSON.parse(JSON.stringify(hotelcodes))
            }
        }

        // JSON.parse(JSON.stringify(hotelcodes))
        
        return searchRequest;
    }

    async search(body: any): Promise<any> {
       
        try {
            const header = await this.getHeader('HOTEL_SEARCH_REQUEST', 'Request',body['UserType']);
            const givenUrl = `${HOTELBEDS_URL}hotels`;

            const start1: any = new Date();
            const searchRequest: any = await this.searchRequest(body);

            const end1: any = new Date();
            console.log("For Third party request Format time:", (end1 - start1));

            let markup: any;
        if (body['UserType'] ) {
            if(body['UserId']==undefined){
                body['UserId']=0;
            }
           
            // markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
            markup = await this.hotelDbService.getMarkup(body);
        }        
        
        const start2: any = new Date();
            const result: any = await this.httpService.post(givenUrl,JSON.stringify(searchRequest), {
                
                headers: header
            }).toPromise();
           
            const end2: any = new Date();
         console.log("Third party response time:", (end2 - start2));

        //  const fs = require('fs');
        // const StaticData = fs.readFileSync(`${logStoragePath}/hotels/HotelBeds/AvailabilityRS_live.json`);
        // const result = JSON.parse(StaticData);

         
            if (this.isLogXml) {
                 const fs = require('fs');
             fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/AvailabilityRQ_${body['searchId']}.json`, JSON.stringify(searchRequest));
                fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/AvailabilityRS_${body['searchId']}.json`, JSON.stringify(result));
            }
           
            if (result.hotels && result.hotels.total > 0) {
                var DeDuToken = body.DeDuToken;
                delete(body.DeDuToken);
              
                const formattedResult = await this.HotelBedsTransformService.getHotelSearchUniversalFormat(body, markup, result.hotels);
                const duplicatHotelListData =await this.redisServerService.read_list(DeDuToken);
                
    const duplicatHotelList= JSON.parse(duplicatHotelListData);  
                let finalHotelList:any = [];
                for (let index = 0; index < formattedResult.length; index++) {
                    // console.log("ten-",formattedResult[index].GiataCode);return;
                    if(formattedResult[index] != undefined){
                    
                    formattedResult[index]['uniqueHotelId']=duplicatHotelList.uniqueHotelId++;
                    duplicatHotelList[formattedResult[index]['GiataCode']].price = formattedResult[index]['Price']['Amount'];
                    duplicatHotelList[formattedResult[index]['GiataCode']].uniqueHotelId = formattedResult[index]['uniqueHotelId'];
                    finalHotelList.push(formattedResult[index]);
                }
                   }

                   
                   
                   const DeToken = this.redisServerService.geneateResultToken(body.searchId);

const duplicatHotelListNew = await this.redisServerService.insert_record(DeToken, JSON.stringify(duplicatHotelList));

finalHotelList['DeDuToken'] = duplicatHotelListNew["access_key"];
return finalHotelList;
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ${result.Message}`);
                throw new errorClass(`400 ${result.Message}`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getPriceBreakdownRequestXml(hotelSearchCode: any) {
        const header = await this.getHeader('PRICE_BREAKDOWN_REQUEST', 'Request','B2C');
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
        let result = JSON.parse(data);
        
        const DetailsRequest: any = await this.detailsRequest(result.searchRequest,result.HotelCode);
        let markup: any; 
     
        if (result['searchRequest'].UserType) {
            
            if(result['searchRequest'].UserId==undefined){
                result['searchRequest'].UserId=0;
            }
            body.MarkupCity=result.searchRequest.MarkupCity;
            body.MarkupCountry=result.searchRequest.MarkupCountry;
            body.UserType=result['searchRequest'].UserType;

            // markup = await this.hotelDbService.getMarkupDetails(result['searchRequest'].UserType, result['searchRequest'].UserId,body);
            markup = await this.hotelDbService.getMarkup(body);
        } 
        
        // const hotelCode=result.HotelCode;
        // const checkIn=result.CheckIn;
        // const checkOut=result.CheckOut;
        // let occupancies='';
        // let paxStr='';
        // for (let index = 0; index < result.searchRequest.RoomGuests.length; index++) {
        //     if(index>0){
        //         occupancies+=`,`;
        //     }
        //     const element = result.searchRequest.RoomGuests[index];
        //     for (let PaxIndex = 0; PaxIndex < element.NoOfAdults; PaxIndex++) {
                
        //         paxStr+=`AD-30;`
        //     }
        //     for (let ChildIndex = 0; ChildIndex < element.NoOfChild; ChildIndex++) {
                
        //         paxStr+=`CH-${element.ChildAge[ChildIndex]};`
        //     }
        //     occupancies+=`1~${element.NoOfAdults}~${element.NoOfChild}~${paxStr}`;
        // }
       
        const header = await this.getHeader('HOTEL_DETAILS_REQUEST', 'Request',result['searchRequest'].UserType);

        console.log(header);
        console.log(DetailsRequest);
        const givenUrl = `${HOTELBEDS_URL}hotels`;
        console.log(givenUrl);
        const DetailsResult: any = await this.httpService.post(givenUrl,JSON.stringify(DetailsRequest), {
                
            headers: header
        }).toPromise();
        
        
        const fs = require('fs');
        // const StaticData = fs.readFileSync(`${logStoragePath}/hotels/HotelBeds/HotelDetailsRS.json`);
        // const DetailsResult = JSON.parse(StaticData);
       
        fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/HotelDetailsREQ_${result.searchRequest.searchId}.json`, JSON.stringify(DetailsRequest));
        fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/HotelDetailsRES_${result.searchRequest.searchId}.json`, JSON.stringify(DetailsResult));
       let DetailsResponse: any={};
    
        if (DetailsResult.hotels.total > 0) {
            DetailsResponse= await this.HotelBedsTransformService.getHotelSearchUniversalFormat(result.searchRequest, markup, DetailsResult.hotels);
           
        }
        else {
            const errorClass: any = getExceptionClassByCode(`400 ${DetailsResult.Message}`);
            throw new errorClass(`400 ${DetailsResult.Message}`);
        }
        
        DetailsResponse[0].RoomDetails = this.forceObjectToArray(DetailsResponse[0].RoomDetails);

        let hotelImages = await this.hotelDbService.GetHotelImages(result.GiataCode);
        let galleryImages = [];
        let roomImages= [];
        if(hotelImages[0] != undefined && hotelImages[0].images != undefined){
        let gallery = JSON.parse(hotelImages[0].images);
         
      
        gallery.forEach(element => {
            if(element.roomCode == undefined){
                let hImages = GIATA_IMAGE_BASE_URL+'original/'+element.path;
                galleryImages.push(hImages);
            }else{
                let hImages = GIATA_IMAGE_BASE_URL+'original/'+element.path;
                roomImages[element.roomCode]=hImages;
            }
            
        });
    }

        const finalResult = await Promise.all(
            //result.RoomDetails
           
            DetailsResponse[0].RoomDetails.map(async (t) => {
              
                return this.HotelBedsTransformService.getHotelDetailsUniversalFormat(body, result, t, markup);
                
            })
        )

       

       let FinalRoomList: any =[]
       console.log(finalResult)
    //    console.log(finalResult[0].CancelPolicy.CancelPenalty)
       
        finalResult.forEach((element,elementIndex) => {
            let newRoomList: any = [];
           
            element['Rooms'].forEach((RoomElement,RoomIndex) => {
              
                
                if(typeof newRoomList[RoomIndex]=="undefined"){
                    newRoomList[RoomIndex]=[];
                }

                // if(typeof FinalRoomList[RoomIndex]=="undefined"){
                //     FinalRoomList[RoomIndex]=[];
                // }
                // if(typeof FinalRoomList[RoomIndex][elementIndex]=="undefined"){
                //     FinalRoomList[RoomIndex][elementIndex]=[];
                // }

                if(FinalRoomList[RoomElement[0].paxCount]==undefined){
                    FinalRoomList[RoomElement[0].paxCount]=[];
                }
                newRoomList[RoomIndex].push(RoomElement);
                let roomImage="";
        if(roomImages[RoomElement[0].code]!=undefined){
         roomImage=roomImages[RoomElement[0].code];
        }
        // RoomElement.forEach()
       
                let elementRoom={
                    AgencyToken:element['AgencyToken'],
                    RoomImage:roomImage,
                    RoomCount:RoomElement[0].Rooms,
                    Rooms:RoomElement,
                    Price:element['Price'],
                    CancelPolicy:element['CancelPolicy'],
                    ResultIndex:element['ResultIndex']
                }
                      
               
        //         if(FinalRoomList[RoomIndex][elementIndex]!=undefined){
        //             if(FinalRoomList[RoomIndex][elementIndex].Rooms!=undefined){
        //             if(FinalRoomList[RoomIndex][elementIndex].Rooms[0]!=undefined){
        //             console.log("FinalRoom-");
        //             console.log("RoomElement-",RoomElement[0].paxCount);
        //             return;
        //        if(FinalRoomList[RoomIndex][elementIndex].Rooms[0].paxCount==RoomElement[0].paxCount){
        //         FinalRoomList[RoomIndex][elementIndex]=elementRoom;
        //        }else{
        //         console.log("end");return;

        //        }
        //     }else{
        //         console.log("end2");return;

        //        }
        // }else{
        //     console.log("FinalRoom-",FinalRoomList[RoomIndex][elementIndex]);
        //             console.log("RoomElement-",RoomElement[0].paxCount);
        //             return;

        //        }
        //     }else{
        //         FinalRoomList[RoomIndex][elementIndex]=elementRoom;
        //     }
        FinalRoomList[RoomElement[0].paxCount].push(elementRoom);
              
            // FinalRoomList[RoomIndex][elementIndex]=elementRoom;
          
            });
          
       });  
     
       
       let hotelFacility = await this.hotelDbService.GetHotelFacilitiesGiata(result.GiataCode);
     
     
       let hotelFacilityDescription: any = []; 
       if(hotelFacility[0] && hotelFacility[0].hotel_fac){
        let fac = JSON.parse(hotelFacility[0].hotel_fac);
        fac.forEach(FacilityElement => {
            
        // hotelFacilityDescription.push(FacilityElement.description);
        hotelFacilityDescription.push(FacilityElement.replace(/^facility_/, ''));
       });
    }
       result.HotelPicture=galleryImages;
       result.HotelAmenities=hotelFacilityDescription;
        result.RoomDetails = Object.values(FinalRoomList);
     
        return result;
    }

    async removeDuplicates(arr: any) {
        return arr.filter((item,
            index) => arr.indexOf(item) === index);
    }

    async hotelsValuation(body: any): Promise<any> {
        try{
            let parsedInfoArray: any =[];
           for (let index = 0; index < body.ResultToken.length; index++) {
            const element = body.ResultToken[index];
            let resp = await this.redisServerService.read_list(element);
            parsedInfoArray.push(JSON.parse(resp));
           }
        let convinenceFee = 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
        let Rooms=[];
        let BlockRoomId=[];
        let hotelDetail:any =[];
        let HotelDetails:any =[];
  
   
    let parsedInfo:any=[];
    let hotelResultToken:any=[];
        parsedInfoArray.forEach((parsedInfo,parsedIndex) => {
            
            body.BlockRoomId.forEach((blockElement,blockIndex) => {
                if(parsedIndex==blockIndex){
     
                
                    parsedInfo.Rooms[blockIndex].forEach(RateElement => {
                      
                        if(parseInt(blockElement)==RateElement.Index){
                            
                            Rooms.push(RateElement);
                            const roomKey= {
                             rateKey: RateElement.Id
                               };
                             BlockRoomId.push(roomKey);
                        }
                    });
              
                }
            });
           
            hotelResultToken=parsedInfo['AgencyToken'];
           
          
        }); 
      
            parsedInfo.Rooms=Rooms;
            parsedInfo.ResultToken=hotelResultToken;
            
        hotelDetail =await this.redisServerService.read_list(hotelResultToken);
     
        HotelDetails=parsedInfo.hotel = JSON.parse(hotelDetail);
      
        
        
        const header = await this.getHeader('HOTEL_CHECKRATE_REQUEST', 'Request',HotelDetails.searchRequest.UserType);
       
        const CheckrateRequest: any = await this.getCheckrateRequest(BlockRoomId);
    

        let markup: any; 
        if (HotelDetails.searchRequest.UserType) {
            if(HotelDetails.searchRequest.UserId==undefined){
                HotelDetails.searchRequest.UserId=0;
            }
            body.MarkupCity=HotelDetails.searchRequest.MarkupCity;
            body.MarkupCountry=HotelDetails.searchRequest.MarkupCountry;
            body.UserType = HotelDetails.searchRequest.UserType;
            // markup = await this.hotelDbService.getMarkupDetails(HotelDetails.searchRequest.UserType, HotelDetails.searchRequest.UserId,body);
            markup = await this.hotelDbService.getMarkup(body);
                  
        }
        
        const givenUrl = `${HOTELBEDS_URL}checkrates`;
        try{
        const roomDetail: any = await this.httpService.post(givenUrl,CheckrateRequest, {
                
            headers: header
        }).toPromise();
   
        const fs = require('fs');
        // const StaticData = fs.readFileSync(`${logStoragePath}/hotels/HotelBeds/CheckRateRES.json`);
        // const roomDetail = JSON.parse(StaticData);
       
        fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/CheckRateREQ_${HotelDetails.searchRequest.searchId}.json`, JSON.stringify(CheckrateRequest));
        fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/CheckRateRES_${HotelDetails.searchRequest.searchId}.json`, JSON.stringify(roomDetail));
     
      
if(roomDetail.hotel != undefined){
        const result = roomDetail.hotel.rooms;
        let hotelPolicy:any=[];
       
        // let markup: any;
        let hprice:any=0;
            let hCommission:any=0;
            let conversionRate=1;
            
        if (typeof roomDetail.hotel.rooms!='undefined') {
            for (let RoomIndex = 0; RoomIndex < roomDetail.hotel.rooms.length; RoomIndex++) {
               
                
            
            let arr = [...roomDetail.hotel.rooms[RoomIndex].rates];
         
           if(HotelDetails.searchRequest.Currency != BASE_CURRENCY){
                let currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(HotelDetails.searchRequest.Currency)  
                conversionRate=currencyDetails['value'];
    
            }
            arr.forEach((blockedRoom,BlockedIndex) => {
                
               let cancelationString = ``;
                let Blockedprice:any = 0;
                    let BlockedCommission:any = 0;
                    if(typeof blockedRoom.sellingRate!='undefined'){
                    Blockedprice=parseFloat(blockedRoom.sellingRate);
                    }else if(typeof blockedRoom.net!='undefined'){
                    Blockedprice=parseFloat(blockedRoom.net);
                    }
                    
                    if(typeof blockedRoom.commission!='undefined'){
                    BlockedCommission=parseFloat(blockedRoom.commission);
                    }
                    hprice+=parseFloat(Blockedprice);
                    
                    hCommission+=BlockedCommission;
                    // console.log("blockedRoom.cancellationPolicies-",blockedRoom.cancellationPolicies);return;
                    for (let index = 0; index <  blockedRoom.cancellationPolicies.length; index++) {
                        blockedRoom.cancellationPolicies[index].amount =  blockedRoom.cancellationPolicies[index].amount * conversionRate;
                        
                        hotelPolicy.push(blockedRoom.cancellationPolicies[index]);

          
                    }
                    console.log("hotelPolicy-",hotelPolicy);
                    parsedInfo.Rooms[BlockedIndex].cancellationDetails =hotelPolicy;
                parsedInfo.Rooms[BlockedIndex].Price = {
                    Amount: conversionRate * Blockedprice,
                    Currency: HotelDetails.searchRequest.Currency,
                    Commission: conversionRate * BlockedCommission
                }
            });
        }
            
            HotelDetails.Price={
                Amount: conversionRate * hprice,
                    Currency: HotelDetails.searchRequest.Currency,
                    Commission: conversionRate * hCommission
            }
        } else {
            
            hotelDetail['Price'] = roomDetail['Price'];
        }
        let count = 0
        // let count = HotelDetails.searchRequest.RoomGuests[0].NoOfAdults + HotelDetails.searchRequest.RoomGuests[0].NoOfChild ;
        let totalAdults = 0;
        let totalChildren = 0;
        HotelDetails.searchRequest.RoomGuests .forEach(item=>{
            totalAdults += item.NoOfAdults;
            totalChildren += item.NoOfChild;
        });
        let totalCount = {
            TotalAdults: totalAdults,
            TotalChildren: totalChildren
        };

    
   
   if(markup){
    HotelDetails['Price']['AdminMarkup']=0;
    HotelDetails['Price']['AgentMarkup']=0;
        if (markup.markupDetails.adminMarkup[0] != undefined) {
            const AdminMarkup = markup.markupDetails.adminMarkup[0];
            if (AdminMarkup.value_type == 'percentage') {
                let percentVal = (HotelDetails['Price']['Amount'] * AdminMarkup.value) / 100;
                HotelDetails['Price']['AdminMarkup']=parseFloat(percentVal.toFixed(2));
                HotelDetails['Price']['Amount'] += percentVal;
                HotelDetails['Price']['Amount'] = parseFloat(HotelDetails['Price']['Amount'].toFixed(2));
            } else if (AdminMarkup.value_type == 'plus') {
                AdminMarkup.value=(AdminMarkup.value*conversionRate).toFixed(2);
                HotelDetails['Price']['AdminMarkup']=parseFloat(AdminMarkup.value);
                HotelDetails['Price']['Amount'] += HotelDetails['Price']['AdminMarkup'];
                
            }
           }
           if (markup.markupDetails.agentMarkup != undefined && markup.markupDetails.agentMarkup[0] != undefined) {
            const AgentMarkup = markup.markupDetails.agentMarkup[0];
            if (AgentMarkup.value_type == 'percentage') {
                let percentVal = (HotelDetails['Price']['Amount'] * AgentMarkup.value) / 100;
                HotelDetails['Price']['AgentMarkup']=parseFloat(percentVal.toFixed(2));
                HotelDetails['Price']['Amount'] += percentVal;
                HotelDetails['Price']['Amount'] = parseFloat(HotelDetails['Price']['Amount'].toFixed(2));
            } else if (AgentMarkup.value_type == 'plus') {
                AgentMarkup.value=(AgentMarkup.value).toFixed(2);
                HotelDetails['Price']['AgentMarkup']=parseFloat(AgentMarkup.value);
                HotelDetails['Price']['Amount'] += HotelDetails['Price']['AgentMarkup'];
                
            }
           }
           HotelDetails["Price"]["Fare"] = HotelDetails["Price"]["Amount"] 
           count = totalCount.TotalAdults + totalCount.TotalChildren;
           convinenceFee = await this.hotelDbService.getConvineneceFee(HotelDetails["Price"]["Amount"],HotelDetails.searchRequest.Currency,count)
           HotelDetails["Price"]["Amount"] += convinenceFee
           HotelDetails['HotelPolicy']=hotelPolicy;
            
        HotelDetails['Price']['Amount'] = parseFloat(HotelDetails['Price']['Amount'].toFixed(2));
        if(HotelDetails['HotelPolicy'] && HotelDetails['HotelPolicy'][0]){
            HotelDetails['HotelPolicy'][0].amount=parseFloat(HotelDetails['HotelPolicy'][0].amount)+HotelDetails['Price']['AdminMarkup']+HotelDetails['Price']['AgentMarkup'];
            HotelDetails['HotelPolicy'][0].amount=parseFloat(HotelDetails['HotelPolicy'][0].amount.toFixed(2));
            }

        parsedInfo.Rooms[0].Price.Amount=parseFloat(parsedInfo.Rooms[0].Price.Amount.toFixed(2))+HotelDetails['Price']['AdminMarkup']+HotelDetails['Price']['AgentMarkup'];
    }
        const cancelCapDays = await this.hotelDbService.getCanelCappingDays('hotel')
        let totalCancelCharge: any =0;
        let FirstCancelDate: any =``;
        for (let index = 0; index < parsedInfo.Rooms.length; index++) {
            const room = parsedInfo.Rooms[index];

           
            let cancelationString=``;
            let CancellationDeadline:any =``;
            let nonrefundableDate:any=``;
            let APICancellationDeadline:any =``;
            let NonRefundable=true;
           
           if(room.cancellationDetails != undefined && room.cancellationDetails.length > 0){
            const { DateTime } = require('luxon');
            let newDateTime1:any=``;
            room.cancellationDetails.forEach(cancelElement => {
                // Input date string
                const dateStr = cancelElement.from;
                
                // Parse the date and time zone
                const dateTime = DateTime.fromISO(dateStr);

                const today = new Date();

                // Convert the input date (anotherDate) to a Date object
                const dateToCompare = new Date(dateStr);
                if(body.UserType == "B2B"){
                    newDateTime1 = dateToCompare.setDate(dateToCompare.getDate() - cancelCapDays[0].days);
                    }else{
                        newDateTime1 = dateToCompare;
                    }
                    // newDateTime1= newDateTime1.toISOString().split('T')[0];
                    // today = today.toISOString().split('T')[0];
              console.log("today-",today);
              console.log("dateToCompare-",newDateTime1);
                // Compare the two dates
                if (newDateTime1 < today.getTime()) {
                    console.log("in-right");
                    nonrefundableDate ='true';
                  
                } else {
                    nonrefundableDate ='false';
                    console.log("in-wrong");
                  
                }
            });
            
            if(nonrefundableDate == 'true'){
                NonRefundable= room['NonRefundable'] = true;
            }else{
            for (let i = 0; i < room.cancellationDetails.length; i++) {
                let cancelFlag =0;
                const canc = room.cancellationDetails[i];
                let newDateTime:any = ``;
                const { DateTime } = require('luxon');

                    // Input date string
                    const dateStr = canc.from;
                    
                    // Parse the date and time zone
                    const dateTime = DateTime.fromISO(dateStr);
                    
                    // Convert to desired time zone if needed (e.g., UTC)
                    const dateTimeInUTC = dateTime.toUTC();
                    
                    // Subtract days
                    if(body.UserType == "B2B"){
                        newDateTime = dateTimeInUTC.minus({ days: cancelCapDays[0].days });
                        }else{
                            newDateTime = dateTimeInUTC;
                        }
                    
                    // Print the result in ISO format
                    console.log(newDateTime.toISO());

                    if(cancelFlag == 0){
                        FirstCancelDate= CancellationDeadline = newDateTime.toISO();
                        APICancellationDeadline = canc.from;
                    }
                    let cancelCharge : any = 0;
                    console.log("Typof-",typeof canc.amount);
                   
                    const cancelPrice =canc.amount  ;
         
            cancelCharge=parseFloat(Number(cancelPrice).toFixed(2));
          
            const customDatePart = newDateTime.toISO().split('T')[0];
            const [year, month, day] = customDatePart.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            const customTimePart = newDateTime.toISO().split('T')[1].split('.')[0];

                    cancelationString =` Cancellation Charge ${cancelCharge}  ${HotelDetails.searchRequest.Currency} From  ${formattedDate} ${customTimePart}  ,`;
                cancelationString +=``
            }
        }
        }
            parsedInfo.Rooms[index].cancellationPolicies = cancelationString;
            parsedInfo.Rooms[index].CancellationDeadline = CancellationDeadline;
            parsedInfo.Rooms[index].APICancellationDeadline = APICancellationDeadline;
            
        }
       
        HotelDetails.RoomDetails=parsedInfo.Rooms;

        for (let i = 0; i < HotelDetails['HotelPolicy'].length; i++) {
            let cancelFlag =0;
            const canc = HotelDetails['HotelPolicy'][i];
            let newDateTime:any = ``;
            const { DateTime } = require('luxon');

                // Input date string
                const dateStr = canc.from;
                
                // Parse the date and time zone
                const dateTime = DateTime.fromISO(dateStr);
                
                // Convert to desired time zone if needed (e.g., UTC)
                const dateTimeInUTC = dateTime.toUTC();
                
                // Subtract days
                if(body.UserType == "B2B"){
                    newDateTime = dateTimeInUTC.minus({ days: cancelCapDays[0].days });
                    }else{
                        newDateTime = dateTimeInUTC;
                    }
                
                // Print the result in ISO format
                console.log(newDateTime.toISO());

                if(cancelFlag == 0){
                    FirstCancelDate = newDateTime.toISO();
                    
                }
                let cancelCharge : any = 0;
                console.log("Typof-",typeof canc.amount);
               
                const cancelPrice =canc.amount  ;
     
        cancelCharge=parseFloat(Number(cancelPrice).toFixed(2));
        totalCancelCharge += cancelCharge ;
                
        }
        totalCancelCharge=parseFloat(Number(totalCancelCharge).toFixed(2));
                            // Custom format for date (e.g., YYYY-MM-DD)
        const customDatePart = FirstCancelDate.split('T')[0];
        const [year, month, day] = customDatePart.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        const customTimePart = FirstCancelDate.split('T')[1].split('.')[0];
        
        HotelDetails.CancelPolicy  =` Cancellation Charge ${totalCancelCharge} ${HotelDetails.searchRequest.Currency} From ${formattedDate} ${customTimePart} ,`;
        HotelDetails.Price.ConvinenceValue = convinenceFee
               
        const token = this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(HotelDetails));
        HotelDetails.ResultToken = response["access_key"];
       
        return HotelDetails;
    }else{
        const errorClass: any = getExceptionClassByCode(`400 ${roomDetail.error.message}`);
        throw new errorClass(`${roomDetail.error.message}`);
    
    }
    }catch (error) {
        const errorClass: any = getExceptionClassByCode(`400 ${error.message}`);
        throw new errorClass(`400 ${error.message}`);
        }
    }
    catch (error) {
        const errorClass: any = getExceptionClassByCode(error.message);
        throw new errorClass(error.message);
    }
    }

    async getCheckrateRequest(body: any): Promise<any> {
        let request={
            language: "ENG",
            upselling: "False",
            rooms:body
        }
        return request;
    }

    formatReservationRequestHotelbeds(paxes: any, room: any , searchRequest) {
        let guests = [];
        let rooms:any = [];
       
        let request:any = `<bookingRQ xmlns="http://www.hotelbeds.com/schemas/messages"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <holder name="${paxes[0].first_name}" surname="${paxes[0].last_name}"/>`;
        // paxes.pop();
    
    //  room.forEach((roomElement,Index) => {
    //    rooms= {
    //         rateKey: roomElement.room_id,
    //         paxes: [{
    //             roomId: (Index+1),
    //             type: "AD",
    //             name: "First Adult Name",
    //             surname: "Surname"
    //         }]
    //     }
    //  });

    let newPaxes: any = [];

    paxes.forEach((paxElement, paxIndex) => {
        if(typeof newPaxes[parseInt(paxElement.address2)-1]=="undefined"){
            newPaxes[parseInt(paxElement.address2)-1]=[];
        }
        newPaxes[parseInt(paxElement.address2)-1].push(paxElement);
    });
    
    searchRequest.forEach((r, i) => {
        if(r.Rooms!=undefined){
            r.paxCount=r.Rooms+"~"+r.NoOfAdults+"~"+r.NoOfChild;
        }
    })

    let roomPax: any = [];

    newPaxes.forEach((newPaxElement, newPaxIndex) => {
        let adltCount=0;
        let chldCount=0;
        let roomCount=0;
        newPaxElement.forEach(roomElement => {
            if(roomElement.pax_type=='Adult'){
                adltCount+=1;
            }else if(roomElement.pax_type=='Child'){
                chldCount+=1;
            }
            
       });
       if(roomPax[adltCount+"~"+chldCount]==undefined){
        roomPax[adltCount+"~"+chldCount]=[];
       }
       roomPax[adltCount+"~"+chldCount].push(newPaxElement);
            
       
    });
    let finalRoomPax: any =[]; 
    for (let x in roomPax) {
        finalRoomPax[roomPax[x].length+"~"+x]=roomPax[x];
      } 

      

    request+=`<rooms>`;
    room.forEach((roomDetails, roomsIndex) => {
        request+=`<room rateKey="${roomDetails.room_id}"><paxes>`;
        
        finalRoomPax[roomDetails.attributes].forEach((element, roomIndex) => {
            element.forEach(paxes => {
                if (paxes.pax_type==="Adult" ) {
           
                    request+=`<pax roomId="${roomIndex+1}" type="AD" age="30" name="${paxes.first_name}" surname="${paxes.last_name}"/>`;
                   
                }else if (paxes.pax_type==="Child") {
                   
                    request+=`<pax roomId="${roomIndex+1}" type="CH" age="5" name="${paxes.first_name}" surname="${paxes.last_name}"/>`;
                    
                }     
           });
          
                  
 
            });  
            request+=`</paxes></room>`;
    });  
    request+=`</rooms>`;

    
    //     searchRequest.forEach((r, i) => {


    //         request+=`<room rateKey="${room[i].room_id}"><paxes>`;

         
    //         newPaxes[i].forEach((element, index) => {
    //         // if(parseInt(element.address2)==(i+1)){
    //             if (element.pax_type==="Adult" ) {
    //         //         let pax = {
    //         //             roomId: i + 1,
	// 		// type: "AD",
	// 		// name: element.first_name,
	// 		// surname: element.last_name
                      
    //         //         }
    //         //         guests.push(pax);
    //         request+=`<pax roomId="1" type="AD" age="30" name="${element.first_name}" surname="${element.last_name}"/>`;
           
    //     }else if (element.pax_type==="Child") {
    //         //         let pax = {
    //         //             roomId: i + 1,
	// 		// type: "CH",
	// 		// name: element.first_name,
	// 		// surname: element.last_name
    //         //         }
    //         //         guests.push(pax);
    //         request+=`<pax roomId="1" type="CH" age="7" name="${element.first_name}" surname="${element.last_name}"/>`;
            
    //     }            
    // // }   
    //         });  
            
    //         //       rooms= {
    //         // rateKey: room[i].room_id,
    //         // paxes: guests
    //         request+=`</paxes></room>`;
        
    // });
    // request+=`</rooms>`;
        
        //     var count = 0;
        //     let AdultArray = paxes.filter(ele=>ele.pax_type ==="Adult")
        //     let ChildArray = paxes.filter(ele=>ele.pax_type === "Child")
        //     while (count < r["NoOfAdults"]) {
        //         AdultArray.splice(0,1);
        //         if(count < r["NoOfChild"]){
        //             ChildArray.splice(0,1)
        //         }
        //         count++;                
        // }
        // paxes = [...AdultArray,...ChildArray]
       
   
    request+=`<clientReference>Booking247LTD</clientReference></bookingRQ>`;
    
    // request={
    //     holder: {
    //         name: paxes[0].first_name,
    //         surname: paxes[0].last_name
    //     },
    //     rooms:rooms,
    //     clientReference:room[0].app_reference
    // }

        return request
    }


    async formatReservationRequest(booking: any, pax: any, room: any,body) {
        try{
            let UserType = JSON.parse(booking[0]['attributes'].replace(/'/g,'"')).searchRequest.UserType;
            let searchRequest = JSON.parse(booking[0]['attributes'].replace(/'/g,'"')).searchRequest.RoomGuests;
        const header = await this.getHeaderXML('BOOKING_REQUEST', 'Request',UserType);
        const xmlHeader = await this.getAPIHeader('BOOKING_INSERT_REQUEST');
        const nights = noOfNights(parseInt(booking[0]['hotel_check_in']), parseInt(booking[0]['hotel_check_out']));
        const ArrivalDate =new Date( parseInt(booking[0]['hotel_check_in']))
        //change date data
        const ArrivalDateRequest = formatDate(ArrivalDate)
        const passengerData = pax;
       
        // let searchRequest = JSON.parse(booking[0]['attributes'].replace(/'/g,'"')).RoomGuests;
       
       
        let BookingRequest = this.formatReservationRequestHotelbeds(pax , room , searchRequest)
        console.log(BookingRequest);
        const givenUrl = `${HOTELBEDS_URL}bookings`;
        
        const BookingResponse: any = await this.httpService.post(givenUrl,BookingRequest, {
                
            headers: header
        }).toPromise();
        console.log(BookingResponse);
        const fs = require('fs');
        fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/BookingREQ_${booking[0]['app_reference']}.xml`, BookingRequest);
        fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/BookingRES_${booking[0]['app_reference']}.xml`, BookingResponse);
         
        // const BookingResponse = fs.readFileSync(`${logStoragePath}/hotels/HotelBeds/BookingRES.xml`,
        // { encoding: 'utf8', flag: 'r' });
        
        // const responseXml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><MakeRequestResponse xmlns="http://www.goglobal.travel/"><MakeRequestResult>&lt;Root&gt;&lt;Header&gt;&lt;Agency&gt;124246&lt;/Agency&gt;&lt;User&gt;TALONXMLTEST&lt;/User&gt;&lt;Password&gt;XSG9HMRGMCHL&lt;/Password&gt;&lt;Operation&gt;BOOKING_INSERT_RESPONSE&lt;/Operation&gt;&lt;OperationType&gt;Response&lt;/OperationType&gt;&lt;/Header&gt;&lt;Main&gt;&lt;GoBookingCode&gt;18779336&lt;/GoBookingCode&gt;&lt;GoReference&gt;GO17328763-18779336-A(INT)&lt;/GoReference&gt;&lt;ClientBookingCode&gt;Test AgRef&lt;/ClientBookingCode&gt;&lt;BookingStatus&gt;C&lt;/BookingStatus&gt;&lt;TotalPrice&gt;396&lt;/TotalPrice&gt;&lt;Currency&gt;EUR&lt;/Currency&gt;&lt;HotelId&gt;&lt;![CDATA[623891]]&gt;&lt;/HotelId&gt;&lt;HotelName&gt;&lt;![CDATA[NEW BEDFORD HARBOR HOTEL]]&gt;&lt;/HotelName&gt;&lt;HotelSearchCode&gt;13752803/6574339798810938729/9&lt;/HotelSearchCode&gt;&lt;RoomType&gt;&lt;![CDATA[]]&gt;&lt;/RoomType&gt;&lt;RoomBasis&gt;&lt;![CDATA[BB]]&gt;&lt;/RoomBasis&gt;&lt;ArrivalDate&gt;2021-07-10&lt;/ArrivalDate&gt;&lt;CancellationDeadline&gt;2021-07-08&lt;/CancellationDeadline&gt;&lt;Nights&gt;2&lt;/Nights&gt;&lt;NoAlternativeHotel&gt;1&lt;/NoAlternativeHotel&gt;&lt;Leader LeaderPersonID="1"/&gt;&lt;Rooms&gt;&lt;RoomType Adults="2" &gt;&lt;Room RoomID="1" Category="Room King Size Bed"&gt;&lt;PersonName PersonID="1" Title="MR." FirstName="RAJESH" LastName="MALAKAR" /&gt;&lt;PersonName PersonID="2" Title="MR." FirstName="RAMESH" LastName="MALAKAR" /&gt;&lt;/Room&gt;&lt;/RoomType&gt;&lt;/Rooms&gt;&lt;Preferences&gt;&lt;AdjoiningRooms&gt;&lt;![CDATA[]]&gt;&lt;/AdjoiningRooms&gt;&lt;ConnectingRooms&gt;&lt;![CDATA[]]&gt;&lt;/ConnectingRooms&gt;&lt;LateArrival&gt;&lt;![CDATA[]]&gt;&lt;/LateArrival&gt;&lt;/Preferences&gt;&lt;Remark&gt;&lt;![CDATA[NO AMENDMENTS POSSIBLE. IF NEEDED, PLEASE CANCEL AND REBOOK!!
//  CXL charges apply as follows:  STARTING 08/07/2021 CXL-PENALTY FEE IS 100.00% OF BOOKING PRICE.,  As a result of local government measures and guidelines put in place by services providers – including hotels and ancillaries – guests 
// may find that some facilities or services are not available.Please visit https://static-sources.s3-eu-west-1.amazonaws.com/policy/index.html for further information (18/05/2020 - 31/12/2021).,  STARTING 08/07/2021 CXL-PENALTY FEE IS 100.00% OF BOOKING PRICE.,  As a result of local government measures and guidelines put in place by services providers – including hotels and ancillaries – guests may find that some facilities or services are not available.Please visit https://static-sources.s3-eu-west-1.amazonaws.com/policy/index.html for further information (18/05/2020 - 31/12/2021)., Accommodation category: 2 STARS. Reference: 255-4014109]]&gt;&lt;/Remark&gt;&lt;/Main&gt;&lt;/Root&gt;</MakeRequestResult></MakeRequestResponse></soap:Body></soap:Envelope>`
        const valuationResp:any = await this.xmlToJson(BookingResponse);
 
        const BookedResponse = valuationResp.bookingRS.booking                    
        return this.HotelBedsTransformService.updateData(BookedResponse,body, booking ,passengerData,room);
    }  catch (error) {
        const errorClass: any = getExceptionClassByCode(error.message);
        throw new errorClass(error.message);
    }
    }

    async hotelsReservation(body: any): Promise<any> {
        let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
        let paxDetails = await this.hotelDbService.getHotelBookingPaxDetails(body);
        let roomDetails = await this.hotelDbService.getHotelBookingItineraryDetails(body);
       
        let formattedRequest = this.formatReservationRequest(bookingDetails, paxDetails, roomDetails,body);
        return formattedRequest;
    }

    async cancelReservation(body:any){
        const header = await this.getHeader('BOOKING_CANCEL_REQUEST', 'Request','B2C');
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
    return this.HotelBedsTransformService.updateCancelledData(converted['Root']['Main'],body);


    }

    async hotelsCancellation(body: any): Promise<any> {
        try {
            let bookingDetail = await this.hotelDbService.getHotelBookingDetails(body);

            //Live URL 
            // const givenUrl = `${HOTELBEDS_URL}booking/${bookingDetails[0].booking_reference}`;
            //Test URL
            const givenUrl = `${HOTELBEDS_URL}bookings/${bookingDetail[0].booking_reference}`;
            
            const header = await this.getHeader('CancellationRequest','Request',bookingDetail[0].booking_source);
            let CancelBooking: any = await this.httpService.delete(givenUrl, {
                headers: header

            }).toPromise();
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/${body["AppReference"]}-CancelBookingnRQ.json`, JSON.stringify(body));
                fs.writeFileSync(`${logStoragePath}/hotels/HotelBeds/${body["AppReference"]}-CancelBookingRS.json`, JSON.stringify(CancelBooking));
            }
        //     const fs = require('fs');
        //      const CancelBookingData = fs.readFileSync(`${logStoragePath}/hotels/HotelBeds/${body["AppReference"]}-CancelBookingRS.json`);
        // const CancelBooking = JSON.parse(CancelBookingData);
            
            if (CancelBooking.booking.status=='CANCELLED') {
                
                let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
               
                let response = await this.hotelDbService.updateHotelCancelDetails(bookingDetails[0], body);
                console.log(response);
                return response;
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ${CancelBooking.Message}`);
                throw new errorClass(`400 ${CancelBooking.Message}`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
    
}

