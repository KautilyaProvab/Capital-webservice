import { Injectable } from "@nestjs/common";
import { getManager } from "typeorm";
import { SEARCH_ERROR_STRING, META_FLIGHT_COURSE, TMX_FLIGHT_BOOKING_SOURCE,SAFARI_BOOKING_SOURCE, FARE_FLIGHT_BOOKING_SOURCE, SABRE_FLIGHT_BOOKING_SOURCE, TRAVELPORT_FLIGHT_BOOKING_SOURCE } from "../../constants";
import { RedisServerService } from "../../shared/redis-server.service";
import { FlightDbService } from "./flight-db.service";
import { TmxApiService } from "./third-party-services/tmx-api.service";
import { SabreApiService } from "./third-party-services/sabre-api.service";
import { TravelportApiService } from "./third-party-services/travelport-api.service";
import { SafariService } from "./third-party-services/safari-api.service";

import { FareApiService } from "./third-party-services/fare-api.service";
import { getExceptionClassByCode } from "../../all-exception.filter";

@Injectable()
export class FlightService {


    private isDevelopment = true;
    private manager = getManager();
    private suppliers: any = [];
    constructor(
        private flightDbService: FlightDbService,
        private redisServerService: RedisServerService,
        private tmxApiService: TmxApiService,
        private sabreApiService: SabreApiService,
        private travelportApiService: TravelportApiService,
        private fareApiService: FareApiService,
        private safariService: SafariService,
    ) {
        this.suppliers.push({ name: TMX_FLIGHT_BOOKING_SOURCE, service: this.tmxApiService });
        this.suppliers.push({ name: SABRE_FLIGHT_BOOKING_SOURCE, service: this.sabreApiService });
        this.suppliers.push({ name: TRAVELPORT_FLIGHT_BOOKING_SOURCE, service: this.travelportApiService });
        this.suppliers.push({ name: FARE_FLIGHT_BOOKING_SOURCE, service: this.fareApiService });
        this.suppliers.push({ name: SAFARI_BOOKING_SOURCE, service: this.safariService });

    }

    async CurrencyConversionRate(body: any) {
        return await this.flightDbService.CurrencyConversionRate(body);
    }

    async autocomplete(body: any): Promise<any> {
        return await this.flightDbService.autocomplete(body);
    }

    async preferredAirlines(body: any): Promise<any> {
        return await this.flightDbService.preferredAirlines(body);
    }

    async flightType(body: any): Promise<any> {
        return await this.flightDbService.flightType(body);
    }

    async cabinClassList(body: any): Promise<any> {
        return await this.flightDbService.cabinClassList(body);
    }

    async sendItinerary(body: any): Promise<any> {
        return await this.flightDbService.sendItinerary(body);
    }
    async getRecentSearch(req: any, body: any): Promise<any> {
        return await this.flightDbService.getRecentSearch(req, body);
    }
    async addRecentSearch(req: any, body: any): Promise<any> {
        return await this.flightDbService.addRecentSearch(req, body);
    }
    async deleteRecentSearch(req: any, body: any) {
        return await this.flightDbService.deleteRecentSearch(req, body);
    }
    async test_search(body: any): Promise<any> {
        const pattern = /\(([^)]+)\)/;
        for (let i = 0; i < body['Segments'].length; i++) {
            if (body['Segments'][i]['Origin'].includes("(")) {
                body['Segments'][i]['Origin'] = (pattern.exec(body['Segments'][i]['Origin'])[1]).trim();
            }
            if (body['Segments'][i]['Destination'].includes("(")) {
                body['Segments'][i]['Destination'] = (pattern.exec(body['Segments'][i]['Destination'])[1]).trim();
            }
        }

        const result = await this.fareApiService.search(body);
        return {
            Search: {
                FlightDataList: {
                    JourneyList: [result]
                },
                NearByAirports: []
            }
        };
    }
    async search(body: any): Promise<any> {
        const pattern = /\(([^)]+)\)/;
        for (let i = 0; i < body['Segments'].length; i++) {
            if (body['Segments'][i]['Origin'].includes("(")) {
                body['Segments'][i]['Origin'] = (pattern.exec(body['Segments'][i]['Origin'])[1]).trim();
            }
            if (body['Segments'][i]['Destination'].includes("(")) {
                body['Segments'][i]['Destination'] = (pattern.exec(body['Segments'][i]['Destination'])[1]).trim();
            }
        }


        // const result = await this.sabreApiService.search(body);
        // return {
        //     Search: {
        //         FlightDataList: {
        //             JourneyList: [result]
        //         },
        //         NearByAirports: []
        //     }
        // };




        //     const result = await this.usBanglaApiService.search(body);
        //     //const result = await this.amadeusApiService.search(body);
        //     //const result = await this.sabreApiService.search(body); 
        //    // const result = await this.traveloprtApiService.search(body); 
        //     return {
        //         Search: {
        //             FlightDataList: {
        //                 JourneyList: [result]
        //             },
        //             NearByAirports: []
        //         }
        //     };



        /* const amadeusResult: any = await this.amadeusApiService.search(body);
        const travelportResult: any = await this.traveloprtApiService.search(body);
        const combinedResult = amadeusResult.concat(travelportResult);
        return combinedResult; */
        // return await this.traveloprtApiService.search(body);

        var query = `
        SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
        FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
        JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
        JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
        WHERE BS.booking_engine_status=1 
        AND AC.status=1 AND BS.meta_course_key = '${META_FLIGHT_COURSE}'
        AND DL.id = 1`;
        if (body.booking_source) {
            query = `${query}  AND BS.source_key='${body.booking_source}'`
        }
        query = `${query}  ORDER BY BS.id DESC`;
        const suppliers: any = await this.manager.query(query);
        let merged = [];
        
        // let BookingTravelerRefObj = {};
        let CalenderList = [];
        if (suppliers.length) {

            let allResults = [];
         
            for (let i = 0; i < suppliers.length; i++) {
                const source = this.suppliers.find(t => t.name == suppliers[i]['booking_source']);
                const result = await source['service'].search(body);
                console.log("Result-",result);
                // BookingTravelerRefObj[suppliers[i]['booking_source']] = result['BookingTravelerRefObj'];
                if(suppliers[i]['booking_source']==TRAVELPORT_FLIGHT_BOOKING_SOURCE){
                    CalenderList.push(result.CalenderList)
                }
                allResults.push(...result);
            }
            merged = [].concat.apply([], allResults);
            // merged = [...allResults];

        }

        if (merged.length === 0) {
            // return "No Flights Found";
            const errorClass: any = getExceptionClassByCode(`400 ${SEARCH_ERROR_STRING}`);
            throw new errorClass(`${SEARCH_ERROR_STRING}`);
        }
        return {
            Search: {
                FlightDataList: {
                    JourneyList: [merged],
                    CalenderList:CalenderList
                    // BookingTravelerRefObj
                }
            },
            booking_source: merged[0].booking_source
        };
        /* const amadeusResultTemp = await this.amadeusApiService.search(body);
        const amadeusResult = getPropValue(amadeusResultTemp,'result.Search.FlightDataList.JourneyList') || amadeusResultTemp;
        const travelportResultTemp = await this.traveloprtApiService.search(body);
        const travelportResult = getPropValue(travelportResultTemp,'result.Search.FlightDataList.JourneyList') || travelportResultTemp;
        const combinedResult = amadeusResult.concat(travelportResult);
        return {
            result: {
                Search: {
                    FlightDataList: {
                        JourneyList: combinedResult
                    }
                }
            },
            message: ''
        } */

    }

    async search_roundtrip(body: any): Promise<any> {
        const pattern = /\(([^)]+)\)/;
        for (let i = 0; i < body['Segments'].length; i++) {
            if (body['Segments'][i]['Origin'].includes("(")) {
                body['Segments'][i]['Origin'] = (pattern.exec(body['Segments'][i]['Origin'])[1]).trim();
            }
            if (body['Segments'][i]['Destination'].includes("(")) {
                body['Segments'][i]['Destination'] = (pattern.exec(body['Segments'][i]['Destination'])[1]).trim();
            }
        }

        var query = `
        SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
        FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
        JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
        JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
        WHERE BS.booking_engine_status=1 
        AND AC.status=1 AND BS.meta_course_key = '${META_FLIGHT_COURSE}'
        AND DL.id = 1`;
        if (body.booking_source) {
            query = `${query}  AND BS.source_key='${body.booking_source}'`
        }
        query = `${query}  ORDER BY BS.id DESC`;
        const suppliers: any = await this.manager.query(query);
        let merged = [];
        let allResults = [];

        if (suppliers.length) {
            for (let i = 0; i < suppliers.length; i++) {
                const source = this.suppliers.find(t => t.name == suppliers[i]['booking_source']);
                const result = await source['service'].search(body);
                allResults.push(...result);
            }
        }

        if (allResults.length === 0) {
            const errorClass: any = getExceptionClassByCode(`400 ${SEARCH_ERROR_STRING}`);
            throw new errorClass(`${SEARCH_ERROR_STRING}`);
        }
        return {
            Search: {
                FlightDataList: {
                    JourneyList: allResults,
                }
            }
        };

    }

    async search_mobile(body: any): Promise<any> {
        const pattern = /\(([^)]+)\)/;
        for (let i = 0; i < body['Segments'].length; i++) {
            if (body['Segments'][i]['Origin'].includes("(")) {
                body['Segments'][i]['Origin'] = (pattern.exec(body['Segments'][i]['Origin'])[1]).trim();
            }
            if (body['Segments'][i]['Destination'].includes("(")) {
                body['Segments'][i]['Destination'] = (pattern.exec(body['Segments'][i]['Destination'])[1]).trim();
            }
        }

        var query = `
        SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
        FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
        JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
        JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
        WHERE BS.booking_engine_status=1 
        AND AC.status=1 AND BS.meta_course_key = '${META_FLIGHT_COURSE}'
        AND DL.id = 1`;
        if (body.booking_source) {
            query = `${query}  AND BS.source_key NOT IN ('ZBAPINO00010')`
            // query = `${query}  AND BS.source_key='${body.booking_source}'`
        }
        query = `${query}  ORDER BY BS.id DESC`;
        const suppliers: any = await this.manager.query(query);
        // console.log(suppliers);
        // return false;
        let merged = [];

        // let BookingTravelerRefObj = {};

        if (suppliers.length) {

            let allResults = [];
            for (let i = 0; i < suppliers.length; i++) {
                const source = this.suppliers.find(t => t.name == suppliers[i]['booking_source']);
                const result = await source['service'].search(body);
                // BookingTravelerRefObj[suppliers[i]['booking_source']] = result['BookingTravelerRefObj'];
                allResults.push(...result);
            }
            merged = [].concat.apply([], allResults);
            // merged = [...allResults];

        }

        if (merged.length === 0) {
            // return "No Flights Found";
            const errorClass: any = getExceptionClassByCode(`400 ${SEARCH_ERROR_STRING}`);
            throw new errorClass(`${SEARCH_ERROR_STRING}`);
        }
        return {
            Search: {
                FlightDataList: {
                    JourneyList: [merged],
                    // BookingTravelerRefObj
                }
            },
            booking_source: merged[0].booking_source
        };

    }

    async fareQuote(body: any): Promise<any> {
        // return await this.traveloprtApiService.fareQuote(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].fareQuote(body);
    }

    async extraServices(body: any): Promise<any> {
        // return await this.traveloprtApiService.extraServices(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].extraServices(body);
    }

    async commitBooking(body: any): Promise<any> {
        let res: any;
        body.subagent_id = 0;
        if (body.UserId && body.UserId > 0) {
            res = await this.flightDbService.getSubagentParentID(body.UserId);
            if(res[0].auth_role_id === 5){
                body.subagent_id = res[0].id;
                body.UserId = res[0].created_by_id;
            }
        }
        // return await this.traveloprtApiService.commitBooking(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].commitBooking(body);
    }

    // async updateLostBaggageProtectionPrice(body: any): Promise<any> {
    //     // return await this.traveloprtApiService.commitBooking(body);
    //     const source = this.suppliers.find(t => t.name == body['booking_source']);
    //     return await this.traveloprtApiService.updateLostBaggageProtectionPrice(body);
    // }

    async reservation(body: any): Promise<any> {

        // this.flightDbService.emailFlightDetails({ AppReference: 'TLNF170522-502' })
        // console.log("okkk");
        // return false;
        // const result = await this.traveloprtApiService.reservation(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        const result = await source['service'].reservation(body);

        // if (getPropValue(body, 'AUTO_TICKETING')) {
        //     if (getPropValue(result, 'FinalBooking.BookingDetails.AirReservationLocatorCode')) {
        //         body['AirReservationLocatorCode'] = result.FinalBooking.BookingDetails.AirReservationLocatorCode;
        //         await this.ticketingRequest(body);
        //     }
        // }
        const token = this.redisServerService.geneateResultToken(body);
        let resposeData = "";
        let responseVar
        if (result.result) {
            resposeData = result.result;
        } else {
            resposeData = result
        }
        const response = await this.redisServerService.insert_record(token, JSON.stringify(resposeData));
        if (result.result) {
            result.result.ReservationResultIndex = response["access_key"];

        } else {
            result.ReservationResultIndex = response["access_key"];
        }
        if (resposeData["FinalBooking"].BookingDetails.BookingStatus === "BOOKING_HOLD") {
            console.log("Before email send");
            this.flightDbService.emailFlightDetails({ AppReference: resposeData["FinalBooking"].BookingDetails.BookingAppReference })
            console.log("Before email send");

        }
        return result;
    }

    async cancellation(body: any): Promise<any> {
        // return await this.traveloprtApiService.cancellation(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        const responseData = await source['service'].cancellation(body);
        if (responseData) {
            this.flightDbService.flightCancellationEmail({ AppReference: body.AppReference })
        }
        return responseData;
    }

    async void(body: any): Promise<any> {
        // return await this.traveloprtApiService.cancellation(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].void(body);
    }

    async voucher(body: any): Promise<any> {
        return await this.flightDbService.voucher(body);
    }
    async redirectedReservationResponse(body: any): Promise<any> {
        return await this.flightDbService.redirectedReservationResponse(body);
    }
    async ticketingRequest(body: any): Promise<any> {
        // return await this.traveloprtApiService.ticketingRequest(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].ticketingRequest(body);
    }

    async pnrRetrieve(body: any): Promise<any> {
        let chk_req: any = {};
        let payment_status = false;
        if (body.AppReference) {
            chk_req.app_reference = body.AppReference;
            if (body.payment_type != undefined) {
                if (body.payment_type != "" && body.payment_type == "wallet") {
                    payment_status = await this.flightDbService.checkWalletBalance(chk_req);
                }
            }
            if (body.order_id != undefined) {
                if (body.order_id != "") {
                    chk_req.order_id = body.order_id;
                    payment_status = await this.flightDbService.paymentConfirmation(chk_req);
                }
            }

        } else {
            const errorClass: any = getExceptionClassByCode(`400 This booking is not exist.`);
            throw new errorClass(`This booking is not exist.`);
        }
        
        if (payment_status) {
            const source = this.suppliers.find(t => t.name == body['booking_source']);
            const responseData = await source['service'].pnrRetrieve(body);
            if (body['booking_source'] != 'ZBAPINO00010' && body['booking_source'] != 'ZBAPINO00011' && body['booking_source'] != 'ZBAPINO00007') {
                if (responseData["FinalBooking"].BookingDetails.BookingStatus === "BOOKING_CONFIRMED") {
                    console.log("Before email send");
                    await this.flightDbService.emailFlightDetails({ AppReference: responseData["FinalBooking"].BookingDetails.BookingAppReference })
                    console.log("After email sent");
                }
            }
            return responseData;
        } else {
            const errorClass: any = getExceptionClassByCode(`400 This booking is not exist.`);
            throw new errorClass(`This booking is not exist.`);
        }

    }

    async fareRule(body: any): Promise<any> {
        // return await this.traveloprtApiService.fareRule(body);
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].fareRule(body);
    }

    async listFlightTopDestination(body: any): Promise<any> {
        return await this.flightDbService.listFlightTopDestination(body);
    }

    async updatePassengerDetails(body: any): Promise<any> {
        return await this.flightDbService.updatePassengerDetails(body);
    }

    async flightEmail(body: any): Promise<any> {
        return await this.flightDbService.emailFlightDetails(body);
    }

    async importPNR(body: any): Promise<any> {
        const source = this.suppliers.find(t => t.name == body['booking_source']);
        return await source['service'].importPNR(body);
    }

    async documentUpload(body: any, files: any): Promise<any> {
        return await this.flightDbService.documentUpload(body, files);
    }

    async seatAvailability(body: any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['booking_source']);
        return await source['service'].seatAvailability(body);
    }
}