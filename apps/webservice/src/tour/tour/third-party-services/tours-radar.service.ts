
import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { TOUR_RADAR_URL, TOUR_RADAR_CLIENT_ID, TOUR_RADAR_CLIENT_SECRET, logStoragePath, TOUR_AUTH_RADAR_URL } from "../../../constants";
import { TourApi } from "../../tour.api";
import { TourDbService } from "../tour-db.service";
import * as moment from "moment";

import { ToursRadarTransformService } from "./tours-radar-transform.service";
const crypto = require('crypto');
const fs = require('fs')
const axios = require('axios');
const qs = require('qs');
@Injectable()
export class ToursRadarService extends TourApi {

    apiCred: any;
    apiCredCached: boolean = false;


    constructor(

        private readonly httpService: HttpService,
        private TourDbService: TourDbService,
        private ToursRadarTransformService: ToursRadarTransformService,
        // private HotelBedsTransformService: HotelBedsTransformService,
        // private HotelTboTransformService: HotelTboTransformService,
        private redisServerService: RedisServerService) {
        super()


    }

    throwSoapError(jsonResponse: any) {
        if (getPropValue(jsonResponse, 'Header.OperationType') == 'Error') {
            throw new HttpException(getPropValue(jsonResponse, 'Main.Error.Message'), 400);
        }
    }



    private async getToken(): Promise<string> {
        try {
            let result: any = [];

            let data = qs.stringify({
                'grant_type': 'client_credentials',
                'client_id': `${TOUR_RADAR_CLIENT_ID}`,
                'client_secret': `${TOUR_RADAR_CLIENT_SECRET}`
            });

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${TOUR_AUTH_RADAR_URL}oauth2/token`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: data
            };

            let response = await axios.request(config);
            if (response.data) {
                return response.data.access_token;
            } else {
                return response.access_token;
            }



        } catch (error) {
            console.error('Error obtaining token:', error);
            throw new Error('Failed to obtain access token');
        }
    }

    async search(body: any): Promise<any> {
        try {
            let query1 = `SELECT city_id as CityId FROM tours_city
            WHERE id = '${body.CityId}';
            `;
            const result1 = await this.manager.query(query1);
            
            if(result1[0]!=undefined){

            const givenUrl = `${TOUR_RADAR_URL}v1/tours/search?start_city=${result1[0].CityId}`;

            // let result = await axios.request(config);
            let result = await this.processGetUrl(givenUrl);
            let tourList: any = [];
            if (result.data) {
                tourList = result.data.items;
            } else {
                tourList = result.items;
            }

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/tours/tourRadar/SearchRQ.txt`, givenUrl);
                fs.writeFileSync(`${logStoragePath}/tours/tourRadar/SearchRS.json`, JSON.stringify(tourList));
            }
            let currencyDetails: any
            if (body.Currency && body.Currency != "GBP") {
                currencyDetails = await this.TourDbService.formatPriceDetailToSelectedCurrency(body.Currency)
            } else {
                currencyDetails = {
                    value: 1,
                    currency: "GBP"
                }
            }
            let ApicurrencyDetails = await this.TourDbService.formatPriceDetailToSelectedCurrency(tourList[0].prices.currency);
            const apiCurrencyExchangeRate = ApicurrencyDetails.value;

            const exchangeRate=currencyDetails.value;
            const response: any = await this.ToursRadarTransformService.SearchResponseFormat(tourList, body, exchangeRate, apiCurrencyExchangeRate);

            const finalResponse = response.filter(item => item != undefined);
            return finalResponse;
        }else{
            throw new Error('Tour radar city id not found');
        }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getTourDetails(body: any): Promise<any> {
        try {
            let parseData = await this.redisServerService.read_list(body.ResultToken)
            parseData = JSON.parse(parseData[0]);

            // let result = await axios.request(config);
            const givenUrl = `${TOUR_RADAR_URL}v1/tours/${parseData.id}`;
            let result = await this.processGetUrl(givenUrl);

            let tourDetails: any = {};
            if (result.data) {
                tourDetails = result.data;
            } else {
                tourDetails = result;
            }
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/tours/tourRadar/TourDetails_${parseData.id}.txt`, givenUrl);
                fs.writeFileSync(`${logStoragePath}/tours/tourRadar/TourDetails_${parseData.id}.json`, JSON.stringify(result));
            }

            //Price Data
            const tourPriceUrl = `${TOUR_RADAR_URL}v1/tours/${parseData.id}/prices`;
            let priceResult = await this.processGetUrl(tourPriceUrl);

            let priceDetails: any = [];
            if (priceDetails.data) {
                priceDetails = priceResult.data;
            } else {
                priceDetails = priceResult;
            }
            tourDetails.paxPriceDetails = priceDetails;
            const departure_dates = await this.departureDates(body);

            tourDetails.departure_dates = departure_dates;
            const response: any = await this.ToursRadarTransformService.TourDetailsFormat(tourDetails, body);


            return response;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async tourValuation(body: any): Promise<any> {
        try {
            let parseData = await this.redisServerService.read_list(body.ResultToken)
            parseData = JSON.parse(parseData[0]);
                      
            let givenUrl = `${TOUR_RADAR_URL}v1/tours/${parseData.id}/departures/${body.DepartureId}`;
            let result = await this.processGetUrl(givenUrl);
           
            let departurePrice: any = {}
            if (result.data) {
                departurePrice = result.data;
            } else {
                departurePrice = result;
            }

            const currency = parseData.tourPrice[0].Currency;
            const Pax = body.AdultCount + body.ChildCount;
            const accommodation = departurePrice.prices.accommodations;

            const paxAcco = await this.allocateAccommodation(Pax);

            const paxArray = Array.from({ length: Pax }, (_, i) => i + 1);

            let passengers = [];

            // Allocate passengers to accommodations based on beds_number
            const allocations = [];
            let passengerIndex = 0;


            for (let index = 0; index < paxAcco.length; index++) {
                const element = paxAcco[index];
                let bedName = '';

                if (element['Twin Share']) {
                    bedName = 'Twin Share';
                } else if (element['Twin']) {
                    bedName = 'Twin';
                } else if (element['Triple']) {
                    bedName = 'Triple';
                }
                let pax_count = element[bedName];

                accommodation.forEach(room => {

                    if (room.name == bedName) {
                        const assignedPassengers = paxArray.slice(passengerIndex, passengerIndex + pax_count);

                        assignedPassengers.forEach(PassengerId => {
                            passengers.push({
                                pax_number: PassengerId,
                                price_category_id: room.price_tiers[0].price_category_id
                            })
                        });

                        allocations.push({
                            id: room.id,
                            passengers: assignedPassengers
                        });
                        passengerIndex += pax_count;
                    }
                });
            }

            

            // Create the request object
            const ValuationRequest = {
                currency: parseData.tourPrice[0].ApiCurrency,
                passengers: passengers,
                accommodations: allocations
            };
            
            const accessToken = await this.getToken();

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${givenUrl}/price`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: ValuationRequest
            };
                      
    
            let response = await axios.request(config);
            
            let ResponseValuation:any = {};
            if(response.data){
                ResponseValuation=response.data;
            }else{
                ResponseValuation=response;
            }
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/tours/tourRadar/ValuationRQ.json`, JSON.stringify(ValuationRequest));
            fs.writeFileSync(`${logStoragePath}/tours/tourRadar/ValuationRS.json`, JSON.stringify(response));
                     
            const ValuationResponse = await this.ToursRadarTransformService.ValuationFormat(ResponseValuation, parseData, body, ValuationRequest);
            return ValuationResponse;


        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }


    }


    async allocateAccommodation(pax) {
   
        let allocation = [];
        let accom = []
        // Handle cases from 1 to 9 pax
        while (pax > 0) {
            if (pax >= 3) {
                accom['Triple'] = 3;
                allocation.push(accom);
                accom = [];
                pax -= 3;
            } else if (pax === 2) {
                accom['Twin'] = 2;
                allocation.push(accom);
                accom = [];
                pax -= 2;
            } else if (pax === 1) {
                accom['Twin Share'] = 1;
                allocation.push(accom);
                accom = [];
                pax -= 1;
            } else {
                // Handle any case that might not fit the criteria, e.g., remaining pax less than 1
                break;
            }
        }

        // Handle case where 'twin' might be better suited if there's an even number of pax
        if (pax % 2 === 0 && pax > 0) {
            while (pax >= 2) {
                accom['Twin'] = 2;
                allocation.push(accom);
                accom = [];
                pax -= 2;
            }
        }

        // Return the allocation result
        return allocation;
    }

    async paxAccommdationAllocationRequest(pax, accommodation,currency) {
        let paxAcco = [];
        let accom = []
        // Handle cases from 1 to 9 pax
        while (pax > 0) {
            if (pax >= 3) {
                accom['Triple'] = 3;
                paxAcco.push(accom);
                accom = [];
                pax -= 3;
            } else if (pax === 2) {
                accom['Twin'] = 2;
                paxAcco.push(accom);
                accom = [];
                pax -= 2;
            } else if (pax === 1) {
                accom['Twin Share'] = 1;
                paxAcco.push(accom);
                accom = [];
                pax -= 1;
            } else {
                // Handle any case that might not fit the criteria, e.g., remaining pax less than 1
                break;
            }
        }

        // Handle case where 'twin' might be better suited if there's an even number of pax
        if (pax % 2 === 0 && pax > 0) {
            while (pax >= 2) {
                accom['Twin'] = 2;
                paxAcco.push(accom);
                accom = [];
                pax -= 2;
            }
        }

        const paxArray = Array.from({ length: pax }, (_, i) => i + 1);

        let passengers = [];

        // Allocate passengers to accommodations based on beds_number
        const allocations = [];
        let passengerIndex = 0;


        for (let index = 0; index < paxAcco.length; index++) {
            const element = paxAcco[index];
            let bedName = '';

            if (element['Twin Share']) {
                bedName = 'Twin Share';
            } else if (element['Twin']) {
                bedName = 'Twin';
            } else if (element['Triple']) {
                bedName = 'Triple';
            }
            let pax_count = element[bedName];

            accommodation.forEach(room => {

                if (room.name == bedName) {
                    const assignedPassengers = paxArray.slice(passengerIndex, passengerIndex + pax_count);

                    assignedPassengers.forEach(PassengerId => {
                        passengers.push({
                            pax_number: PassengerId,
                            price_category_id: room.price_tiers[0].price_category_id
                        })
                    });

                    allocations.push({
                        id: room.id,
                        passengers: assignedPassengers
                    });
                    passengerIndex += pax_count;
                }
            });
        }



        // Create the request object
        const ValuationRequest = {
            currency: currency,
            passengers: passengers,
            accommodations: allocations
        };
        return ValuationRequest;
    }



    async departureDates(body: any): Promise<any> {
        try {
            let parseData = await this.redisServerService.read_list(body.ResultToken)
            parseData = JSON.parse(parseData[0]);

            let nextPage: any = null;
            let page = ``;
            let departureDates = [];
            let givenUrl = `${TOUR_RADAR_URL}v1/tours/${parseData.id}/departures`;

            do {


                if (nextPage > 0) {
                    page = `?page=${nextPage}`
                }

                givenUrl = `${TOUR_RADAR_URL}v1/tours/${parseData.id}/departures${page}`;

                let result = await this.processGetUrl(givenUrl);

                if (result.data) {
                    nextPage = result.data.next_page;
                } else if (result.next_page) {
                    nextPage = result.next_page;
                } else {
                    nextPage = null;
                }
                if (result.data) {
                    departureDates.push(result.data.items);
                } else {
                    departureDates.push(result.items);
                }
                console.log("nextPage-", nextPage);
            } while (nextPage != null)

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/tours/tourRadar/departureDates_${parseData.id}.txt`, givenUrl);
                fs.writeFileSync(`${logStoragePath}/tours/tourRadar/departureDates_${parseData.id}.json`, JSON.stringify(departureDates));
            }
            const response: any = await this.ToursRadarTransformService.departureDatesFormat(departureDates, body);
            return response;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async currencies(body: any): Promise<any> {
        try {
            const accessToken = await this.getToken();


            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `${TOUR_RADAR_URL}v1/taxonomy/currencies`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            let response = await axios.request(config);
            console.log(response.data);
            return response.data;
        } catch (error) {

        }
    }


    async destinations(body: any): Promise<any> {

        let token = 0;
        let next_page = 0;
        let page = '';
    
            const accessToken = await this.getToken();

            if (next_page) {
                page = `&page=${next_page}`;
            }
            const destinationType = body.destinationType;
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `${TOUR_RADAR_URL}v1/taxonomy/destinations/${destinationType}`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            let response = await axios.request(config);

            let countries = response.data.items;

       
            for (let i = 0; i < countries.length; i++) {
                const record = countries[i];
                console.log("record-",record);1
                try{
                let links=record.links;
                let parent_ids=record.parent_ids[0];
                
                // console.log(electricity_outlets);return;
                const [recorddata] = await this.manager.query(`INSERT INTO hoppa_country (id, latitude, longitude, name, parent_ids, geoname_id, country_code, currency_code, currency_name) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[record?.id,record?.latitude,record?.longitude,record?.name,parent_ids,record?.geoname_id,record?.country_code,record?.currency_code,record?.currency_name]);
            
                  // Extract the insertId from the result
                  const id = recorddata.insertId;
                  console.log('Inserted data with ID:', id);
                } catch (error) {
                    console.error('Error inserting data:', error);
                
                  }
              }
          
            // let cities = response.data.items;



            // for (let index = 0; index < cities.length; index++) {
            //     const city = cities[index];

            //     let parent_ids = ``;
            //     city.parent_ids.forEach((element, key) => {
            //         if (key > 0) {
            //             parent_ids = ',';
            //         }
            //         parent_ids = element;
            //     });

            //     let query = `INSERT INTO tour_radar_city (city_id, latitude, longitude, name, parent_ids, geoname_id, links, country_id) VALUES (${city.id},${city.latitude},${city.longitude},'${city.name.replace(/'/g, '')}','${parent_ids}',${city.geoname_id},'${JSON.stringify(city.links)}',${city.country_id});`

            //     let response = await this.manager.query(query)
            // }


            // if (response.data.next_page > 1) {
            //     next_page = response.data.next_page;
            //     token = 1;
            // } else {
            //     token = 0;
            // }

       

    }

    


    async tourTypes(body: any): Promise<any> {
        try {
            const accessToken = await this.getToken();

            const destinationType = body.destinationType;
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `${TOUR_RADAR_URL}v1/taxonomy/tours/types`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            let response = await axios.request(config);
            console.log(response.data);
            return response.data;

        } catch (error) {

        }
    }




    async processGetUrl(url: string): Promise<any> {
        const accessToken = await this.getToken();


        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: url,
            headers: {
                'accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        };

        let response = await axios.request(config);
        return response;
    }

    async confirmBooking(body: any): Promise<any> {
        try {
            let query1 = `SELECT DepartureId,currency_code,email,tours_id,attributes FROM tour_booking_details WHERE app_reference = '${body.AppReference}'`
            let resul1 = await this.manager.query(query1);
            let tourInfo = Object.values(JSON.parse(JSON.stringify(resul1)))[0];

            let query2 = `SELECT pax_title,pax_type,pax_first_name,pax_last_name,mobile_number,email,gender,nationality,pax_dob,adress,adress2,city,postal_code,country,state FROM tour_pax_details WHERE app_reference = '${body.AppReference}'`
            let result2 = await this.manager.query(query2);
            let paxInfo = Object.values(JSON.parse(JSON.stringify(result2)));

            let query3 = `SELECT id FROM tours_country WHERE isocode = '${paxInfo[0]['country']}'`
            let result3 = await this.manager.query(query3);
            let country = Object.values(JSON.parse(JSON.stringify(result3)));
           
            let attribute =JSON.parse(tourInfo['attributes']);

            let paxAccommdationAllocationRequest=attribute[2];
            for (let index = 0; index < paxInfo.length; index++) {

                const pax = paxInfo[index];
                const dob = new Date(pax['pax_dob']).toISOString().split('T')[0];

                const date = new Date(dob);

                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
                const year = date.getFullYear();



                // Format as DD/MM/YYYY
                const finalDob = `${day}/${month}/${year}`;
                let paxes = {};
                if (index == 0) {
                    paxAccommdationAllocationRequest.passengers[index].fields={
                        "title": `${pax['pax_title']}.`,
                        "first_name": pax['pax_first_name'],
                        "last_name": pax['pax_last_name'],
                        "email": pax['email'],
                        "phone_number": pax['mobile_number'],
                        "date_of_birth": finalDob,
                        "nationality": pax['nationality'],
                        "gender": pax['gender'],
                        "address": pax['adress'] + ' ' + pax['adress2'],
                        "city": pax['city'],
                        "postal_code": pax['postal_code'],
                        "state": pax['state'],
                        "country": pax['country'],
                        "pre_existing_medical_conditions": "none"
                    }
                    // paxes = {
                    //     "pax_number": index + 1,
                    //     "price_category_id": 9,
                    //     "fields": {
                    //         "title": `${pax['pax_title']}.`,
                    //         "first_name": pax['pax_first_name'],
                    //         "last_name": pax['pax_last_name'],
                    //         "email": pax['email'],
                    //         "phone_number": pax['mobile_number'],
                    //         "date_of_birth": finalDob,
                    //         "nationality": pax['nationality'],
                    //         "gender": pax['gender'],
                    //         "address": pax['adress'] + ' ' + pax['adress2'],
                    //         "city": pax['city'],
                    //         "postal_code": pax['postal_code'],
                    //         "state": pax['state'],
                    //         "country": pax['country'],
                    //         "pre_existing_medical_conditions": "none"
                    //     }
                    // };
                } else {
                    paxAccommdationAllocationRequest.passengers[index].fields={
                        "title": `${pax['pax_title']}.`,
                        "first_name": pax['pax_first_name'],
                        "last_name": pax['pax_last_name'],
                        "email": pax['email'],
                        "phone_number": pax['mobile_number'],
                        "date_of_birth": finalDob,
                        "nationality": pax['nationality'],
                        "gender": pax['gender']
                    }
                    // paxes = {
                    //     "pax_number": index + 1,
                    //     "price_category_id": 9,
                    //     "fields": {
                    //         "title": `${pax['pax_title']}.`,
                    //         "first_name": pax['pax_first_name'],
                    //         "last_name": pax['pax_last_name'],
                    //         "email": pax['email'],
                    //         "phone_number": pax['mobile_number'],
                    //         "date_of_birth": finalDob,
                    //         "nationality": pax['nationality'],
                    //         "gender": pax['gender']
                    //     }
                    // };
                }
                
            }
            let passanger = paxAccommdationAllocationRequest.passengers;
            let accommodation = paxAccommdationAllocationRequest.accommodations;

            // "Austria"
            let bookingRequest = {
                "tour_id": tourInfo['tours_id'],
                "departure_id": tourInfo['DepartureId'],
                "currency": "USD",
                "email": tourInfo['email'],
                "user_country": country[0]['id'],
                "passengers": passanger,
                "accommodations": accommodation

            };
            //   "accommodations": [
            //     {
            //       "id": 345,
            //       "passengers": [1, 2]
            //     }
            //   ],
            //   "optional_extras": [
            //     {
            //       "id": 456,
            //       "passengers": [2]
            //     }
            //   ],
            const accessToken = await this.getToken();
            
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: `${TOUR_RADAR_URL}v1/bookings`,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: bookingRequest
            };
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/tours/tourRadar/BookingRQ_${body.AppReference}.json`, JSON.stringify(bookingRequest));
            console.log("config-",config);
            let response = await axios.request(config);
            console.log("response-",response);
           
            fs.writeFileSync(`${logStoragePath}/tours/tourRadar/BookingRS_${body.AppReference}.json`, JSON.stringify(response));
            
            let finalResponse:any ={};
            if(response.data){
                finalResponse=response.data;
            }else{
                finalResponse=response;
            }

            // if(finalResponse.status=='pending'){
            //     throw new Error(finalResponse.status_reason_text);
            // }
            return finalResponse;

        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

}


