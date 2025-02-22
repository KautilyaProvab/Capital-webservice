import { Body, HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { HOPPA_B2C_USERNAME, HOPPA_B2C_PASSWORD, HOPPA_B2B_USERNAME, HOPPA_B2B_PASSWORD, HOPPA_TRANSFER_URL, logStoragePath, TMX_DOMAINKEY, TMX_PASSWORD, TMX_SYSTEM, TMX_USER_NAME, BASE_CURRENCY } from "../../../constants";
import { TransferApi } from "../../transfer.api";
import { TransferDbService } from "../transfer-db.service";
import { HoppaTransformService } from "./hoppa-transform.service";
import * as moment from "moment";
const fs = require('fs');

@Injectable()
export class HoppaService extends TransferApi {
    Url = HOPPA_TRANSFER_URL
    constructor(
        private readonly httpService: HttpService,
        private transferDbService: TransferDbService,
        private hoppaTransformService: HoppaTransformService,
        private redisServerService: RedisServerService) {
        super()
    }

    async Availability(@Body() body: any): Promise<any> {
       
        try {
            const givenUrl = `${this.Url}`;
            
            let username: string='';
            let password: string='';
            if(body.UserType == 'B2C'){
                username=HOPPA_B2C_USERNAME;
                password=HOPPA_B2C_PASSWORD;
            }else if(body.UserType == 'B2B'){
                username=HOPPA_B2B_USERNAME;
                password=HOPPA_B2B_PASSWORD;
            }
            

            
          // let CityDetails = await this.transferDbService.CityDetailsById(body.FromCityId, body.ToCityId);
            
            // let From = CityDetails['From'][0];
            // let To = CityDetails['To'][0];
            let RetDateTime = ``;
            if (body.IsReturn) {

                RetDateTime = `<RetDate>${body.ReturnDate}</RetDate>
        <RetTime>${body.RetTime.replace(":", "")}</RetTime>`;
            }
            //BLR 13.1986351013184,77.7065963745117
            //"Bangalore City Centre","lat":"12.9792814254761","long":"77.6374816894531","loctype":"RT"
            let xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT">
    <TransferOnly>
        <P2PAvailability>
            <Request>
                <Username>${username}</Username>
                <Password>${password}</Password>
                <Lang>EN</Lang>
                <LatitudeP1>${body.From.latitude}</LatitudeP1>
                <LongitudeP1>${body.From.longitude}</LongitudeP1>
                <LatitudeP2>${body.To.latitude}</LatitudeP2>
                <LongitudeP2>${body.To.longitude}</LongitudeP2>
                <PlaceFrom>${body.From.name}</PlaceFrom>
                <PlaceTo>${body.To.name}</PlaceTo>
                <CountryCodeFrom>${body.From.country_code}</CountryCodeFrom>
                <CountryCodeTo>${body.To.country_code}</CountryCodeTo>
                <IsReturn>${body.IsReturn}</IsReturn>
                <ArrDate>${body.ArrivalDate}</ArrDate>
                <ArrTime>${body.ArrTime.replace(":", "")}</ArrTime>
                ${RetDateTime}
                <Adults>${body.AdultCount}</Adults>
                <Children>${body.ChildCount}</Children>
                <Infants>${body.InfantCount}</Infants>
                <ResponseType>0</ResponseType>
                <CalcJ1PickupTime>1</CalcJ1PickupTime>
                <CalcJ2PickupTime>1</CalcJ2PickupTime>
                <GoogleAPIKey></GoogleAPIKey>
            </Request>
        </P2PAvailability>
    </TransferOnly>
</TCOML>`;

// <LatitudeP1>${CityDetails['From'][0].lat}</LatitudeP1>
// <LongitudeP1>${CityDetails['From'][0].lng}</LongitudeP1>
// <LatitudeP2>${CityDetails['To'][0].lat}</LatitudeP2>
// <LongitudeP2>${CityDetails['To'][0].lng}</LongitudeP2>
// <PlaceFrom>${CityDetails['From'][0].destination_name }</PlaceFrom>
// <PlaceTo>${CityDetails['To'][0].destination_name }</PlaceTo>
// <CountryCodeFrom>ES</CountryCodeFrom>
// <CountryCodeTo>ES</CountryCodeTo>
// <IATAj1>PMI</IATAj1>
//                 <IATAj2>IBZ</IATAj2>
console.log('givenUrl-',givenUrl);
console.log('xmlRequest-',xmlRequest);



const resultApi: any = await this.httpService.post(givenUrl, xmlRequest, {
    headers: {
       'http-equiv':'Content-Type',
        'content':'text/html; charset=utf-8',
        'Content-Type': 'application/xml'
    }
}).toPromise();

console.log("resultApi-",resultApi);
// let config = {
//     method: 'post',
//     maxBodyLength: Infinity,
//     url: `${this.Url}`,
//     headers: { 
//       'http-equiv': 'Content-Type', 
//       'content': 'text/html; charset=utf-8', 
//       'Content-Type': 'application/xml'
//     },
//     data : xmlRequest
//   };
//   let resultApi:any="";
//   axios.request(config)
//   .then((response) => {
//     resultApi=response; 
//     console.log("API RESPONCE VARUTHEI",resultApi);
//   })
//   .catch((error) => {
//     console.log(error);
//   });
 
            if (this.isLogXml) {
                const fs = require('fs');
                 
                fs.writeFileSync(`${logStoragePath}/transfer/hoppa/SearchRQ.xml`, xmlRequest);
                fs.writeFileSync(`${logStoragePath}/transfer/hoppa/SearchRS.xml`, resultApi);
            }
            const fs = require('fs');
                //  const StaticResponse = fs.readFileSync(`${logStoragePath}/transfer/hoppa/SearchRS_Static.xml`,{ encoding: 'utf8', flag: 'r' });
                 
                let result =await this.xmlToJson(resultApi);
            if (result['TCOML'].TransferOnly.P2PResults.Response != undefined) {
                let placeFrom = result['TCOML'].TransferOnly.P2PResults.Request.PlaceFrom['$t'];
                let placeTo = result['TCOML'].TransferOnly.P2PResults.Request.PlaceTo['$t'];

                // let CityDetails = await this.transferDbService.CityDetailsByCode(placeFrom, placeTo);

                // if(CityDetails['From'][0]){
                //     result['TCOML'].TransferOnly.P2PResults.Request.PlaceFrom['$t']=CityDetails['From'][0].location_name;
                // }

                // if(CityDetails['To'][0]){
                //     result['TCOML'].TransferOnly.P2PResults.Request.PlaceFrom['$t']=CityDetails['To'][0].location_name;
                // }
                const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(body);
            
                let currencyDetails: any = [];
                if (body.Currency != BASE_CURRENCY) {
                    currencyDetails = await this.getGraphData(`query {
                                                                        cmsCurrencyConversions(where: {
                                                                            currency: {
                                                                                eq:"${body.Currency}"
                                                                            } 
                                                                        }
                                                                        ) {
                                                                            id
                                                                            currency
                                                                            value
                                                                            status
                                                                        }
                                                                    }
                                                                `, "cmsCurrencyConversions");
                }
                let response:any = [];
                for (let transfer of result['TCOML'].TransferOnly.P2PResults.Response.Transfers.Transfer) {
                    if (transfer.Price.PriceBreakup==undefined){
                        transfer.Price.PriceBreakup={};
                    }
                    
                    let exchangeRate: any = 1;
                    const token = this.redisServerService.geneateResultToken(body);
                    transfer.SessionID = result['TCOML'].TransferOnly.P2PResults.SessionID['$t'];
                    transfer.Request =result['TCOML'].TransferOnly.P2PResults.Request;
                    const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...transfer, body }));
                    let totalFare: any = Number(transfer.Price.$t);
                    let totalCommission: any = 0;
                    let tdsOnCommission: any = 0;
                    if (currencyDetails.length > 0) {
                        // exchangeRate =parseFloat( Number(currencyDetails[0].value).toFixed(2));
                        exchangeRate = Math.floor(Number(currencyDetails[0].value) * 100) / 100;
                        totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                        // totalCommission = totalCommission* exchangeRate;
                        tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                    }
                    const markupAndCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails));
                    const markupDetails = await this.markupDetails(markupAndCommission, totalFare, exchangeRate);
                    
                    if (body.UserType === "B2B") {
                        transfer.Price.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        let specificCommission = markupAndCommissionDetails.commissionDetails.commission;
                        // transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                        if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                            if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            }
                        }
                        transfer.Price.PriceBreakup.AgentCommission = totalCommission;
                        transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        
                        transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        transfer.Price.Amount = totalFare;
                        transfer.Price.Currency = body.Currency;
                    } else if (body.UserType === "B2C") {
                        transfer.Price.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        transfer.Price.TotalDisplayFare = Number(parseFloat(Number(totalFare) + markupDetails.AdminMarkup).toFixed(2));
                        transfer.Price.AgentNetFare = Number(parseFloat(totalFare + markupDetails.AdminMarkup).toFixed(2));
                        transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                        transfer.Price.Amount = totalFare;
                        transfer.Price.Currency = body.Currency;
                    }
                    let Request = result['TCOML'].TransferOnly.P2PResults.Request;
                    transfer = await this.hoppaTransformService.availabilityResponseFormat(transfer,Request, body)
                    delete transfer.data;
                    transfer.searchBody = body;
                    transfer.ResultIndex = redis["access_key"];
                    transfer.BookingSource = body.BookingSource
                    response.push(transfer)
                }
                return response;
            } else {
                throw new Error(`400 Response Not Found`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async markupDetails(body: any, totalFare: any, exchangeRate: any = 1): Promise<any> {
        let AdminMarkup = 0;
        let AgentMarkup = 0;
        const markupDetails: any = body.markupDetails;
        if (markupDetails.adminMarkup && markupDetails.adminMarkup.length > 0) {
            markupDetails.adminMarkup.forEach((markup: any) => {
                markup.value = parseFloat((markup.value * exchangeRate).toFixed(2));
                if (markup.value_type === "plus") {
                    AdminMarkup += markup.value;
                } else if (markup.value_type === "percentage") {
                    AdminMarkup += (totalFare * markup.value) / 100
                }
            });
        }

        if (markupDetails.agentMarkup && markupDetails.agentMarkup.length > 0) {
            markupDetails.agentMarkup.forEach((markup: any) => {
                markup.value = parseFloat((markup.value).toFixed(2));
                if (markup.value_type === "plus") {
                    AgentMarkup += markup.value;
                } else if (markup.value_type === "percentage") {
                    AgentMarkup += (totalFare * markup.value) / 100
                }
            });
        }

        return {
            AdminMarkup,
            AgentMarkup
        }
    }

    async ProductDetails(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data: any = await this.redisServerService.read_list(body.ResultToken)
               
                let parsedData: any = JSON.parse(data[0]);

                let format = {
                    ProductCode: parsedData.ProductCode,
                    ResultToken: parsedData.ResultToken
                }

                
                // const givenUrl = `${this.Url}ProductDetails`;
                // const result: any = await this.httpService.post(givenUrl, format, {
                //     headers: {
                //         'Accept': 'application/json',
                //         'Accept-Language': 'en',
                //         'x-username': TMX_USER_NAME,
                //         'x-password': TMX_PASSWORD,
                //         'x-domainkey': TMX_DOMAINKEY,
                //         'x-system': TMX_SYSTEM
                //     }
                // }).toPromise();

                const transfer = parsedData;
                let Disclaimer:any =[];

                const givenUrl = `${this.Url}`;
            
                    let username: string='';
                    let password: string='';
                    if(body.UserType == 'B2C'){
                        username=HOPPA_B2C_USERNAME;
                        password=HOPPA_B2C_PASSWORD;
                    }else if(body.UserType == 'B2B'){
                        username=HOPPA_B2B_USERNAME;
                        password=HOPPA_B2B_PASSWORD;
                    }
                
                if(transfer.Disclaimer && transfer.Disclaimer['$t']=='1'){
                    
                    let DisclaimerReq =`<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT" >
<TransferOnly>
<Info>
<Disclaimer>
                <Username>${username}</Username>
                <Password>${password}</Password>
                <Lang>EN</Lang>
                <SessionID>${transfer.SessionID}</SessionID> 
                <BookingID>${transfer.BookingID['$t']}</BookingID>  
</Disclaimer>
</Info>
</TransferOnly>
</TCOML>`;
const ApiResult: any = await this.httpService.post(givenUrl, DisclaimerReq, {
    headers: {
        'http-equiv':'Content-Type',
         'content':'text/html; charset=utf-8',
         'Content-Type': 'application/xml'
     }
}).toPromise();

const fs = require('fs');
// const resultApi = fs.readFileSync(`${logStoragePath}/transfer/hoppa/DisclaimerStaticRS.xml`,{ encoding: 'utf8', flag: 'r' });

let result =await this.xmlToJson(ApiResult);

if (this.isLogXml) {
    const fs = require('fs');
    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/DisclaimerRQ.xml`, DisclaimerReq);
    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/DisclaimerRS.xml`, ApiResult);
}
result['TCOML'].TransferOnly.Info.Disclaimer.Disclaimer_Info=this.forceObjectToArray(result['TCOML'].TransferOnly.Info.Disclaimer.Disclaimer_Info);
result['TCOML'].TransferOnly.Info.Disclaimer.Disclaimer_Info.forEach(element => {
    const desc = {Title:element.Title['$t'],
        Description:element.Description['$t']
    }
    Disclaimer.push(desc);
   });
   console.log(Disclaimer);
               
            }

            //Extras
            let ExtrasReq =`<?xml version="1.0" encoding="UTF-8"?>
            <TCOML version="NEWFORMAT" >
            <TransferOnly>
             <P2PExtras>
              <Availability>
                            <Username>${username}</Username>
                            <Password>${password}</Password>
                            <SessionID>${transfer.SessionID}</SessionID> 
                            <BookingID>${transfer.BookingID['$t']}</BookingID>  
                </Availability>
             </P2PExtras>
            </TransferOnly>
            </TCOML>`;
            const ExtrasResult: any = await this.httpService.post(givenUrl, ExtrasReq, {
                headers: {
                    'http-equiv':'Content-Type',
                     'content':'text/html; charset=utf-8',
                     'Content-Type': 'application/xml'
                 }
            }).toPromise();
            
            // const fs = require('fs');
            // const resultApi = fs.readFileSync(`${logStoragePath}/transfer/hoppa/ExtrasResultStaticRS.xml`,{ encoding: 'utf8', flag: 'r' });
            const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/ExtrasRQ.xml`, ExtrasReq);
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/ExtrasRS.xml`, ExtrasResult);
            let ExtrasApiResult =await this.xmlToJson(ExtrasResult);
            
            let Extras:any = [];
            if(ExtrasApiResult['TCOML'].TransferOnly.P2PResults.errors == undefined && ExtrasApiResult['TCOML'].TransferOnly.P2PResults.Extras){
            Extras = ExtrasApiResult['TCOML'].TransferOnly.P2PResults.Extras.Response.Avline;
            }
            
               
                if (transfer.BookingID) {
                    const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(parsedData.body);
                   
                    let currencyDetails: any = [];
                    if (parsedData.body.Currency != BASE_CURRENCY) {
                        currencyDetails = await this.getGraphData(`query {
                                                                            cmsCurrencyConversions(where: {
                                                                                currency: {
                                                                                    eq:"${parsedData.body.Currency}"
                                                                                } 
                                                                            }
                                                                            ) {
                                                                                id
                                                                                currency
                                                                                value
                                                                                status
                                                                            }
                                                                        }
                                                                    `, "cmsCurrencyConversions");
                    }

                    let exchangeRate: any = 1;
                    let totalFare: any = Number(transfer.Price.$t);
                    let totalCommission: any = 0;
                    let tdsOnCommission: any = 0;
                    if (currencyDetails.length > 0) {
                        // exchangeRate =parseFloat( Number(currencyDetails[0].value).toFixed(2));
                        exchangeRate = Math.floor(Number(currencyDetails[0].value) * 100) / 100;
                        totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                        // totalCommission = totalCommission* exchangeRate;
                        tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                    }
                    console.log("exchangeRate-",exchangeRate);
                    let extrasArray:any=[];

                    if(Array.isArray(Extras)){
                    Extras.forEach(Extra => {
                        const transformedObject = {
                            count: Extra.count,
                            ExtrasID: Extra.ExtrasID.$t,
                            ExtrasCode: Extra.ExtrasCode.$t,
                            Extras_Description: Extra.Extras_Description.$t,
                            Price: parseFloat((Extra.Price.$t * exchangeRate).toFixed(2)),
                            Currency : body.Currency,
                            MaxNumberOfExtras: Extra.MaxNumberOfExtras.$t,
                            Category: Extra.Category.$t
                        };

                        extrasArray.push(transformedObject);
                    });
                }
                    const markupAndCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails));
                    const markupDetails = await this.markupDetails(markupAndCommission, totalFare, exchangeRate);
                    
                    if (body.UserType === "B2B") {
                        transfer.Price.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        let specificCommission = markupAndCommissionDetails.commissionDetails.commission;
                        // transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                        if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                            if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            }
                        }
                        transfer.Price.PriceBreakup.AgentCommission = totalCommission;
                        transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        transfer.Price.Amount = totalFare;
                        transfer.Price.Currency = body.Currency;
                    } else if (body.UserType === "B2C") {
                        transfer.Price.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        transfer.Price.TotalDisplayFare = Number(parseFloat(totalFare + markupDetails.AdminMarkup).toFixed(2));
                        transfer.Price.AgentNetFare = Number(parseFloat(totalFare + markupDetails.AdminMarkup).toFixed(2));
                        transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                        transfer.Price.Amount = totalFare;
                        transfer.Price.Currency = body.Currency;
                    }
                    const token = this.redisServerService.geneateResultToken(body);
                    transfer.Disclaimer=Disclaimer;
                    transfer.Extras=extrasArray;

                    let services = await this.hoppaTransformService.ProductDetailsResponseFormat(transfer)
                    const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...services, body:parsedData.body }));
                    services.ResultToken = redis["access_key"];
                    services.BookingSource = body.BookingSource
                    
                    return services;
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async TripList(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data: any = await this.redisServerService.read_list(body.ResultToken)
                let parsedData: any = JSON.parse(data[0]);

                let format = {
                    "ProductCode": parsedData.ProductCode,
                    "BookingDate": body.BookingDate,
                    "ResultToken": parsedData.ResultToken,
                    "ageBands": []
                }

                const descriptionToBandIdMap = {};
                parsedData.Product_AgeBands.forEach((ageBand) => {
                    descriptionToBandIdMap[ageBand.description] = ageBand.bandId;
                });

                for (const ageBand of parsedData.Product_AgeBands) {
                    const description = ageBand.description;

                    if (body && body[description + "Count"] > 0) {
                        const bandId = descriptionToBandIdMap[description];
                        format.ageBands.push({ "bandId": bandId, "count": body[description + "Count"] });
                    }
                }
                const givenUrl = `${this.Url}TripList`;
                const result: any = await this.httpService.post(givenUrl, format, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': TMX_USER_NAME,
                        'x-password': TMX_PASSWORD,
                        'x-domainkey': TMX_DOMAINKEY,
                        'x-system': TMX_SYSTEM
                    }
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/TripListRQ.json`, JSON.stringify(format));
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/TripListRS.json`, JSON.stringify(result));
                }

                if (result.Status == 1) {
                    const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(parsedData.body);
                    let currencyDetails: any = [];
                    if (parsedData.body.Currency != BASE_CURRENCY) {
                        currencyDetails = await this.getGraphData(`query {
                                                                            cmsCurrencyConversions(where: {
                                                                                currency: {
                                                                                    eq:"${parsedData.body.Currency}"
                                                                                } 
                                                                            }
                                                                            ) {
                                                                                id
                                                                                currency
                                                                                value
                                                                                status
                                                                            }
                                                                        }
                                                                    `, "cmsCurrencyConversions");
                    }
                    for (const transfer of result.TripList.Trip_list) {
                        transfer.BookingQuestions = parsedData.BookingQuestions;
                        transfer.Cancellation_Policy = parsedData.Cancellation_Policy
                        transfer.TermsAndConditions = parsedData.TermsAndConditions
                        transfer.Inclusions = parsedData.Inclusions
                        const token = this.redisServerService.geneateResultToken(body);
                        const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...transfer, body: parsedData.body }));
                        // transfer.Price.TotalDisplayFare = transfer.Price.TotalDisplayFare + markupAndCommission.AdminMarkup + markupAndCommission.AgentMarkup;

                        let exchangeRate: any = 1;
                        let totalFare: any = transfer.Price.TotalDisplayFare;
                        let totalCommission: any = transfer.Price.PriceBreakup.AgentCommission;
                        let tdsOnCommission: any = transfer.Price.PriceBreakup.AgentTdsOnCommision;
                        if (currencyDetails.length > 0) {
                            exchangeRate = Number(currencyDetails[0].value);
                            totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                            // totalCommission = totalCommission* exchangeRate;
                            tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                        }
                        const markupAndCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails));

                        const markupDetails = await this.markupDetails(markupAndCommission, totalFare, exchangeRate);

                        if (parsedData.body.UserType === "B2B") {
                            transfer.Price.markupDetails = markupDetails;
                            let specificCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails.commissionDetails.commission));
                            // transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                                if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                    totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                    totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                                }
                            }
                            transfer.Price.PriceBreakup.AgentCommission = totalCommission;
                            transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                            transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                            transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                            transfer.Price.Amount = totalFare;
                            transfer.Price.Currency = parsedData.body.Currency;
                        } else if (parsedData.body.UserType === "B2C") {
                            transfer.Price.markupDetails = markupDetails;
                            transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                            transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                            transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                            transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                            transfer.Price.Amount = totalFare;
                            transfer.Price.Currency = parsedData.body.Currency;
                        }
                        transfer.ResultIndex = redis["access_key"];
                    }
                    let TransferList: any = {
                        BookingSource: body.BookingSource,
                        TransferList: result.TripList.Trip_list,
                        ProductDetails: result.TripList.ProductDetails
                    }
                    return TransferList;
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Blocktrip(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data: any = await this.redisServerService.read_list(body.ResultToken)
                let parsedData: any = JSON.parse(data[0]);
                console.log("parsedData-",parsedData);
                 const givenUrl = `${this.Url}`;
            
                    let username: string='';
                    let password: string='';
                    if(body.UserType == 'B2C'){
                        username=HOPPA_B2C_USERNAME;
                        password=HOPPA_B2C_PASSWORD;
                    }else if(body.UserType == 'B2B'){
                        username=HOPPA_B2B_USERNAME;
                        password=HOPPA_B2B_PASSWORD;
                    }
                   
                    let Disclaimer:any =[];
                    
                    if(parsedData.Disclaimer && parsedData.Disclaimer.length > 0){
                       
                        let DisclaimerReq =`<?xml version="1.0" encoding="UTF-8"?>
    <TCOML version="NEWFORMAT" >
    <TransferOnly>
    <Info>
    <Disclaimer>
                    <Username>${username}</Username>
                    <Password>${password}</Password>
                    <Lang>EN</Lang>
                    <SessionID>${parsedData.SessionID}</SessionID> 
                    <BookingID>${parsedData.ProductCode}</BookingID>  
    </Disclaimer>
    </Info>
    </TransferOnly>
    </TCOML>`;
    const ApiResult: any = await this.httpService.post(givenUrl, DisclaimerReq, {
        headers: {
            'http-equiv':'Content-Type',
             'content':'text/html; charset=utf-8',
             'Content-Type': 'application/xml'
         }
    }).toPromise();
    
    const fs = require('fs');
    // const resultApi = fs.readFileSync(`${logStoragePath}/transfer/hoppa/DisclaimerStaticRS.xml`,{ encoding: 'utf8', flag: 'r' });
    
    let result =await this.xmlToJson(ApiResult);
    result['TCOML'].TransferOnly.Info.Disclaimer.Disclaimer_Info=this.forceObjectToArray(result['TCOML'].TransferOnly.Info.Disclaimer.Disclaimer_Info);
    result['TCOML'].TransferOnly.Info.Disclaimer.Disclaimer_Info.forEach(element => {
        const desc = {Title:element.Title['$t'],
            Description:element.Description['$t']
        }
        Disclaimer.push(desc);
       });
       console.log(Disclaimer);
                    if (this.isLogXml) {
                        const fs = require('fs');
                        fs.writeFileSync(`${logStoragePath}/transfer/hoppa/DisclaimerRQ.xml`, DisclaimerReq);
                        fs.writeFileSync(`${logStoragePath}/transfer/hoppa/DisclaimerRS.xml`, ApiResult);
                    }
                }
                   


                    let ReserveReq =`<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT" >
<TransferOnly>
<Booking> 
			<P2PReserve>
                <Username>${username}</Username>
                <Password>${password}</Password>
                <Lang>EN</Lang>
                  <SessionID>${parsedData.SessionID}</SessionID> 
                     <BookingID>${parsedData.ProductCode}</BookingID>   
</P2PReserve> 
			</Booking> 
</TransferOnly>
</TCOML>`;
const resultApi: any = await this.httpService.post(givenUrl, ReserveReq, {
    headers: {
        'http-equiv':'Content-Type',
         'content':'text/html; charset=utf-8',
         'Content-Type': 'application/xml'
     }
}).toPromise();

const fs = require('fs');
// const resultApi2 = fs.readFileSync(`${logStoragePath}/transfer/hoppa/ReserveStaticRS.xml`,{ encoding: 'utf8', flag: 'r' });

let result =await this.xmlToJson(resultApi);

              
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/ReserveRQ.xml`, ReserveReq);
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/ReserveRS.xml`, resultApi);
                }
              
                if (result['TCOML'].TransferOnly.P2PResults!=undefined && result['TCOML'].TransferOnly.P2PResults.Reserve.Response.PriceExpired['$t'] == 0) {
                    const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(parsedData.body);
                    let currencyDetails: any = [];
                    if (parsedData.body.Currency != BASE_CURRENCY) {
                        currencyDetails = await this.getGraphData(`query {
                                                                            cmsCurrencyConversions(where: {
                                                                                currency: {
                                                                                    eq:"${parsedData.body.Currency}"
                                                                                } 
                                                                            }
                                                                            ) {
                                                                                id
                                                                                currency
                                                                                value
                                                                                status
                                                                            }
                                                                        }
                                                                    `, "cmsCurrencyConversions");
                    }
                    let reserveResponse=result['TCOML'].TransferOnly.P2PResults.Reserve.Response;
                   reserveResponse.SessionID = result['TCOML'].TransferOnly.P2PResults.Reserve.Request.SessionID['$t']
                   reserveResponse.parsedData=parsedData;
                   //Airport = AP,Resort = RT,Port = PT,Train station = TN
                    
                    let exchangeRate: any = 1;
                    let totalFare: any = Number(reserveResponse.HolidayValue['$t']);
                    let totalCommission: any = 0;
                    let tdsOnCommission: any = 0;
                    if (currencyDetails.length > 0) {
                        // exchangeRate =parseFloat( Number(currencyDetails[0].value).toFixed(2));
                        exchangeRate = Math.floor(Number(currencyDetails[0].value) * 100) / 100;
                        totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                        // totalCommission = totalCommission* exchangeRate;
                        tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                    }

                    const markupDetails = await this.markupDetails(markupAndCommissionDetails, totalFare, exchangeRate);
                    reserveResponse.Price={};
                        reserveResponse.Price.PriceBreakup={};
                    if (parsedData.body.UserType === "B2B") {
                        
                        reserveResponse.Price.markupDetails = markupDetails;
                        let specificCommission = markupAndCommissionDetails.commissionDetails.commission;
                        // reserveResponse.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                        if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                            if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            }
                        }
                        reserveResponse.Price.PriceBreakup.AgentCommission = totalCommission;
                        reserveResponse.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        reserveResponse.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        reserveResponse.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        reserveResponse.Price.Amount = totalFare;
                        reserveResponse.Price.Currency = parsedData.body.Currency;
                    } else if (parsedData.body.UserType === "B2C") {
                        reserveResponse.Price.markupDetails = markupDetails;
                        reserveResponse.Price.TotalDisplayFare = Number(parseFloat(totalFare + markupDetails.AdminMarkup).toFixed(2));
                        reserveResponse.Price.AgentNetFare = Number(parseFloat(totalFare + markupDetails.AdminMarkup).toFixed(2));
                        reserveResponse.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        reserveResponse.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                        reserveResponse.Price.Amount = totalFare;
                        reserveResponse.Price.Currency = parsedData.body.Currency;
                    }
                    const token = this.redisServerService.geneateResultToken(body);
                    reserveResponse.Disclaimer=Disclaimer;
                    let BlockTripResult = await this.hoppaTransformService.formatBlocktripResponse(reserveResponse,body)
                    
                    BlockTripResult.Journey = parsedData.Journey
                    BlockTripResult.ProductPhotos = parsedData.ProductPhotos
                    
                    BlockTripResult.LocTypeFrom=BlockTripResult.data.LocTypeFrom["$t"];
                    BlockTripResult.LocTypeTo=BlockTripResult.data.LocTypeTo["$t"];
                    BlockTripResult.Extras = parsedData.Extras;
                    
                    const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...BlockTripResult, body: parsedData.body, exchangeRate }));
                    delete BlockTripResult.data;
                    
                    BlockTripResult.ResultIndex = redis["access_key"];
                    BlockTripResult.BookingSource = body.BookingSource;

                    return BlockTripResult;
                } else {
                    throw new Error(`400 Price Expired`)
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async AddPax(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken)
               
                let parsedData = JSON.parse(data[0]);
                // let convertedResp = resp["response"].replace(/'/g, '"');
                const appRefInDB = await this.getGraphData(
                    `query {
                                        transferBookingDetails (
                                            where: {
                                                app_reference: {
                                                    eq: "${body.AppReference}"
                                                }
                                            }
                                        ) {
                                            app_reference
                                        }
                                    }
                                    `,
                    "transferBookingDetails"
                );
                if (appRefInDB.length > 0) {
                    throw new Error("409 Duplicate entry for AppReference");
                }
                else {
                    console.log("body-",body.Extras);
                
                    let extrasAmount:any = 0;
                if(Array.isArray(parsedData.data.parsedData.Extras) && Array.isArray(body.Extras)){
                    let extraArray:any=[];
                    parsedData.data.parsedData.Extras.forEach(Extras => {
                        extraArray[Extras.ExtrasID] = Extras;
                    });

                    body.Extras.forEach(CustExtras => {
                        if(extraArray[CustExtras.id]){
                            extrasAmount+=extraArray[CustExtras.id].Price;
                        }
                    });
                }
                parsedData.Price.ExtrasAmount = extrasAmount;
                
                    const bookingDetails = await this.hoppaTransformService.addTransferBookingDetails(parsedData, body);

                    const bookingItinerary = await this.hoppaTransformService.addTransferBookingItineraryDetails(parsedData, body);

                    const paxDetails = await this.hoppaTransformService.addTransferBookingPaxDetails(parsedData, body);

                    return this.hoppaTransformService.getTransferBookingPaxDetailsUniversal(body,
                        bookingDetails,
                        bookingItinerary,
                        paxDetails);
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async ConfirmBooking(@Body() body: any): Promise<any> {
        try {
            if (body.AppReference) {

                const paxDetails = await this.getGraphData(
                    `query {
                            transferBookingPaxDetails (
                                    where: {
                                        app_reference: {
                                            eq: "${body.AppReference}"
                                        }
                                    }
                                ) {
                                    id
                                    app_reference
                                    booking_reference
                                    title
                                    first_name
                                    middle_name
                                    last_name
                                    phone
                                    email
                                    pax_type
                                    age
                                    date_of_birth
                                    status
                                    attributes
                                    adult_count
                                    child_count
                                }
                            }
                            `,
                    "transferBookingPaxDetails"
                );

                const appRefInDB = await this.getGraphData(
                    `query {
                                transferBookingDetails (
                                    where: {
                                        app_reference: {
                                            eq: "${body.AppReference}"
                                        }
                                    }
                                ) {
                                    payment_mode
                                    attributes
                                }
                            }
                            `,
                    "transferBookingDetails"
                );
                if (appRefInDB.length <= 0) {
                    throw new Error("400 No Data Found");
                }
                let parsedData = JSON.parse(appRefInDB[0].attributes.replace(/'/g, '"'));
                parsedData.payment_mode=appRefInDB[0].payment_mode;
                const givenUrl = `${this.Url}`;
                let username: string='';
                let password: string='';
                if(parsedData.body.UserType == 'B2C'){
                    parsedData.username= username=HOPPA_B2C_USERNAME;
                    parsedData.password=password=HOPPA_B2C_PASSWORD;
                }else if(parsedData.body.UserType == 'B2B'){
                    parsedData.username= username=HOPPA_B2B_USERNAME;
                    parsedData.password=password=HOPPA_B2B_PASSWORD;
                }
                console.log("parsedData-",parsedData);
                let ExtrasTransacNo:any=``;

        if(parsedData.BooKingInfo.Extras != undefined && Array.isArray(parsedData.BooKingInfo.Extras) && parsedData.BooKingInfo.Extras.length>0){
            let ExtrasReservationReq = `<?xml version="1.0" encoding="UTF-8"?>
    <TCOML version="NEWFORMAT">
        <TransferOnly>
            <P2PExtras>
                <Reserve>
                    <Username>${parsedData.username}</Username>
                <Password>${parsedData.password}</Password>
                    <SessionID>${parsedData.SessionID}</SessionID>
                    <BookingID>${parsedData.ProductCode}</BookingID>
                    <ExtrasList>`;
                     for (let i = 0; i < parsedData.BooKingInfo.Extras.length; i++) {
                       ExtrasReservationReq+=`<Extra ID="${parsedData.BooKingInfo.Extras[i].id}" NumberOfExtras="${parsedData.BooKingInfo.Extras[i].NoOf}" ExtrasCode="${parsedData.BooKingInfo.Extras[i].code}"/>`;
                       }
                    ExtrasReservationReq+=`</ExtrasList>
                </Reserve>
            </P2PExtras>
        </TransferOnly>
    </TCOML>`;
    
    const ExtrasResultApi: any = await this.httpService.post(givenUrl, ExtrasReservationReq, {
        headers: {
            'http-equiv':'Content-Type',
             'content':'text/html; charset=utf-8',
             'Content-Type': 'application/xml'
         }
    }).toPromise();
    let ExtraResult = await this.xmlToJson(ExtrasResultApi);
    if (this.isLogXml) {
        const fs = require('fs');
        fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-ExtrasReservation_RQ.xml`, ExtrasReservationReq);
        fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-ExtrasReservation_RS.xml`, ExtrasResultApi);
    }
    ExtrasTransacNo = ExtraResult['TCOML'].TransferOnly.P2PResults.Reserve.Response.ExtrasTransacNo['$t'];
    
            }
            parsedData.ExtrasTransacNo=ExtrasTransacNo;
                let bookingRequest = await this.hoppaTransformService.bookingRequestFormat(parsedData, paxDetails[0], body);

               
                
          
                // const result: any = await this.httpService.post(givenUrl, bookingRequest, {
                //     headers: {
                //         'Accept': 'application/json',
                //         'Accept-Language': 'en',
                //         'x-username': TMX_USER_NAME,
                //         'x-password': TMX_PASSWORD,
                //         'x-domainkey': TMX_DOMAINKEY,
                //         'x-system': TMX_SYSTEM
                //     }
                // }).toPromise();
                const resultApi: any = await this.httpService.post(givenUrl, bookingRequest, {
                    headers: {
                        'http-equiv':'Content-Type',
                         'content':'text/html; charset=utf-8',
                         'Content-Type': 'application/xml'
                     }
                }).toPromise();
                let result = await this.xmlToJson(resultApi);
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-Booking_RQ.xml`, bookingRequest);
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-Booking_RS.xml`, resultApi);
                }

                if (result) {
                    let bookingRes = result['TCOML'].TransferOnly.P2PResults.Booking;
                    const pickupTimeReq = `<?xml version="1.0" encoding="UTF-8"?>
                    <TCOML version="NEWFORMAT">
                        <TransferOnly>
                            <Booking>
                                <PickupTime>
                                     <Username>${parsedData.username}</Username>
                                    <Password>${parsedData.password}</Password>
                                    <BookingRef>${bookingRes.VoucherInfo.BookingRef['$t']}</BookingRef>
                                </PickupTime>
                            </Booking>
                        </TransferOnly>
                    </TCOML>`
                            
                    const pickupTimeRes: any = await this.httpService.post(givenUrl, pickupTimeReq, {
                     headers: {
                         'http-equiv':'Content-Type',
                          'content':'text/html; charset=utf-8',
                          'Content-Type': 'application/xml'
                      }
                 }).toPromise();
                 let PickTimeResult = await this.xmlToJson(pickupTimeRes);
     
                 if (this.isLogXml) {
                     const fs = require('fs');
                     fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-PickupTime_RQ.xml`, pickupTimeReq);
                     fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-PickupTime_RS.xml`, pickupTimeRes);
                 }
                              
                    let bookingResponse: any = await this.hoppaTransformService.bookingResponseFormat(parsedData, paxDetails[0], body, bookingRes);
                    bookingResponse.BookingSource = body.BookingSource;
                    return bookingResponse
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 AppReference is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async CancelBooking(@Body() body: any): Promise<any> {
        try {
            if (body.AppReference) {
                const bookingDetails = await this.getGraphData(
                    `query {
                            transferBookingDetails (
                                where: {
                                    app_reference: {
                                        eq: "${body.AppReference}"
                                    }
                                }
                            ) {
                                booking_id
                                booking_reference
                                attributes
                                booking_source
                            }
                        }
                        `,
                    "transferBookingDetails"
                );

                await this.manager.query(
                    'UPDATE transfer_booking_details SET status = ?, cancelled_datetime = ? WHERE app_reference = ?',
                    ["BOOKING_CANCELLED", new Date(), body.AppReference]
                );
                
                let parsedData = JSON.parse(bookingDetails[0].attributes.replace(/'/g, '"'));
                parsedData.booking_id = bookingDetails[0].booking_id;
                parsedData.booking_reference = bookingDetails[0].booking_reference;
                parsedData.booking_source = bookingDetails[0].booking_source;

                let username: string = '';
                let password: string = '';
                if (parsedData.booking_source == 'B2C') {
                    parsedData.username = username = HOPPA_B2C_USERNAME;
                    parsedData.password = password = HOPPA_B2C_PASSWORD;
                } else if (parsedData.booking_source == 'B2B') {
                    parsedData.username = username = HOPPA_B2B_USERNAME;
                    parsedData.password = password = HOPPA_B2B_PASSWORD;
                }

                let format: any = {
                    AppReference: body.AppReference,
                    CancelCode: 59,
                    CancelDescription: "remarks"
                }
                const givenUrl = `${this.Url}`;
        const cancelRequest = `<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT">
<TransferOnly>                               
<Booking>
<Cancel>
                <BookingRef>${parsedData.booking_id}</BookingRef>
                <Username>${username}</Username>
                <Password>${password}</Password>
</Cancel>
</Booking>
</TransferOnly>                              
</TCOML>`;

const resultApi: any = await this.httpService.post(givenUrl, cancelRequest, {
    headers: {
        'http-equiv': 'Content-Type',
        'content': 'text/html; charset=utf-8',
        'Content-Type': 'application/xml'
    }
}).toPromise();

const fs = require('fs');
// const StaticResponse = fs.readFileSync(`${logStoragePath}/transfer/hoppa/cancel_RS.xml`, { encoding: 'utf8', flag: 'r' });

let result = await this.xmlToJson(resultApi);
   if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-CancelBookingRQ.xml`, cancelRequest);
                    fs.writeFileSync(`${logStoragePath}/transfer/hoppa/${body?.AppReference}-CancelBookingRS.xml`,resultApi);
                }

let CancellationDetails = result['TCOML'].TransferOnly.Booking;

             
                if (CancellationDetails.BookingStatus['$t']=='Cancelled') {
                   
                    let bookingResponse: any = await this.hoppaTransformService.CancellationResponseFormat(parsedData, body, CancellationDetails);
                    bookingResponse.BookingSource = body.BookingSource;
                    return bookingResponse
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 AppReference is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    
    async getLocation(@Body() body: any): Promise<any> {
        const givenUrl = `${this.Url}`;
        const locationRequest = `<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT">
<TransferOnly>                               
<CacheLocations>
<Request>
                <Username>${HOPPA_B2C_USERNAME}</Username>
                <Password>${HOPPA_B2C_PASSWORD}</Password>
                <Lang>EN</Lang>   
</Request>
</CacheLocations>
</TransferOnly>                              
</TCOML>`;
const LocationResult: any = await this.httpService.post(givenUrl, locationRequest, {
    headers: {
        'http-equiv': 'Content-Type',
        'content': 'text/html; charset=utf-8',
        'Content-Type': 'application/xml'
    }
}).toPromise();
const fs = require('fs');
// const StaticResponse = fs.readFileSync(`${logStoragePath}/transfer/hoppa/Location.xml`, { encoding: 'utf8', flag: 'r' });

// let result = await this.xmlToJson(StaticResponse);


fs.writeFileSync(`${logStoragePath}/transfer/hoppa/Location_RQ.xml`, locationRequest);
fs.writeFileSync(`${logStoragePath}/transfer/hoppa/Location_RS.xml`, LocationResult);

let result = await this.xmlToJson(LocationResult);

let locations = result['TCOML'].TransferOnly.Locations.Location;

let response =await this.insertLocations(locations);

    }

    async getRoutes(@Body() body: any): Promise<any> {
        const givenUrl = `${this.Url}`;
        const routeRequest = `<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT">
<TransferOnly>                               
<CacheRoutes>
<Request>
                <Username>${HOPPA_B2C_USERNAME}</Username>
                <Password>${HOPPA_B2C_PASSWORD}</Password> 
                <Lang>EN</Lang>   
</Request>
</CacheRoutes>
</TransferOnly>                              
</TCOML>`;
const routeResult: any = await this.httpService.post(givenUrl, routeRequest, {
    headers: {
        'http-equiv': 'Content-Type',
        'content': 'text/html; charset=utf-8',
        'Content-Type': 'application/xml'
    }
}).toPromise();
const fs = require('fs');
// const StaticResponse = fs.readFileSync(`${logStoragePath}/transfer/hoppa/route.xml`, { encoding: 'utf8', flag: 'r' });

// let result = await this.xmlToJson(StaticResponse);


fs.writeFileSync(`${logStoragePath}/transfer/hoppa/route_RQ.xml`, routeRequest);
fs.writeFileSync(`${logStoragePath}/transfer/hoppa/route_RS.xml`, routeResult);

let result = await this.xmlToJson(routeResult);

let routes = result['TCOML'].TransferOnly.routes.route;

let response =await this.insertroutes(routes);

    }

    async  insertLocations(locations) {
        // Iterate through the locations array using a for loop
        for (let i = 0; i < locations.length; i++) {
          const location = locations[i];
          if(location)  {
          const code = location?.Code?.['$t']??"";
          const locationName = location?.LocationName?.['$t']??"";
          const locationType = location?.LocationType?.['$t']??"";
          const countryCode = location?.CountryCode?.['$t']??"";
          const country = location?.Country?.['$t']??"";
          const latitude = location?.Latitude?.['$t']??"";
          const longitude = location?.Longitude?.['$t']??"";
      
          try {
            // Execute the query and wait for it to complete
            const [record] = await this.manager.query(
              `INSERT INTO hoppa_locations (code, location_name, location_type, country_code, country, latitude, longitude)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [code, locationName, locationType, countryCode, country, latitude, longitude]
            );
      
            // Extract the insertId from the result
            const id = record.insertId;
            console.log('Inserted data with ID:', id);
          } catch (error) {
            console.error('Error inserting data:', error);
        
          }
        }
        }
    }

    async  insertroutes(routes) {
    // Iterate through the routes array using a for loop
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
    
        try {
        // Execute the query and wait for it to complete
        const [record] = await this.manager.query(
            `INSERT INTO hoppa_routes (code_from, code_to) VALUES (?, ?)`,
            [route.codeFrom, route.codeTo]
        );
    
        // Extract the insertId from the result
        const id = record.insertId;
        console.log('Inserted data with ID:', id);
        } catch (error) {
        console.error('Error inserting data:', error);
    
        }
    }
    }
}
