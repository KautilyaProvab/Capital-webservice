import { Body, HttpException, HttpService, Injectable } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { HOPPA_B2C_USERNAME, HOPPA_TRANSFER_URL, HOPPA_B2C_PASSWORD, HOPPA_B2B_USERNAME, HOPPA_B2B_PASSWORD, logStoragePath } from "../../../constants";
import { TransferApi } from "../../transfer.api";
import { TransferDbService } from "../transfer-db.service";
import { HotelBedsTransformService } from "./hotel-beds-transform.service";
const fs = require('fs');

@Injectable()
export class HotelBedsService extends TransferApi {

    constructor(
        private readonly httpService: HttpService,
        private transferDbService: TransferDbService,
        private hotelBedsTransformService: HotelBedsTransformService,
        private redisServerService: RedisServerService) {
        super()
    }
    
    async Availability(@Body() body:any):Promise<any> {
        try {
            const axiosConfig:any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/availability/${body.Language}/from/${body.FromType}/${body.FromCode}/to/${body.ToType}/${body.ToCode}/${body.Outbound}/${body.AdultCount}/${body.ChildCount}/${body.InfantCount}`;
            if(body.Inbound){
                Transfer_URL  = `${HOPPA_TRANSFER_URL}/availability/${body.Language}/from/${body.FromType}/${body.FromCode}/to/${body.ToType}/${body.ToCode}/${body.Outbound}/${body.Inbound}/${body.AdultCount}/${body.ChildCount}/${body.InfantCount}`;
            }
            const result:any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();
            fs.writeFileSync(`${logStoragePath}/transfer/hbs/Availability_RQ.json`, JSON.stringify(Transfer_URL));
            fs.writeFileSync(`${logStoragePath}/transfer/hbs/Availability_RS.json`, JSON.stringify(result));
            let response:any = [];
            for(let services of result.services){
                services.searchBody = body;
                const token = this.redisServerService.geneateResultToken(body);
                const redis = await this.redisServerService.insert_record(token, JSON.stringify(services));
                services = await this.hotelBedsTransformService.availabilityResponseFormat(services, body)

                services.ResultIndex = redis["access_key"];
                services.BookingSource = body.BookingSource
                response.push(services)
            }
            return response;
        } 
        catch (error) {
          const errorClass: any = getExceptionClassByCode(error.message);
          throw new errorClass(error.message);
        }
    }

    async ProductDetails(@Body() body:any):Promise<any> {
        try {
                if (body.ResultToken) {
                    let data:any = await this.redisServerService.read_list(body.ResultToken)
                    let parsedData:any = JSON.parse(data[0]);
                    let services = await this.hotelBedsTransformService.ProductDetailsResponseFormat(parsedData)
                    services.resultToken = body.ResultToken;
                    services.BookingSource = body.BookingSource
                    
                    return services;
                }
                else{
                    throw new Error(`400 Result Token is Missing`)
                }
            }
            catch (error) {
                const errorClass: any = getExceptionClassByCode(error.message);
                throw new errorClass(error.message);
            }
    }

    async AddPax(@Body() body:any):Promise<any> {
        try {
                if (body.ResultToken) {
                    let data = await this.redisServerService.read_list(body.ResultToken)
                    let parsedData = JSON.parse(data[0]);
                    console.log('====================================');
                    console.log("parsedData:",parsedData);
                    console.log('====================================');
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
                            else{
                                delete parsedData.content.transferDetailInfo
                                const bookingDetails = await this.hotelBedsTransformService.addTransferBookingDetails(
                                    parsedData,body);

                                const bookingItinerary = await this.hotelBedsTransformService.addTransferBookingItineraryDetails(
                                        parsedData, body);

                                const paxDetails = await this.hotelBedsTransformService.addTransferBookingPaxDetails(
                                        parsedData, body);

                                return this.hotelBedsTransformService.getTransferBookingPaxDetailsUniversal(body,
                                    bookingDetails,
                                    bookingItinerary,
                                    paxDetails);
                            }
                }
                else{
                    throw new Error(`400 Result Token is Missing`)
                }
            }
            catch (error) {
                const errorClass: any = getExceptionClassByCode(error.message);
                throw new errorClass(error.message);
            }
    }

    async ConfirmBooking(@Body() body:any):Promise<any> {
        try {
                if (body.AppReference) {

                    const axiosConfig:any = {
                        headers: {
                            'Api-key': HOPPA_B2C_USERNAME,
                        },
                    };
                    let bookingFormat:any = await this.hotelBedsTransformService.transformBookingFormat(body)
                    let bookingResponse = await this.httpService.post('https://api.test.hotelbeds.com/transfer-api/1.0/bookings', bookingFormat, axiosConfig).toPromise();

                    fs.writeFileSync(`${logStoragePath}/transfer/hbs/${body?.AppReference}-Booking_RQ.json`, JSON.stringify(bookingFormat));
                    fs.writeFileSync(`${logStoragePath}/transfer/hbs/${body?.AppReference}-Booking_RS.json`, JSON.stringify(bookingResponse));
                    return bookingResponse;
                }
                else{
                    throw new Error(`400 AppReference is Missing`)
                }
            }
            catch (error) {
                const errorClass: any = getExceptionClassByCode(error.message);
                throw new errorClass(error.message);
            }
    }

    async BookingDetail(@Body() body:any):Promise<any> {
        try {
                if (body.AppReference) {

                    const axiosConfig:any = {
                        headers: {
                            'Api-key': HOPPA_B2C_USERNAME,
                        },
                    };
                    let bookingFormat:any = `https://api.test.hotelbeds.com/transfer-api/1.0/bookings/en/reference/${body}`
                    let bookingResponse = await this.httpService.post('https://api.test.hotelbeds.com/transfer-api/1.0/bookings', bookingFormat, axiosConfig).toPromise();

                    fs.writeFileSync(`${logStoragePath}/transfer/hbs/${body?.AppReference}-Booking_RQ.json`, JSON.stringify(bookingFormat));
                    fs.writeFileSync(`${logStoragePath}/transfer/hbs/${body?.AppReference}-Booking_RS.json`, JSON.stringify(bookingResponse));
                    return bookingResponse;
                }
                else{
                    throw new Error(`400 AppReference is Missing`)
                }
            }
            catch (error) {
                const errorClass: any = getExceptionClassByCode(error.message);
                throw new errorClass(error.message);
            }
    }
    
}

