import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransferService } from './transfer.service';
import { TransferDbService } from './transfer-db.service';

@Controller('transfer')
export class TransferController {

    constructor(
        private transferService: TransferService,
        private transferDbService: TransferDbService,
    ) { }

    // @HttpCode(200)
    // @Post('autoComplete')
    // async autoComplete(@Body() body: AutoCompleteDto): Promise<AutoCompleteDao[]> {
    //     return await this.transferService.autoComplete(body);
    // }

    @HttpCode(200)
    @Post('availability')
    async Availability(@Body() body: any): Promise<any[]> {
        return await this.transferService.Availability(body);
    }
    
    @HttpCode(200)
    @Post('productDetails')
    async ProductDetails(@Body() body: any): Promise<any[]> {
        return await this.transferService.ProductDetails(body);
    }

    @HttpCode(200)
    @Post('tripList')
    async TripList(@Body() body: any): Promise<any[]> {
        return await this.transferService.TripList(body);
    }

    @HttpCode(200)
    @Post('blocktrip')
    async Blocktrip(@Body() body: any): Promise<any[]> {
        return await this.transferService.Blocktrip(body);
    }

    @HttpCode(200)
    @Post('addPax')
    async addPax(@Body() body: any): Promise<any[]> {
        return await this.transferService.addPax(body);
    }

    @HttpCode(200)
    @Post('confirmBooking')
    async ConfirmBooking(@Body() body: any): Promise<any[]> {
        const data = await this.transferService.ConfirmBooking(body);
        if (data) {
            this.transferDbService.emailTransferDetails(body)
        }
        return data;
    }

    @HttpCode(200)
    @Post('cancelBooking')
    async CancelBooking(@Body() body: any): Promise<any[]> {
        const data = await this.transferService.CancelBooking(body);
        if (data) {
            this.transferDbService.emailTransferDetails(body)
        }
        return data;
    }

    @HttpCode(200)
    @Post('getLocations')
    async getLocations(@Body() body: any): Promise<any[]> {
        return await this.transferService.getLocations(body);
    }

    @HttpCode(200)
    @Post('getRoutes')
    async getRoutes(@Body() body: any): Promise<any[]> {
        return await this.transferService.getRoutes(body);
    }

    @HttpCode(200)
    @Post('cityList')
    async CityList(@Body() body: any): Promise<any[]> {
        return await this.transferService.CityList(body);
    }

    @HttpCode(200)
    @Post('voucher')
    async Voucher(@Body() body: any): Promise<any[]> {
        return await this.transferService.Voucher(body);
    }
    
    @HttpCode(201)
    @Post('categories')
    async Categories(@Body() body: any): Promise<any[]> {
        return await this.transferService.Categories(body);
    }

    @HttpCode(201)
    @Post('transferTypes')
    async TransferTypes(@Body() body: any): Promise<any[]> {
        return await this.transferService.TransferTypes(body);
    }

    @HttpCode(201)
    @Post('vehicles')
    async Vehicles(@Body() body: any): Promise<any[]> {
        return await this.transferService.Vehicles(body);
    }

    @HttpCode(201)
    @Post('currencies')
    async Currencies(@Body() body: any): Promise<any[]> {
        return await this.transferService.Currencies(body);
    }

    @HttpCode(201)
    @Post('pickups')
    async Pickups(@Body() body: any): Promise<any[]> {
        return await this.transferService.Pickups(body);
    }

    @HttpCode(201)
    @Post('countries')
    async Countries(@Body() body: any): Promise<any[]> {
        return await this.transferService.Countries(body);
    }

    @HttpCode(201)
    @Post('destinations')
    async Destinations(@Body() body: any): Promise<any[]> {
        return await this.transferService.Destinations(body);
    }
    
    @HttpCode(201)
    @Post('hotels')
    async Hotels(@Body() body: any): Promise<any[]> {
        return await this.transferService.Hotels(body);
    }

    @HttpCode(201)
    @Post('terminals')
    async Terminals(@Body() body: any): Promise<any[]> {
        return await this.transferService.Terminals(body);
    }

    @HttpCode(201)
    @Post('routes')
    async Routes(@Body() body: any): Promise<any[]> {
        return await this.transferService.Routes(body);
    }

    @HttpCode(200)
    @Post('transferEmail')
    async transferEmail(@Body() body: any): Promise<any> {
        return await this.transferDbService.emailTransferDetails(body);
    }


    @Post('automaticCancellation')
    @HttpCode(200)
    async automaticCancellation(@Req() req: any): Promise<any> {
        const unpaidPayLaterBooking= await this.transferService.unpaidBookings(req);

        if(unpaidPayLaterBooking && unpaidPayLaterBooking[0]){
    
            for (let index = 0; index < unpaidPayLaterBooking.length; index++) {
              const booking = unpaidPayLaterBooking[index];
              const cancelRequest = {
                "AppReference": booking.app_reference,
                "BookingSource": booking.Api_id
            }
              const cancelBooking = await this.CancelBooking(cancelRequest)
            }
            
          }
    }
}
