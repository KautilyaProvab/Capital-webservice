import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { RedisServerService } from "../../../shared/redis-server.service";
import { roomBasisCode } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { log } from "console";

@Injectable()
export class IRIXTransformService extends HotelApi {
    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: HotelDbService) {
        super();
    }
    async updateHotelBookingItineraryDetails(id, BookingStatus) {
        
        
        //total_fare:${TotalPrice}
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingItineraryDetail(
                        id: ${id}
                        hotelHotelBookingItineraryDetailPartial: {
                            status: "${BookingStatus}"
                            
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
                            status: "${body.BookingStatus}"
                            booking_id: "${body.booking_id}"
                            created_datetime: "${body.created_date}"
                            booking_reference: "${body.booking_reference}"
                            confirmation_reference: "${body.confirmation_reference}"
                        }
                    )
                } 
            `, 'updateHotelHotelBookingDetail');
            return result;
        }
        // return result;
    }

    async updateHotelBookingPaxDetails(id, BookingStatus) {
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingPaxDetail(
                        id: ${id}
                        hotelHotelBookingPaxDetailPartial: {
                            status: "${BookingStatus}"
                        }
                    )
                } 
            `, 'updateHotelHotelBookingPaxDetail');
        return result
    }

    async updateData(bookingDetails: any, body, booking, bookingPaxDetails, bookingItineraryDetails) {
        console.log("bookingDetails-",bookingDetails);
        body.TotalPrice = bookingDetails.totalSellingRate;
        body.Currency = bookingDetails.currency;
        let bookingDetailsBody = {};
        // if(booking[0].payment_mode == 'pay_later'){
        //     BookingStatus= 'BOOKING_HOLD';
        // }
        if (bookingDetails) {
            bookingDetailsBody['id'] = booking[0].id;
            bookingDetailsBody['booking_reference'] = bookingDetails.reference;
            bookingDetailsBody['confirmation_reference'] = bookingDetails.reference;
            bookingDetailsBody['booking_id'] = bookingDetails.reference;
            bookingDetailsBody['BookingStatus'] = bookingDetails.BookingStatus;
        }
        let createdDate = formatDate(Date.now());
        bookingDetailsBody['created_date'] = createdDate;
        const bookingDetailsResp = await this.updateHotelBookingDetails(bookingDetailsBody);
       
        let bookingItineraryResp;
        bookingItineraryDetails.forEach(async element => {
            bookingItineraryResp = await this.updateHotelBookingItineraryDetails(element.id,bookingDetails.BookingStatus);
        });
        let bookingPaxResp;
        bookingPaxDetails.forEach(async element => {

            bookingPaxResp = await this.updateHotelBookingPaxDetails(element.id, bookingDetails.BookingStatus);
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

    async getHotelSearchUniversalFormat(body: any, markup: any, result: any, srk: any, api_token: any) {
        const start3: any = new Date();
        let hotel_image = [];
        let hotel_amenities;
        let hotel_code = [];
        let currencyDetails = [];
        let conversionRate = 1;
        let checkInDate = new Date(body.CheckIn);
        let checkOutDate = new Date(body.CheckOut);
        const hotelLength = result.length;
        let hotelsData = [];
        let hotelCommission = 0;
    
        for (const element of result) {
            let hotelFacilities = [];
            let trip_rating = "";
            let HotelPrice = 0;
            let NoOfReviews = "";
            let hotelPhone = "N/A";
            let hotelAddress = "N/A";
            let Refundable = true;
            let ResultIndex = "";
            let HotelCode = "";
            let HotelName = "";
            let HotelCategory = "";
    
            const data = {
                HotelName: element.name,
                HotelCode: element.index,
                Price: {
                    Amount: element.minPrice.value,
                    Currency: element.minPrice.currency,
                    Commision: hotelCommission * conversionRate,
                    AdminMarkup: 0,
                    AgentMarkup: 0,
                },
                HotelAddress: hotelAddress,
                HotelContactNo: hotelPhone,
                HotelMap: null,
                Latitude: "",
                Longitude: "",
                Breakfast: "",
                HotelLocation: null,
                SupplierPrice: null,
                OrginalHotelCode: "",
                HotelPromotionContent: "",
                PhoneNumber: hotelPhone,
                HotelAmenities: hotelFacilities,
                Free_cancel_date: "",
                trip_adv_url: "",
                trip_rating: trip_rating,
                NoOfRoomsAvailableAtThisPrice: "",
                Refundable: Refundable,
                HotelCurrencyCode: "",
                NoOfReviews: NoOfReviews,
                ReviewScore: trip_rating,
                ReviewScoreWord: "",
                CheckIn: body.CheckIn,
                CheckOut: body.CheckOut,
                Source: "irix",
                searchRequest: body,
                HotelPicture: ""
            };
    
            let BackData = {};
            BackData['data'] = data;
            BackData['srk'] = srk;
            BackData['api_token'] = api_token;
            const token = this.redisServerService.geneateResultToken(body);
    
            const response = await this.redisServerService.insert_record(token, JSON.stringify(BackData));
            data["ResultIndex"] = response["access_key"];
            data["booking_source"] = body.booking_source;
    
            hotelsData.push(data);
        }
    
        return hotelsData;
    }
    
}