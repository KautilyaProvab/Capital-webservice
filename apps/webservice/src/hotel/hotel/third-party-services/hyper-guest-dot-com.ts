
import { Url, TMX_HOTEL_BOOKING_SOURCE, TMX_USER_NAME, TMX_PASSWORD, TMX_DOMAINKEY, TMX_SYSTEM, TBOH_USERNAME, TBOH_PASSWORD } from "apps/webservice/src/constants";



import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { HOTELBEDS_URL, HOTELBEDS_HOTEL_BOOKING_SOURCE, logStoragePath, META_TL_HOTEL_COURSE, HOTELBEDS_APIKEY, HOTELBEDS_SECRET, ExchangeRate_1_GBP_to_USD, BASE_CURRENCY , HYPER_GUEST_TOKEN } from "../../../constants";
import { goGlobalRequestTypes } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { HotelBedsTransformService } from "./hotelbeds-transform.service";
import { HotelTboTransformService } from './tboHolidays-transform.Service';
import axios from "axios";

const crypto = require('crypto');
const fs = require('fs')

@Injectable()
export class HyperGuestDotComService extends HotelApi {

    apiCred: any;
    apiCredCached: boolean = false;

    constructor(
        private readonly httpService: HttpService,
        private redisServerService: RedisServerService) {
        super()
    }

    throwSoapError(jsonResponse: any) {
        if (getPropValue(jsonResponse, 'Header.OperationType') == 'Error') {
            throw new HttpException(getPropValue(jsonResponse, 'Main.Error.Message'), 400);
        }
    }

   
    async Create(body: any): Promise<any> {
        try {
            const url = 'https://hg-static.hyperguest.com/hotels.json' 
            const hotel_result: any = await this.httpService.get(url , {
                headers: { 
                    'Authorization': 'Bearer 43ad539134e84a389ecc6a7761888391',
                    'Accept-Encoding': 'gzip, deflate'
                  }
            }).toPromise(); 

            hotel_result.map(async (getcode: any) => {
                let dataToInsert = {
                    hotelId: getcode.hotel_id ? getcode.hotel_id : '',
                    name: getcode.name ? getcode.name  : '',
                    country: getcode.country ? getcode.country : '' ,
                    region : getcode.region ? getcode.region : '',
                    city_name : getcode.city ? getcode.city  : '' ,
                    city_Id : getcode.city_Id ? getcode.city_Id : ''

                }
                let getCityData = await this.manager.query(`Select *  from  hyper_guest_city where hotelId= "${getcode.hotel_id}" `);

                if (getCityData && !getCityData.length)
                    await this.manager.query(`INSERT INTO hyper_guest_city SET ?`, [dataToInsert]);
            });
          
           
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    async searchRequest(body: any): Promise<any> {
        const { CheckIn, NoOfNights, HotelIds, RoomGuests } = body;
        const guests = RoomGuests.map(room => {
            const adults = room.NoOfAdults;
            const children = room.NoOfChild;
            const childAges = room.ChildAge.join(',');
            return children > 0 ? `${adults}-${childAges}` : `${adults}`;
        }).join('.');
    
        const searchRequest = `https://search-api.hyperguest.io/2.0/?checkIn=${CheckIn}&nights=${NoOfNights}&guests=${guests}&hotelIds=${HotelIds.join(',')}&customerNationality=DE`;
    
        return searchRequest;
    }
    

    async search(body: any): Promise<any> {
        try {
      
           const request : any = await this.searchRequest(body )
           const search_result : any = await this.httpService.get(request , {
            headers: { 
                'Authorization': 'Bearer 43ad539134e84a389ecc6a7761888391',
                'Accept-Encoding': 'gzip, deflate'
              }
        }).toPromise(); 

        if (this.isLogXml) {
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/hotels/hyper-guest/SearchRQ.json`, JSON.stringify(request));
            fs.writeFileSync(`${logStoragePath}/hotels/hyper-guest/SearchRS.json`, JSON.stringify(search_result));
        }

        console.log(search_result , '==========================');

          
           
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

   
}


