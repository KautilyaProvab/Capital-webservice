import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service';

@Controller('common/bookings')
export class BookingsController {

    constructor(private bookingService: BookingsService) { }

    @Post('bookingCounts')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    async bookingCounts(@Req() req: any): Promise<any> {
        return await this.bookingService.getBookingCounts(req);
    }

    @Post('upcomingBookings')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    async upcomingBookings(@Req() req: any): Promise<any> {
        return await this.bookingService.getUpcomingBookings(req);
    }

    @Post('completedCancelledBookings')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    async completedCancelledBookings(@Req() req: any): Promise<any> {
        return await this.bookingService.getCompletedCancelledBookings(req);
    }

    @Post('getHotelBookingDetails')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    async getHotelBookingDetails(@Req() req: any): Promise<any> {
        return await this.bookingService.getHotelBookingDetails(req);
    }

    @Post('getFlightBookingDetails')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    async getFlightBookingDetails(@Req() req: any): Promise<any> {
        return await this.bookingService.getFlightBookingDetails(req);
    }

    @Post('searchByBookindId')
    @HttpCode(200)
    @UseGuards(AuthGuard('jwt'))
    async searchByBookingId(@Req() req: any, @Body() body: any): Promise<any> {
        return await this.bookingService.searchByBookingId(req, body);
    }


}
