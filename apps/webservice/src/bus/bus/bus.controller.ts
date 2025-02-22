import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusService } from './bus.service';
import { CityListDao,CityListDto } from './swagger';
import { SearchBusDto , SearchBusDao,SeatLayoutBusDto , SeatLayoutBusDao} from './swagger';

@Controller('bus/bus')
export class BusController {

    constructor(
        private busService: BusService
    ) { }
    
    /* travelomatix API*/
    @HttpCode(200)
    @Post('cityList')
    async cityListBusTravelomatix(@Body() body:any): Promise<[]> {
     console.log(body);
        return await this.busService.cityListBusTravelomatix(body);
    }

    @HttpCode(200)
    @Post('searchBus')
    async searchBusTravelomatix(@Body() body:any): Promise<[]> {
         return await this.busService.searchBusTravelomatix(body);
    }

    @HttpCode(200)
    @Post('seatLayoutBus')
    async seatLayoutBusTravelomatix(@Body() body: any): Promise<[]> {
         return await this.busService.seatLayoutBusTravelomatix(body);
    }

    @HttpCode(200)
    @Post('seatBusInfo')
    async seatBusInfoTravelomatix(@Body() body: any): Promise<[]> {
         return await this.busService.seatBusInfoTravelomatix(body);
    }
    
    @HttpCode(200)
    @Post('addPaxDetails')
    async addPaxDetailsBusTravelomatix(@Body() body: any): Promise<[]> {
         return await this.busService.addPaxDetailsBusTravelomatix(body);
    }

    @HttpCode(200)
    @Post('holdSeatsBus')
    async holdSeatsBusTravelomatix(@Body() body: any) {
         return await this.busService.holdSeatsBusTravelomatix(body);
    }

    @HttpCode(200)
    @Post('BookSeats')
    async BookSeatsBusTravelomatix(@Body() body: any) {
         return await this.busService.BookSeatsBusTravelomatix(body);
    }

    @HttpCode(200)
    @Post('voucher')
    async VoucherBusTravelomatix(@Body() body: any) {
         return await this.busService.VoucherBusTravelomatix(body);
    }
}