import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT ,ExchangeRate_1_GBP_to_USD, ExchangeRate_1_EUR_to_USD } from "apps/webservice/src/constants";
import { RedisServerService } from "../../../shared/redis-server.service";
import { roomBasisCode } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";

@Injectable()
export class HotelDotwTransformService extends HotelApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: HotelDbService) {
        super();
    }

    async updateHotelBookingItineraryDetails(id, body) {
      
        let TotalPrice
        if(body.Currency==="GBP"){     
            TotalPrice = ( body.TotalPrice * ExchangeRate_1_GBP_to_USD).toFixed(2)
        }
        //total_fare:${TotalPrice}
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingItineraryDetail(
                        id: ${id}
                        hotelHotelBookingItineraryDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                            
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
                            confirmation_reference : "${body.confirmation_reference}"
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
        body.TotalPrice = bookingItineraryDetails[0].total_fare;
        body.Currency = bookingItineraryDetails[0].currency; 
        let bookingDetailsBody = {}; 

        // let jsonString = booking?.attributes?.replace(/'/g, '"');
        // let RoomData = JSON.parse(jsonString);

        // RoomData.confirmationText = bookingDetails?.result?.confirmationText?.['$t']  ?? ''
        // RoomData.voucher = bookingData?.voucher['$t'] ?? ''
        // RoomData.paymentGuaranteedBy = bookingData?.paymentGuaranteedBy['$t'] ?? ''
        // let RoomDataStringfy = JSON.stringify(RoomData)
    
        if (bookingDetails) {
            bookingDetailsBody['id'] = booking.id;
            bookingDetailsBody['booking_reference'] = body.booking_reference; 
            // bookingDetailsBody['booking_id'] = bookingDetails.booking_reference;
            bookingDetailsBody['confirmation_reference'] = `[${bookingDetails.bookingReferenceNumber}]`
            bookingDetailsBody['booking_id'] = `[${bookingDetails.bookingCode}]`
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
        

    }

}