import { Injectable } from "@nestjs/common";
import { BaseApi } from "../../base.api";
import { TransferDbService } from "./transfer-db.service";
import { HOPPA_TRANSFER_BOOKING_SOURCE, META_TRANSFER_COURSE , GOOGLE_MAP_KEY } from "../../constants";
import { HoppaService } from "./third-party-services";
const { createClient } = require('@google/maps');
import { formatDate } from '../../app.helper';

@Injectable()
export class TransferService extends BaseApi {
    private suppliers: any = [];
    constructor(
        private transferDbService: TransferDbService,
        private hoppaService: HoppaService
    ) {
        super()
        this.suppliers.push({ name: HOPPA_TRANSFER_BOOKING_SOURCE, service: this.hoppaService });
       
    }

    async Availability(body: any): Promise<any> {
        let query = `
            SELECT
                BS.name,
                BS.source_key AS booking_source,
                BS.authentication AS check_auth
            FROM
                ws_apis BS
            JOIN
                ws_api_credentials AC ON AC.ws_api_id = BS.id
            JOIN
                ws_api_maps DAM ON DAM.ws_api_id = BS.id
            JOIN
                ws_domains DL ON DL.id = DAM.ws_domain_id
            WHERE
                BS.booking_engine_status = 1
                AND AC.status = 1
                AND BS.meta_course_key = '${META_TRANSFER_COURSE}'
                AND DL.id = 1`;
    
        if (body.BookingSource) {
            query += ` AND BS.source_key = '${body.BookingSource}'`;
        }
    
        query += ' ORDER BY BS.id DESC';
    
        const suppliers: any[] = await this.manager.query(query);
        let merged: any;

        if (suppliers.length > 0) {
            const allResults = await Promise.all(
                suppliers.map(async (supplier) => {
                    const source = this.suppliers.find((t: any) => t.name === supplier['booking_source']);
                    const result = await source['service'].Availability(body);
                    return result;
                })
            );
    
            merged = allResults.reduce((accumulator, currentArray) => {
                return accumulator.concat(currentArray);
              }, []);
        }
        
        return merged;
    } 

    async ProductDetails(body:any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].ProductDetails(body);
    }
    
    async TripList(body:any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].TripList(body);
    }

    async Blocktrip(body:any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].Blocktrip(body);
    }

    async addPax(body:any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].AddPax(body);
    }

    async ConfirmBooking(body:any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
           
    if(body.payment_mode != undefined &&  body.payment_mode == "pay_later"){
        await this.transferDbService.payLaterCheck(body);   
      }
        return await source['service'].ConfirmBooking(body);
    }

    async CancelBooking(body:any): Promise<any> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].CancelBooking(body);
    }

   
    async getLocations(body: any): Promise<any[]> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].getLocation(body);
    }

    async getRoutes(body: any): Promise<any[]> {
        const source = this.suppliers.find((t:any) => t.name == body['BookingSource']);
        return await source['service'].getRoutes(body);
    }

    async CityList(body:any): Promise<any> {
        // let googleMapsLocation=await this.getLocationAutocomplete(body.Name);
        let googleMapsPlaces=await this.place(body);
        // console.log("googleMapsPlaces-",googleMapsPlaces);
        let googleLocation:any = [];
        // if(googleMapsLocation.predictions && googleMapsLocation.predictions.length > 0){
            if(googleMapsPlaces && googleMapsPlaces.length > 0){
            for (let index = 0; index < googleMapsPlaces.length; index++) {
                const element = googleMapsPlaces[index];
             
                const location=await this.getGeocodeByPlaceId(element.place_id);
               
               
               
                  googleLocation.push({id: index,
                    code: element.place_id,
                    location_name: element.name,
                    location_type: 'GoogleMap',
                    country_code: location.results[0].Country_code,
                    country: location.results[0].Country,
                    latitude: parseFloat(location.results[0].geometry.location.lat),
                    longitude: parseFloat(location.results[0].geometry.location.lng),
                    BookingSource: 'ZBAPINO00011'
                  });
               
            }
          
        }

        let hoppaLocation = await this.transferDbService.CityList(body);
        let hoppaFinalLocation:any =[];

        if(hoppaLocation){
            hoppaFinalLocation=JSON.parse(JSON.stringify(hoppaLocation));
        }
        // console.log("mergedLocations-",hoppaFinalLocation);
    
        const mergedLocations =  [...hoppaFinalLocation , ...googleLocation];
      
        return mergedLocations;
        // return await this.transferDbService.CityList(body);
    }

    async place(body: any): Promise<any> {
        // Replace with your Google Maps API key
        const googleMapsClient = createClient({
            key: GOOGLE_MAP_KEY,
            Promise: Promise
        });
       const query = body.Name;

        const response = await googleMapsClient.places({
            query,
            radius: 5000 // Optional radius in meters
        }).asPromise();
        console.log("response - ",response.json.results);
        console.log("length - ",response.json.results.length);
        const places = response.json.results.map(place => ({
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location,
            place_id:place.place_id
        }));
        console.log("places - ",places)
        return places;

    }


    async  getLocationAutocomplete(input) {
        const axios = require('axios');
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;
    
        try {
            const response = await axios.get(url, {
                params: {
                    input: input,
                    types: 'geocode',
                    language: 'fr',
                    key: GOOGLE_MAP_KEY,
                }
            });
    
          if(response.data){
            return response.data;
        }else{
            return response;
        }
        } catch (error) {
            console.error('Error fetching data from Google Maps API:', error.response ? error.response.data : error.message);
        }
    }



    async  getGeocodeByPlaceId(placeId) {
        const axios = require('axios');
        const url = `https://maps.googleapis.com/maps/api/geocode/json`;
    
        try {
            const response = await axios.get(url, {
                params: {
                    place_id: placeId,
                    key: GOOGLE_MAP_KEY,
                }
            });
            let geoCodeData:any=[];

            if(response.data){
                geoCodeData = response.data;
            }else{
                geoCodeData = response;
            }
            if (geoCodeData && geoCodeData.results && geoCodeData.results.length > 0) {
                const addressComponents = geoCodeData.results[0].address_components;
    
                // Find the country code
                const country = addressComponents.find(component => 
                    component.types.includes("country")
                );
    
                if (country) {
                   
                    geoCodeData.results[0].Country_code = country.short_name;
                    geoCodeData.results[0].Country = country.long_name;
                   
                    
                    console.log(`Country Code: ${country.short_name}`);
                } else {
                    console.log('Country code not found.');
                }
            } else {
                console.log('No results found.');
            }
    
            return geoCodeData;
          
        } catch (error) {
            console.error('Error fetching data from Google Maps API:', error.response ? error.response.data : error.message);
        }
    }
    
    
    async Voucher(body:any): Promise<any> {
        return await this.transferDbService.Voucher(body);
    }
    
    async Categories(body:any): Promise<any> {
        return await this.transferDbService.Categories(body);
    }
    async TransferTypes(body:any): Promise<any> {
        return await this.transferDbService.TransferTypes(body);
    }

    async Vehicles(body:any): Promise<any> {
        return await this.transferDbService.Vehicles(body);
    }

    async Currencies(body:any): Promise<any> {
        return await this.transferDbService.Currencies(body);
    }

    async Pickups(body:any): Promise<any> {
        return await this.transferDbService.Pickups(body);
    }

    async Countries(body:any): Promise<any> {
        return await this.transferDbService.Countries(body);
    }
    
    async Destinations(body:any): Promise<any> {
        return await this.transferDbService.Destinations(body);
    }

    async Hotels(body:any): Promise<any> {
        return await this.transferDbService.Hotels(body);
    }

    async Terminals(body:any): Promise<any> {
        return await this.transferDbService.Terminals(body);
    }

    async Routes(body:any): Promise<any> {
        return await this.transferDbService.Routes(body);
    }

    async unpaidBookings(body: any) {
        let today = new Date();
        let currentDate = formatDate(today);
        const transferBooking = await this.transferDbService.getPayLaterUnpaidTransferBookings('BOOKING_HOLD',  currentDate);
        
        return  transferBooking
      }
}
