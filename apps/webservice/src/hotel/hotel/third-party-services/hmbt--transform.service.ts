import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT ,ExchangeRate_1_GBP_to_USD, ExchangeRate_1_EUR_to_USD , BASE_CURRENCY } from "apps/webservice/src/constants";
import { RedisServerService } from "../../../shared/redis-server.service";
import { roomBasisCode } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";

@Injectable()
export class HmbtTransformService extends HotelApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: HotelDbService) {
        super();
    }

    async updateHotelBookingItineraryDetails(id, BookingStatus) { 

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
            console.log(body.TotalAmount  , '{body.TotalAmount{body.TotalAmount');
                   
           const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingDetail(
                        id: ${body.id}
                        hotelHotelBookingDetailPartial: {
                            status: "${body.BookingStatus}"
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
    
    async updateHotelBookingPaxDetails(id , BookingStatus) {

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
       
        
        // body.TotalPrice = bookingDetails.grandTotal[0].amount;
        // body.Currency =  bookingDetails.grandTotal[0].currencyCode;
        let bookingDetailsBody = {};     

        // let Conversion_Rate = 1;
        // let currencyDetails;

        // if ( bookingDetails.grandTotal[0].currencyCode && bookingDetails.grandTotal[0].currencyCode  !== BASE_CURRENCY) {
        //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(bookingDetails.grandTotal[0].currencyCode );
        //     Conversion_Rate = currencyDetails['value'] ?? 1;
        // }    
        // body.TotalPrice =  parseFloat( bookingDetails.grandTotal[0].amount ?? 0) / Conversion_Rate;  
        // if (booking[0].currency  != BASE_CURRENCY) {
        //     currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(booking[0].currency );
        //     Conversion_Rate = currencyDetails['value'] ?? 1;
        //     body.TotalPrice =  body.TotalPrice * Conversion_Rate; 
        // }

        let BookingStatus= 'BOOKING_CONFIRMED';
        if(booking[0].payment_mode == 'pay_later'){
            BookingStatus= 'BOOKING_HOLD';
        }
        
        if (bookingDetails) {
            bookingDetailsBody['id'] = booking[0].id;
            bookingDetailsBody['booking_reference'] = body.booking_reference; 
            bookingDetailsBody['booking_id'] = bookingDetails.reference;
            bookingDetailsBody['confirmation_reference'] =  bookingDetails.responseToken
            bookingDetailsBody['cancellation_policy'] = bookingDetails['hotels'][0]['cancellationPolicies']
            bookingDetailsBody['BookingStatus'] = BookingStatus;
            // bookingDetailsBody['TotalAmount'] =  body.TotalPrice
            // bookingDetailsBody['booking_id'] = bookingDetails.booking_id

        }                                             
        let createdDate = formatDate(Date.now());
        bookingDetailsBody['created_date'] = createdDate;
  
        const bookingDetailsResp = await this.updateHotelBookingDetails(bookingDetailsBody);
       console.log(`2222222222222222221111`);
       
        let bookingItineraryResp;
        bookingItineraryDetails.forEach(async element => {
            bookingItineraryResp = await this.updateHotelBookingItineraryDetails(element.id, BookingStatus);
        });
        let bookingPaxResp;
        bookingPaxDetails.forEach(async element => {
            bookingPaxResp = await this.updateHotelBookingPaxDetails(element.id  , BookingStatus);
        });

        const bookingDetailsByAppRef = await this.hotelDbService.getHotelBookingDetails(
            body
        );
        bookingDetailsByAppRef[0]['CancellationPolicy'] = bookingDetails['hotels'][0]['cancellationPolicies']
        const bookingPaxDetailsByAppRef = await this.hotelDbService.getHotelBookingPaxDetails(
            body
        );
        const bookingItineraryDetailsByAppRef = await this.hotelDbService.getHotelBookingItineraryDetails(
            body
        );
        const result = this.getHotelBookingPaxDetailsUniversal(body, bookingPaxDetailsByAppRef, bookingDetailsByAppRef[0], bookingItineraryDetailsByAppRef) ;
        return result;
        

    }

}