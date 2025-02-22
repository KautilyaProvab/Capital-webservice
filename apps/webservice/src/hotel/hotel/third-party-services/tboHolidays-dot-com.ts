
import { Url, TMX_HOTEL_BOOKING_SOURCE, TMX_USER_NAME, TMX_PASSWORD, TMX_DOMAINKEY, TMX_SYSTEM, TBOH_USERNAME, TBOH_PASSWORD } from "apps/webservice/src/constants";



import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { HOTELBEDS_URL, HOTELBEDS_HOTEL_BOOKING_SOURCE, logStoragePath, META_TL_HOTEL_COURSE, HOTELBEDS_APIKEY, HOTELBEDS_SECRET, ExchangeRate_1_GBP_to_USD, BASE_CURRENCY } from "../../../constants";
import { goGlobalRequestTypes } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { HotelBedsTransformService } from "./hotelbeds-transform.service";
import { HotelTboTransformService } from './tboHolidays-transform.Service';
import * as moment from "moment";
import { log } from "util";
import { decode } from 'html-entities'
const crypto = require('crypto');
const fs = require('fs')

@Injectable()
export class TboHolidaysDotComService extends HotelApi {

    apiCred: any;
    apiCredCached: boolean = false;

    constructor(
        private readonly httpService: HttpService,
        private hotelDbService: HotelDbService,
        private HotelBedsTransformService: HotelBedsTransformService,
        private HotelTboTransformService: HotelTboTransformService,
        private redisServerService: RedisServerService) {
        super()
    }

    throwSoapError(jsonResponse: any) {
        if (getPropValue(jsonResponse, 'Header.OperationType') == 'Error') {
            throw new HttpException(getPropValue(jsonResponse, 'Main.Error.Message'), 400);
        }
    }

    async CityList(code) {
        const CityCode = await Promise.all(code.map(async (countyCode) => {
            const city_url = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/CityList`
            const req = {
                CountryCode: countyCode.Code
            }
            const cityResult: any = await this.httpService.post(city_url, req, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                    'x-username': TBOH_USERNAME,
                    'x-password': TBOH_PASSWORD,
                }
            }).toPromise();
            cityResult.CityList.map(async (getcode: any) => {

                let dataToInsert = {
                    CityCode: getcode.Code,
                    CityName: getcode.Name,
                    CountryCode: countyCode.Code

                }
                let getCityData = await this.manager.query(`Select CityCode  from  hotel_hotel_cityId where CityCode= "${getcode.Code}" `);

                if (getCityData && !getCityData.length)
                    await this.manager.query(`INSERT INTO hotel_hotel_cityId SET ?`, [dataToInsert]);
            });

            return cityResult
        }))

    }

    async CountryList() {

        const Country_Url = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/CountryList`
        const CountryResult: any = await this.httpService.get(Country_Url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en',
                'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                'x-username': TBOH_USERNAME,
                'x-password': TBOH_PASSWORD,
            }
        }).toPromise()


        if (CountryResult.Status.Code == 200) {
            const CityCode = await this.CityList(CountryResult.CountryList)
            return CityCode
        }
    }



    async Create(body: any): Promise<any> {
        try {

            const givenUrl = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/TBOHotelCodeList`;
            const req = {
                CityCode: body.CityCode,
                IsDetailedResponse: false
            }

            const result: any = await this.httpService.post(givenUrl, req, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                    'x-username': TBOH_USERNAME,
                    'x-password': TBOH_PASSWORD,
                }
            }).toPromise();


            const getHotelDetailsUrl = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/Hoteldetails`
            if (result?.Status && result?.Status.Code === 200) {
                const hotelResults = result.Hotels;

                hotelResults.map(async (hotel) => {
                    const hotelReq = {
                        Hotelcodes: hotel.HotelCode,
                        Language: "en"
                    };
                    const response = await this.httpService.post(getHotelDetailsUrl, hotelReq, {
                        headers: {
                            'Accept': 'application/json',
                            'Accept-Language': 'en',
                            'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                            'x-username': TBOH_USERNAME,
                        }
                    }).toPromise();
                    let result = response["HotelDetails"] ?? []

                    let getResult: any;
                    for (const hotelDetail of result) {
                        if (hotelDetail?.HotelCode == hotel.HotelCode) {
                            getResult = hotelDetail;
                        }
                    }
                    result = getResult;
                    const data = {
                        Code: hotel.HotelCode,
                        hotelName: hotel.HotelName,
                        stars: result?.HotelRating ?? 0,
                        description: result?.Description ?? "",
                        images: result?.Images ?? "",
                        contactNo: result?.PhoneNumber ?? "",
                        hotelAddress: hotel.Address,
                        latitude: hotel.Latitude ?? "",
                        longitude: hotel.Longitude ?? "",
                        amenities: result?.HotelFacilities,
                        CityId: body.CityCode,
                        CityName: result?.CityName ?? ""
                    };


                    const dataToInsert = {
                        ...data,
                        images: JSON.stringify(data.images),
                        amenities: JSON.stringify(data.amenities)
                    };


                    let tboHotelData = await this.manager.query(`select * from hotel_hotel_tbo where  Code = "${hotel.HotelCode}"`);
                    if (tboHotelData && !tboHotelData.length) {

                        await this.manager.query(`INSERT INTO hotel_hotel_tbo SET ?`, [dataToInsert]);
                    }

                })
            }

        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    // async searchRequest(body: any): Promise<any> {

    //     var hotelcode = await this.hotelDbService.TboHotelHotelCode(body['CityIds'][0]);
    //     hotelcode = JSON.parse(JSON.stringify(hotelcode));

    //     let responseTime: any

    //     if (hotelcode.length <= 50) {
    //         responseTime = 10
    //     }
    //     else if (hotelcode.length <= 100) {
    //         responseTime = 15
    //     }
    //     else {
    //         responseTime = 23
    //     }

    //     let hotelcodes: any = [];
    //     for (let index = 0; index < hotelcode.length; index++) {
    //         hotelcodes.push(hotelcode[index].hotel_code);

    //     }
    //     let HotelCodes = hotelcodes.join(',');


    //     let PaxRooms: any = [];
    //     body.RoomGuests.forEach((guest) => {
    //         PaxRooms.push({ Adults: guest.NoOfAdults, Children: guest.NoOfChild, ChildrenAges: guest.ChildAge })
    //     })

    //     let searchRequest: any = {
    //         CheckIn: body.CheckIn,
    //         CheckOut: body.CheckOut,
    //         HotelCodes: HotelCodes,
    //         GuestNationality: "AE",
    //         PaxRooms,
    //         ResponseTime: responseTime,
    //         IsDetailedResponse: true,
    //         Filters: {
    //             Refundable: false,
    //             NoOfRooms: 0,
    //             MealType: "All"
    //         }
    //     }


    //     return searchRequest;
    // }
    async searchRequest(body: any): Promise<any[]> {
        let hotelcode = await this.hotelDbService.TboHotelHotelCode(body['CityIds'][0]);
        hotelcode = JSON.parse(JSON.stringify(hotelcode));

        let responseTime: any;

        if (hotelcode.length <= 50) {
            responseTime = 10;
        } else if (hotelcode.length <= 100) {
            responseTime = 15;
        } else {
            responseTime = 23;
        }

        let hotelcodes: any = [];
        for (let index = 0; index < hotelcode.length; index++) {
            hotelcodes.push(hotelcode[index].hotel_code);
        }
        let hotelCodeChunks = [];
        for (let i = 0; i < hotelcodes.length; i += 100) {
            hotelCodeChunks.push(hotelcodes.slice(i, i + 100));
        }

        let searchRequests = hotelCodeChunks.map((HotelCodesChunk, index) => {
            let HotelCodes = HotelCodesChunk.join(',');
            let PaxRooms: any = [];
            body.RoomGuests.forEach((guest) => {
                PaxRooms.push({ Adults: guest.NoOfAdults, Children: guest.NoOfChild, ChildrenAges: guest.ChildAge });
            });

            return {
                CheckIn: body.CheckIn,
                CheckOut: body.CheckOut,
                HotelCodes: HotelCodes,
                GuestNationality: "AE",
                PaxRooms,
                ResponseTime: responseTime,
                IsDetailedResponse: true,
                Filters: {
                    Refundable: false,
                    NoOfRooms: 0,
                    MealType: "All",
                },
            };
        });

        return searchRequests;
    }


    formatRooms(rooms, body) {
        const roomDetails = []
        rooms[0].Name.map((room, index) => {

            const rates = rooms.map((rate) => {

                const totalFare = rate.DayRates[index];
                const adult = body.RoomGuests[index]?.NoOfAdults || '';
                const childage = body.RoomGuests[index]?.NoOfChild || '';
                const room = index + 1

                if (rate.Supplements && rate.Supplements.length) {
                    const mergedSupplements = rate.Supplements.reduce((acc, supplements) => {
                        if (Array.isArray(supplements)) {
                            supplements.forEach(supplement => {
                                const existing = acc.find(item =>
                                    item.Type === supplement.Type &&
                                    item.Description === supplement.Description &&
                                    item.Currency === supplement.Currency
                                );

                                if (existing) {
                                    existing.Price += supplement.Price;
                                } else {
                                    acc.push({ ...supplement });
                                }
                            });
                        } else {
                            const existing = acc.find(item =>
                                item.Type === supplements.Type &&
                                item.Description === supplements.Description &&
                                item.Currency === supplements.Currency
                            );

                            if (existing) {
                                existing.Price += supplements.Price;
                            } else {
                                acc.push({ ...supplements });
                            }
                        }
                        return acc;
                    }, []);

                    rate.Supplements = mergedSupplements;
                }

                let result = rate.CancelPolicies.map((policy) => {
                    if (policy.ChargeType === "Fixed" && policy.CancellationCharge > 0) {
                        policy.CancellationCharge = policy.CancellationCharge / body.RoomGuests.length
                    }
                    return `From ${policy.FromDate} cancellation charge ${policy.CancellationCharge} ${policy.ChargeType}`;
                }).reduce((acc, curr) => acc + ' ' + curr, '');

                return {
                    name: rate.Name[0],
                    rateKey: rate.BookingCode,
                    rateClass: "",
                    rateType: "",
                    // net: rate.TotalFare ? (rate.TotalFare / body.RoomGuests.length).toFixed(2) : null,
                    net: rate.RecommendedSellingRate ? (Number(rate.RecommendedSellingRate) / body.RoomGuests.length).toFixed(2) : (rate.TotalFare / body.RoomGuests.length).toFixed(2),
                    allotment: '',
                    paymentType: "",
                    packaging: false,
                    boardCode: '',
                    RoomType: rate?.MealType ?? '',
                    NonRefundable: rate?.IsRefundable ?? '',
                    Inclusion: rate.Inclusion ? rate.Inclusion : '',
                    cancellationPolicies: result,
                    RoomPromotion: rate?.RoomPromotion ?? [],
                    rooms: room,
                    adults: adult,
                    children: childage,
                    offers: rate.offers ? rate.offers : null,
                    Supplements: rate.Supplements ? rate.Supplements : []
                };
            });

            roomDetails.push([{
                code: '',
                name: '',
                rate: rates
            }])
        });

        return roomDetails
    }


    async search(body: any): Promise<any> {  
        try {
            const header = {
                Accept: 'application/json',
                'Accept-Language': 'en',
                Authorization: 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                'x-username': TBOH_USERNAME,
                'x-password': TBOH_PASSWORD,
            };
            const givenUrl = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/Search`;
            const searchRequests: any[] = await this.searchRequest(body);

            let markup: any;
            if (body['UserType'] && body['UserId']) {
                markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'], body);
            }  

            const dataFormat: any[] = [];
            const hotelCodes: string[] = [];

            for (const searchRequest of searchRequests) {
                const result: any = await this.httpService
                    .post(givenUrl, searchRequest, { headers: header })
                    .toPromise();

                if (this.isLogXml) {
                    const fs = require('fs');
                    const index = searchRequests.indexOf(searchRequest);
                    fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/SearchRQ_${index}.json`, JSON.stringify(searchRequest));
                    fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/SearchRS_${index}.json`, JSON.stringify(result));
                }

                if (result?.Status && result?.Status.Code === 200) {
                    const hotelResults = result.HotelResult;
                    hotelResults.forEach(hotel => {
                        hotelCodes.push(hotel.HotelCode);
                    });
                }
            }

            if (hotelCodes.length === 0) {
                throw new Error('No hotel codes found from search requests');
            }

            const hotelsData = await this.manager.query(
                `SELECT * FROM hotel_hotel_tbo WHERE Code IN (${hotelCodes.map(code => `"${code}"`).join(',')})`
            );

            if (!hotelsData || hotelsData.length === 0) {
                throw new Error('No matching hotel data found in the database');
            }

            let Conversion_Rate = 1;
            if (body.Currency && body.Currency !== BASE_CURRENCY) {
                const currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
                Conversion_Rate = currencyDetails['value'];
            }


            for (const searchRequest of searchRequests) {
                const result: any = await this.httpService
                    .post(givenUrl, searchRequest, { headers: header })
                    .toPromise();

                if (result?.Status && result?.Status.Code === 200) {
                    const hotelResults = result.HotelResult;

                    for (const hotel of hotelResults) {
                        const dbHotel = hotelsData.find(h => h.Code === hotel.HotelCode);
                        if (!dbHotel) {
                            console.error(`No matching hotel found for Code: ${hotel.HotelCode}`);
                            continue;
                        }

                        const minPrice = Math.min(...hotel.Rooms.map(room => room.TotalFare || Infinity));
                        const recommendedSellingRate = Math.min(...hotel.Rooms.map(room => room.RecommendedSellingRate || Infinity));

                        let hotelImages = [];
                        try {
                            hotelImages = dbHotel.images ? JSON.parse(dbHotel.images) : [];
                        } catch (error) {
                            console.error('Error parsing hotel images:', error);
                        }

                        const data = {
                            HotelCode: dbHotel?.Code || "",
                            HotelName: dbHotel?.hotelName || "",
                            HotelCategory: dbHotel.HotelCategory || '',
                            StarRating: dbHotel.stars || 0,
                            HotelDescription: dbHotel.description || '',
                            Price: {
                                Amount: Conversion_Rate * minPrice,
                                Currency: hotel.Currency,
                                Commission: Conversion_Rate * recommendedSellingRate,
                                Markup: 0,
                            },
                            AveragePerNight: (minPrice / body.NoOfNights) * Conversion_Rate,
                            HotelPicture: hotelImages.length ? hotelImages[0] : '',
                            HotelAddress: dbHotel?.hotelAddress || "",
                            HotelContactNo: dbHotel.contactNo || '',
                            HotelAmenities: dbHotel.amenities ? JSON.parse(dbHotel.amenities) : [],
                            Latitude: dbHotel.latitude || '',
                            Longitude: dbHotel.longitude || '',
                            Breakfast: dbHotel.Breakfast || '',
                            ReviewScore: dbHotel.ReviewScore || '',
                            checkIn: body.CheckIn || '',
                            checkOut: body.CheckOut || '',
                            Source: 'TBO Holidays',
                        };

                        if (markup && markup.markup_currency === data.Price.Currency) {
                            if (markup.value_type === 'percentage') {
                                const percentVal = (data.Price.Amount * markup.value) / 100;
                                data.Price.Markup = percentVal;
                                data.Price.Amount += percentVal;
                            } else if (markup.value_type === 'plus') {
                                data.Price.Markup = markup.value;
                                data.Price.Amount += markup.value;
                            }
                            data.Price.Amount = parseFloat(data.Price.Amount.toFixed(2));
               }


                        const temp = {
                            ...data,
                            roomDetails: this.formatRooms(hotel.Rooms, body),
                            searchRequest: body,
                            booking_source: body.booking_source,
                            ResultToken: result['ResultToken'],
                            CurrencyCode: hotel.Currency,
                        };

                        dataFormat.push(temp);
                    }
                }
            }

            const token = this.redisServerService.geneateResultToken(body);
            const resultData = await Promise.all(
                dataFormat.map(async (x) => {
                    const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
                    delete x['ResultToken'];
                    return {
                        ResultIndex: response['access_key'],
                        ...x,
                    };
                })
            );

            return resultData.length > 0 ? resultData : [];
        } catch (error) {
            console.error('Error during search:', error);
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    async getHotelDetails(body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken);
                data = JSON.parse(data[0]);
                let token = data["ResultToken"];

                let room1 = data.searchRequest.RoomGuests[0];
                let room1_pax = room1.NoOfAdults + "_" + room1.NoOfChild;

                let currencyDetails: any;
                let conversionRate = 1;

                if (data.Price.Currency == BASE_CURRENCY) {
                    currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(data.Price.Currency);
                    conversionRate = currencyDetails['value'];


                }

                let markup: any;

                if (data['searchRequest'].UserType) {
                    if (data['searchRequest'].UserId == undefined) {
                        data['searchRequest'].UserId = 0;
                    }

                    body.MarkupCity = data['searchRequest'].MarkupCity;
                    body.MarkupCountry = data['searchRequest'].MarkupCountry;
                    markup = await this.hotelDbService.getMarkupDetails(data['searchRequest'].UserType, data['searchRequest'].UserId, body);

                }


                let Images = await this.manager.query(`select images from hotel_hotel_tbo where Code = "${data?.HotelCode}"`)


                let hotelImages
                try {
                    hotelImages = Images ? JSON.parse(Images[0].images) : '';
                } catch (error) {
                    console.error('Error parsing hotelImages:', error);
                }

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
                    HotelPicture: hotelImages ?? [],
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
                    HotelCurrencyCode: data?.CurrencyCode ?? "",
                    NoOfReviews: data.NoOfReviews ? data.NoOfReviews : "",
                    ReviewScore: data?.ReviewScore ?? "",
                    PhoneNumber: data?.PhoneNumber ?? "",
                    ReviewScoreWord: data?.ReviewScoreWord ?? "",
                    CheckIn: data?.checkIn ?? "",
                    CheckOut: data?.checkOut ?? "",
                    Source: "Tbo",
                    searchRequest: data?.searchRequest ?? '',
                    booking_source: body.booking_source,
                    HotelPromotionContent: data?.HotelPromotionContent ?? "",
                };

                const roomDetails = [];

                if (data?.roomDetails) {
                    for (const roomData of data.roomDetails) {
                        let roomGroup = [];

                        await Promise.all(roomData.map(async (obj) => {
                            await Promise.all(obj.rate.map(async (e) => {                                
                                let price = conversionRate * e.net;
                                let markupvalue = 0;

                                if (body.UserType !== 'B2C' && body.UserType !== 'B2B') {
                                    if (markup.value_type == 'plus' && e.adults + "_" + e.children == room1_pax) {
                                        markupvalue = markup['value'];
                                        price += markup['value'];
                                    } else {
                                        let percentVal = (price * markup['value']) / 100;
                                        markupvalue = percentVal;
                                        price += percentVal;

                                    }
                                }


                                let roomData = {
                                    AgencyToken: obj.AgencyToken || "",
                                    Rooms: [{
                                        Index: '',
                                        Price: e.net ? [{ FromDate: data?.checkIn ?? "", ToDate: data?.checkOut ?? "", Amount: price, Currency: data.Price?.Currency ?? "", Markup: markupvalue, }] : [],
                                        Id: e?.rateKey || '',
                                        Description: e?.name ?? "",
                                        RoomType: e?.RoomType ?? '',
                                        NonRefundable: e?.NonRefundable ?? null,
                                        MealPlanCode: obj?.MealType || "",
                                        Inclusion: e?.Inclusion ?? "",
                                        Occupacy: obj?.Occupacy || null,
                                        CancellationPolicies: e.cancellationPolicies ? e.cancellationPolicies : '',
                                        RoomPromotion: e?.RoomPromotion ?? [],
                                        paxCount: '',
                                        AdultCount: e?.adults || null,
                                        ChildrenCount:  e.children || 0,
                                        Rooms: e.rooms,
                                        Supplements: e?.Supplements ?? []
                                    }],
                                    ResultIndex: "",
                                    RoomUniqueId: obj.RoomUniqueId || "",
                                };

                                roomGroup.push(roomData);
                                const token = this.redisServerService.geneateResultToken(body)
                                const response = await this.redisServerService.insert_record(token, JSON.stringify(roomData))
                                roomData.Rooms[0].Index = response.access_key;
                                roomData.ResultIndex = body.ResultToken;

                            }));

                        }));

                        roomDetails.push(roomGroup);
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

            //For Markup
            // let markup:any;

            // body.MarkupCity=roomListData.searchRequest.MarkupCity;
            // body.MarkupCountry=roomListData.searchRequest.MarkupCountry;
            // markup = await this.hotelDbService.getMarkupDetails(roomListData.searchRequest.UserType, roomListData.searchRequest.UserId,body);

            let totalAdultCount = 0;
            let totalChildCount = 0;

            roomListData.searchRequest.RoomGuests.forEach(roomGuest => {
                totalAdultCount += roomGuest.NoOfAdults;
                totalChildCount += roomGuest.NoOfChild;
            });

            const respDataArray = await Promise.all(body.BlockRoomId.map(async (RoomResultToken) => {
                let roomDetailsData = await this.redisServerService.read_list(RoomResultToken);
                roomDetailsData = JSON.parse(roomDetailsData);




                // for (let roomData of roomDetailsData) {
                const respData = await Promise.all(roomDetailsData.Rooms.map(async (room) => {

                    try {
                        let givenUrl = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/PreBook`;
                        let blockRoomResponse: any = await this.httpService.post(givenUrl, {
                            BookingCode: room.Id,
                            PaymentMode: `Limit`
                        }, {
                            headers: {
                                'Accept': 'application/json',
                                'Accept-Language': 'en',
                                'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                                'x-username': TBOH_USERNAME,
                            }
                        }).toPromise();


                        if (this.isLogXml) {
                            const fs = require('fs');
                            fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BlockRoomRQ.json`, JSON.stringify({ BookingCode: room.Id, PaymentMode: `Limit` }));
                            fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BlockRoomRS.json`, JSON.stringify(blockRoomResponse));
                        }



                        if (blockRoomResponse.Status.Code === 200) {

                            let Blockedprice: any = 0;
                            let BlockedCommission: any = 0;
                            let BlockedRoom = blockRoomResponse.HotelResult[0].Rooms[0]

                            // if (typeof BlockedRoom.RecommendedSellingRate != 'undefined') {
                            //     Blockedprice = parseFloat(BlockedRoom.RecommendedSellingRate);
                            //     console.log();

                            // } else 
                            if (typeof BlockedRoom.TotalFare != 'undefined') {
                                Blockedprice = BlockedRoom.RecommendedSellingRate ? parseFloat(BlockedRoom.RecommendedSellingRate).toFixed(2) : parseFloat(BlockedRoom.TotalFare).toFixed(2);
                            }


                            //For Markup
                            // let markupvalue=0;

                            // if(markup.value_type == 'plus'){

                            //         markupvalue=markup['value'];
                            //         // result['price']['Amount'] += markup['value'];
                            //         Blockedprice += markup['value'];
                            //         Blockedprice = parseFloat(Number(Blockedprice).toFixed(2));

                            // }else{

                            //     let percentVal = (Blockedprice * markup['value']) / 100;
                            //     markupvalue=percentVal;
                            //     Blockedprice += percentVal;

                            //     Blockedprice = parseFloat(Blockedprice.toFixed(2));
                            // }

                            roomListData.Price = {
                                Amount: Blockedprice,
                                Currency: BASE_CURRENCY,
                                Commission: ''
                            }

                            const rateConditionsArray = blockRoomResponse?.HotelResult[0]?.RateConditions ?? [];
                            const decodedRateConditionsArray = rateConditionsArray.map(rateCondition => decode(rateCondition));


                            // if (roomListData.Price.Currency == 'INR') {
                            //     roomListData.Price = await this.hotelDbService.formatPriceDetailToSelectedCurrencyForTbo({
                            //         Amount: blockRoomResponse.HotelResult[0].Rooms[0].TotalFare,
                            //         Currency: roomListData.Rooms[0].Price.Currency,
                            //         Commission: roomListData.Price.Currency
                            //     });
                            // }
                            // else {
                            //     roomListData.Price = {
                            //         Amount: blockRoomResponse.HotelResult[0].Rooms[0].TotalFare,
                            //         Currency: roomListData.Price.Currency,
                            //         Commission: roomListData.Price.Commission
                            //     }
                            // }


                            let roomDetails = [{
                                Price: roomListData?.Price ?? [],
                                BookingPrice: blockRoomResponse.HotelResult[0].Rooms[0]?.TotalFare,
                                Index: 0,
                                Id: blockRoomResponse.HotelResult[0].Rooms[0]?.BookingCode ?? '',
                                Description: blockRoomResponse.HotelResult[0].Rooms[0]?.Name[0] ?? '',
                                NonRefundable: blockRoomResponse.HotelResult[0].Rooms[0]?.IsRefundable ?? null,
                                MealPlanCode: blockRoomResponse.HotelResult[0].Rooms[0]?.MealType ?? '',
                                Inclusion: blockRoomResponse.HotelResult[0].Rooms[0]?.Inclusion ?? '',
                                roomAmenities: blockRoomResponse.HotelResult[0].Rooms[0]?.Amenities ?? '',
                                Occupancy: blockRoomResponse.HotelResult[0].Rooms[0]?.Occupacy ?? '',
                                cancellationPolicies: room?.CancellationPolicies ?? '',
                                RoomPromotion: room?.RoomPromotion ?? [],
                                RateConditions: decodedRateConditionsArray,
                                paxCount: room.paxCount,
                                AdultCount: totalAdultCount,
                                ChildrenCount: totalChildCount,
                                Rooms: roomListData.searchRequest?.NoOfRooms ?? '',
                                Supplements: room?.Supplements ?? []
                            }];


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
                                HotelAddress: roomListData?.HotelAddress ?? "",
                                HotelContactNo: roomListData?.HotelContactNo ?? "",
                                HotelMap: roomListData?.HotelMap ?? "",
                                Latitude: roomListData?.Latitude ?? "",
                                Longitude: roomListData?.Longitude ?? "",
                                Breakfast: roomListData?.Breakfast ?? "",
                                HotelLocation: roomListData?.SupplierPrice ?? null,
                                SupplierPrice: roomListData?.SupplierPrice ?? null,
                                RoomDetails: roomDetails,
                                OrginalHotelCode: roomListData?.OrginalHotelCode ?? "",
                                HotelPromotionContent: roomListData?.HotelPromotionContent ?? "",
                                PhoneNumber: roomListData?.PhoneNumber ?? "",
                                HotelAmenities: blockRoomResponse.HotelResult[0].Rooms[0]?.Amenities ?? [],
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
                                //   RateConditions: blockRoomResponse.HotelResult[0]?.RateConditions ?? '' ,
                                Source: "tboHotels",
                                searchRequest: roomListData?.searchRequest ?? {},
                                NoOfRooms: roomListData.searchRequest?.NoOfRooms ?? '',
                                RoomGuests: roomListData?.searchRequest.RoomGuests ?? [],
                                booking_source: body.booking_source,
                                ResultToken: roomListData.ResultToken
                            };

                            const token = this.redisServerService.geneateResultToken(body);
                            const dataFormatResponse = await this.redisServerService.insert_record(token, JSON.stringify(dataFormat));
                            delete dataFormat["BlockRoomId"];
                            delete dataFormat["ResultToken"];
                            dataFormat = {
                                ...dataFormat,
                                "ResultToken": dataFormatResponse["access_key"]
                            };

                            return dataFormat;
                        } else {
                            const errorClass: any = getExceptionClassByCode(`400 ${blockRoomResponse.Status.Description}`);
                            throw new errorClass(`400 ${blockRoomResponse.Status.Description}`);
                        }
                    } catch (error) {
                        const errorClass: any = getExceptionClassByCode(error.message);
                        throw new errorClass(error.message);
                    }
                }));

                return respData;
                // }
            }));
            let result = respDataArray[0][0]
            return result
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    generateRandomThreeDigits() {
        return Math.floor(100 + Math.random() * 900);
    }

    async BookHeader(booking, pax, room) {
        let groupedCustomerNames = {};
        let phone;

        // let RoomData = JSON.stringify(booking[0].attribute).replace(/"/g, "'")
        // console.log( RoomData, '==========================');

        let jsonString = booking[0]?.attributes?.replace(/'/g, '"');
        let RoomData = JSON.parse(jsonString);
        console.log(RoomData.RoomDetails[0].BookingPrice, '====================');


        pax.map((data) => {
            if (data.phone !== '' && data.phone !== undefined) {
                phone = data.phone;
            }

            let CustomerObj = {
                Title: data.title,
                FirstName: data.first_name,
                LastName: data.last_name,
                Type: data.pax_type
            };

            if (!groupedCustomerNames[data.address2]) {
                groupedCustomerNames[data.address2] = [];
            }
            groupedCustomerNames[data.address2].push(CustomerObj);
        });

        let formattedDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        let ClientReferenceId = `${formattedDate}${this.generateRandomThreeDigits()}`;
        let BookingReferenceId = `${formattedDate}${this.generateRandomThreeDigits()}`;

        let CustomerDetails = Object.keys(groupedCustomerNames).map(key => ({
            CustomerNames: groupedCustomerNames[key]
        }));


        let request = {
            BookingCode: room[0].room_id,
            CustomerDetails: CustomerDetails,
            ClientReferenceId: ClientReferenceId,
            BookingReferenceId: BookingReferenceId,
            TotalFare: RoomData.RoomDetails[0].BookingPrice,
            EmailId: booking[0].email,
            PhoneNumber: phone,
            BookingType: "Voucher",
            PaymentMode: "Limit"
        }

        return request;
    }

    async formatReservationRequest(booking: any, pax: any, room: any, body: any) {
        try {

            let formattedRequest = await this.BookHeader(booking, pax, room);
            const Url = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/Book`;


            let blockRoomResponse: any;
            try {
                blockRoomResponse = await this.httpService.post(Url, formattedRequest, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                        'x-username': TBOH_USERNAME,
                    }
                }).toPromise();

                try {
                    fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BookingREQ.json`, JSON.stringify(formattedRequest));
                    fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BookingRES.json`, JSON.stringify(blockRoomResponse));
                } catch (error) {
                    console.error(`Failed to write log files: ${error.message}`);
                }

            } catch (error) {
                throw new Error(`Failed to book room: ${error.message}`);
            }


            if (blockRoomResponse.Status.Code !== 200) {
                const errorClass: any = getExceptionClassByCode(`400 ${blockRoomResponse.Status.Description}`);
                throw new errorClass(`400 ${blockRoomResponse.Status.Description}`);
            }


            await this.delay(120 * 1000);


            let BookingDetails: any;
            try {
                let request = {
                    BookingReferenceId: formattedRequest.BookingReferenceId,
                    PaymentMode: `Limit`,
                };
                const givenUrl = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/BookingDetail`;

                BookingDetails = await this.httpService.post(givenUrl, request, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                        'x-username': TBOH_USERNAME,
                    }
                }).toPromise();


                try {
                    fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BookingDetailsREQ.json`, JSON.stringify(request));
                    fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BookingDetailsRES.json`, JSON.stringify(BookingDetails));
                } catch (error) {
                    console.error(`Failed to write log files: ${error.message}`);
                }

            } catch (error) {
                const errorClass: any = getExceptionClassByCode(`400 ${error}`);
                throw new errorClass(`400 ${error}`);
            }


            if (BookingDetails.Status.Code === 200) {
                BookingDetails.BookingDetail.booking_id = formattedRequest.BookingReferenceId;
                let BookedResponse = BookingDetails.BookingDetail;


                return this.HotelTboTransformService.updateData(BookedResponse, body, booking, pax, room);
            } else {
                const errorClass: any = getExceptionClassByCode(`400 ${BookingDetails.Status.Description}`);
                throw new errorClass(`400 ${BookingDetails.Status.Description}`);
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(`400 ${error}`);
            throw new errorClass(`400 ${error}`);
        }
    }


    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

            let getCityData = await this.manager.query(`Select confirmation_reference from  hotel_hotel_booking_details where app_reference= "${body.AppReference}" `);

            const givenUrl = `http://api.tbotechnology.in/TBOHolidays_HotelAPI/Cancel`;
            let CancelBooking: any = await this.httpService.post(givenUrl, {
                ConfirmationNumber: getCityData[0].confirmation_reference,
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'Authorization': 'Basic bXphaGlkdHJhdmVsdGVzdDpNemFAMTA2MTY3MDM=',
                    'x-username': TBOH_USERNAME,
                }
            }).toPromise();
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BookingCancellationRQ.json`, JSON.stringify({ ConfirmationNumber: getCityData[0].confirmation_reference, }));
                fs.writeFileSync(`${logStoragePath}/hotels/TboHotels/BookingCancellationRS.json`, JSON.stringify(CancelBooking));
            }
            console.log(CancelBooking.Status.Code, '=======');

            if (CancelBooking.Status.Code == 200) {
                console.log(CancelBooking);
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


