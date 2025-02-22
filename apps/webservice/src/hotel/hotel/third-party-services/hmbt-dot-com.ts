
import { Url, TMX_HOTEL_BOOKING_SOURCE, TMX_USER_NAME, TMX_PASSWORD, TMX_DOMAINKEY, TMX_SYSTEM, TBOH_USERNAME, TBOH_PASSWORD, HMBT_URL, HMBT_CLIENT_SECRET, HMBT_CLIENT_ID, HMBT_USER_EMAIL } from "apps/webservice/src/constants";



import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { HOTELBEDS_URL, HUMMING_BIRD_BOOKING_SOURCE, logStoragePath, BASE_CURRENCY, HMBT_CURRENCY } from "../../../constants";
import { goGlobalRequestTypes } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { HotelBedsTransformService } from "./hotelbeds-transform.service";
import { HotelTboTransformService } from './tboHolidays-transform.Service';
import * as moment from "moment";

import axios from 'axios';
import { HmbtTransformService } from "./hmbt--transform.service";
import { throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";
const crypto = require('crypto');
const fs = require('fs')

@Injectable()
export class HummingBirdDotComService extends HotelApi {

    apiCred: any;
    apiCredCached: boolean = false;

    constructor(
        private readonly httpService: HttpService,
        private hotelDbService: HotelDbService,
        private HmbtTransformService: HmbtTransformService,
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



    private async getToken(): Promise<any> {
        try {
            const response = await this.httpService.post(
                `${HMBT_URL}/oauth/token`,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    scope: '*',
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    auth: {
                        username: HMBT_CLIENT_ID,
                        password: HMBT_CLIENT_SECRET,
                    },
                },
            ).pipe(
                map((response: any) => {

                    return response.access_token; // Adjust based on the actual structure
                }),
                catchError(error => {
                    console.error('Error obtaining token:', error);
                    return throwError(() => new Error('Failed to obtain access token'));
                })
            ).toPromise();

            return response;
        } catch (error) {
            console.error('Error obtaining token:', error);
            throw new Error('Failed to obtain access token');
        }
    }

    formatDate = (date) => {
        const [year, month, day] = date.split("-");
        return `${day}-${month}-${year}`;
      };
      


    async Create(body: any): Promise<any> {
        try {

            const accessToken = await this.getToken();
            const givenUrl = `${HMBT_URL}/v1/properties/list/regions`;
            const result: any = await this.httpService.get(givenUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            }).toPromise();

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/listRegionRS.json`, JSON.stringify(result));
            }


            const destination_url = `${HMBT_URL}/v1/properties/list/destinations`;
            const destination_data: any = await this.httpService.get(destination_url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            }).toPromise();

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/destinationRS.json`, JSON.stringify(destination_data));
            }


            if (destination_data && destination_data.length) {
                await Promise.all(destination_data.map(async (destination) => {

                    let obj = {
                        destination_code: destination.code,
                        destination_name: destination.name
                    }

                    let hotelData = await this.manager.query(`select * from humming_bird_destination where  destination_code = "${destination.code}"`);
                    if (hotelData && !hotelData.length) {
                        await this.manager.query(`INSERT INTO humming_bird_destination SET ?`, [obj]);
                    }


                    let url = `${HMBT_URL}/v1/properties/${destination.code}`
                    const response = await this.httpService.get(url, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        }
                    }).toPromise();

                    if (this.isLogXml) {
                        const fs = require('fs');
                        fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/listRegionDataRQ.json`, JSON.stringify(url));
                        fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/listRegionDataRS.json`, JSON.stringify(response));
                    }

                    let result = response['destination']["properties"] ?? []
                    let getResult: any;
                    for (const hotelDetail of result) {
                        const data = {
                            hotelId: hotelDetail?.id ?? "",
                            hotel_code: hotelDetail?.code ?? '',
                            hotel_name: hotelDetail?.name ?? "",
                            type: hotelDetail?.type ?? "",
                            logo_image: hotelDetail?.logo ?? '',
                            rating: hotelDetail?.rating ?? "",
                            rating_label: hotelDetail?.rating_label ?? "",
                            featuredImage: hotelDetail?.featuredImage ?? "",
                            locationText: hotelDetail.locationText ?? "",
                            description: hotelDetail?.description ?? "",
                            destination_code: destination?.code ?? "",
                            destination_name: destination?.name ?? "",
                            lastUpdated: moment(hotelDetail.lastUpdated).format('YYYY-MM-DD HH:mm:ss')
                        }

                        let hotelData = await this.manager.query(`select * from humming_bird_hotel_details where  hotel_code = "${hotelDetail.code}"`);
                        if (hotelData && !hotelData.length) {
                            await this.manager.query(`INSERT INTO humming_bird_hotel_details SET ?`, [data]);
                        }
                    }
                }))

            }

        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    async searchRequest(body: any): Promise<any> {

        // let hotelcode = await this.manager.query(`select hotel_code from humming_bird_hotel_details where destination_code = "${body.CityIds[0]}"`)
        // let hotelcodes: any = [];
        // var hotelcode= await this.hotelDbService.getHotelIdsByGiataId(body['CityIds'][0],HUMMING_BIRD_BOOKING_SOURCE);
        let hotelcode = await this.manager.query(`SELECT hotel_code FROM humming_bird_hotel_details where destination_code = "${body.CityIds[0]}"`)

        let hotelcodes = hotelcode.map(row => row.hotel_code);

        // let hotelcodes= JSON.parse(JSON.stringify(hotelcode));
        // for (let index = 0; index < hotelcode.length; index++) {
        //     hotelcodes.push(hotelcode[index].hotel_code);
        // }
        // let HotelCodes = hotelcodes.join(',');

        // console.log("Hotelcode-",HotelCodes);
        let PaxRooms: any = [];
        body.RoomGuests.forEach((guest) => {
            PaxRooms.push({ adults: guest.NoOfAdults, children: guest.NoOfChild, childAges: guest.ChildAge })
        })

        body.CheckIn = new Date(body.CheckIn).toISOString().split('T')[0];
        body.CheckOut = new Date(body.CheckOut).toISOString().split('T')[0];
        let requestRef = '';
        for (let i = 0; i < 22; i++) {
            requestRef += Math.floor(Math.random() * 10);
        }

        let searchRequest = {
            source: {
                userEmail: HMBT_USER_EMAIL,
                requestRef: requestRef
            },
            requestCriteria: {
                region: "CBD",
                destination: {
                    destinationCode: body.CityIds[0],
                    locationCode: "ANY"
                },
                hotelCodes: hotelcodes,
                stayPeriod: {
                    checkInDate: body.CheckIn,
                    checkOutDate: body.CheckOut
                },
                nationalityCode: "GB",
                roomRequests: PaxRooms,
                mealTypeCode: "HB",
                vacationTypeCode: "STD",
                preferences: {
                    availability: "free_sell"
                }
            }
        }


        return searchRequest;
    }

    async formatRooms(roomData, body, USD_to_GBP, Conversion_Rate) {
        const roomDetails = [];

        for (const [index, group] of roomData.entries()) {
            const adult = body.RoomGuests[index]?.NoOfAdults || '';
            const childCount = body.RoomGuests[index]?.NoOfChild || '';
            const [text, number] = group.id?.split('-') || ["", ""];

            const roomByDeals = await Promise.all(group.rooms.map(async (rate) => {
                const rateDeals = await Promise.all(rate.deals.map(async (deal) => {

                    // let Conversion_Rate = 1;
                    // let currencyDetails;
                    // if (deal.price.currency && deal.price.currency !== BASE_CURRENCY) {
                    //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(deal.price.currency);
                    //     Conversion_Rate = currencyDetails['value'] ?? 1;
                    // }   
                    let roomPrice = parseFloat(deal.price?.nett ?? 0) / USD_to_GBP;
                    // if (body.Currency != BASE_CURRENCY) {
                    //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
                    //     Conversion_Rate = currencyDetails['value'] ?? 1;
                    // }
                    roomPrice = roomPrice * Conversion_Rate;

                    let OrginalCancellationpolicy = '';
                    if (deal?.cancellationPolicies) {
                        OrginalCancellationpolicy = deal.cancellationPolicies.flatMap(policy => policy.description).join(', ');
                    }



                    let cancellationText = '';

                    if (deal?.cancellationPolicies) {
                        cancellationText = deal.cancellationPolicies.flatMap(policy => {
                          
                            let updatedDescriptions = policy.description.map(desc => {
                                return desc.replace(/\b([A-Za-z]{3}) (\d{1,2}), (\d{4})\b/g, (match, month, day, year) => {
                                    const cancellationDate = new Date(`${month} ${day}, ${year}`);
                                    cancellationDate.setDate(cancellationDate.getDate() - 3); 
                                    const adjustedDate = cancellationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                                    return adjustedDate;  
                                });
                            });
                
                            return updatedDescriptions.join(', ');
                        }).join(', ');
                    }
                    


                    let NonRefundable = true
                    if (deal?.cancellationPolicies) {
                        deal.cancellationPolicies.map((flag) => {
                            NonRefundable = flag.active
                        })
                    }

                    return {
                        roomCode: rate?.code ?? "",
                        name: rate?.name ?? "",
                        rateId: deal?.id ?? "",
                        rateKey: deal?.key ?? "",
                        rateClass: "",
                        rateType: "",
                        net: parseFloat(roomPrice.toFixed(2)),
                        allotment: "",
                        paymentType: "",
                        packaging: false,
                        boardCode: '',
                        RoomType: deal.info?.accommodation?.mealPlan?.baseMealPlan?.name ?? '',
                        NonRefundable: NonRefundable,
                        boardName: '',
                        cancellationPolicies: cancellationText ? cancellationText : '',
                        OrginalCancellationpolicy:  OrginalCancellationpolicy ? OrginalCancellationpolicy : '' ,
                        rooms: number,
                        adults: adult,
                        children: childCount,
                        offers: deal?.offers ?? null,
                        info: deal?.info ?? {},
                        availability: deal?.availability ?? "",
                        others: deal?.others ?? [],
                        transfer: deal?.transfer ?? {}
                    };
                }));

                return {
                    code: rate?.code ?? "",
                    name: rate?.name ?? "",
                    rate: rateDeals
                };
            }));

            roomDetails.push(roomByDeals);
        }

        return roomDetails
    }



    async search(body: any): Promise<any> {
        try {
            const accessToken = await this.getToken();
            const givenUrl = `${HMBT_URL}/v1/price/search`;
            const searchRequest: any = await this.searchRequest(body);
            const result: any = await this.httpService.post(givenUrl, searchRequest, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            }).toPromise();
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchRQ.json`, JSON.stringify(searchRequest));
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchRS.json`, JSON.stringify(result));
            }
            const listing_url = result.link
            const searchListing: any = await this.httpService.get(listing_url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            }).toPromise();
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchListingRQ.json`, JSON.stringify(listing_url));
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchListingRS.json`, JSON.stringify(searchListing));
            }
            let markup: any;
            // if (body['UserType'] && body['UserId']) {
            //     markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
            //     // markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
            // }

            if (body['UserType']) {
                if (body['UserId'] == undefined) {
                    body['UserId'] = 0;
                }
                // markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
                markup = await this.hotelDbService.getMarkup(body);
            }

            body.CheckIn =    this.formatDate(body.CheckIn)
             body.CheckOut =  this.formatDate(body.CheckOut)

            if (searchListing.result && searchListing.result.length) {
                const hotelResults = searchListing.result;
                let dataFormat: any[] = []
                let currencyDetails;
                let USD_to_GBP = 1
                let Conversion_Rate = 1

                const hotelCodes = Array.from(new Set(hotelResults.map((hotel) => hotel.hotelCode)));
                const hotelDataArray = await this.manager.query(`SELECT * FROM humming_bird_hotel_details WHERE hotel_code IN (${hotelCodes.map(code => `"${code}"`).join(',')})`);
                const hotelDataMap = new Map(hotelDataArray.map(hotel => [hotel.hotel_code, hotel]));
  
                if (searchListing.result[0].groups[0].rooms[0].deals[0].price.currency != BASE_CURRENCY) {
                    currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(searchListing.result[0].groups[0].rooms[0].deals[0].price.currency);
                    USD_to_GBP = currencyDetails['value'] ?? 1;
                }

                if (body?.Currency && body.Currency != BASE_CURRENCY) {
                    currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
                    Conversion_Rate = currencyDetails['value'] ?? 1;
                }

                const fetchData = async (hotelResults: any) => {
                    try {
                        let hotelData: any = hotelDataMap.get(hotelResults.hotelCode);
                        let minPrice = Infinity;
                        let Currecncy
                        hotelResults.groups.map((group) => {
                            group.rooms.map(async (room) => {

                                if (room.deals[0].price.nett < minPrice)
                                    minPrice = room.deals[0].price.nett
                                Currecncy = room.deals[0].price.currency
                                // if (!isNaN(room.RecommendedSellingRate) && room.RecommendedSellingRate < recommendedSellingRate) {
                                //     recommendedSellingRate = room.RecommendedSellingRate;
                                // }
                            })
                        })
                        if (minPrice == Infinity)
                            minPrice = null;

                        // if (HMBT_CURRENCY != BASE_CURRENCY) {
                        //     if (searchListing.result[0].groups[0].rooms[0].deals[0].price.currency != BASE_CURRENCY) {
                        //     // currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
                        //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(searchListing.result[0].groups[0].rooms[0].deals[0].price.currency);
                        //     Conversion_Rate = currencyDetails['value'] ?? 1;
                        //  }

                        let Amount = (minPrice ?? 0) / USD_to_GBP;
                        Amount = isNaN(Amount) ? 0 : parseFloat(Amount.toFixed(2));

                        // if (body?.Currency && body.Currency != BASE_CURRENCY) {
                        //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
                        //     Conversion_Rate = currencyDetails['value'] ?? 1;
                        // }
                        Amount = (Amount ?? 0) * Conversion_Rate;
                        Amount = isNaN(Amount) ? 0 : parseFloat(Amount.toFixed(2));
                        // const [rating, label] = hotelData?.ratingLabel.split(', ').map(item => item.trim()) ?? "";
                        const data = {
                            HotelCode: hotelResults?.hotelCode ?? '',
                            HotelName: hotelData?.hotel_name ?? '',
                            HotelCategory: result.HotelCategory ? result.HotelCategory : "",
                            StarRating: hotelData?.rating ?? "",
                            HotelDescription: hotelData?.description ?? "",
                            HotelPromotion: result.HotelPromotion ? result.HotelPromotion : "",
                            HotelPolicy: result.HotelPolicy ? result.HotelPolicy : [],
                            Price: { Amount: Amount, Currency: body.Currency, Commission: '', Markup: {} },
                            // AveragePerNight: (minPrice / body.NoOfNights) * Conversion_Rate,
                            HotelPicture: hotelData?.featuredImage ?? "",
                            HotelAddress: hotelData?.locationText ?? "",
                            HotelContactNo: "",
                            HotelAmenities: [],
                            HotelMap: "",
                            Latitude: "",
                            Longitude: "",
                            Breakfast: "",
                            HotelLocation: "",
                            SupplierPrice: "",
                            OrginalHotelCode: "",
                            HotelPromotionContent: "",
                            PhoneNumber: "",
                            Free_cancel_date: "",
                            trip_adv_url: "",
                            trip_rating: "",
                            NoOfRoomsAvailableAtThisPrice: "",
                            Refundable: "",
                            HotelCurrencyCode: Currecncy,
                            NoOfReviews: "",
                            ReviewScore: "",
                            ReviewScoreWord: "",
                            checkIn: body.CheckIn ? body.CheckIn : "",
                            checkOut: body.CheckOut ? body.CheckOut : "",
                            responseToken: searchListing?.responseToken ?? "",
                            Source: "HBMT Hotels",
                        };

                        let markupDetails = await this.markupDetails(markup, data['Price']['Amount']);
                        if (body.UserType == "B2B") {
                            data['Price']['Markup']['AdminMarkup'] = parseFloat(markupDetails.AdminMarkup).toFixed(2);
                            data['Price']['Markup']['AgentMarkup'] = parseFloat(markupDetails.AgentMarkup).toFixed(2);
                            data['Price']['Amount'] = Number((data['Price']['Amount'] + markupDetails.AdminMarkup + markupDetails.AgentMarkup).toFixed(2))
                            data['Price']['AgentNetFare'] = (Number((data['Price']['Amount'] - markupDetails.AgentMarkup).toFixed(2)));
                        } else if (body.UserType == "B2C") {
                            data['Price']['Markup']['AdminMarkup'] = parseFloat(markupDetails.AdminMarkup).toFixed(2);
                            data['Price']['Amount'] = Number((data['Price']['Amount'] + markupDetails.AdminMarkup).toFixed(2))
                        }

                        // if (markup && markup.markup_currency == data['Price']['Currency']) {
                        //     if (markup.value_type == 'percentage') {
                        //         let percentVal = (data['Price']['Amount'] * markup['value']) / 100;
                        //         data['Price']['Markup'] = percentVal;
                        //         data['Price']['Amount'] += percentVal;
                        //         data['Price']['Amount'] = parseFloat(data['Price']['Amount'].toFixed(2));
                        //     } 
                        // }
                        const temp = {
                            ...data,
                            roomDetails: await this.formatRooms(hotelResults.groups, body, USD_to_GBP, Conversion_Rate),
                            searchRequest: body,
                            booking_source: body.booking_source,
                            ResultToken: result["ResultToken"],
                            CurrencyCode: Currecncy
                        }
                        dataFormat.push(temp);
                    } catch (error) {
                        const errorClass: any = getExceptionClassByCode(error.message);
                        throw new errorClass(error.message);
                    }
                };
                await Promise.all(hotelResults.map(fetchData));
                const token = this.redisServerService.geneateResultToken(body);
                const resultData = Promise.all(
                    dataFormat.map(async (x) => {
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
                        delete x["ResultToken"];
                        return {
                            ResultIndex: response["access_key"],
                            ...x,
                        }
                    })
                )
                if ((await resultData).length > 0) {
                    return await resultData;
                }
                else {
                    return [];
                }
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 Hotel Not found with this scenario`);
                throw new errorClass(`400   Hotel Not found with this scenario`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    //original code
    // async search(body: any): Promise<any> {
    //     try {
    //         const accessToken = await this.getToken();
    //         const givenUrl = `${HMBT_URL}/v1/price/search`;
    //         const searchRequest: any = await this.searchRequest(body);
    //         const result: any = await this.httpService.post(givenUrl, searchRequest, {
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': `Bearer ${accessToken}`,
    //             },
    //         }).toPromise();
    //         if (this.isLogXml) {
    //             const fs = require('fs');
    //             fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchRQ.json`, JSON.stringify(searchRequest));
    //             fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchRS.json`, JSON.stringify(result));
    //         }
    //         const listing_url = result.link
    //         const searchListing: any = await this.httpService.get(listing_url, {
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': `Bearer ${accessToken}`,
    //             },
    //         }).toPromise();
    //         if (this.isLogXml) {
    //             const fs = require('fs');
    //             fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchListingRQ.json`, JSON.stringify(listing_url));
    //             fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/SearchListingRS.json`, JSON.stringify(searchListing));
    //         }
    //         let markup: any;
    //         if (body['UserType'] && body['UserId']) {
    //             markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
    //             // markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
    //         }

    //         if (searchListing.result && searchListing.result.length) {
    //             const hotelResults = searchListing.result;
    //             let dataFormat: any[] = []
    //             let currencyDetails;
    //             let Conversion_Rate = 1



    //             const fetchData = async (hotelResults: any) => {
    //                 try {
    //                     let hotelData = await this.manager.query(`select * from humming_bird_hotel_details where hotel_code = "${hotelResults.hotelCode}"`)
    //                     hotelData = hotelData[0]
    //                     let minPrice = Infinity;
    //                     let Currecncy
    //                     hotelResults.groups.map((group) => {
    //                         group.rooms.map(async (room) => {
    //                             let Cur
    //                             if (room.deals[0].price.nett < minPrice)
    //                                 minPrice = room.deals[0].price.nett
    //                             Currecncy = room.deals[0].price.currency
    //                             // if (!isNaN(room.RecommendedSellingRate) && room.RecommendedSellingRate < recommendedSellingRate) {
    //                             //     recommendedSellingRate = room.RecommendedSellingRate;
    //                             // }
    //                         })
    //                     })
    //                     if (minPrice == Infinity)
    //                         minPrice = null;

    //                     if (HMBT_CURRENCY != BASE_CURRENCY) {
    //                         currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
    //                         Conversion_Rate = currencyDetails['value'] ?? 1;
    //                      }
    //                     let Amount =  (minPrice ?? 0) * Conversion_Rate ; 
    //                     Amount = isNaN(Amount) ? 0 : parseFloat(Amount.toFixed(2)) ;

    //                     if (body?.Currency && body.Currency != BASE_CURRENCY) {
    //                         currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
    //                         Conversion_Rate = currencyDetails['value'] ?? 1;
    //                         Amount = (Amount ?? 0) * Conversion_Rate; 
    //                         Amount = isNaN(Amount) ? 0 : parseFloat(Amount.toFixed(2));
    //                      }
    //                     // const [rating, label] = hotelData?.ratingLabel.split(', ').map(item => item.trim()) ?? "";
    //                     const data = {
    //                         HotelCode: hotelResults?.hotelCode ?? '',
    //                         HotelName: hotelData?.hotel_name ?? '',
    //                         HotelCategory: result.HotelCategory ? result.HotelCategory : "",
    //                         StarRating: hotelData?.rating ?? "",
    //                         HotelDescription: hotelData?.description ?? "",
    //                         HotelPromotion: result.HotelPromotion ? result.HotelPromotion : "",
    //                         HotelPolicy: result.HotelPolicy ? result.HotelPolicy : [],
    //                         Price: { Amount: Amount , Currency: body.Currency, Commission: '' },
    //                         // AveragePerNight: (minPrice / body.NoOfNights) * Conversion_Rate,
    //                         HotelPicture: hotelData?.featuredImage ?? "",
    //                         HotelAddress: hotelData?.locationText ?? "",
    //                         HotelContactNo: "",
    //                         HotelAmenities: [],
    //                         HotelMap: "",
    //                         Latitude: "",
    //                         Longitude: "",
    //                         Breakfast: "",
    //                         HotelLocation: "",
    //                         SupplierPrice: "",
    //                         OrginalHotelCode: "",
    //                         HotelPromotionContent: "",
    //                         PhoneNumber: "",
    //                         Free_cancel_date: "",
    //                         trip_adv_url: "",
    //                         trip_rating: "",
    //                         NoOfRoomsAvailableAtThisPrice: "",
    //                         Refundable: "",
    //                         HotelCurrencyCode: Currecncy,
    //                         NoOfReviews: "",
    //                         ReviewScore: "",
    //                         ReviewScoreWord: "",
    //                         checkIn: body.CheckIn ? body.CheckIn : "",
    //                         checkOut: body.CheckOut ? body.CheckOut : "",
    //                         responseToken: searchListing?.responseToken ?? "",
    //                         Source: "HBMT Hotels",
    //                     };
    //                     if (markup && markup.markup_currency == data['Price']['Currency']) {
    //                         if (markup.value_type == 'percentage') {
    //                             let percentVal = (data['Price']['Amount'] * markup['value']) / 100;
    //                             data['Price']['Markup'] = percentVal;
    //                             data['Price']['Amount'] += percentVal;
    //                             data['Price']['Amount'] = parseFloat(data['Price']['Amount'].toFixed(2));
    //                         } else if (markup.value_type == 'plus') {
    //                             data['Price']['Markup'] = markup['value'];
    //                             data['Price']['Amount'] += markup['value'];
    //                         }
    //                     }
    //                     const temp = {
    //                         ...data,
    //                         roomDetails: await this.formatRooms(hotelResults.groups, body , Conversion_Rate),
    //                         searchRequest: body,
    //                         booking_source: body.booking_source,
    //                         ResultToken: result["ResultToken"],
    //                         CurrencyCode: Currecncy
    //                     }
    //                     dataFormat.push(temp);
    //                 } catch (error) {
    //                     const errorClass: any = getExceptionClassByCode(error.message);
    //                     throw new errorClass(error.message);
    //                 }
    //             };
    //             await Promise.all(hotelResults.map(fetchData));
    //             const token = this.redisServerService.geneateResultToken(body);
    //             const resultData = Promise.all(
    //                 dataFormat.map(async (x) => {
    //                     const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
    //                     delete x["ResultToken"];
    //                     return {
    //                         ResultIndex: response["access_key"],
    //                         ...x,
    //                     }
    //                 })
    //             )
    //             if ((await resultData).length > 0) {
    //                 return await resultData;
    //             }
    //             else {
    //                 return [];
    //             }
    //         }
    //         else {     
    //             const errorClass: any = getExceptionClassByCode(`400 Hotel Not found with this scenario`);
    //             throw new errorClass(`400   Hotel Not found with this scenario`);
    //         }
    //     }
    //     catch (error) {
    //         const errorClass: any = getExceptionClassByCode(error.message);
    //         throw new errorClass(error.message);
    //     }
    // }

    async getHotelDetails(body: any): Promise<any> {
        try {
            const accessToken = await this.getToken();
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken);
                data = JSON.parse(data[0]);
                let token = data["ResultToken"];

                let room1 = data.searchRequest.RoomGuests[0];
                let room1_pax = room1.NoOfAdults + "_" + room1.NoOfChild;

                // let currencyDetails: any;
                // let conversionRate = 1;

                // if (data.Price.Currecncy == BASE_CURRENCY) {
                //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(data.Price.Currecncy);
                //     conversionRate = currencyDetails['value'];
                // }

                let markup: any;

                // if (data['searchRequest'].UserType) {
                //     if (data['searchRequest'].UserId == undefined) {
                //         data['searchRequest'].UserId = 0;
                //     }
                //     body.MarkupCity = data['searchRequest'].MarkupCity;
                //     body.MarkupCountry = data['searchRequest'].MarkupCountry;
                //     markup = await this.hotelDbService.getMarkupDetails(data['searchRequest'].UserType, data['searchRequest'].UserId, body);
                // }

                let url = `${HMBT_URL}/v1/price/hotel/${data.HotelCode}/deals/${data.responseToken}`;
                const hotelDetails: any = await this.httpService.get(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                }).toPromise();

                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/HotelDetailsRQ.json`, JSON.stringify(url));
                    fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/HotelDetailsRS.json`, JSON.stringify(hotelDetails));
                }

                if (Object.keys(hotelDetails).length) {
                    let dataFormat = {
                        ResultIndex: data?.ResultIndex ?? 0,
                        HotelCode: data?.HotelCode ?? null,
                        HotelName: data?.HotelName ?? "",
                        HotelCategory: data.HotelCategory ? data.HotelCategory : "",
                        StarRating: data?.StarRating ?? "",
                        HotelDescription: data?.HotelDescription ?? "",
                        HotelPromotion: data.HotelPromotionContent ? data.HotelPromotionContent : "",
                        HotelPolicy: data?.HotelPolicy ?? [],
                        Price: data?.Price ?? {},
                        AveragePerNight: data?.AveragePerNight ?? "",
                        HotelPicture: data.HotelPicture ? [`${data.HotelPicture}`] : "",
                        HotelAddress: data?.HotelAddress ?? "",
                        HotelContactNo: data?.HotelContactNo ?? "",
                        HotelMap: data?.HotelMap ?? null,
                        Latitude: data?.Latitude ?? "",
                        Longitude: data?.Longitude ?? "",
                        Breakfast: data?.Breakfast ?? "",
                        HotelLocation: data?.HotelLocation ?? null,
                        SupplierPrice: data?.SupplierPrice ?? null,
                        HotelAmenities: data?.HotelAmenities ?? [],
                        OrginalHotelCode: data?.HotelCode ?? "",
                        Free_cancel_date: data?.Free_cancel_date ?? "",
                        trip_adv_url: data?.trip_adv_url ?? "",
                        trip_rating: data?.trip_rating ?? "",
                        NoOfRoomsAvailableAtThisPrice: data?.NoOfRoomsAvailableAtThisPrice ?? "",
                        Refundable: data?.Refundable ?? "",
                        HotelCurrencyCode: hotelDetails.result?.currency ?? "",
                        NoOfReviews: data.NoOfReviews ? data.NoOfReviews : "",
                        ReviewScore: data?.ReviewScore ?? "",
                        PhoneNumber: data?.PhoneNumber ?? "",
                        ReviewScoreWord: data?.ReviewScoreWord ?? "",
                        CheckIn: data?.checkIn ?? "",
                        CheckOut: data?.checkOut ?? "",
                        Source: data?.Source ?? "",
                        searchRequest: data?.searchRequest ?? '',
                        booking_source: body.booking_source,
                        HotelPromotionContent: data?.HotelPromotionContent ?? "",
                        responseToken: hotelDetails?.requestToken ?? ""
                    };
                    let InclusivePrice = 0
                    if(hotelDetails.result?.compulsoryOtherInclusives && hotelDetails.result?.compulsoryOtherInclusives.length ){
                        hotelDetails.result?.compulsoryOtherInclusives.forEach((inclusive)=>{
                            InclusivePrice += inclusive.price
                      })
                    }
                    const roomDetails = [];
                    if (hotelDetails.result.groups && hotelDetails.result.groups.length) {
                        await Promise.all(hotelDetails.result.groups.map(async (roomGroup, index) => {
                            const adult = data.searchRequest.RoomGuests[index]?.NoOfAdults || 0;
                            const childCount = data.searchRequest.RoomGuests[index]?.NoOfChild || 0;
                            const roomCount = index + 1
                            const roomGroupData = [];
                            await Promise.all(roomGroup.rooms.map(async (room) => {
                              let   dataInclusivePrice = 0
                                await Promise.all(room.packages.map(async (roomPackage) => {
                                    let markupvalue = 0;

                                    let Conversion_Rate = 1;
                                    let currencyDetails;
                                    if (hotelDetails.result.currency && hotelDetails.result.currency !== BASE_CURRENCY) {
                                        currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(hotelDetails.result.currency);
                                        Conversion_Rate = currencyDetails['value'] ?? 1;
                                    }
                                    dataInclusivePrice = InclusivePrice / Conversion_Rate  
                                    let roomPrice = parseFloat(roomPackage.price.nettTotal ?? 0) / Conversion_Rate;
                                    // console.log(InclusivePrice , 'InclusivePriceInclusivePrice');
                        
                                    if (data?.Price.Currency != BASE_CURRENCY) {
                                        currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(data?.Price.Currency);
                                        Conversion_Rate = currencyDetails['value'] ?? 1;
                                        roomPrice = roomPrice * Conversion_Rate;
                                        dataInclusivePrice = dataInclusivePrice * Conversion_Rate
                                    }

                                    roomPrice = dataInclusivePrice + roomPrice
                                    console.log('====================================');
                                    console.log("roomPrice", roomPrice);
                                    console.log('====================================');
                                    if (data['searchRequest']['UserType']) {
                                        if (data['searchRequest']['UserId'] == undefined) {
                                            data['searchRequest']['UserId'] = 0;
                                        }
                                        // markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
                                        markup = await this.hotelDbService.getMarkup(data.searchRequest);
                                
                                    }
                                    let markupDetails = await this.markupDetails(markup, roomPrice);
                                    roomPrice = roomPrice + markupDetails.AdminMarkup + markupDetails.AgentMarkup
                                    let Markup: any = {}
                                    Markup['AdminMarkup'] = (markupDetails.AdminMarkup).toFixed(2);
                                    Markup['AgentMarkup'] = (markupDetails.AgentMarkup).toFixed(2);
                                    // let cancellationText = '';
                                    // if (roomPackage?.cancellationPolicies) {
                                    //     cancellationText = roomPackage.cancellationPolicies.flatMap(policy => policy.description).join(', ');
                                    // }


                                    let OrginalCancellationpolicy = '';
                                    if (roomPackage?.cancellationPolicies) {
                                        OrginalCancellationpolicy = roomPackage.cancellationPolicies.flatMap(policy => policy.description).join(', ');
                                    }
                
                                    let cancellationText = '';

                                    if (roomPackage?.cancellationPolicies) {
                                        cancellationText = roomPackage.cancellationPolicies.flatMap(policy => {
                                            // Adjust the cancellation date by -3 days (if the date exists)
                                            let updatedDescriptions = policy.description.map(desc => {
                                                // Regex to match dates in the format "Dec 2, 2024"
                                                return desc.replace(/\b([A-Za-z]{3}) (\d{1,2}), (\d{4})\b/g, (match, month, day, year) => {
                                                    const cancellationDate = new Date(`${month} ${day}, ${year}`);
                                                    cancellationDate.setDate(cancellationDate.getDate() - 3); // Subtract 3 days
                                                    const adjustedDate = cancellationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
                                                    return adjustedDate;  // Replace matched date with adjusted date
                                                });
                                            });
                                    
                                            // Join descriptions back together and return
                                            return updatedDescriptions.join(', ');
                                        }).join(', ');
                                    }  

                                    let roomData = {
                                        AgencyToken: "",
                                        Rooms: [{
                                            Index: '',
                                            Price: [{ FromDate: data?.checkIn ?? "", ToDate: data?.checkOut ?? "", Amount: parseFloat(Number(roomPrice).toFixed(2)), Currency: data.Price?.Currency ?? "", Markup: Markup, }],
                                            roomCode: room?.code ?? "",
                                            rateId: roomPackage?.id ?? "",
                                            Id: roomGroup?.id || '',
                                            Description: room?.name ?? "",
                                            RoomType: roomPackage?.info?.accommodation?.mealPlan?.name ?? '',
                                            MealPlanCode: roomPackage?.info?.accommodation?.mealPlan?.code ?? '',
                                            Occupacy: "",
                                            cancellationPolicies: cancellationText ? cancellationText : '',
                                            OrginalCancellationpolicy: OrginalCancellationpolicy ? OrginalCancellationpolicy : '',
                                            paxCount: '',
                                            AdultCount: adult,
                                            ChildrenCount: childCount,
                                            Rooms: roomCount,
                                            info: roomPackage?.info ?? "",
                                            freeUpgrades: roomPackage?.freeUpgrades ?? [],
                                            extraBenefits: roomPackage?.extraBenefits ?? [],
                                            offers: roomPackage?.offers ?? [],
                                            notes: roomPackage?.notes ?? [] ,
                                            compulsoryOtherInclusives : hotelDetails.result?.compulsoryOtherInclusives ?? [] ,
                                            InclusivePrice : parseFloat(dataInclusivePrice.toFixed(2))
                                        }],
                                        ResultIndex: "",
                                        RoomUniqueId: "",
                                    };
                                    roomGroupData.push(roomData);
                                    const token = this.redisServerService.geneateResultToken(body);
                                    const response = await this.redisServerService.insert_record(token, JSON.stringify(roomData));
                                    roomData.Rooms[0].Index = response.access_key;
                                    roomData.ResultIndex = body.ResultToken;

                                }));
                            }));
                            roomDetails.push(roomGroupData);
                        }));
                    }
                 
                   data.Price.Amount = roomDetails[0][0].Rooms[0].Price[0].Amount 

                    dataFormat["RoomDetails"] = roomDetails;
                    dataFormat = {
                        ...dataFormat,
                        "ResultIndex": ''
                    };
                    return dataFormat;
                } else {
                    const errorClass: any = getExceptionClassByCode(`400 ${hotelDetails.Message}`);
                    throw new errorClass(`400 ${hotelDetails.Message}`);
                }
            } else {
                const errorClass: any = getExceptionClassByCode(`400 ResultToken is empty`);
                throw new errorClass(`400 ResultToken is empty`);
            }
        } catch (error) {
            throw new Error(`getHotelDetails Error: ${error.message}`);
        }
    }



    async hotelsValuation(body: any): Promise<any> {
        try {
            const accessToken = await this.getToken();
            let roomListData = await this.redisServerService.read_list(body.ResultToken[0]);
            roomListData = JSON.parse(roomListData[0]);

            let roomArr = []
            let totalRoomPrice = 0
            const respDataArray = await Promise.all(body.BlockRoomId.map(async (RoomResultToken, index) => {
                let roomDetailsData = await this.redisServerService.read_list(RoomResultToken);
                roomDetailsData = JSON.parse(roomDetailsData);
                await Promise.all(roomDetailsData.Rooms.map(async (room, index) => {
                    totalRoomPrice = totalRoomPrice + room.Price[0].Amount;

                    try {
                        if (true) {
                            let roomDetails = {
                                Price: room?.Price ?? [],
                                Index: 0,
                                Id: room?.Id ?? "",
                                roomCode: room?.roomCode ?? "",
                                rateId: room?.rateId ?? "",
                                Description: room?.Description ?? '',
                                NonRefundable: "",
                                MealPlanCode: room?.MealPlanCode ?? '',
                                Occupancy: '',
                                cancellationPolicies: room?.cancellationPolicies ?? '',
                                OrginalCancellationpolicy: room?.OrginalCancellationpolicy ?? '',
                                compulsoryOtherInclusives : room.compulsoryOtherInclusives ?? [] ,
                                InclusivePrice : room?.InclusivePrice ?? 0 ,
                                paxCount: room.paxCount,
                                AdultCount: room.AdultCount,
                                ChildrenCount: Number(room.ChildrenCount),
                                Rooms: room.Rooms,
                                // Info : room?.info ?? ""
                            };
                            roomArr.push(roomDetails)
                        }
                    } catch (error) {
                        const errorClass: any = getExceptionClassByCode(error.message);
                        throw new errorClass(error.message);
                    }
                }));

                let dataFormat = {
                    ResultIndex: "",
                    
                    HotelCategory: roomListData?.HotelCategory ?? "",
                    StarRating: roomListData?.StarRating ?? "",
                    HotelDescription: roomListData.HotelDescription ? roomListData.HotelDescription.replace(/\^/g, "'") : "",
                    HotelPromotion: roomListData?.HotelPromotion ?? "",
                    HotelPolicy: roomListData?.HotelPolicy ?? "",
                    Price: roomListData?.Price ?? "",
                    AveragePerNight: roomListData?.AveragePerNight ?? " ",
                    HotelPicture: roomListData?.HotelPicture ?? "",
                    HotelAddress: roomListData?.HotelAddress ?? "",
                    HotelContactNo: roomListData?.HotelContactNo ?? "",
                    HotelMap: roomListData?.HotelMap ?? "",
                    Latitude: roomListData?.Latitude ?? "",
                    Longitude: roomListData?.Longitude ?? "",
                    Breakfast: roomListData?.Breakfast ?? "",
                    HotelLocation: roomListData?.SupplierPrice ?? null,
                    SupplierPrice: roomListData?.SupplierPrice ?? null,
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
                    searchRequest: roomListData?.searchRequest ?? {},
                    NoOfRooms: roomListData.searchRequest?.NoOfRooms ?? '',
                    RoomGuests: roomListData?.searchRequest.RoomGuests ?? [],
                    booking_source: body.booking_source,
                    responseToken: roomListData.responseToken,
                    ResultToken: roomListData.ResultToken
                };
                dataFormat.Price = {
                    Amount: totalRoomPrice.toFixed(2),
                    Currency: roomListData?.Price?.Currency,
                    Commission: "",

                }
                const token = this.redisServerService.geneateResultToken(body);
                const dataFormatResponse = await this.redisServerService.insert_record(token, JSON.stringify(dataFormat));
                delete dataFormat["BlockRoomId"];
                delete dataFormat["ResultToken"];
                dataFormat = {
                    ...dataFormat,
                    "ResultToken": dataFormatResponse["access_key"]
                };
                return dataFormat;

            }));
            let result = respDataArray[0]
            return result
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async BookHeader(booking, pax, room) {
        let RoomData = JSON.parse(booking[0].attributes.replace(/'/g, '"'));
        let responseToken = RoomData.responseToken;

        let attributesData = pax[0].attributes.replace(/'/g, '"');
        attributesData = JSON.parse(attributesData);
        let groups = RoomData.RoomDetails.map((roomDetail, index) => {
            // let [groupId, number] = roomDetail.Id.split(":");

            let guest = pax[index] || {};
            return {
                id: roomDetail.Id,
                room: roomDetail?.roomCode ?? "",
                deal: roomDetail?.rateId ?? ""
            }
        })

        let request = {
            bookingRequest: {
                primaryGuestName: pax[0]?.first_name ?? "",
                groups: groups
            },
            remarks: attributesData.note ? attributesData.note : ""

        };
        return {
            reqArr: request,
            responseToken
        };
    }


    async GuestRequest(booking, pax, BookingDetails) {

        const guestDetails = pax.map((guest, index) => {
            const birthDate = new Date(parseInt(guest.date_of_birth));
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const dayDiff = today.getDate() - birthDate.getDate();


            if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                age--;
            }
            const bookingGuestDetail = BookingDetails.paxGroups
                .flatMap(group => group.guestDetails)[index];


            let attributesData = guest.attributes.replace(/'/g, '"');
            attributesData = JSON.parse(attributesData);


            return {
                id: bookingGuestDetail.id,
                primary: guest.address2 === '1',
                type: guest.pax_type.toLowerCase(),
                wheelChair: false,
                firstName: guest.first_name,
                lastName: guest.last_name,
                childAge: guest.pax_type.toLowerCase() === 'child' ? age : null,
                arrivalFlightDate: attributesData.arrivalFlightDate ? attributesData.arrivalFlightDate : "",
                arrivalFlightAirline: attributesData.arrivalFlightAirline ? attributesData.arrivalFlightAirline : "",
                arrivalFlightNumber: attributesData.arrivalFlightNumber ? attributesData.arrivalFlightNumber : "",
                departureFlightDate: attributesData.departureFlightDate ? attributesData.departureFlightDate : "",
                departureFlightAirline: attributesData.departureFlightAirline ? attributesData.departureFlightAirline : "",
                departureFlightNumber: attributesData.departureFlightNumber ? attributesData.departureFlightNumber : "",
            };
        });

        return {
            details: guestDetails,
        };
    }



    async formatReservationRequest(booking: any, pax: any, room: any, body: any) {
        try {
            const accessToken = await this.getToken();
            let { reqArr, responseToken } = await this.BookHeader(booking, pax, room);
            let hotelCode = booking[0].hotel_code

            let result
            try {
                const url = `${HMBT_URL}/v1/booking/${hotelCode}/create/${responseToken}`;
                result = await this.httpService.post(url, reqArr, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                }).toPromise();

                if (this.isLogXml) {
                    const fs = require('fs');
                    const url = `${HMBT_URL}/v1/booking/${hotelCode}/create/${responseToken}`;
                    fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/BookingRQ.json`, JSON.stringify(reqArr));
                    fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/BookingRS.json`, JSON.stringify(result));
                }

            } catch (error) {
                throw new Error(`Failed to book room: ${error.message}`);
            }

            let BookingDetails: any;
            if (result.link) {
                try {
                    BookingDetails = await this.httpService.get(result.link, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    }).toPromise();

                    try {
                        fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/BookingDetailsREQ.json`, JSON.stringify(result.link));
                        fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/BookingDetailsRES.json`, JSON.stringify(BookingDetails));
                    } catch (error) {
                        console.error(`Failed to write log files: ${error.message}`);
                    }


                    let guestReq = await this.GuestRequest(booking, pax, BookingDetails)
                    const guest_url = `${HMBT_URL}/v1/booking/${BookingDetails.responseToken}/guest-details`
                    let guestDetails = await this.httpService.post(guest_url, guestReq, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    }).toPromise();

                    if (this.isLogXml) {
                        const fs = require('fs');
                        fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/GuestDetailsRQ.json`, JSON.stringify({ guest_url, guestReq }));
                        fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/GuestDetailsRS.json`, JSON.stringify(guestDetails));
                    }


                } catch (error) {
                    const errorClass: any = getExceptionClassByCode(`400 ${error}`);
                    throw new errorClass(`400 ${error}`);
                }
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ${result.message}`);
                throw new errorClass(`400 ${result.message}`);
            }

            if (Object.keys(BookingDetails).length) {
                return this.HmbtTransformService.updateData(BookingDetails, body, booking, pax, room);
            } else {
                const errorClass: any = getExceptionClassByCode(`400 Booking Failed`);
                throw new errorClass(`400  Booking Failed`);
            }
        }
        catch (error) {
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
            const accessToken = await this.getToken();
            let responseToken = await this.manager.query(`Select confirmation_reference , booking_id from  hotel_hotel_booking_details where app_reference= "${body.AppReference}" `);
            responseToken = responseToken[0]

            const url = `${HMBT_URL}/v1/booking/${responseToken.confirmation_reference}/cancel-request`;

            let request = {
                reference: responseToken.booking_id
            }
            let result = await this.httpService.post(url, request, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            }).toPromise();

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/CancellationRQ.json`, JSON.stringify({ url, request }));
                fs.writeFileSync(`${logStoragePath}/hotels/HummingBirds/CancellationRS.json`, JSON.stringify(result));
            }

            let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
            let response = await this.hotelDbService.updateHotelCancelDetails(bookingDetails[0], body);

            console.log(response);
            return response;


        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    //added
    async markupDetails(body: any, totalFare: any): Promise<any> {
        let AdminMarkup = 0;
        let AgentMarkup = 0;
        const markupDetails: any = body.markupDetails;
        if (markupDetails.adminMarkup && markupDetails.adminMarkup.length > 0) {
            markupDetails.adminMarkup.forEach((markup: any) => {
                markup.value = parseFloat((markup.value).toFixed(2));
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
                    AgentMarkup += (markup.value + AdminMarkup);
                } else if (markup.value_type === "percentage") {
                    AgentMarkup += ((totalFare + AdminMarkup) * markup.value) / 100
                }
            });
        }

        return {
            AdminMarkup,
            AgentMarkup
        }
    }


}


