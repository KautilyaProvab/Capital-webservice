
import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { getPropValue } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { logStoragePath, BASE_CURRENCY, DOTW_URL, DOTW_B2B_COMPANYCODE, DOTW_B2B_USERNAME, DOTW_B2B_PASSWORD, DOTW_B2C_USERNAME, DOTW_B2C_PASSWORD, DOTW_B2C_COMPANYCODE, DOTW_HOTEL_BOOKING_SOURCE } from "../../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";

import * as md5 from 'md5';
import { HotelDotwTransformService } from "./dotw-transofrm-service";
// const crypto = require('crypto');
const fs = require('fs')

@Injectable()
export class DotwDotComService extends HotelApi {
    apiCred: any;
    apiCredCached: boolean = false;
    constructor(
        private readonly httpService: HttpService,
        private hotelDbService: HotelDbService,
        private HotelDotwTransformService: HotelDotwTransformService,
        private redisServerService: RedisServerService) {
        super()
    }

    throwSoapError(jsonResponse: any) {
        if (getPropValue(jsonResponse, 'Header.OperationType') == 'Error') {
            throw new HttpException(getPropValue(jsonResponse, 'Main.Error.Message'), 400);
        }
    }

    async getAllCities(body: any): Promise<any> {
        let DOTW_USERNAME;
        let hashedPassword;
        let DOTW_COMPANYCODE;

        if (body.UserType == 'B2B') {
            DOTW_USERNAME = DOTW_B2B_USERNAME;
            hashedPassword = md5(DOTW_B2B_PASSWORD)
            DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE
        } else {
            DOTW_USERNAME = DOTW_B2C_USERNAME;
            hashedPassword = md5(DOTW_B2C_PASSWORD)
            DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE
        }
        // const xmlReq = `
        //   <customer>
        //     <username>${DOTW_USERNAME}</username>
        //     <password>${hashedPassword}</password>
        //     <id>${DOTW_COMPANYCODE}</id>
        //     <source>1</source>
        //     <request command="getallcities">
        //       <return>
        //         <fields>
        //           <field>countryName</field>
        //           <field>countryCode</field>
        //         </fields>
        //       </return>
        //     </request>
        //   </customer>`;

        //         try {
        //             const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
        //                 headers: {
        //                     'Content-Type': 'text/xml; charset=utf-8',
        //                 }
        //             }).toPromise();

        //             if (response) {
        //                 fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/getCityREQ.xml`, xmlReq);
        //                 fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/getCityRES.xml`, response);
        //             } else {
        //                 console.warn('Response data is undefined');
        //             }

        //             const valuationResp: any = await this.xmlToJson(response);
        //             const cityDataList = valuationResp.result.cities.city;

        //             if (cityDataList && cityDataList.length) {
        //                 for (const city of cityDataList) {
        //                     const cityObj = {
        //                         city_name: city.name ? city.name['$t'] : '',
        //                         city_code: city.code ? city.code['$t'] : '',
        //                         country_name: city.countryName ? city.countryName['$t'] : '',
        //                         country_code: city.countryCode ? city.countryCode['$t'] : ''
        //                     };

        //                     const existingCity = await this.manager.query(
        //                         `SELECT * FROM dotw_city_list WHERE city_code = ?`, [city.code['$t']]
        //                     );

        //                     if (!existingCity.length) {
        //                         await this.manager.query(
        //                             `INSERT INTO dotw_city_list SET ?`, [cityObj]
        //                         );
        //                     }
        //                 }
        //             }
        //         } catch (error) {
        //             console.error('Error in getAllCities method:', error.message);
        //             throw error;
        //         }

        //         const xmlReq2 = `
        //           <customer>
        //             <username>${DOTW_USERNAME}</username>
        //             <password>${hashedPassword}</password>
        //             <id>${DOTW_COMPANYCODE}</id>
        //             <source>1</source>
        //             <request command="getcurrenciesids"></request>
        //           </customer>`;

        //         try {
        //             const response: any = await this.httpService.post(DOTW_URL, xmlReq2, {
        //                 headers: {
        //                     'Content-Type': 'text/xml; charset=utf-8',
        //                 }
        //             }).toPromise();

        //             if (response) {
        //                 fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/dotwCurrencyRQ.xml`, xmlReq2);
        //                 fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/dotwCurrencyRS.xml`, response);
        //             } else {
        //                 console.warn('Response data is undefined');
        //             }

        //             const valuationResp1: any = await this.xmlToJson(response);
        //             let currencyData = valuationResp1.result.currency.option
        //             if (currencyData && currencyData.length) {
        //                 for (const currency of currencyData) {
        //                     console.log(currency, '======');

        //                     const currencyObj = {
        //                         runo_id: currency.runno ? currency.runno : '',
        //                         currency: currency.shortcut ? currency.shortcut : '',
        //                         currency_code: currency.value ? currency.value : '',
        //                         currency_name: currency['$t'] ? currency['$t'] : ''
        //                     };

        //                     const existingCity = await this.manager.query(
        //                         `SELECT * FROM dotw_currency_data WHERE currency_code = ?`, [currency.value]
        //                     );

        //                     if (!existingCity.length) {
        //                         await this.manager.query(
        //                             `INSERT INTO dotw_currency_data SET ?`, [currencyObj]
        //                         );
        //                     }
        //                 }
        //             }

        //         } catch (error) {
        //             console.error('Error in getCurrencies method:', error.message);
        //             throw error;
        //         }

        //         const xmlReq3 = `<customer>  
        //       <username>${DOTW_USERNAME}</username>
        //         //     <password>${hashedPassword}</password>
        //         //     <id>${DOTW_COMPANYCODE}</id>
        //     <source>1</source>  
        //     <request command="getlanguagesids"></request>  
        // </customer> `;

        //         try {
        //             const response: any = await this.httpService.post(DOTW_URL, xmlReq3, {
        //                 headers: {
        //                     'Content-Type': 'text/xml; charset=utf-8',
        //                 }
        //             }).toPromise();

        //             if (response) {
        //                 fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/dotwLanguageRQ.xml`, xmlReq3);
        //                 fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/dotwLanguageRS.xml`, response);
        //             } else {
        //                 console.warn('Response data is undefined');
        //             }

        //             const valuationResp2: any = await this.xmlToJson(response);
        //             const languageData = valuationResp2.result.languages.option

        //             //  let currencyData = valuationResp1.result.currency.option 
        //             if (languageData && languageData.length) {
        //                 for (const language of languageData) {
        //                     console.log(language, '======');

        //                     const languageObj = {
        //                         runo_id: language.runno ? language.runno : '',
        //                         language_shortcut: language.shortcut ? language.shortcut : '',
        //                         language_code: language.value ? language.value : '',
        //                         language: language['$t'] ? language['$t'] : ''
        //                     };

        //                     const existingCity = await this.manager.query(
        //                         `SELECT * FROM dotw_language_data WHERE language_code = ?`, [language.value]
        //                     );

        //                     if (!existingCity.length) {
        //                         await this.manager.query(
        //                             `INSERT INTO dotw_language_data SET ?`, [languageObj]
        //                         );
        //                     }
        //                 }
        //             }

        //         } catch (error) {
        //             console.error('Error in getCurrencies method:', error.message);
        //             throw error;
        //         }

        // const xmlReq = `
        // <customer>
        //   <username>${DOTW_USERNAME}</username>
        //   <password>${hashedPassword}</password>
        //   <id>${DOTW_COMPANYCODE}</id>
        //   <source>1</source>
        //    <request command="getsalutationsids"></request>  
        // </customer>`;

        // try {
        //   const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
        //       headers: {
        //           'Content-Type': 'text/xml; charset=utf-8',
        //       }
        //   }).toPromise();

        //   if (response) {
        //       fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/getSalutationREQ.xml`, xmlReq);
        //       fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/getSalutationRES.xml`, response);
        //   } else {
        //       console.warn('Response data is undefined');
        //   }
        //   const valuationResp: any = await this.xmlToJson(response);
        //    let  salutationsData = valuationResp.result.salutations.option
        //    console.log(salutationsData , '==========');

        //   if (salutationsData && salutationsData.length) {DOTW_B2B_USERNAME
        //       for (const salution of salutationsData) {
        //           const salutationObj = {
        //               code: salution?.value ?? '' ,
        //               title:  salution?.['$t'] ?? ''
        //           };

        //           const existingCity = await this.manager.query(
        //               `SELECT * FROM dotw_salutations_data WHERE code = ?`, [salution?.value]
        //           );

        //           if (!existingCity.length) {
        //               await this.manager.query(
        //                   `INSERT INTO dotw_salutations_data SET ?`, [salutationObj]
        //               );
        //           }
        //       }
        //   }
        // } catch (error) {
        //   console.error('Error in getAllCities method:', error.message);
        //   throw error;
        // }

        const xmlReq = `
<customer>
  <username>${DOTW_USERNAME}</username>
  <password>${hashedPassword}</password>
  <id>${DOTW_COMPANYCODE}</id>
  <source>1</source>
  <request command="getratebasisids"></request>  
</customer>`;

        try {
            const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                }
            }).toPromise();

            if (response) {
                fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/getRateBasisIdREQ.xml`, xmlReq);
                fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/getRateBasisIdRES.xml`, response);
            } else {
                console.warn('Response data is undefined');
            }
            const valuationResp: any = await this.xmlToJson(response);
            console.log(valuationResp);

            let getRateBasisData = valuationResp.result.ratebasis.option
            console.log(getRateBasisData, '==========');

            if (getRateBasisData && getRateBasisData.length) {
                for (const ratebasis of getRateBasisData) {
                    const ratebasisObj = {
                        code: ratebasis?.value ?? '',
                        ratebasis: ratebasis?.['$t'] ?? ''
                    };

                    const existingRateBasis = await this.manager.query(
                        `SELECT * FROM dotw_ratebasis_code_data WHERE code = ?`, [ratebasis?.value]
                    );

                    if (!existingRateBasis.length) {
                        await this.manager.query(
                            `INSERT INTO dotw_ratebasis_code_data SET ?`, [ratebasisObj]
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Error in getAllCities method:', error.message);
            throw error;
        }
    }
    async Create(body: any): Promise<any> {

        let DOTW_USERNAME;
        let hashedPassword;
        let DOTW_COMPANYCODE;

        if (body.UserType == 'B2B') {
            DOTW_USERNAME = DOTW_B2B_USERNAME;
            hashedPassword = md5(DOTW_B2B_PASSWORD);
            DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE;
        } else {
            DOTW_USERNAME = DOTW_B2C_USERNAME;
            hashedPassword = md5(DOTW_B2C_PASSWORD);
            DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE;
        }

        let cityData = await this.manager.query(`SELECT city_code FROM dotw_city_list ORDER BY id ASC Limit 3000 offset 30000`);

        let data = await this.manager.query(`SELECT city_code FROM dotw_static_data where city_code = "${cityData[0].city_code}"`)

        // console.log(data, ' ==================================== ', cityData[0].city_code);

        if (!data.length) {
            for (let city of cityData) {
                const xmlReq = `
            <customer>  
                <username>${DOTW_USERNAME}</username>
                <password>${hashedPassword}</password>
                <id>${DOTW_COMPANYCODE}</id>
                <source>1</source>  
                <product>hotel</product>  
                <language>en</language>  
                <request command="searchhotels">  
                    <bookingDetails>  
                        <fromDate>${body.CheckIn}</fromDate>  
                        <toDate>${body.CheckOut}</toDate>  
                        <currency>416</currency>  
                        <rooms no="1">  
                            <room runno="0">  
                                <adultsCode>1</adultsCode>  
                                <children no="0"></children>  
                                <rateBasis>-1</rateBasis>  
                            </room>  
                        </rooms>  
                    </bookingDetails>  
                    <return>  
                        <getRooms>true</getRooms> 
                        <filters xmlns:a="http://us.dotwconnect.com/xsd/atomicCondition" xmlns:c="http://us.dotwconnect.com/xsd/complexCondition">  
                            <city>${city.city_code}</city>  
                            <noPrice>true</noPrice>  
                        </filters>  
                        <fields>  
                            <field>preferred</field>  
                            <field>builtYear</field>  
                            <field>renovationYear</field>  
                            <field>floors</field>  
                            <field>noOfRooms</field>  
                            <field>fullAddress</field>  
                            <field>description1</field>  
                            <field>description2</field>  
                            <field>hotelName</field>  
                            <field>address</field>  
                            <field>zipCode</field>  
                            <field>location</field>  
                            <field>locationId</field>  
                            <field>geoLocations</field>  
                            <field>location1</field>  
                            <field>location2</field>  
                            <field>location3</field>  
                            <field>cityName</field>  
                            <field>cityCode</field>  
                            <field>stateName</field>  
                            <field>stateCode</field>  
                            <field>countryName</field>  
                            <field>countryCode</field>  
                            <field>regionName</field>  
                            <field>regionCode</field>  
                            <field>attraction</field>  
                            <field>amenitie</field>  
                            <field>leisure</field>  
                            <field>business</field>  
                            <field>transportation</field>  
                            <field>hotelPhone</field>  
                            <field>hotelCheckIn</field>  
                            <field>hotelCheckOut</field>  
                            <field>minAge</field>  
                            <field>rating</field>  
                            <field>images</field>  
                            <field>fireSafety</field>  
                            <field>hotelPreference</field>  
                            <field>direct</field>  
                            <field>geoPoint</field>  
                            <field>leftToSell</field>  
                            <field>chain</field>  
                            <field>lastUpdated</field>  
                            <field>priority</field>  
                            <roomField>name</roomField>  
                            <roomField>roomInfo</roomField>  
                            <roomField>roomAmenities</roomField>  
                            <roomField>twin</roomField>  
                        </fields>  
                    </return>  
                </request>  
            </customer>`;

                console.log(`Request XML for city ${city.city_code}: `);

                try {
                    const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                        }
                    }).toPromise();

                    if (response) {

                        // fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/SearchCreateRQ_${city.city_code}.xml`, xmlReq);
                        // fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/SearchCreateRS_${city.city_code}.xml`, response);

                        const valuationResp: any = await this.xmlToJson(response);

                        let hotelData = valuationResp.result?.hotels?.hotel;

                        if (Array.isArray(hotelData)) {
                            let hotelDetailsArray: any = [];

                            for (let hotel of hotelData) {

                                let amenityArr = [];

                                if (hotel.amenitie) {
                                    if (hotel.amenitie?.language?.amenitieItem?.length) {
                                        amenityArr = hotel.amenitie.language.amenitieItem.map((amenities: any) => amenities['$t']);
                                    }

                                }
                                let hotel_image = [];
                                if (hotel.images?.hotelImages?.image?.length) {
                                    hotel_image = hotel.images.hotelImages.image.map((image: any) => image.url['$t']);
                                }

                                let leisure_item = [];
                                if (hotel.leisure?.language?.leisureItem?.length) {
                                    leisure_item = hotel.leisure.language.leisureItem.map((leisure: any) => leisure['$t']);
                                }

                                let business_item = [];
                                if (hotel.business?.language?.businessItem?.length) {
                                    business_item = hotel.business.language.businessItem.map((businessItem: any) => businessItem['$t']);
                                }

                                let geoPoints = {
                                    lat: hotel.geoPoint?.lat?.['$t'] || '',
                                    lng: hotel.geoPoint?.lng?.['$t'] || ''
                                };

                                let hotelObj = {
                                    hotel_id: hotel.hotelid || '',
                                    city_name: hotel.cityName?.['$t'] || '',
                                    built_Year: hotel.builtYear?.['$t'] || '',
                                    renovation_year: hotel.renovationYear?.['$t'] || '',
                                    floors: hotel.floors?.['$t'] || '',
                                    noOfRooms: hotel.noOfRooms?.['$t'] || '',
                                    hotel_address: hotel.fullAddress?.hotelStreetAddress?.['$t'] || '',
                                    zip_code: hotel.fullAddress?.hotelZipCode?.['$t'] || '',
                                    hotel_country: hotel.fullAddress?.hotelCountry?.['$t'] || '',
                                    description1: hotel.description1?.language?.['$t'] || '',
                                    description2: hotel.description2?.language?.['$t'] || '',
                                    hotel_name: hotel.hotelName?.['$t'] || '',
                                    amenities_item: JSON.stringify(amenityArr) || '[]',
                                    leisure_item: JSON.stringify(leisure_item) || '[]',
                                    business_item: JSON.stringify(business_item) || '[]',
                                    hotelCheckIn: hotel.hotelCheckIn?.['$t'] || '',
                                    hotelCheckOut: hotel.hotelCheckOut?.['$t'] || '',
                                    minAge: hotel.minAge?.['$t'] || '',
                                    rating: hotel.rating?.['$t'] || '',
                                    hotel_images: JSON.stringify(hotel_image) || '[]',
                                    geoPoint: JSON.stringify(geoPoints) || '',
                                    city_code: hotel.cityCode?.['$t'] || '',
                                    hotelPhone: hotel?.hotelPhone?.['$t'] ?? ''
                                };

                                let existingHotelData = await this.manager.query(`SELECT hotel_id FROM dotw_static_data WHERE hotel_id = "${hotel.hotelid}"`);
                                if (!existingHotelData.length) {
                                    await this.manager.query(`INSERT INTO dotw_static_data SET ?`, [hotelObj]);
                                }
                            }
                        } else {
                            console.warn(`hotelData is not an array or is undefined for city ${city.city_code}`);
                        }
                    } else {
                        console.warn(`Response data is undefined for city ${city.city_code}`);
                    }
                } catch (error) {
                    console.error(`Error processing city ${city.city_code}:`, error);
                }
            }

            return { message: 'Processing completed for all cities.' };
        }
        else {
            console.log(`no length ================?????>>>>>>>>>>>`);

        }
    }

    formatRooms(rooms, body) {
        let roomDetails = [];
        let totalRoomPrice = 0;
        let totalRooms = 0;

        if (!Array.isArray(rooms.room)) {
            rooms.room = [rooms.room];
        }

        let HotelPrice  = Infinity
        let data = rooms.room.map((roomEle, index) => {

            if (!Array.isArray(roomEle.roomType)) {
                roomEle.roomType = [roomEle.roomType];
            }

            let roomTypeArr = roomEle.roomType.map((roomData) => {
                if (!Array.isArray(roomData.rateBases.rateBasis)) {
                    roomData.rateBases.rateBasis = [roomData.rateBases.rateBasis];
                }


                let rates = roomData.rateBases.rateBasis.map((rate) => {
                    
                    let netPrice =  rate.totalMinimumSelling ?  Number(parseFloat(rate.totalMinimumSelling['$t']).toFixed(2)): Number(parseFloat(rate.total['$t']).toFixed(2));
            
                    if (netPrice < HotelPrice) {
                        HotelPrice = netPrice;
                    }
                  


                    // totalRoomPrice += parseFloat(netPrice);

                    return {
                        rateKey: roomData?.roomtypecode ?? '',
                        name: roomData?.name?.['$t'] ?? '',
                        rateClass: "",
                        net: netPrice,
                        allotment: '',
                        paymentType: "",
                        packaging: false,
                        boardCode: '',
                        RoomType: roomData?.name?.['$t'] ?? '',
                        NonRefundable: '',
                        boardName: '',
                        cancellationPolicies: '',
                        rooms: index + 1,
                        adults: roomEle?.adults ?? '',
                        children: roomEle?.children ?? '',
                        extrabeds: roomEle?.extrabeds ?? '',
                        offers: "",
                    };
                });

                return {
                    code: roomData?.roomtypecode ?? '',
                    name: roomData?.name['$t'] ?? '',
                    rate: rates
                };
            });

            roomDetails[index] = roomTypeArr;

            totalRooms += 1;
            return roomEle;
        });




        // let averageRoomPrice = totalRooms > 0 ? (totalRoomPrice / totalRooms).toFixed(2) : 0;
        return { roomDetails, HotelPrice };
    }

    async search(body: any): Promise<any> {
        try {
            let DOTW_USERNAME;
            let hashedPassword;
            let DOTW_COMPANYCODE;

            if (body.UserType == 'B2B') {
                DOTW_USERNAME = DOTW_B2B_USERNAME;
                hashedPassword = md5(DOTW_B2B_PASSWORD);
                DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE;
            } else {
                DOTW_USERNAME = DOTW_B2C_USERNAME;
                hashedPassword = md5(DOTW_B2C_PASSWORD);
                DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE;
            }

            let CurrencyCode = await this.manager.query(`SELECT currency_code FROM dotw_currency_data where currency = "${body.Currency}"`)
            CurrencyCode = CurrencyCode[0];
            let Dotw_currency_code = CurrencyCode.currency_code;


            let giataData = await this.hotelDbService.getHotelIdsByGiataId(body?.CityIds?.[0] ?? null, DOTW_HOTEL_BOOKING_SOURCE);
            let hotelcode = giataData.hotelIds
            
            // Add  new hotel 809755 For send a Screeshot to APi Team For this hotel
            hotelcode.push('809755') // Remove the code 
           
        
            let cityNameUpperCase = giataData.city_name.toUpperCase();
            let PassengerNationalityCode = await this.manager.query(`SELECT country_code, country_name FROM dotw_city_list WHERE UPPER(city_name) LIKE "%${cityNameUpperCase}%"`);

            if (!hotelcode || hotelcode.length === 0) {
                throw new Error(`400 No Hotel Found`);
            }

            const roomGuestsXML = body.RoomGuests.map((room: any, index: number) => {
                const childrenXML = room.ChildAge.map((age: number, childIndex: number) => {
                    return `<child runno="${childIndex}">${age}</child>`;
                }).join('');

                return `
                <room runno="${index}">
                    <adultsCode>${room.NoOfAdults}</adultsCode>
                    <children no="${room.NoOfChild}">
                        ${childrenXML}
                    </children>
                    <rateBasis>${room.RateBasis || '-1'}</rateBasis>
                    <passengerNationality>${PassengerNationalityCode[0].country_code}</passengerNationality>
                    <passengerCountryOfResidence>${PassengerNationalityCode[0].country_code}</passengerCountryOfResidence>
                </room>`;
            }).join('');


            const chunkSize = 50;
            let resultData = [];

            for (let i = 0; i < hotelcode.length; i += chunkSize) {
                const hotelCodeChunk = hotelcode.slice(i, i + chunkSize);


                let xmlReq = `
    <customer>  
        <username>${DOTW_USERNAME}</username>
        <password>${hashedPassword}</password>
        <id>${DOTW_COMPANYCODE}</id>
        <source>1</source>   
        <product>hotel</product>  
        <request command="searchhotels">  
            <bookingDetails>  
                <fromDate>${body.CheckIn}</fromDate>  
                <toDate>${body.CheckOut}</toDate>  
                <currency>${Dotw_currency_code}</currency>   
                <rooms no="${body.NoOfRooms}">
                    ${roomGuestsXML}
                </rooms>  
            </bookingDetails>  
            <return>  
                <filters xmlns:a="http://us.dotwconnect.com/xsd/atomicCondition" xmlns:c="http://us.dotwconnect.com/xsd/complexCondition">  
                    <c:condition>  
                        <a:condition>  
                            <fieldName>hotelId</fieldName>  
                            <fieldTest>in</fieldTest>
                            <fieldValues>`;

                hotelCodeChunk.forEach(code => {
                    xmlReq += `<fieldValue>${code}</fieldValue>`;
                });

                xmlReq += `</fieldValues>  
                        </a:condition>  
                    </c:condition>  
                </filters>  
            </return>  
        </request>  
    </customer>`;

                console.log("Request XML: ", xmlReq);

                const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                    }
                }).toPromise();

                if (response) {
                    fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/SearchRQ_${i}.xml`, xmlReq);
                    fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/SearchRS_${i}.xml`, response);
                } else {
                    console.warn('Response data is undefined');
                }

                const valuationResp: any = await this.xmlToJson(response);
                if (valuationResp?.['result']?.['successful']?.['$t'] === 'TRUE') {
                    let HotelResult = valuationResp.result.hotels.hotel;

                    if (!Array.isArray(HotelResult)) {
                        HotelResult = [HotelResult];
                    }
                    const hotelIds = HotelResult.map((hotel) => hotel.hotelid);

                    let hotelDetailsList = await this.manager.query(`SELECT  DOTW as hotel_id,giata_code, hotel_name , address, email, star_rating, images, phone_number, trip_adv_rating, country_code ,country_name, city_name, city_code, destination_name FROM giata_property_data WHERE DOTW IN (${hotelIds.map(id => `"${id}"`).join(',')})`);

                if (!hotelDetailsList || hotelDetailsList.length === 0) {
                        console.warn('No hotel details found for the hotel IDs');
                        continue;
                    }

                       let hotelDetailsMap = hotelDetailsList.reduce((map, hotel) => {
                        map[hotel.hotel_id] = hotel;
                        return map;
                    }, {});

                    let dataFormat: any = await Promise.all(HotelResult.map(async (hotel) => {
                        try {
                            const hotelDetails = hotelDetailsMap[hotel.hotelid];
                            if (!hotelDetails) {
                                console.warn(`Hotel details not found for hotel id: ${hotel.hotelid}`);
                                return null;
                            }

                            // let geoPoint;
                            // if (hotelDetails?.geoPoint) {
                            //     geoPoint = JSON.parse(hotelDetails?.geoPoint);
                            // }

                            let hotelEmail = JSON.parse(hotelDetails.email)

                            let hotel_picture = []
                            if (hotelDetails?.images) {
                              let hotel_images = JSON.parse(hotelDetails.images);
                              hotel_images.forEach((image) => {
                                let picture_url = `https://photos.hotelbeds.com/giata/${image.path}`
                                hotel_picture.push(picture_url)
                              })
                            }

                            let address = hotelDetails.address ? JSON.parse(hotelDetails.address) : ''
                            let hotelAddress = ``;
                            if(address && address.addressLine_1 != undefined && address.addressLine_1 != undefined ){
                            hotelAddress = address.addressLine_1+`, `+address.addressLine_2;
                                if (address.cityName != undefined && !hotelAddress.includes(address.cityName)) {
                                hotelAddress += `, `+address.cityName;
                              }
                            }


                            
                            let data = {
                                HotelCode: hotelDetails?.hotel_id ?? '',
                                GiataCode: hotelDetails?.giata_code ?? '',
                                HotelName: hotelDetails?.hotel_name ?? '',
                                HotelCategory: "",
                                StarRating: hotelDetails?.star_rating ?? '',
                                HotelPromotion: "",
                                HotelPolicy: [],
                                Dotw_currency_code: Dotw_currency_code,
                                Price: { Amount: 0, Currency: body?.Currency ?? '', Commission: '', Markup: {}, },
                                HotelPicture: hotel_picture && hotel_picture.length ? hotel_picture[0] : '',
                                HotelAddress: hotelAddress ? hotelAddress : '',
                                HotelContactNo: "",
                               
                                Latitude: hotelDetails?.latitude ?? '',
                                Longitude: hotelDetails?.longitude ?? '',
                                Breakfast: '',
                            
                                SupplierPrice: "",
                                OrginalHotelCode: "",
                                HotelPromotionContent: "",
                                PhoneNumber: hotelDetails.phone_number ? JSON.parse(hotelDetails.phone_number) : {},
                                Free_cancel_date: "",
                                trip_adv_url: hotelDetails?.trip_adv_rating ?? '',
                                trip_rating: "",
                                NoOfRoomsAvailableAtThisPrice: "",
                                Refundable: "",
                                Email: hotelEmail && hotelEmail.length ? hotelEmail : '',
                                CountryCode: hotelDetails?.country_code ?? '',
                                CountryName: hotelDetails?.country_name ?? '',
                                CityName: hotelDetails?.city_name ?? '',
                                CityCode: hotelDetails?.city_code ?? '',
                                DestinationName: hotelDetails?.destination_name ?? '',
                                NoOfReviews: "",
                                ReviewScore: "",
                                ReviewScoreWord: "",
                                checkIn:body.CheckIn ?? '',
                                checkOut: body?.CheckOut?? '',
                                Source: "DotwHotel",
                                PassengerNationalityCode: PassengerNationalityCode,
                                ResultToken: ''
                              };

                            let { roomDetails, HotelPrice }: any = this.formatRooms(hotel.rooms, body);
                            data.Price.Amount  = HotelPrice
                            body.Dotw_currency_code = Dotw_currency_code
                            body.PassengerNationalityCode = PassengerNationalityCode


                            const temp = {
                                ...data,
                                roomDetails: roomDetails,
                                searchRequest: body,
                                booking_source: body.booking_source,
                                ResultToken: data["ResultToken"]
                            };

                            return temp;
                        } catch (err) {
                            console.error("Error processing hotel details:", err);
                            return null;
                        }
                    }));

                    dataFormat = dataFormat.filter(item => item !== null);

                    const token = this.redisServerService.geneateResultToken(body);
                    const batchResultData = await Promise.all(
                        dataFormat.map(async (x: any) => {
                            const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
                            delete x["ResultToken"];
                            return {
                                ...x,
                                ResultIndex: response["access_key"]
                            };
                        })
                    );

                    resultData.push(...batchResultData);
                } else {
                    const errorClass: any = getExceptionClassByCode(`400 ${valuationResp.result.request.error.extraDetails.xsd_error.error_message['$t']}`);
                    throw new errorClass(`${valuationResp.result.request.error.extraDetails.xsd_error.error_message['$t']}`);
                }
            }

            if (resultData.length > 0) {
                return resultData;
            } else {
                return [];
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(`400 ${error} `);
            throw new errorClass(error);
        }
    }



    async getHotelDetails(body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken);
                data = JSON.parse(data[0]);
                let token = data["ResultToken"];

                let DOTW_USERNAME;
                let hashedPassword;
                let DOTW_COMPANYCODE;

                if (data.searchRequest.UserType == 'B2B') {
                    DOTW_USERNAME = DOTW_B2B_USERNAME;
                    hashedPassword = md5(DOTW_B2B_PASSWORD)
                    DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE
                } else {
                    DOTW_USERNAME = DOTW_B2C_USERNAME;
                    hashedPassword = md5(DOTW_B2C_PASSWORD)
                    DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE
                }

                let room1 = data.searchRequest.RoomGuests[0];
                let room1_pax = room1.NoOfAdults + "_" + room1.NoOfChild;

                let currencyDetails: any;
                let conversionRate = 1;

                if (data.Price.Currency == BASE_CURRENCY) {
                    currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(data.Price.Currency);
                    conversionRate = currencyDetails['value'];


                }

                let markup: any;

                // if (data['searchRequest'].UserType) {   
                //     if (data['searchRequest'].UserId == undefined) {
                //         data['searchRequest'].UserId = 0;
                //     }
                //     markup = await this.hotelDbService.getMarkupDetails(data['searchRequest'].UserType, data['searchRequest'].UserId , body);

                // }


        let hotelImages = await this.hotelDbService.GetHotelImages(data.GiataCode);
        let hotelFacility = await this.hotelDbService.GetHotelFacilitiesGiata(data.GiataCode)

        let hotelFacilityDescription: any = []; 
        if(hotelFacility[0] && hotelFacility[0].hotel_fac){
         let fac = JSON.parse(hotelFacility[0].hotel_fac);
         fac.forEach(FacilityElement => {

         hotelFacilityDescription.push(FacilityElement.replace(/^facility_/, ''));
        });
     }


    let galleryImages = [];
    let roomImages= [];
    if(hotelImages[0] != undefined && hotelImages[0].images != undefined){
    let gallery = JSON.parse(hotelImages[0].images);
     
  
    gallery.forEach(element => {
        if(element.roomCode == undefined){
            let hImages = `https://photos.hotelbeds.com/giata/`+element.path;
            galleryImages.push(hImages);
            
          }else{
            let hImages = `https://photos.hotelbeds.com/giata/`+element.path;
            roomImages[element.roomCode]=hImages;
          }
          
        });
      }
  


                let dataFormat = {
                    ResultIndex: data?.ResultIndex ?? 0,
                    HotelCode: data?.HotelCode ?? null,
                    HotelName: data?.HotelName ?? "",
                    HotelCategory: data.HotelCategory ? data.HotelCategory : "",
                    // GiataCode : hotelDetails.giata_code ,
                    StarRating: data?.StarRating ?? "",
                    HotelDescription:  hotelImages && hotelImages.length ? hotelImages[0].hotel_desc :  "",
                    HotelPromotion: data.HotelPromotionContent ? data.HotelPromotionContent : "",
                    HotelPolicy: data?.HotelPolicy ?? [],
                    Dotw_currency_code: data?.Dotw_currency_code ?? '',
                    Price: data?.Price ?? {},
                    AveragePerNight: data?.AveragePerNight ?? "",
                    HotelPicture:  galleryImages  && galleryImages.length ? galleryImages : [],
                    HotelCheckIn: data?.HotelCheckIn ?? '',
                    HotelCheckOut: data?.HotelCheckOut ?? '',
                    LeisureItem: data?.LeisureItem ?? [],
                    BusinessItem: data?.BusinessItem ?? [],
                    HotelAddress: data?.HotelAddress ?? "",
                    HotelContactNo: data?.HotelContactNo ?? "",
                    HotelMap: data?.HotelMap ?? null,
                    Latitude: data?.Latitude ?? "",
                    Longitude: data?.Longitude ?? "",
                    Breakfast: data?.Breakfast ?? "",
                    HotelLocation: data?.HotelLocation ?? null,
                    SupplierPrice: data?.SupplierPrice ?? null,
                    HotelAmenities:  hotelFacilityDescription && hotelFacilityDescription.length ?  hotelFacilityDescription :  [],
                    OrginalHotelCode: data?.HotelCode ?? "",
                    Free_cancel_date: data?.Free_cancel_date ?? "",
                    trip_adv_url: data?.trip_adv_url ?? "",
                    trip_rating: data?.trip_rating ?? "",
                    NoOfRoomsAvailableAtThisPrice: data?.NoOfRoomsAvailableAtThisPrice ?? "",
                    Refundable: data?.Refundable ?? "",
                    HotelCurrencyCode: data?.CurrencyCode ?? "",
                    NoOfReviews: data.NoOfReviews ? data.NoOfReviews : "",
                    ReviewScore: data?.ReviewScore ?? "",
                    PhoneNumber: data?.PhoneNumber ?? "",
                    ReviewScoreWord: data?.ReviewScoreWord ?? "",
                    CheckIn: data?.checkIn ?? "",
                    CheckOut: data?.checkOut ?? "",
                    Source: "Dotw",
                    PassengerNationalityCode: data?.PassengerNationalityCode ?? [],
                    searchRequest: data?.searchRequest ?? '',
                    booking_source: body.booking_source,
                    HotelPromotionContent: data?.HotelPromotionContent ?? "",
                };

                const roomDetails = [];
                if (data?.roomDetails) {
                    let bodyData = data.searchRequest

                    const roomGuestsXML = bodyData.RoomGuests.map((room: any, index: number) => {
                        const childrenXML = room.ChildAge.map((age: number, childIndex: number) => {
                            return `<child runno="${childIndex}">${age}</child>`;
                        }).join('');


                        return `
        <room runno="${index}">
            <adultsCode>${room.NoOfAdults}</adultsCode>
            <children no="${room.NoOfChild}">
                ${childrenXML}
            </children>
            <rateBasis>-1</rateBasis>
            <passengerNationality>${data.PassengerNationalityCode[0].country_code}</passengerNationality>
            <passengerCountryOfResidence>${data.PassengerNationalityCode[0].country_code}</passengerCountryOfResidence>
        </room>`;
                    }).join('');

                    const xmlReq = `
    <customer>  
        <username>${DOTW_USERNAME}</username>
        <password>${hashedPassword}</password>
        <id>${DOTW_COMPANYCODE}</id>
        <source>1</source>  
        <product>hotel</product>  
        <request command="getrooms">  
            <bookingDetails>  
                <fromDate>${bodyData.CheckIn}</fromDate>  
                <toDate>${bodyData.CheckOut}</toDate>  
                <currency>${data?.Dotw_currency_code}</currency>  
                <rooms no="${bodyData.NoOfRooms}">
                    ${roomGuestsXML}
                </rooms>  
                <productId>${data.HotelCode}</productId>
            </bookingDetails>   
        </request>  
    </customer>`;



                    const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                        }
                    }).toPromise();

                    if (response) {
                        fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/RoomDetailsRQ.xml`, xmlReq);
                        fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/RoomDetailsRS.xml`, response);
                    } else {
                        console.warn('Response data is undefined');
                    }

                    const valuationResp: any = await this.xmlToJson(response);

                    if (valuationResp.result.successful['$t'] === 'TRUE') {
                        let roomData = valuationResp.result.hotel.rooms

                        if (!Array.isArray(roomData.room)) {
                            roomData.room = [roomData.room];
                        }

                        await Promise.all(roomData.room.map(async (room, index) => {

                            const adultRegex = /(\d+)\s+adult\/s/g;
                            const childRegex = /(\d+)\s+child/g;

                            const adults = [];
                            const children = [];

                            let match;
                            while ((match = adultRegex.exec(room.lookedForText['$t'])) !== null) {
                                adults.push(match[1]);
                            }
                            while ((match = childRegex.exec(room.lookedForText['$t'])) !== null) {
                                children.push(match[1]);
                            }

                            console.log("Adults: ", adults);
                            console.log("Children: ", children);


                            let roomGroup = [];

                            if (!Array.isArray(room.roomType)) {
                                room.roomType = [room.roomType];
                            }

                            await Promise.all(room.roomType.map(async (roomtype) => {
                                if (!Array.isArray(roomtype.rateBases.rateBasis)) {
                                    roomtype.rateBases.rateBasis = [roomtype.rateBases.rateBasis];
                                }

                                await Promise.all(roomtype.rateBases.rateBasis.map(async (rate) => {

                                if (!Array.isArray(rate.cancellationRules.rule)) {
                                    rate.cancellationRules.rule = [rate.cancellationRules.rule];
                               }
                                    let cancellationPolicies = "";
                                    let NonRefundableFlag 
                                    if (rate?.cancellationRules?.rule && Array.isArray(rate.cancellationRules.rule)) {

                                        if( rate?.cancellationRules.rule[0].cancelRestricted?.['$t']){
                                            NonRefundableFlag = true
                                        }
                                        else if(rate?.cancellationRules.rule[0].cancelCharge?.['$t'] == 0){
                                            NonRefundableFlag = false
                                        }
                                        else{
                                            NonRefundableFlag = true
                                        }
                                    
                                           cancellationPolicies = rate.cancellationRules.rule.map((policy, i) => { 
                                        //   let PolicyCharge = policy?.cancelRestricted?.['$t'] === 'true'  ? true  : policy?.cancelCharge 
                                            const fromDate = policy.fromDate?.['$t'];
                                            const toDate = policy.toDate?.['$t'];
                                            const charge = policy.charge?.formatted?.['$t'] || policy.charge?.['$t'] || '';
                                            const amendRestricted = policy?.amendRestricted?.['$t'] === 'true' ?`Amendments restricted ${policy.amendRestricted['$t']}` : '';
                                            const cancelRestricted = policy?.cancelRestricted?.['$t'] === 'true' ? `Cancellations restricted ${policy.cancelRestricted['$t']}`  : '';
                                            const noShowPolicy = policy.noShowPolicy?.['$t'] === 'true' ? `noShowPolicy ${policy.noShowPolicy['$t']}` : '';

                                            let policyText = `Policy ${i + 1}: ${fromDate ? `From ${fromDate}` : ''} ${toDate ? `to ${toDate}` : ''}`;


                                        if (charge || (!amendRestricted && !cancelRestricted)) {
                                           policyText += `, charge is ${charge}`;
                                         }

                                         const conditions = [amendRestricted, cancelRestricted, noShowPolicy].filter(Boolean).join(' ');
                                         policyText += conditions ? ` ${conditions}` : '';
                                       
                                         return policyText.trim();

                                        }).join('; ');
                                    } 
                                  
                                    const cleanedTariffNotes = rate?.tariffNotes?.['$t']
                                        ?.replace(/\\n/g, ' ')       // Replace escaped newline characters
                                        ?.replace(/\n/g, ' ')        // Replace actual newline characters
                                        ?.replace(/\\r/g, '')        // Remove escaped carriage returns
                                        ?.replace(/\r/g, '')         // Remove actual carriage returns
                                        ?.replace(/&amp;/g, '&')     // Decode HTML entity for "&"
                                        ?.replace(/\\'/g, "'")       // Replace escaped single quotes
                                        ?.replace(/\\"/g, '"')       // Replace escaped double quotes
                                        ?.replace(/\\t/g, ' ')       // Replace tabs with space (optional)
                                        ?.trim();                    // Remove leading and trailing whitespace


                                    let roomData = {
                                        AgencyToken: "",
                                        Rooms: [{
                                            Index: "",
                                            Price: rate?.dates?.date
                                                ? [{
                                                    FromDate: data?.checkIn ?? "",
                                                    ToDate: data?.checkOut ?? "",
                                                    // Amount:  parseFloat(rate.dates?.date?.price?.['$t']) || rate.total?.['$t'] || '',
                                                    // Amount: parseFloat( rate?.totalMinimumSelling?.['$t']),
                                                    Amount: rate.totalMinimumSelling ? parseFloat(rate?.totalMinimumSelling?.['$t']).toFixed(2) : parseFloat(rate?.total?.['$t']).toFixed(2),                                             
                                                    Currency: data.Price?.Currency ?? "",
                                                    Markup: '',
                                                }] : [],
                                            Id: rate?.id ?? '',
                                            specialsApplied: rate?.specialsApplied?.special?.['$t'] ?? '',
                                            passengerNamesRequiredForBooking: rate?.passengerNamesRequiredForBooking?.['$t'] ?? '',
                                            code: roomtype?.roomtypecode ?? '',
                                            name: roomtype?.name?.['$t'] ?? '',
                                            Description: roomtype?.name?.['$t'] ?? '',
                                            // Description: rate?.description ?? '',
                                            twin: roomtype.twin?.['$t'] ?? '',
                                            RoomType: rate?.description ?? '',
                                            MealType: rate?.dates?.date?.including?.includedMeal?.mealType?.['$t'] ?? '',
                                            status: rate?.status?.['$t'] ?? '',
                                            rateType: rate?.rateType ?? '',
                                            allowsExtraMeals: rate?.allowsExtraMeals?.['$t'] ?? '',
                                            allowsSpecialRequests: rate?.allowsSpecialRequests?.['$t'] ?? '',
                                            allowsBeddingPreference: rate?.allowsBeddingPreference?.['$t'] ?? '',
                                            allocationDetails: rate?.allocationDetails?.['$t'] ?? '',
                                            minStay: rate?.minStay?.['$t'] ?? '',
                                            dateApplyMinStay: rate?.dateApplyMinStay ?? '',
                                            NonRefundable: NonRefundableFlag,
                                            MealPlanCode: rate?.description ?? '',
                                            Inclusion: "",
                                            Occupacy: null,
                                            cancellationPolicies: cancellationPolicies ? cancellationPolicies : '',
                                            withinCancellationDeadline: rate?.withinCancellationDeadline?.['$t'] ?? '',
                                            tariffNotes: cleanedTariffNotes ?? '',
                                            isBookable: rate?.isBookable?.['$t'] ?? '',
                                            extrabeds: room?.extrabeds ?? '',
                                            lookedForText: room?.lookedForText?.['$t'] ?? '',
                                            paxCount: '',
                                            AdultCount: adults[0],
                                            ChildrenCount: children && children.length ? children[0] : 0,
                                            Rooms: index + 1,
                                        }],
                                        ResultIndex: "",
                                    };

                                    const token = this.redisServerService.geneateResultToken(body)
                                    const response = await this.redisServerService.insert_record(token, JSON.stringify(roomData))
                                    roomData.Rooms[0].Index = response.access_key;
                                    roomData.ResultIndex = body.ResultToken;
                                    roomGroup.push(roomData);
                                }))
                            }))
                            roomDetails.push(roomGroup);
                        }))

                    }
                    else {
                        const errorClass: any = getExceptionClassByCode(`400 ${response.result.request.error.details['$t']}`);
                        throw new errorClass(`400 ${response.result.request.error.details['$t']}`);
                    }
                }

                dataFormat["RoomDetails"] = roomDetails;
                dataFormat = {
                    ...dataFormat,
                    "ResultIndex": ''
                };
                return dataFormat;
            } else {
                const errorClass: any = getExceptionClassByCode(`400 ResultToken not found!!`);
                throw new errorClass(`400 ResultToken not found!!`);
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error);
            throw new errorClass(error);
        }
    }

    

    async hotelsValuation(body: any): Promise<any> {
        try {

            let roomListData = await this.redisServerService.read_list(body.ResultToken[0]);
            roomListData = JSON.parse(roomListData[0]);

             let searchRequest = roomListData.searchRequest


             let DOTW_USERNAME;
             let hashedPassword;
             let DOTW_COMPANYCODE;
 
             if (searchRequest.UserType == 'B2B') {
                 DOTW_USERNAME = DOTW_B2B_USERNAME;
                 hashedPassword = md5(DOTW_B2B_PASSWORD);
                 DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE;
             } else {
                 DOTW_USERNAME = DOTW_B2C_USERNAME;
                 hashedPassword = md5(DOTW_B2C_PASSWORD);
                 DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE;
             }

             let Roomxml = '';
             let roomArr = []
             let TotalRoomPrice = 0
             const roomXmlArr = new Array(body.BlockRoomId.length);
             
             const respDataArray = await Promise.all(
               body.BlockRoomId.map(async (RoomResultToken, index) => {
                 let roomDetailsData = await this.redisServerService.read_list(RoomResultToken);
                 roomDetailsData = JSON.parse(roomDetailsData);
                 
                 try {
                   const childrenXML = searchRequest.RoomGuests[index].ChildAge
                     .map((age: number, childIndex: number) => {
                       return `<child runno="${childIndex}">${age}</child>`;
                     })
                     .join('');
             
                   const roomCode = roomDetailsData.Rooms[0]?.code;
                   const RoomType = roomDetailsData.Rooms[0]?.RoomType;
                   const allocationDetail = roomDetailsData.Rooms[0]?.allocationDetails;
             
                   let selectedRateBasisResult = await this.manager.query(
                     `SELECT code FROM dotw_ratebasis_code_data WHERE ratebasis = "${RoomType}"`
                   );

                   let BlockRoommselectedRateBasis = selectedRateBasisResult[0]?.code || 0;
             
                   
                   roomXmlArr[index] = `
                     <room runno="${index}">
                       <adultsCode>${searchRequest.RoomGuests[index].NoOfAdults}</adultsCode>
                       <children no="${searchRequest.RoomGuests[index].NoOfChild}">
                         ${childrenXML}
                       </children>
                       <rateBasis>-1</rateBasis>
                       <passengerNationality>${roomListData.searchRequest.PassengerNationalityCode[0].country_code}</passengerNationality>
                       <passengerCountryOfResidence>${roomListData.searchRequest.PassengerNationalityCode[0].country_code}</passengerCountryOfResidence>
                       <roomTypeSelected>
                         <code>${roomCode}</code>
                         <selectedRateBasis>${BlockRoommselectedRateBasis}</selectedRateBasis>
                         <allocationDetails>${allocationDetail}</allocationDetails>
                       </roomTypeSelected>
                     </room>
                   `;
                 } catch (error) {
                   const errorClass: any = getExceptionClassByCode(error.message);
                   throw new errorClass(error.message);
                 }
               })
             );
             
            
             Roomxml = roomXmlArr.join('');
             
                const xmlReq = `<customer>  
                    <username>${DOTW_USERNAME}</username>
                    <password>${hashedPassword}</password>
                    <id>${DOTW_COMPANYCODE}</id>
                    <source>1</source>  
                    <product>hotel</product>  
                    <request command="getrooms">  
                        <bookingDetails>  
                            <fromDate>${searchRequest.CheckIn}</fromDate>  
                            <toDate>${searchRequest.CheckOut}</toDate>  
                            <currency>${searchRequest.Dotw_currency_code}</currency>  
                            <rooms no="${searchRequest.NoOfRooms}">
                               ${Roomxml}
                            </rooms>  
                            <productId>${roomListData.HotelCode}</productId>
                        </bookingDetails>   
                    </request>  
                </customer>`;

                  const response: any = await this.httpService.post(DOTW_URL, xmlReq, {
                            headers: {
                                'Content-Type': 'text/xml; charset=utf-8',
                            }
                        }).toPromise();
            
                        if (response) {
                            fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/BlockGetRoomREQ.xml`, xmlReq);
                            fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/BlockGetRoomRES.xml`, response);
                        } else {
                            console.warn('Response data is undefined');
                        }
                        const valuationResp: any = await this.xmlToJson(response);  
                        
                        if (valuationResp?.result?.successful?.['$t'] === 'TRUE') {
                            let roomData = valuationResp.result.hotel.rooms
    
                            if (!Array.isArray(roomData.room)) {
                                roomData.room = [roomData.room];
                            }
                            await Promise.all(roomData.room.map(async (room, index) => {

                                const adultRegex = /(\d+)\s+adult\/s/g;
                                const childRegex = /(\d+)\s+child/g;
    
                                const adults = [];
                                const children = [];
    
                                let match;
                                while ((match = adultRegex.exec(room.lookedForText['$t'])) !== null) {
                                    adults.push(match[1]);
                                }
                                while ((match = childRegex.exec(room.lookedForText['$t'])) !== null) {
                                    children.push(match[1]);
                                }
    
                                console.log("Adults: ", adults);
                                console.log("Children: ", children);
    
                                if (!Array.isArray(room.roomType)) {
                                    room.roomType = [room.roomType];
                                }
    
                              
                                await Promise.all(room.roomType.map(async (roomtype) => {
                                    if (!Array.isArray(roomtype.rateBases.rateBasis)) {
                                        roomtype.rateBases.rateBasis = [roomtype.rateBases.rateBasis];
                                    }
                                    await Promise.all(roomtype.rateBases.rateBasis.map(async (rate) => { 
                                 console.log(rate.status['$t'] , '================');
                                 

                                        if(rate.status['$t'] === 'checked'){
                                        let cancellationPolicies = "";

                                        let RoomPrice =rate.totalMinimumSelling ? parseFloat( rate?.totalMinimumSelling?.['$t']):  parseFloat( rate?.total?.['$t'])
                                        TotalRoomPrice += RoomPrice
                                        if (!Array.isArray(rate?.cancellationRules?.rule)) {
                                            rate.cancellationRules.rule = [rate.cancellationRules.rule];
                                        }
                                        let NonRefundableFlag 
                                        if (rate?.cancellationRules?.rule && Array.isArray(rate.cancellationRules.rule)) {
                                            if( rate?.cancellationRules.rule[0].cancelRestricted?.['$t']){
                                                NonRefundableFlag = true
                                            }
                                            else if(rate?.cancellationRules.rule[0].cancelCharge?.['$t'] == 0){
                                                NonRefundableFlag = false
                                            }
                                            else{
                                                NonRefundableFlag = true
                                            }
                                            cancellationPolicies = rate.cancellationRules.rule.map((policy, i) => {
                                                const fromDate = policy.fromDate?.['$t'];
                                                const toDate = policy.toDate?.['$t'];
                                                const charge = policy.charge?.formatted?.['$t'] || policy.charge?.['$t'] || '';
                                                const amendRestricted = policy.amendRestricted?.['$t'] === 'true' ?`Amendments restricted ${policy.amendRestricted['$t']}` : '';
                                                const cancelRestricted = policy.cancelRestricted?.['$t'] === 'true' ? `Cancellations restricted ${policy.cancelRestricted['$t']}`  : '';
                                                const noShowPolicy = policy.noShowPolicy?.['$t'] === 'true' ? `noShowPolicy ${policy.noShowPolicy['$t']}` : '';

                                                let policyText = `Policy ${i + 1}: ${fromDate ? `From ${fromDate}` : ''} ${toDate ? `to ${toDate}` : ''}`;
  
 
                                            if (charge || (!amendRestricted && !cancelRestricted)) {
                                               policyText += `, charge is ${charge}`;
                                             }

                                             const conditions = [amendRestricted, cancelRestricted, noShowPolicy].filter(Boolean).join(' ');
                                             policyText += conditions ? ` ${conditions}` : '';
                                           
                                             return policyText.trim();

        
                                              
                               
                                                
                                                // return `Policy ${i + 1}: From ${policy.fromDate?.['$t']}, charge is ${policy.charge?.formatted?.['$t'] || policy.charge?.['$t'] || ''}`;
                                            }).join('; ');
                                        } 
                                        // else if (rate?.cancellationRules?.rule) {
                                        //     const policy = rate.cancellationRules.rule;
                                        //     cancellationPolicies = `From ${policy.fromDate?.['$t']}, charge is ${policy.charge?.formatted?.['$t'] || policy.charge?.['$t'] || ''}`;
                                        // }
                                        const cleanedTariffNotes = rate?.tariffNotes?.['$t']
                                            ?.replace(/\\n/g, ' ')       // Replace escaped newline characters
                                            ?.replace(/\n/g, ' ')        // Replace actual newline characters
                                            ?.replace(/\\r/g, '')        // Remove escaped carriage returns
                                            ?.replace(/\r/g, '')         // Remove actual carriage returns
                                            ?.replace(/&amp;/g, '&')     // Decode HTML entity for "&"
                                            ?.replace(/\\'/g, "'")       // Replace escaped single quotes
                                            ?.replace(/\\"/g, '"')       // Replace escaped double quotes
                                            ?.replace(/\\t/g, ' ')       // Replace tabs with space (optional)
                                            ?.trim();                    // Remove leading and trailing whitespace

                                            let roomDetails = {
                                               Index: "",
                                                Price: rate?.dates?.date
                                                    ? [{
                                                        FromDate: searchRequest?.CheckIn ?? "",
                                                        ToDate: searchRequest?.CheckOut ?? "",       
                                                        Amount: rate.totalMinimumSelling ? parseFloat(parseFloat(rate?.totalMinimumSelling?.['$t']).toFixed(2)) : parseFloat(parseFloat(rate?.total?.['$t']).toFixed(2)), 
                                                        Currency: roomListData?.Price.Currency ?? "",
                                                        Markup: '',
                                                    }] : [],
                                                Id: rate?.id ?? '',
                                                specialsApplied: rate?.specialsApplied?.special?.['$t'] ?? '',
                                                passengerNamesRequiredForBooking: rate?.passengerNamesRequiredForBooking?.['$t'] ?? '',
                                                roomCode : roomtype?.roomtypecode ?? '',
                                                name: roomtype?.name?.['$t'] ?? '',
                                                Description: roomtype?.name?.['$t'] ?? '',                                                // Description: rate?.description ?? '',
                                                twin: roomtype.twin?.['$t'] ?? '',
                                                RoomType: rate?.description ?? '',
                                                MealType: rate?.dates?.date?.including?.includedMeal?.mealType?.['$t'] ?? '',
                                                status: rate?.status?.['$t'] ?? '',
                                                rateType: rate?.rateType ?? '',
                                                allowsExtraMeals: rate?.allowsExtraMeals?.['$t'] ?? '',
                                                allowsSpecialRequests: rate?.allowsSpecialRequests?.['$t'] ?? '',
                                                allowsBeddingPreference: rate?.allowsBeddingPreference?.['$t'] ?? '',
                                                allocationDetails: rate?.allocationDetails?.['$t'] ?? '',
                                                minStay: rate?.minStay?.['$t'] ?? '',
                                                dateApplyMinStay: rate?.dateApplyMinStay ?? '',
                                                NonRefundable: NonRefundableFlag,
                                                MealPlanCode: rate?.description ?? '',
                                                Inclusion: "",
                                                Occupacy: null,
                                                cancellationPolicies: cancellationPolicies ? cancellationPolicies : '',
                                                withinCancellationDeadline: rate?.withinCancellationDeadline?.['$t'] ?? '',
                                                tariffNotes: cleanedTariffNotes ?? '',
                                                isBookable: rate?.isBookable?.['$t'] ?? '',
                                                extrabeds: room?.extrabeds ?? '',
                                                lookedForText: room?.lookedForText?.['$t'] ?? '',
                                                paxCount: '',
                                                AdultCount:  Number(adults[0]),
                                                ChildrenCount: children && children.length ? Number(children[0]) : 0,
                                                Rooms: index + 1,
                                            }
                                            roomArr.push(roomDetails)
 
                                        }
                                    }))
                                    
                                }))
                        //    console.log(TotalRoomPrice , 'TotalRoomPriceTotalRoomPriceTotalRoomPrice');
                            }))           
                        }
                        else {    
                            const errorClass: any = getExceptionClassByCode(`400 ${valuationResp.result.request.error.details['$t']}`);
                            throw new errorClass(`400 ${valuationResp.result.request.error.details['$t']}`);
                        }
                      

                let dataFormat = {
                    ResultIndex: "",
                    HotelCode: roomListData?.HotelCode ?? "",
                    HotelName: roomListData?.HotelName ?? "",
                    HotelCategory: roomListData?.HotelCategory ?? "",
                    StarRating: roomListData?.StarRating ?? "",
                    HotelDescription: roomListData.HotelDescription ? roomListData.HotelDescription.replace(/\^/g, "'") : "",
                    HotelPromotion: roomListData?.HotelPromotion ?? "",
                    HotelPolicy: roomListData?.HotelPolicy ?? "",
                    Price: roomListData?.Price ?? "",
                    AveragePerNight: roomListData?.AveragePerNight ?? " ",
                    HotelPicture: roomListData?.HotelPicture ?? "",
                    HotelDescription1: roomListData?.HotelDescription1 ?? '',
                    HotelAddress: roomListData?.HotelAddress ?? "",
                    HotelContactNo: roomListData?.HotelContactNo ?? "",
                    HotelMap: roomListData?.HotelMap ?? "",
                    Latitude: roomListData?.Latitude ?? "",
                    Longitude: roomListData?.Longitude ?? "",
                    Breakfast: roomListData?.Breakfast ?? "",
                    LeisureItem: roomListData?.LeisureItem ?? [],
                    BusinessItem: roomListData?.BusinessItem ?? [],
                    HotelLocation: roomListData?.HotelLocation ?? null,
                    HotelCheckIn: roomListData?.HotelCheckIn ?? '',
                    HotelCheckOut: roomListData?.HotelCheckOut ?? '',
                    SupplierPrice: roomListData?.SupplierPrice ?? null,
                    HotelMinAge: roomListData?.HotelMinAge ?? '',
                    CityCode: roomListData?.CityCode ?? '',
                    RoomDetails: roomArr,
                    OrginalHotelCode: roomListData?.OrginalHotelCode ?? "",
                    HotelPromotionContent: roomListData?.HotelPromotionContent ?? "",
                    PhoneNumber: roomListData?.PhoneNumber ?? "",
                    HotelAmenities: "",
                    Free_cancel_date: roomListData?.Free_cancel_date ?? "",
                    trip_adv_url: roomListData?.trip_adv_url ?? "",
                    trip_rating: roomListData?.trip_rating ?? "",
                    NoOfRoomsAvailableAtThisPrice: roomListData?.NoOfRoomsAvailableAtThisPrice ?? "",
                    Refundable: roomListData?.Refundable ?? "",
                    HotelCurrencyCode: roomListData.Price?.Currency ?? "",
                    NoOfReviews: roomListData?.NoOfReviews ?? "",
                    ReviewScore: roomListData?.ReviewScore ?? "",
                    ReviewScoreWord: roomListData?.ReviewScoreWord ?? "",
                    CheckIn: roomListData?.checkIn ?? "",
                    CheckOut: roomListData?.checkOut ?? "",
                    Source: roomListData?.Source ?? "",
                    PassengerNationalityCode: roomListData?.PassengerNationalityCode ?? [],
                    Dotw_currency_code: roomListData?.Dotw_currency_code ?? '',
                    searchRequest: roomListData?.searchRequest ?? {},
                    NoOfRooms: roomListData.searchRequest?.NoOfRooms ?? '',
                    RoomGuests: roomListData?.searchRequest.RoomGuests ?? [],
                    booking_source: body.booking_source,     
                    responseToken: roomListData.responseToken,
                    ResultToken: roomListData.ResultToken
                };

                dataFormat.Price.Amount = parseFloat(TotalRoomPrice.toFixed(2))
                
                const token = this.redisServerService.geneateResultToken(body);
                const dataFormatResponse = await this.redisServerService.insert_record(token, JSON.stringify(dataFormat));
                delete dataFormat["BlockRoomId"];
                delete dataFormat["ResultToken"];
                dataFormat = {
                    ...dataFormat,
                    "ResultToken": dataFormatResponse["access_key"]
                };
                return dataFormat;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
    async formatReservationRequest(booking: any, pax: any, room: any, body: any) {
        try {
            let DOTW_USERNAME;
            let hashedPassword;
            let DOTW_COMPANYCODE;

            if (booking[0].booking_source == 'B2B') {
                DOTW_USERNAME = DOTW_B2B_USERNAME;
                hashedPassword = md5(DOTW_B2B_PASSWORD);
                DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE;
            } else {
                DOTW_USERNAME = DOTW_B2C_USERNAME;
                hashedPassword = md5(DOTW_B2C_PASSWORD);
                DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE;
            }


            let selectedRateBasis
            let allocationDetails
            let roomCode
            booking = booking[0];
            let jsonString = booking?.attributes?.replace(/'/g, '"');
            let RoomData = JSON.parse(jsonString);
            let bodyData = RoomData.searchRequest;

            const roomGuestsXML = await Promise.all(
                bodyData.RoomGuests.map(async (room: any, index: number) => {
                    const childrenXML = room.NoOfChild > 0 && Array.isArray(room.ChildAge)
                        ? room.ChildAge.map((age: number, childIndex: number) => {
                            return `<child runno="${childIndex}">${age}</child>`;
                        }).join('')
                        : '';

                    const actualChildrenXML = room.NoOfChild > 0 && Array.isArray(room.ChildAge)
                        ? room.ChildAge.map((age: number, childIndex: number) => {
                            return `<actualChild runno="${childIndex}">${age}</actualChild>`;
                        }).join('')
                        : '';

                    const passengersForRoom = pax.filter((passenger: any) => {
                        return passenger.address2 === `${index + 1}`;
                    });

                    const passengersXML = await Promise.all(
                        passengersForRoom.map(async (passenger: any, passIndex: number) => {
                            if (passenger.title == 'Mstr' || passenger.title == 'Miss') {
                                passenger.title = 'Child'
                            }
                            let salutationCodeResult = await this.manager.query(`SELECT code FROM dotw_salutations_data WHERE title = "${passenger.title}"`);
                            let salutationCode = salutationCodeResult[0]?.code || 'MR';

                            return `
                                <passenger leading="${passIndex === 0 ? 'yes' : 'no'}">
                                    <salutation>${salutationCode}</salutation> 
                                    <firstName>${passenger.first_name}</firstName>
                                    <lastName>${passenger.last_name}</lastName>
                                </passenger>
                            `;
                        })
                    );

                    let selectedRateBasisResult = await this.manager.query(`SELECT code FROM dotw_ratebasis_code_data WHERE ratebasis = "${RoomData.RoomDetails[index]?.RoomType}"`);
                    selectedRateBasis = selectedRateBasisResult[0]?.code || 0;

                    roomCode = RoomData.RoomDetails[index]?.roomCode ?? '';
                    allocationDetails = RoomData.RoomDetails[index]?.allocationDetails ?? '';

                    return `
                        <room runno="${index}">
                            <roomTypeCode>${roomCode}</roomTypeCode>
                            <selectedRateBasis>${selectedRateBasis}</selectedRateBasis>
                            <allocationDetails>${allocationDetails}</allocationDetails>  
                            <adultsCode>${room.NoOfAdults}</adultsCode>
                            <actualAdults>${room.NoOfAdults}</actualAdults>
                            <children no="${room.NoOfChild}">
                                ${childrenXML}
                            </children>
                            <actualChildren no="${room.NoOfChild}">
                                ${actualChildrenXML}
                            </actualChildren>
                            <extraBed>0</extraBed>  
                            <passengerNationality>${bodyData.PassengerNationalityCode[0].country_code}</passengerNationality>
                            <passengerCountryOfResidence>${bodyData.PassengerNationalityCode[0].country_code}</passengerCountryOfResidence>
                            <passengersDetails>
                                ${passengersXML.join('')}
                            </passengersDetails>
                            <beddingPreference>0</beddingPreference>  
                        </room>
                    `;
                })
            );


                const confirmReq = `
            <customer>      
                <username>${DOTW_USERNAME}</username>  
                <password>${hashedPassword}</password>  
                <id>${DOTW_COMPANYCODE}</id>  
                <source>1</source>      
                <product>hotel</product>  
                <request command="confirmbooking">  
                    <bookingDetails>   
                        <fromDate>${bodyData.CheckIn}</fromDate>  
                        <toDate>${bodyData.CheckOut}</toDate>  
                        <currency>${bodyData.Dotw_currency_code}</currency>  
                        <productId>${booking.hotel_code}</productId>  
                        <customerReference></customerReference>  
                        <rooms no="${bodyData.NoOfRooms}">
                            ${roomGuestsXML.join('')}
                        </rooms>  
                    </bookingDetails>  
                </request>  
            </customer>
            `;

                const ConfrimBooking: any = await this.httpService.post(DOTW_URL, confirmReq, {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                    }
                }).toPromise();

                if (ConfrimBooking) {
                    fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/ConfirmBookingRQ.xml`, confirmReq);
                    fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/ConfirmBooingRS.xml`, ConfrimBooking);
                } else {
                    console.warn('Response data is undefined');
                }

                const confirmBookingResp: any = await this.xmlToJson(ConfrimBooking);

                if (confirmBookingResp?.result?.successful?.['$t'] === 'TRUE') {
                    let bookingCodeArr = [];
                    let bookingReferenceNumberArr = [];

                    if (!Array.isArray(confirmBookingResp.result.bookings.booking)) {
                        confirmBookingResp.result.bookings.booking = [confirmBookingResp.result.bookings.booking];
                    }

                    for (const [index, booking] of confirmBookingResp.result.bookings.booking.entries()) {
                        const BookingDetailsREQ = `
                    <customer>  
                        <username>${DOTW_USERNAME}</username>
                        <password>${hashedPassword}</password>
                        <id>${DOTW_COMPANYCODE}</id> 
                        <source>1</source>  
                        <request command="getbookingdetails">  
                            <bookingDetails>  
                                <bookingType>Confirmed</bookingType>  
                                <bookingCode>${booking.bookingCode['$t']}</bookingCode>  
                            </bookingDetails>  
                        </request>  
                    </customer>  
                    `;

                        try {
                            const BookingDetailsResult: any = await this.httpService.post(DOTW_URL, BookingDetailsREQ, {
                                headers: {
                                    'Content-Type': 'text/xml; charset=utf-8',
                                }
                            }).toPromise();

                            if (BookingDetailsResult) {
                                fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/BookingDetailRQ_${index}.xml`, BookingDetailsREQ);
                                fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/BookingDetailRS_${index}.xml`, BookingDetailsResult);
                            } else {
                                console.warn('Response data is undefined');
                            }
                            bookingReferenceNumberArr.push(booking.bookingReferenceNumber['$t']);
                            bookingCodeArr.push(booking.bookingCode['$t']);
                        } catch (error) {
                            console.error('Error fetching booking details:', error);
                        }
                    }

                    let bookingDetails = {
                        bookingCode: bookingCodeArr,
                        bookingReferenceNumber: bookingReferenceNumberArr
                    };
                    return this.HotelDotwTransformService.updateData(bookingDetails, body, booking, pax, room);
                } else {
                    const errorClass: any = getExceptionClassByCode(`400 ${confirmBookingResp.result.request.error.details['$t']}`);
                    throw new errorClass(`400 ${confirmBookingResp.result.request.error.details['$t']}`);
                
            }
          
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(`400 ${error}`);
            throw new errorClass(`400 ${error}`);
        }
    }




    async hotelsReservation(body: any): Promise<any> {
        let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
        let paxDetails = await this.hotelDbService.getHotelBookingPaxDetails(body);
        let roomDetails = await this.hotelDbService.getHotelBookingItineraryDetails(body);
        let formattedRequest = this.formatReservationRequest(bookingDetails, paxDetails, roomDetails, body,);

        return formattedRequest;
    }

    async hotelsCancellation(body: any): Promise<any> {
        try {
            let getCityData = await this.manager.query(`
            SELECT confirmation_reference, booking_source, booking_id  
            FROM hotel_hotel_booking_details  
            WHERE app_reference = "${body.AppReference}"
        `);
            getCityData = getCityData[0];

            let DOTW_USERNAME, hashedPassword, DOTW_COMPANYCODE;

            if (getCityData.booking_source === 'B2B') {
                DOTW_USERNAME = DOTW_B2B_USERNAME;
                hashedPassword = md5(DOTW_B2B_PASSWORD);
                DOTW_COMPANYCODE = DOTW_B2B_COMPANYCODE;
            } else {
                DOTW_USERNAME = DOTW_B2C_USERNAME;
                hashedPassword = md5(DOTW_B2C_PASSWORD);
                DOTW_COMPANYCODE = DOTW_B2C_COMPANYCODE;
            }

            getCityData.booking_id = JSON.parse(getCityData.booking_id);

            for (const [index, booking_id] of getCityData.booking_id.entries()) {
                const CancelBookingREQ = `
                <customer>  
                    <username>${DOTW_USERNAME}</username>  
                    <password>${hashedPassword}</password>  
                    <id>${DOTW_COMPANYCODE}</id>  
                    <source>1</source>      
                    <request command="cancelbooking">  
                        <bookingDetails>  
                            <bookingType>1</bookingType>  
                            <bookingCode>${booking_id}</bookingCode>  
                            <confirm>no</confirm>  
                        </bookingDetails>  
                    </request>  
                </customer>
            `;

                const initialCancelBookingResult: any = await this.httpService.post(DOTW_URL, CancelBookingREQ, {
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                    }
                }).toPromise();

                if (initialCancelBookingResult) {
                    fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/CancellationRQ_${index}.xml`, CancelBookingREQ);
                    fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/CancellationRS_${index}.xml`, initialCancelBookingResult);
                } else {
                    console.warn('Response data is undefined');
                    continue;
                }

                const initialCancelBookingResp: any = await this.xmlToJson(initialCancelBookingResult);

                if (initialCancelBookingResp?.result?.successful?.['$t'] === 'TRUE') {
                    const penaltyApplied = initialCancelBookingResp?.result?.services?.service?.cancellationPenalty?.charge?.['$t'] ?? 0;
                    const finalCancelBookingREQ = `
                    <customer>  
                        <username>${DOTW_USERNAME}</username>  
                        <password>${hashedPassword}</password>  
                        <id>${DOTW_COMPANYCODE}</id>  
                        <source>1</source>      
                        <request command="cancelbooking">  
                            <bookingDetails>  
                                <bookingType>1</bookingType>  
                                <bookingCode>${booking_id}</bookingCode>  
                                <confirm>yes</confirm>  
                                <testPricesAndAllocation>  
                                    <service referencenumber="${booking_id}">  
                                        <penaltyApplied>${penaltyApplied}</penaltyApplied>  
                                    </service>  
                                </testPricesAndAllocation>  
                            </bookingDetails>  
                        </request>  
                    </customer>
                `;

                    const finalCancelBookingResult: any = await this.httpService.post(DOTW_URL, finalCancelBookingREQ, {
                        headers: {
                            'Content-Type': 'text/xml; charset=utf-8',
                        }
                    }).toPromise();

                    if (finalCancelBookingResult) {
                        fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/FinalCancellationRQ_${index}.xml`, finalCancelBookingREQ);
                        fs.writeFileSync(`${logStoragePath}/hotels/DotwHotels/FinalCancellationRS_${index}.xml`, finalCancelBookingResult);
                    } else {
                        console.warn('Response data is undefined');
                        continue;
                    }

                    const finalCancelBookingResp: any = await this.xmlToJson(finalCancelBookingResult);

                    if (finalCancelBookingResp?.result?.successful?.['$t'] === 'TRUE') {
                        let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
                        let response = await this.hotelDbService.updateHotelCancelDetails(bookingDetails[0], body);
                        return response; // Return the response once a successful cancellation is made
                    } else {
                        const errorClass: any = getExceptionClassByCode(`400 ${finalCancelBookingResp.Message}`);
                        throw new errorClass(`400 ${finalCancelBookingResp.Message}`);
                    }

                } else {
                    console.log(initialCancelBookingResp.result.request.error.details['$t'], '=========');
                    const errorClass: any = getExceptionClassByCode(`400, ${initialCancelBookingResp.result.request.error.details['$t']}`);
                    throw new errorClass(`400 ${initialCancelBookingResp.result.request.error.details['$t']}`);
                }
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


}