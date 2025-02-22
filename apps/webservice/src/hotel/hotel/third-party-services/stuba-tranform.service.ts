import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT ,ExchangeRate_1_GBP_to_USD, ExchangeRate_1_EUR_to_USD } from "apps/webservice/src/constants";
import { RedisServerService } from "../../../shared/redis-server.service";
import { roomBasisCode } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import * as moment from 'moment';

@Injectable()
export class HotelStubaTransformService extends HotelApi {

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
                            confirmation_reference: "${body.confirmation_reference}"
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

        let bookingDetailsBody = {};

        let BookingStatus= 'BOOKING_CONFIRMED';
        if(booking[0].payment_mode == 'pay_later'){
            BookingStatus= 'BOOKING_HOLD';
        }
         
        if (bookingDetails) {

            bookingDetailsBody['id'] = booking.id;
            bookingDetailsBody['booking_reference'] = body?.booking_reference ?? ''; 
            bookingDetailsBody['booking_id'] = bookingDetails['Id']['$t'];
            bookingDetailsBody['confirmation_reference'] = bookingDetails['Id']['$t'];
            bookingDetailsBody['BookingStatus'] = BookingStatus;
        }                                             
        let createdDate = formatDate(Date.now());
        bookingDetailsBody['created_date'] = createdDate;
     
        const bookingDetailsResp = await this.updateHotelBookingDetails(bookingDetailsBody);
        let bookingItineraryResp;
        bookingItineraryDetails.forEach(async element => {     
            bookingItineraryResp = await this.updateHotelBookingItineraryDetails(element.id, BookingStatus);
        });
        let bookingPaxResp;
        bookingPaxDetails.forEach(async element => {
            bookingPaxResp = await this.updateHotelBookingPaxDetails(element.id, BookingStatus);
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

    async updateHotelCancelDetails(bookingDetails, requestData ,cancel) {
        // console.log(cancel['HotelBooking']['Room']['Messages']['Message'], '=============');
        
        // let cancellation_policy = cancel['HotelBooking']['Room']['Messages']['Message']
        let bookingDetailsBody = {};
        bookingDetailsBody['id'] = bookingDetails.id;
        bookingDetailsBody['reason'] = requestData.Reason;
        // bookingDetailsBody['cancellation_policy'] = cancellation_policy
        let cancelledDate = moment.utc(Date.now()).format('YYYY-MM-DD HH:mm:ss');
        bookingDetailsBody['cancelled_date'] = cancelledDate;
        const bookingPaxDetails = await this.hotelDbService.getHotelBookingPaxDetails(requestData);
        const bookingItineraryDetails = await this.hotelDbService.getHotelBookingItineraryDetails(requestData);
      
        const bookingDetailsResp = await this.hotelDbService.updateCancelledHotelBookingDetails(bookingDetailsBody);
        
        let bookingItineraryResp;
        bookingItineraryDetails.forEach(async element => {
            
            bookingItineraryResp = await this.hotelDbService.updateCancelledHotelBookingItineraryDetails(element.id);
        });
  
        let bookingPaxResp;
        bookingPaxDetails.forEach(async element => {
            bookingPaxResp = await this.hotelDbService.updateCancelledHotelBookingPaxDetails(element.id);
        });
        if (bookingDetailsResp) {
            const bookingDetailsByAppRef = await this.hotelDbService.getHotelBookingDetails(
                requestData
            );
            const bookingPaxDetailsByAppRef = await this.hotelDbService.getHotelBookingPaxDetails(
                requestData
            );
            const bookingItineraryDetailsByAppRef = await this.hotelDbService.getHotelBookingItineraryDetails(
                requestData
            );

            const result = this.hotelDbService.getHotelBookingPaxDetailsUniversal('', bookingPaxDetailsByAppRef, bookingDetailsByAppRef[0], bookingItineraryDetailsByAppRef);
            return result;
        }
    }

} 