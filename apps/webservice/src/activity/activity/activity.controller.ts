import { Controller, HttpCode, Body, Post, UseGuards, Req ,Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivityService } from './activity.service';
import { SearchDto, SearchDao, DetailsDto, DetailsDao, AvailabilityDto, AvailabilityDao, BlockDto, BlockDao, BookDto, BookDao } from './swagger';

@Controller('activity')
export class ActivityController {

    constructor(private activityService: ActivityService) { }

    @HttpCode(200)
    @Post('autoComplete')
    async autoComplete(@Body() body: any): Promise<any[]> {
        return this.activityService.getAutoComplete(body);
    }

    @HttpCode(200)
    @Post('search')
    async search(@Body() body: SearchDto): Promise<SearchDao[]> {   
        return this.activityService.search(body);
    }

    

    @HttpCode(200)
    @Post('productDetails')
    async details(@Body() body: DetailsDto): Promise<DetailsDao[]> {
        return this.activityService.ProductDetailsSer(body);
    }

    @HttpCode(200)
    @Post('tripList')
    async tripList(@Body() body: DetailsDto): Promise<DetailsDao[]> {
        return this.activityService.tripListSer(body);
    }

    @HttpCode(200)
    @Post('availability')
    async availability(@Body() body: AvailabilityDto): Promise<AvailabilityDao[]> {
        return this.activityService.availability(body);
    }


    @HttpCode(200)
    @Post('addRecentSearch')
    @UseGuards(AuthGuard('jwt'))
    async addRecentSearch(@Req() req: any, @Body() body: any): Promise<any> {
        return await this.activityService.addRecentSearch(req, body);
    }

    @HttpCode(200)
    @Post('getRecentSearch')
    @UseGuards(AuthGuard('jwt'))
    async getRecentSearch(@Req() req: any, @Body() body: any) {
        return await this.activityService.getRecentSearch(req, body);
    }

    @HttpCode(200)
    @Post('deleteRecentSearch')
    @UseGuards(AuthGuard('jwt'))
    async deleteRecentSearch(@Req() req: any, @Body() body: any) {
        return await this.activityService.deleteRecentSearch(req, body);
    }
    /*@HttpCode(200)
    async block(@Body() body: BlockDto): Promise<BlockDao[]> {
        return this.activityService.block(body);
    }

    @HttpCode(200)
    async book(@Body() body: BookDto): Promise<BookDao[]> {
        return this.activityService.book(body);
    }*/


    @HttpCode(200)
    @Get('getCountryCode')
    async getCountryCode(): Promise<DetailsDao[]> {
        return this.activityService.CountryCodeSer()
    }

    @HttpCode(200)
    @Post('destination')
    async DestinationStore(@Body() body: any): Promise<DetailsDao[]> {
        return this.activityService.DestinationSer(body)
    }

    @HttpCode(200)
    @Post('cityList')
    async cityList(@Body() body: any): Promise<DetailsDao[]> {
        return this.activityService.CityListSer(body)
    }

    @HttpCode(200)
    @Post('blocktrip')
    async blockTrip(@Body() body: any): Promise<DetailsDao[]> {
        return this.activityService.BlockTripSer(body)
    }

    @HttpCode(200)
    @Post('confirmBooking')
    async BookingActivity(@Body() body: any): Promise<DetailsDao[]> {
        return this.activityService.BookingConfrimSer(body)
    }

    @HttpCode(200)
    @Post('addPax')
    async cityListl(@Body() body: any): Promise<DetailsDao[]> {
        return this.activityService.addPaxDetails(body)
    }

    @HttpCode(200)
    @Post('cancel')
    async actvityBookingCancellation(@Body() body: any): Promise<DetailsDao[]> {
        return this.activityService.activityCancellationSer(body)
    }


    @Post('voucher')
    async bookingConfirmed(@Body() body: any): Promise<any[]> {
        return await this.activityService.bookingConfirmed(body);
    }

    @Post("activityEmail")
    async activityEmail(@Body() body: any): Promise<any> {
        return await this.activityService.sendEmail(body);
    }

    @Post('automaticCancellation')
    @HttpCode(200)
    async automaticCancellation(@Req() req: any): Promise<any> {
        const unpaidPayLaterBooking = await this.activityService.unpaidBookings(req);
        if(unpaidPayLaterBooking && unpaidPayLaterBooking[0]){
    
            for (let index = 0; index < unpaidPayLaterBooking.length; index++) {
              const booking = unpaidPayLaterBooking[index];
              const cancelRequest = {
                "AppReference": booking.app_reference
            }
              const cancelBooking = await this.actvityBookingCancellation(cancelRequest)
            }
            
          }
    }
}
