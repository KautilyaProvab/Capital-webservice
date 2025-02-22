import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { TourService } from './tour.service'

@Controller('tour')
export class TourController {

    constructor(
        private tourService: TourService
    ) { }

    @HttpCode(200)
    @Post('autoComplete')
    async autoComplete(@Body() body: any): Promise<[]> {
        return await this.tourService.autoComplete(body);
    }

    @HttpCode(200)
    @Post('countryList')
    async countryList(@Body() body: any): Promise<[]> {
        return await this.tourService.countryList(body);
    }

    @HttpCode(200)
    @Post('search')
    async search(@Body() body: any): Promise<[]> {
        return await this.tourService.search(body);
    }
    

    @HttpCode(200)
    @Post('currencies')
    async currencies(@Body() body: any): Promise<[]> {
        return await this.tourService.currencies(body);
    }

    @HttpCode(200)
    @Post('destinations')
    async destinations(@Body() body: any): Promise<[]> {
        return await this.tourService.destinations(body);
    }


    @HttpCode(200)
    @Post('tourTypes')
    async tourTypes(@Body() body: any): Promise<[]> {
        return await this.tourService.tourTypes(body);
    }
    
    @HttpCode(200)
    @Post('homePublishsearch')
    async homePublishsearch(@Body() body: any): Promise<[]> {
        return await this.tourService.homePublishsearch(body);
    }

    @HttpCode(200)
    @Post('tourDetail')
    async tourDetail(@Body() body: any): Promise<[]> {
        return await this.tourService.tourDetail(body);
    }

    @HttpCode(200)
    @Post('broucher')
    async broucher(@Body() body: any): Promise<[]> {
        return await this.tourService.broucher(body);
    }

        
    @HttpCode(200)
    @Post('departureDates')
    async departureDates(@Body() body: any): Promise<[]> {
        return await this.tourService.departureDates(body);
    }


    @HttpCode(200)
    @Post('tourValuation')
    async tourValuation(@Body() body: any): Promise<[]> {
        return await this.tourService.tourValuation(body);
    }

    @HttpCode(200)
    @Post('sendEnquiry')
    async sendEnquiry(@Body() body: any): Promise<[]> {
        return await this.tourService.sendEnquiry(body);
    }
    

    // @Get("getBannerImage/:imgpath")
    // getBannerImage(@Param("imgpath") image: any, @Res() res: any) {
    //     return res.sendFile(image, {
    //         root: "./uploads/tour/tour-banner-images/",
    //     });
    // }
    @HttpCode(200)
    @Post('addPaxDetails')
    async addpaxDetails(@Body() body: any): Promise<[]>{
        return await this.tourService.addPaxDetails(body);
    }
    @HttpCode(200)
    @Post('Voucher')
    async Voucher(@Body() body: any): Promise<[]>{
        return await this.tourService.Voucher(body);
    }
    @HttpCode(200)
    @Post('confirmBooking')
    async confirmBooking(@Body() body: any): Promise<[]>{
        return await this.tourService.confirmBooking(body);
    }

    @HttpCode(200)
    @Post('emailTourDetails')
    async emailTourDetails(@Body() body: any): Promise<[]>{
        return await this.tourService.emailTourDetails(body);
    }
}
