import { Injectable } from "@nestjs/common";
import { ViatorApiService } from "./third-party-services/viator-api.service";
import { SearchDto, SearchDao, DetailsDto, DetailsDao, AvailabilityDto, AvailabilityDao, BlockDto, BlockDao, BookDto, BookDao } from "./swagger";
import { ActivityDbService } from "./activity-db.service";
import { HotelBedsActivity } from "./third-party-services/hotelbedsActivity-api.service";
import { formatDate } from '../../app.helper';

@Injectable()
export class ActivityService {
  
    constructor(
        private viatorApiService: ViatorApiService,
        private activityDbService: ActivityDbService ,
        private HotelBedsActivity : HotelBedsActivity
    ) {}

    async getAutoComplete(body: any): Promise<any> {
        return await this.activityDbService.getDestinations(body);
    }

    async search(body: SearchDto): Promise<SearchDao[]> {
        // return await this.viatorApiService.search(body);
        return await  this.HotelBedsActivity.search(body)
    }

    async ProductDetailsSer(body: DetailsDto): Promise<DetailsDao[]> {
        // return this.viatorApiService.details(body);
        return await  this.HotelBedsActivity.ProductDetails(body)
    }
    
    async tripListSer(body: DetailsDto): Promise<DetailsDao[]> {
        // return this.viatorApiService.details(body);
        return await  this.HotelBedsActivity.tripList(body)
    }

    async availability(body: AvailabilityDto): Promise<AvailabilityDao[]> {
        return this.viatorApiService.availability(body);
    }

    async getRecentSearch(req: any, body: any) {
        return await this.activityDbService.getRecentSearch(req,body);
    }
    async addRecentSearch(req: any, body: any) {
        return await this.activityDbService.addRecentSearch(req,body);
    }

    async deleteRecentSearch(req: any, body: any) {
        return await this.activityDbService.deleteRecentSearch(req,body);
    }

    /*async block(body: BlockDto): Promise<BlockDao[]> {
        return this.viatorApiService.block(body);
    }

    async book(body: BookDto): Promise<BookDao[]> {
        return this.viatorApiService.book(body);
    }*/


        async BlockTripSer(body: any): Promise<SearchDao[]> {
            return await this.HotelBedsActivity.blockTrip(body)
        }
     
        async CountryCodeSer(): Promise<SearchDao[]> {
            return await this.HotelBedsActivity.getCountryCode()
        }

        async DestinationSer(body: any): Promise<SearchDao[]> {
            return await this.HotelBedsActivity.InsertDestination(body)
        }


        async CityListSer(body: any): Promise<SearchDao[]> {
            return await this.HotelBedsActivity.getDestByName(body)
        }

        async addPaxDetails(body: any): Promise<any[]> {      
            return await this.activityDbService.addPaxDetails(body);
        }

        async BookingConfrimSer(body: any): Promise<any[]> {
            if(body.payment_mode != undefined &&  body.payment_mode == "pay_later"){
                await this.activityDbService.payLaterCheck(body);   
              }
            const data = await this.HotelBedsActivity.ConfirmBooking(body)
            if (data) {
                this.activityDbService.emailActivityDetails(body)
            }
            return data;
        }

        async activityCancellationSer(body : any): Promise<any[]> {
            const data = await this.HotelBedsActivity.bookingCancellation(body)
            if (data) {
                this.activityDbService.emailActivityDetails(body)
            }
            return data;
        }

        async bookingConfirmed(body: any): Promise<any> {
            const result = await this.activityDbService.bookingConfirmed(body);
            return result;
        }

        async sendEmail(body: any): Promise<any> {
            return await this.activityDbService.emailActivityDetails(body);
        }

          async unpaidBookings(body: any) {
            let today = new Date();
            let currentDate = formatDate(today);
           const hotelbedsActivityBooking = await this.activityDbService.getPayLaterUnpaidActivityBookings('BOOKING_HOLD', currentDate)
            
            return hotelbedsActivityBooking
            
          }
   
}
