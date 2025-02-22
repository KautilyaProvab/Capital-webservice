import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT } from "apps/webservice/src/constants";
import moment from "moment";
import { RedisServerService } from "../../../shared/redis-server.service";
import { roomBasisCode } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";

@Injectable()
export class GoGlobalTransformService extends HotelApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: HotelDbService) {
        super();
    }

    async updateHotelBookingItineraryDetails(id, body) {
        console.log("reservation " , body , id)
        let TotalPrice
        if(body.Currency==="USD"){
            TotalPrice = ( body.TotalPrice * ExchangeRate_1_USD_to_BDT).toFixed(2)
        }
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingItineraryDetail(
                        id: ${id}
                        hotelHotelBookingItineraryDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                            total_fare:${TotalPrice}
                        }
                    )
                } 
            `, 'updateHotelHotelBookingItineraryDetail');
        return result
    }
    async updateHotelBookingDetails(body) {
        // let result: any;
        if (body) {
            const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingDetail(
                        id: ${body.id}
                        hotelHotelBookingDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                            booking_id: "${body.booking_id}"
                            created_datetime: "${body.created_date}"
                            booking_reference: "${body.booking_reference}"
                        }
                    )
                } 
            `, 'updateHotelHotelBookingDetail');
            return result;
        }
        // return result;
    }

    async updateHotelBookingPaxDetails(id) {
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingPaxDetail(
                        id: ${id}
                        hotelHotelBookingPaxDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                        }
                    )
                } 
            `, 'updateHotelHotelBookingPaxDetail');
        return result
    }

    async updateData(bookingDetails: any, body, booking, bookingPaxDetails, bookingItineraryDetails) {
        body.TotalPrice = bookingDetails.TotalPrice['$t'];
        body.Currency = bookingDetails.Currency['$t'];
        let bookingDetailsBody = {};
        if (bookingDetails) {
            bookingDetailsBody['id'] = booking[0].id;
            bookingDetailsBody['booking_reference'] = bookingDetails.GoReference['$t'];
            bookingDetailsBody['booking_id'] = bookingDetails.GoBookingCode['$t'];
        }
        let createdDate = formatDate(Date.now());
        bookingDetailsBody['created_date'] = createdDate;
        const bookingDetailsResp = await this.updateHotelBookingDetails(bookingDetailsBody);
        let bookingItineraryResp;
        bookingItineraryDetails.forEach(async element => {
            bookingItineraryResp = await this.updateHotelBookingItineraryDetails(element.id, body);
        });
        let bookingPaxResp;
        bookingPaxDetails.forEach(async element => {

            bookingPaxResp = await this.updateHotelBookingPaxDetails(element.id);
        });
        // if (bookingDetailsResp) {
        const bookingDetailsByAppRef = await this.hotelDbService.getHotelBookingDetails(
            body
        );
        const bookingPaxDetailsByAppRef = await this.hotelDbService.getHotelBookingPaxDetails(
            body
        );
        const bookingItineraryDetailsByAppRef = await this.hotelDbService.getHotelBookingItineraryDetails(
            body
        );
        const result = this.getHotelBookingPaxDetailsUniversal(body, bookingPaxDetailsByAppRef, bookingDetailsByAppRef[0], bookingItineraryDetailsByAppRef);
        return result;
        // }

    }

    async getHotelSearchUniversalFormat(body: any, markup: any, result: any) {
        let hotel_image = [];
        let hotel_amenities;
        hotel_image.push(result.HotelImage);
        if (result.hotelInfo['Pictures']) {
            for (let ele in result.hotelInfo['Pictures']['Picture']) {
                hotel_image.push(result.hotelInfo['Pictures']['Picture'][ele]['$t']);
            };
        }
        if (result.hotelInfo['HotelFacilities'] && result.hotelInfo['HotelFacilities'] != undefined && Object.keys(result.hotelInfo['HotelFacilities']).length != 0) {
            if (result.hotelInfo['HotelFacilities']['$t'].includes(",")) {
                hotel_amenities = result.hotelInfo['HotelFacilities']['$t'].split(", ");
            } else if (result.hotelInfo['HotelFacilities']['$t'].includes("<BR />")) {
                hotel_amenities = result.hotelInfo['HotelFacilities']['$t'].split("<BR />");
            }
        }
        // console.log(body['RoomGuests']); return;    
        result.Offers.forEach((element) => {
            element['Rooms'].forEach((ele, i) => {
                let room = {
                    RoomName: ele,
                    Occupancy: body['RoomGuests'][i].NoOfAdults + body['RoomGuests'][i].NoOfChild
                }
                element['Rooms'].push(room);
            });
            for (var i = 0; i < element['Rooms'].length; i++) {
                if (typeof element['Rooms'][i] == 'string') {
                    element['Rooms'].splice(i, 1);
                    i--;
                }
            }
        });
        result.Offers.forEach((element, index) => {
            if (element.Currency === "USD")
                element.TotalPrice = (element.TotalPrice * ExchangeRate_1_USD_to_BDT).toFixed(2)
            element.Currency = "BDT"
        });

        const data = {
            ResultIndex: "",
            HotelCode: result.HotelCode,
            HotelName: result.HotelName,
            HotelCategory: "",
            StarRating: result.hotelInfo['TripAdvisor'] != undefined ? result.hotelInfo['TripAdvisor']['Rating']['$t'] : "",
            HotelDescription: result.hotelInfo['Description'] ? result.hotelInfo['Description']['$t'] : '',
            HotelPromotion: "",
            HotelPolicy: "",
            Price: {
                "Amount": result.Offers[0].TotalPrice,
                "Currency": result.Offers[0].Currency,
                "Commission": 0
            },
            HotelPicture: hotel_image,
            HotelAddress: result.hotelInfo['Address'] ? result.hotelInfo['Address']['$t'] : 'N/A',
            HotelContactNo: result.hotelInfo['Phone'] ? result.hotelInfo['Phone']['$t'] : 'N/A',
            HotelMap: null,
            Latitude: result.Latitude ? result.Latitude : result.hotelInfo['GeoCodes'] ? result.hotelInfo['GeoCodes']['Latitude']['$t'] : '',
            Longitude: result.Longitude ? result.Longitude : result.hotelInfo['GeoCodes'] ? result.hotelInfo['GeoCodes']['Longitude']['$t'] : '',
            Breakfast: "",
            HotelLocation: null,
            SupplierPrice: null,
            RoomDetails: result.Offers,
            OrginalHotelCode: "",
            HotelPromotionContent: "",
            PhoneNumber: "",
            HotelAmenities: hotel_amenities ? hotel_amenities : [],
            Free_cancel_date: "",
            trip_adv_url: "",
            trip_rating: "",
            NoOfRoomsAvailableAtThisPrice: "",
            Refundable: result.Offers[0].NonRef == true ? false : true,
            HotelCurrencyCode: result.Offers[0].Currency,
            NoOfReviews: result.hotelInfo['TripAdvisor'] != undefined ? result.hotelInfo['TripAdvisor']['ReviewCount']['$t'] : "",
            ReviewScore: "",
            ReviewScoreWord: "",
            CheckIn: body.CheckIn,
            CheckOut: body.CheckOut,
            Source: "goglobal",
            searchRequest: body
        }
        // if (markup && markup.markup_currency == data['Price']['Currency']) {
        //     if (markup.value_type == 'percentage') {
        //         let percentVal = (data['Price']['Amount'] * markup['value']) / 100;
        //         data['Price']['Amount'] += percentVal;
        //         data['Price']['Amount'] = parseFloat(data['Price']['Amount'].toFixed(2));
        //     } else if (markup.value_type == 'plus') {
        //         result['price']['Amount'] += markup['value'];
        //         result.roomDetails.forEach(room => {
        //             room['Rooms'].forEach(element => {
        //                 element['Price']['Amount'] += markup['value'];
        //             });
        //             room['Price']['Amount'] += markup['value'];
        //         });
        //     }
        // }
        const token = this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(data));
        data["ResultIndex"] = response["access_key"];
        data["booking_source"] = body.booking_source
        return data;
    }

    async getHotelDetailsUniversalFormat(body: any, result: any) {
        let rooms = []
        result['Rooms'].forEach((element, i) => {
            let room = {};
            room["Price"] = []
            room['Id'] = result['HotelSearchCode']
            room['Description'] = element['RoomName'];
            room['NonRefundable'] = result['NonRef'];
            const priceBreakDown = result['Rooms'].length == 1 ? result.priceInfo['Room']['PriceBreakdown'] : result.priceInfo['Room'][i]['PriceBreakdown'];
            let price = 0;
            if (Array.isArray(priceBreakDown)) {
                priceBreakDown.map(item => {
                    console.log("qwertyu" ,item)
                    let floatValue = parseFloat(item.Price['$t']);
                    price = floatValue;
                    if (item.Currency['$t'] === "USD") {
                        price = ExchangeRate_1_USD_to_BDT * price
                        item.Currency['$t'] = "BDT"
                    }
                    room['Price'].push({
                        FromDate:item.FromDate['$t'],
                        ToDate:item.ToDate['$t'],
                        Currency: item.Currency['$t'],
                        Amount: Number(price.toFixed(2))
                    })
                })
            } else {
                let floatValue = parseFloat(priceBreakDown.Price['$t']);
                price = floatValue;
                if (priceBreakDown.Currency['$t'] === "USD") {
                    price = ExchangeRate_1_USD_to_BDT * price
                    priceBreakDown.Currency['$t'] = "BDT"
                }
                room['Price'].push({
                    FromDate:priceBreakDown.FromDate['$t'],
                    ToDate:priceBreakDown.ToDate['$t'],
                    Currency: priceBreakDown.Currency['$t'],
                    Amount: Number(price.toFixed(2))
                })
            }

            room['MealPlanCode'] = roomBasisCode[result['RoomBasis']];
            room['Occupancy'] = element['Occupancy'];
            rooms.push(room);
        });
        if (result['Currency'] === "USD") {
            result['TotalPrice'] = ExchangeRate_1_USD_to_BDT * result['TotalPrice']
            result['Currecy'] = " BDT"
        }
        let roomDetail = {
            AgencyToken: result['HotelSearchCode'],
            Rooms: rooms,
            Price: {
                Currency: result['Currency'],
                Amount: result['TotalPrice'],
                Commission: 0
            },
            CancelPolicy: {
                NonRefundable: result['NonRef'],
                CancelPenalty: result['CxlDeadLine']
            }
        };
        const token = this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(roomDetail));
        roomDetail["ResultIndex"] = response["access_key"];
        
        return roomDetail;
    }
    async updateCancelledData(response, AppReference) {
        //Make updates
    }
}