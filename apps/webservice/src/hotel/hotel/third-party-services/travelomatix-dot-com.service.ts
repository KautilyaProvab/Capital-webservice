import { Body, HttpService, Injectable } from "@nestjs/common";
import { HotelDbService } from "../hotel-db.service";
import { HotelApi } from "../../hotel.api";
import { Url, logStoragePath, TMX_HOTEL_BOOKING_SOURCE, META_TL_HOTEL_COURSE } from "apps/webservice/src/constants";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { RedisServerService } from "../../../shared/redis-server.service"
import * as moment from "moment";

export const TMX_USER_NAME = "test245274";
export const TMX_PASSWORD =  "test@245";
export const TMX_URL = "http://test.services.travelomatix.com";
export const TMX_SYSTEM = "test";
export const TMX_DOMAINKEY = "TMX3372451534825527";

// export const TMX_USER_NAME = "test22926789";
// export const TMX_PASSWORD = "test@229";
// export const TMX_URL = "http://test.services.travelomatix.com";
// export const TMX_SYSTEM = "test";
// export const TMX_DOMAINKEY = "TMX1512291534825461";

@Injectable()
export class  TravelomatixDotComService extends HotelApi {

    apiCred: any;
    apiCredCached: boolean = false;

    constructor(
        private httpService: HttpService,
        private hotelDbService: HotelDbService,
        private redisServerService: RedisServerService
    ) {
        super();
    }

    async search(body: any): Promise<any> {
        try {
           
            const givenUrl = `${Url}Search`;
            const result: any = await this.httpService.post(givenUrl, {
                CheckInDate: moment(body.CheckIn).format('DD-MM-YYYY'),
                NoOfNights: moment(body.CheckOut).diff(moment(body.CheckIn), 'days'),
                CountryCode: body.Market,
                CityId: 6743,
                GuestNationality: body.Market,
                NoOfRooms: body.NoOfRooms,
                RoomGuests: body.RoomGuests
            }, {
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
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/SearchRQ.json`, JSON.stringify(body));
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/SearchRS.json`, JSON.stringify(result));
            }
            if (result.Status) {
              
                
                const hotelResults = result.Search.HotelSearchResult.HotelResults
                const dataFormat: any[] = [];
                const markup: any = {};
            
                hotelResults.map((x: any) => {
                    const data = {
                        Code: x.HotelCode,
                        hotelName: x.HotelName,
                        stars: x.StarRating ? x.StarRating : 0,
                        price: { ...x.Price, Amount: x.Price.PublishedPrice, Currency: x.Price.CurrencyCode, Commission: x.Price.AgentCommission },
                        description: x.HotelDescription ? x.HotelDescription : "",
                        hotelPolicy: x.HotelPolicy ? x.HotelPolicy : "",
                        hotelCategory: x.HotelCategory ? x.HotelCategory : "",
                        hotelPromotion: x.HotelPromotion ? x.HotelPromotion : "",
                        images: x.HotelPicture ? [x.HotelPicture] : "",
                        contactNo: x.HotelContactNo ? x.HotelContactNo : "",
                        hotelAddress: x.HotelAddress,
                        latitude: x.Latitude ? x.Latitude : "",
                        longitude: x.Longitude ? x.Longitude : "",
                        breakfast: x.Breakfast ? x.Breakfast : "",
                        roomDetails: x.RoomDetails,
                        amenities: x.HotelAmenities,
                        checkIn: body.CheckIn ? body.CheckIn : "",
                        checkOut: body.CheckOut ? body.CheckOut : "",
                        originalHotelCode: x.OrginalHotelCode ? x.OrginalHotelCode : "",
                        amenties: x.HotelAmenities ? [x.HotelAmenities] : "",
                        Free_cancel_date: x.Free_cancel_date ? x.Free_cancel_date : "",
                        trip_adv_url: x.trip_adv_url ? x.trip_adv_url : "",
                        trip_rating: x.trip_rating ? x.trip_rating : "",
                        hotelLocation: x.HotelLocation ? x.HotelLocation : "",
                        hotelMap: x.HotelMap ? x.HotelMap : "",
                        supplierPrice: x.SupplierPrice ? x.SupplierPrice : "",
                        //hotel_currency_code: x.HotelCurrencyCode ? x.HotelCurrencyCode : "",
                        // review_nr: x.NoOfReviews ? x.NoOfReviews : "",
                        //// review_score: x.ReviewScore ? x.ReviewScore : "",
                        // review_score_word: x.ReviewScoreWord ? x.ReviewScoreWord : "",
                        // source: x.Source ? x.Source : "",
                        // deal_tagging: x.DealTagging ? x.DealTagging : "",
                    };
                    const y = this.getSearchResultUniversal(data, markup);
                    delete y["Source"]
                    const temp = {
                        ...y,
                        searchRequest: body,
                        booking_source: body.booking_source,
                        ResultToken: x["ResultToken"]
                    }

                    dataFormat.push(temp);
                })

                const token = this.redisServerService.geneateResultToken(body);
                const resultData = Promise.all(
                    dataFormat.map(async (x) => {
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
                        delete x["ResultToken"];
                        return {
                            ...x,
                            ResultIndex: response["access_key"],
                        }

                    })
                )
                if ((await resultData).length > 0) {
                    return resultData;
                }
                else {
                    return [];
                }
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

    async getHotelDetails(body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken)
                data = JSON.parse(data[0]);
                let token = data["ResultToken"]

                const givenUrl1 = `${Url}HotelDetails`;
                let hotelDetails: any = await this.httpService.post(givenUrl1, {
                    ResultToken: token
                }, {
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
                    fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/HotelDetailsRQ.json`, JSON.stringify(body));
                    fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/HotelDetailsRS.json`, JSON.stringify(hotelDetails));
                }
                const givenUrl2 = `${Url}RoomList`;
                let roomList: any = await this.httpService.post(givenUrl2, {
                    ResultToken: token
                }, {
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
                    fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/RoomListRQ.json`, JSON.stringify(body));
                    fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/RoomListRS.json`, JSON.stringify(roomList));
                }

                if (hotelDetails.Status && roomList.Status) {
                    hotelDetails = hotelDetails.HotelDetails.HotelInfoResult.HotelDetails;
                    roomList = roomList.RoomList.GetHotelRoomResult.HotelRoomsDetails;
                    let dataFormat = {
                        ResultIndex: "",
                        HotelCode: hotelDetails.HotelCode ? hotelDetails.HotelCode : "",
                        HotelName: hotelDetails.HotelName ? hotelDetails.HotelName : "",
                        HotelCategory: data.HotelCategory ? data.HotelCategory : "",
                        HotelURL: hotelDetails.HotelURL ? hotelDetails.HotelURL : null,
                        HotelDescription: hotelDetails.Description ? hotelDetails.Description.replace(/\^/g, "'") : "",
                        HotelPromotion: data.HotelPromotion ? data.HotelPromotion : "",
                        HotelPolicy: hotelDetails.HotelPolicy ? hotelDetails.HotelPolicy : null,
                        Price: data.Price ? data.Price : "",
                        Email: hotelDetails.Email ? hotelDetails.Email : null,
                        RoomFacilities: hotelDetails.RoomFacilities ? hotelDetails.RoomFacilities : null,
                        Services: hotelDetails.Services ? hotelDetails.Services : null,
                        HotelPicture: hotelDetails.Images ? hotelDetails.Images : [],
                        HotelAddress: hotelDetails.Address ? hotelDetails.Address : "",
                        HotelContactNo: hotelDetails.HotelContactNo ? hotelDetails.HotelContactNo : "",
                        HotelMap: data.HotelMap ? data.HotelMap : null,
                        Latitude: hotelDetails.Latitude ? hotelDetails.Latitude : "",
                        Longitude: hotelDetails.Longitude ? hotelDetails.Longitude : "",
                        Breakfast: data.Breakfast ? data.Breakfast : "",
                        HotelLocation: data.HotelLocation ? data.HotelLocation : null,
                        OrginalHotelCode: data.OrginalHotelCode ? data.OrginalHotelCode : "",
                        HotelPromotionContent: data.HotelPromotionContent ? data.HotelPromotionContent : "",
                        PhoneNumber: "",
                        HotelAmenities: hotelDetails.HotelFacilities ? hotelDetails.HotelFacilities : "",
                        Free_cancel_date: data.Free_cancel_date ? data.Free_cancel_date : "",
                        trip_adv_url: hotelDetails.trip_adv_url ? hotelDetails.trip_adv_url : "",
                        trip_rating: hotelDetails.trip_rating ? hotelDetails.trip_rating : "",
                        NoOfRoomsAvailableAtThisPrice: "",
                        Refundable: data.Refundable ? data.Refundable : "",
                        HotelCurrencyCode: data.Price.Currency ? data.Price.Currency : "",
                        NoOfReviews: data.NoOfReviews ? data.NoOfReviews : "",
                        ReviewScore: data.ReviewScore ? data.ReviewScore : "",
                        ReviewScoreWord: data.ReviewScoreWord ? data.ReviewScoreWord : "",
                        CheckIn: hotelDetails.checkin ? hotelDetails.checkin : "",
                        CheckOut: hotelDetails.checkout ? hotelDetails.checkout : "",
                        FaxNumber: hotelDetails.FaxNumber ? hotelDetails.FaxNumber : "",
                        CountryName: hotelDetails.CountryName ? hotelDetails.CountryName : "",
                        PinCode: hotelDetails.PinCode ? hotelDetails.PinCode : "",
                        SpecialInstructions: hotelDetails.SpecialInstructions ? hotelDetails.SpecialInstructions : "",
                        booking_source: body.booking_source,
                        SearchRequest: data.searchRequest,
                        StarRating: data.StarRating ? data.StarRating : "",
                        SupplierPrice: data.SupplierPrice ? data.SupplierPrice : null,
                        Source: "Travelomatix",
                    }
                    const roomDetails = [];
                    for (const obj of roomList) {
                        let roomData = {
                            AgencyToken: obj.AgencyToken ? obj.AgencyToken : "",
                            Price: data.Price ? data.Price : "",
                            Rooms: [{
                                RoomTypeCode: obj.RoomTypeCode ? obj.RoomTypeCode : "",
                                Description: obj.RoomTypeName ? obj.RoomTypeName : "",
                                Price: obj.Price ? { ...obj.Price, Amount: obj.Price.PublishedPriceRoundedOff, Currency: obj.Price.CurrencyCode, Commission: obj.Price.AgentCommission } : "",
                                MealPlanCode: obj.room_only ? obj.room_only : "",
                                CancelPenalties: obj.CancellationPolicies.map((x:any) => {
                                    return x ? x.ChargeType === 1 ?
                                    { ...x, "NonRefundable": false, "CancelPenalty": x.FromDate, "ToDate": x.ToDate.replace(/\t/g, '') }
                                    : { ...x, "NonRefundable": true, "CancelPenalty": x.FromDate, "ToDate": x.ToDate.replace(/\t/g, '') }
                                    : 0;}),
                                SmokingPreference: obj.SmokingPreference ? obj.SmokingPreference : "",
                                RatePlanCode: obj.RatePlanCode ? obj.RatePlanCode : "",
                                rate_key: obj.rate_key ? obj.rate_key : "",
                                group_code: obj.group_code ? obj.group_code : "",
                                room_code: obj.room_code ? obj.room_code : "",
                                HOTEL_CODE: obj.HOTEL_CODE ? obj.HOTEL_CODE : "",
                                SEARCH_ID: obj.SEARCH_ID ? obj.SEARCH_ID : "",
                            }],
                            CancelPolicy: obj.CancellationPolicy ? obj.CancellationPolicy : "",
                            ResultIndex: "",
                            RoomUniqueId: obj.RoomUniqueId ? obj.RoomUniqueId : "",
                        }
                        const token = this.redisServerService.geneateResultToken(body);
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(roomData));
                        delete roomData["RoomUniqueId"];
                        roomDetails.push({
                            ...roomData,
                            ResultIndex: response["access_key"]
                        });
                    }

                    dataFormat["RoomDetails"] = roomDetails;
                    dataFormat = {
                        ...dataFormat,
                        "ResultIndex": body.ResultToken
                    }
                    return dataFormat;
                }
                else {
                    const errorClass: any = getExceptionClassByCode(`400 ${hotelDetails.Message}`);
                    throw new errorClass(`400 ${hotelDetails.Message}`);
                }
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ResultToken not found!!`);
                throw new errorClass(`400 ResultToken not found!!`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getRoomList(body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken)
                data = JSON.parse(data[0]);
                let token = data["ResultToken"]
                const givenUrl = `${Url}RoomList`;
                let roomList: any = await this.httpService.post(givenUrl, {
                    ResultToken: token
                }, {
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
                    fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/RoomListRQ.json`, JSON.stringify(body));
                    fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/RoomListRS.json`, JSON.stringify(roomList));
                }

                if (roomList.Status) {
                    roomList = roomList.RoomList.GetHotelRoomResult.HotelRoomsDetails;
                    const roomDetails = [];
                    for (const obj of roomList) {
                        let roomData = {
                            AgencyToken: obj.AgencyToken ? obj.AgencyToken : "",
                            Price: data.Price ? data.Price : "",
                            Rooms: [{
                                RoomTypeCode: obj.RoomTypeCode ? obj.RoomTypeCode : "",
                                Description: obj.RoomTypeName ? obj.RoomTypeName : "",
                                Price: obj.Price ? { ...obj.Price, Amount: obj.Price.PublishedPriceRoundedOff, Currency: obj.Price.CurrencyCode, Commission: obj.Price.AgentCommission } : "",
                                MealPlanCode: obj.room_only ? obj.room_only : "",
                                CancelPenalties: obj.CancellationPolicies.map(x => {
                                    return x.CancellationPolicies ? x.ChargeType == 1 ? { ...x, "NonRefundable": false, "CancelPenalty": x.FromDate } : { ...x, "NonRefundable": true, "CancelPenalty": x.FromDate } : ""
                                }),
                                SmokingPreference: obj.SmokingPreference ? obj.SmokingPreference : "",
                                RatePlanCode: obj.RatePlanCode ? obj.RatePlanCode : "",
                                rate_key: obj.rate_key ? obj.rate_key : "",
                                group_code: obj.group_code ? obj.group_code : "",
                                room_code: obj.room_code ? obj.room_code : "",
                                HOTEL_CODE: obj.HOTEL_CODE ? obj.HOTEL_CODE : "",
                                SEARCH_ID: obj.SEARCH_ID ? obj.SEARCH_ID : "",
                            }],
                            CancellPolicy: obj.CancellationPolicy ? obj.CancellationPolicy : "",
                            ResultIndex: "",
                            RoomUniqueId: obj.RoomUniqueId ? obj.RoomUniqueId : "",
                        }
                        const token = this.redisServerService.geneateResultToken(body);
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(roomData));
                        delete roomData["RoomUniqueId"];
                        roomDetails.push({
                            ...roomData,
                            ResultIndex: response["access_key"]
                        });
                    }
                    return roomDetails;
                    // let data = await this.redisServerService.read_list(body.ResultToken)
                    // data = JSON.parse(data[0]);
                    // return data;
                }
                else {
                    const errorClass: any = getExceptionClassByCode(`400 ${roomList.Message}`);
                    throw new errorClass(`400 ${roomList.Message}`);
                }
            } else {
                const errorClass: any = getExceptionClassByCode(`400 ResultToken not found!!`);
                throw new errorClass(`400 ResultToken not found!!`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async hotelsValuation(body: any): Promise<any> {
        try {
            let roomData = await this.redisServerService.read_list(body.RoomResultToken)
            roomData = JSON.parse(roomData[0]);
            let hotelDetails = await this.redisServerService.read_list(body.ResultToken)
            hotelDetails = JSON.parse(hotelDetails);
            const givenUrl = `${Url}BlockRoom`;
            let blockRoomResponse: any = await this.httpService.post(givenUrl, {
                ResultToken: hotelDetails.ResultToken,
                RoomUniqueId: [roomData.RoomUniqueId]
            }, {
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
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/BlockRoomRQ.json`, JSON.stringify(body));
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/BlockRoomRS.json`, JSON.stringify(blockRoomResponse));
            }
            const blockRoom = blockRoomResponse.BlockRoom.BlockRoomResult.HotelRoomsDetails[0];
            if (blockRoom) {
                let dataFormat = {
                    ResultIndex: "",
                    HotelCode: hotelDetails.HotelCode ? hotelDetails.HotelCode : "",
                    HotelName: hotelDetails.HotelName ? hotelDetails.HotelName : "",
                    HotelCategory: hotelDetails.HotelCategory ? hotelDetails.HotelCategory : "",
                    StarRating: hotelDetails.StarRating ? hotelDetails.StarRating : "",
                    HotelDescription: hotelDetails.HotelDescription ? hotelDetails.HotelDescription.replace(/\^/g, "'") : "",
                    HotelPromotion: hotelDetails.HotelPromotion ? hotelDetails.HotelPromotion : "",
                    HotelPolicy: hotelDetails.HotelPolicy ? hotelDetails.HotelPolicy : "",
                    Price: blockRoom.Price ? { ...blockRoom.Price, Amount: blockRoom.Price.PublishedPriceRoundedOff, Currency: blockRoom.Price.CurrencyCode, Commission: blockRoom.Price.AgentCommission } : "",
                    HotelPicture: hotelDetails.HotelPicture ? hotelDetails.HotelPicture : [],
                    HotelAddress: hotelDetails.HotelAddress ? hotelDetails.HotelAddress : "",
                    HotelContactNo: hotelDetails.HotelContactNo ? hotelDetails.HotelContactNo : "",
                    HotelMap: null,
                    Latitude: hotelDetails.Latitude ? hotelDetails.Latitude : "",
                    Longitude: hotelDetails.Longitude ? hotelDetails.Longitude : "",
                    Breakfast: hotelDetails.Breakfast ? hotelDetails.Breakfast : "",
                    HotelLocation: hotelDetails.SupplierPrice ? hotelDetails.SupplierPrice : null,
                    SupplierPrice: hotelDetails.SupplierPrice ? hotelDetails.SupplierPrice : null,
                    RoomDetails: roomData,
                    OrginalHotelCode: hotelDetails.OrginalHotelCode ? hotelDetails.OrginalHotelCode : "",
                    HotelPromotionContent: hotelDetails.HotelPromotionContent ? hotelDetails.HotelPromotionContent : "",
                    PhoneNumber: hotelDetails.PhoneNumber ? hotelDetails.PhoneNumber : "",
                    HotelAmenities: blockRoom.Amenities ? blockRoom.Amenities : "",
                    Free_cancel_date: hotelDetails.Free_cancel_date ? hotelDetails.Free_cancel_date : "",
                    trip_adv_url: hotelDetails.trip_adv_url ? hotelDetails.trip_adv_url : "",
                    trip_rating: hotelDetails.trip_rating ? hotelDetails.trip_rating : "",
                    NoOfRoomsAvailableAtThisPrice: hotelDetails.NoOfRoomsAvailableAtThisPrice ? hotelDetails.NoOfRoomsAvailableAtThisPrice : "",
                    Refundable: hotelDetails.Refundable ? hotelDetails.Refundable : "",
                    HotelCurrencyCode: hotelDetails.Price.Currency ? hotelDetails.Price.Currency : "",
                    NoOfReviews: hotelDetails.NoOfReviews ? hotelDetails.NoOfReviews : "",
                    ReviewScore: hotelDetails.ReviewScore ? hotelDetails.ReviewScore : "",
                    ReviewScoreWord: hotelDetails.ReviewScoreWord ? hotelDetails.ReviewScoreWord : "",
                    CheckIn: hotelDetails.CheckIn ? hotelDetails.CheckIn : "",
                    CheckOut: hotelDetails.CheckOut ? hotelDetails.CheckOut : "",
                    Source: "Travelomatix",
                    AgencyToken: blockRoom.AgencyToken ? blockRoom.AgencyToken : "",
                    Offers: blockRoom.Offers ? blockRoom.Offers : [],
                    Fees: null,
                    CancelPenalties: {
                        CancelPenalty: roomData.Rooms[0].CancelPenalties.CancelPenalty ? roomData.Rooms[0].CancelPenalties.CancelPenalty : "",
                    },
                    Remarks: blockRoom.Remarks ? blockRoom.Remarks : "",
                    booking_source: body.booking_source,
                    BlockRoomId: blockRoomResponse.BlockRoom.BlockRoomResult.BlockRoomId ? blockRoomResponse.BlockRoom.BlockRoomResult.BlockRoomId : "",
                    searchRequest: hotelDetails.searchRequest,
                    ResultToken: hotelDetails.ResultToken
                }
                const token = this.redisServerService.geneateResultToken(body);
                const dataFormatResponse = await this.redisServerService.insert_record(token, JSON.stringify(dataFormat));
                delete dataFormat["BlockRoomId"];
                delete dataFormat["ResultToken"];
                dataFormat = {
                    ...dataFormat,
                    "ResultIndex": dataFormatResponse["access_key"]
                }
                return dataFormat;
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ${blockRoomResponse.Message}`);
                throw new errorClass(`400 ${blockRoomResponse.Message}`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async hotelsReservation(body: any): Promise<any> {
        try {
            let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
            const formattedJson = JSON.parse(bookingDetails[0].attributes.replace(/'/g, '"'));
            const givenUrl = `${Url}CommitBooking`;
            let commiBooking: any = await this.httpService.post(givenUrl, {
                ResultToken: formattedJson.ResultToken,
                BlockRoomId: formattedJson.BlockRoomId,
                AppReference: body.AppReference,
                RoomDetails: formattedJson.RoomDetails
            }, {
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
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/${body["AppReference"]}-hotelsReservationRQ.json`, JSON.stringify(body));
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/${body["AppReference"]}-hotelsReservationRS.json`, JSON.stringify(commiBooking));
            }
            if (commiBooking.Status) {
                let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
                let paxDetails = await this.hotelDbService.getHotelBookingPaxDetails(body);
                let itineraryDetails = await this.hotelDbService.getHotelBookingItineraryDetails(body);

                let updateBookingData = { created_date: moment().format('YYYY-MM-DD HH:mm:ss'), id: bookingDetails[0].id, booking_id: commiBooking.CommitBooking.BookingDetails.BookingId }
                let updateBookingDetails = await this.hotelDbService.updateHotelBookingDetails(updateBookingData);
                paxDetails.map(async (paxData: any) => {
                    let updatePaxDetails = await this.hotelDbService.updateHotelBookingPaxDetails(paxData.id)
                })
                let updateItineraryDetails = await this.hotelDbService.updateHotelBookingItineraryDetails(itineraryDetails[0].id, itineraryDetails[0].total_fare)
                let result = await this.hotelDbService.bookingConfirmed(body);
                return result;
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ${commiBooking.Message}`);
                throw new errorClass(`400 ${commiBooking.Message}`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async hotelsCancellation(body: any): Promise<any> {
        try {
            const givenUrl = `${Url}CancelBooking`;
            let CancelBooking: any = await this.httpService.post(givenUrl, {
                AppReference: body.AppReference,
            }, {
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
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/${body["AppReference"]}-CancelBookingnRQ.json`, JSON.stringify(body));
                fs.writeFileSync(`${logStoragePath}/hotels/Travelomatix/${body["AppReference"]}-CancelBookingRS.json`, JSON.stringify(CancelBooking));
            }
            if (CancelBooking.Status) {
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