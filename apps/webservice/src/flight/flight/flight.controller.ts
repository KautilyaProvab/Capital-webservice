import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FlightService } from './flight.service';
import { diskStorage } from "multer";
import { editFileName, imageFileFilter } from '../../app.helper';

import { AutocompleteDto, CommintBookingDto, SearchDto } from './swagger';
import { ListFlightTopDestinationsDto } from './swagger/flight-top-destinations.dto';
import { flightDocumentsPath } from '../../constants';

@Controller('flight')
export class FlightController {

    constructor(private flightService: FlightService) { }

    @Post('CurrencyConversionRate')
    async CurrencyConversionRate(@Body() body: any) {
        return await this.flightService.CurrencyConversionRate(body);
        /*return {
            result: {
                CurrencyConversionRate: {
                    USDUSD: 1,
                    USDAED: 3.673,
                    USDAUD: 1.423133,
                    USDSAR: 3.751049,
                    USDRUB: 78.147,
                    USDJPY: 105.591,
                    USDINR: 73.6995,
                    USDGBP: 0.76,
                    USDHKD: 7.75,
                    USDPHP: 48.44,
                    USDTHB: 30.21,
                    USDIDR: 14173.60,
                    USDVND: 23176.71,
                    USDCNY: 6.62,
                    USDEUR: 0.85,
                    USDRUB: 77.07,
                    USDKRW: 1113.12
                }
            },
            message: ''
        }*/
    }

    @Post('autocomplete')
    async autocomplete(@Body() body: /*AutocompleteDto*/ any): Promise<any> {
        return await this.flightService.autocomplete(body);
    }

    @Post('preferredAirlines')
    async preferredAirlines(@Body() body: any): Promise<any> {
        return await this.flightService.preferredAirlines(body);
    }

    @Post('flightType')
    async flightType(@Body() body: any): Promise<any> {
        return await this.flightService.flightType(body);
    }

    @Post('cabinClassList')
    async cabinClassList(@Body() body: any): Promise<any> {
        return await this.flightService.cabinClassList(body);
    }

    @Post('search')
    async search(@Body() body: /*SearchDto*/ any): Promise<any> {
        if (body.SearchMode != undefined) {
            if (body.SearchMode == 'mobile') {
                return await this.flightService.search_mobile(body);
            }
        } else if (body.booking_source == 'ZBAPINO00011') {
            return await this.flightService.test_search(body);
        }else if (body.JourneyType == 'Return' && body.booking_source == 'ZBAPINO00010') {
            let india_airport_list = ['AGR', 'AGX', 'AJL', 'AKD', 'AMD', 'ATQ', 'BBI', 'BDQ', 'BEK', 'BEP', 'BHJ', 'BHO', 'BHU', 'BKB', 'BLR', 'BOM', 'BUP', 'CD', 'CCJ', 'CCU', 'CDP', 'CJB', 'CNN', 'COH', 'COK', 'DAE', 'DAI', 'DBD', 'DED', 'DEL', 'DEP', 'DHM', 'DIB', 'DIU', 'DMU', 'GAU', 'GAY', 'GOI', 'GOP', 'GUX', 'GWL', 'HBX', 'HDD', 'HJR', 'HSS', 'HYD', 'IDR', 'IMF', 'ISK', 'IXA', 'IXB', 'IXC', 'IXD', 'IXE', 'IXG', 'IXH', 'IXI', 'IXJ', 'IXK', 'IXL', 'IXM', 'IXN', 'IXP', 'IXQ', 'IXR', 'IXS', 'IXT', 'IXU', 'IXV', 'IXW', 'IY', 'IXZ', 'JAI', 'JDH', 'JGA', 'JGB', 'JLR', 'JRH', 'JSA', 'KCZ', 'KLH', 'KNU', 'KTU', 'KUU', 'LDA', 'LKO', 'LUH', 'MAA', 'MOH', 'MYQ', 'MZA', 'MZU', 'NAG', 'NDC', 'NMB', 'NVY', 'OMN', 'PAB', 'PAT', 'PBD', 'PGH', 'PNQ', 'PNY', 'PUT', 'PYB', 'RA', 'REW', 'RGH', 'RJA', 'RJI', 'RMD', 'RPR', 'RRK', 'RTC', 'RUP', 'SHL', 'SLV', 'SSE', 'STV', 'SXR', 'SXV', 'TCR', 'TEI', 'EZ', 'TIR', 'TJV', 'TNI', 'TRV', 'TRZ', 'UDR', 'VGA', 'VNS', 'VTZ', 'WGC', 'ZER', 'CNN', 'JRG', 'GBI'];
            if (india_airport_list.includes(body.Segments[0]['Origin']) && india_airport_list.includes(body.Segments[0]['Destination'])) {
                return await this.flightService.search_roundtrip(body);
            } else {
                return await this.flightService.search(body);
            }
        } else {
            return await this.flightService.search(body);
        }
    }

    @Post('sendItinerary')
    async sendItenary(@Body() body: any): Promise<any> {
        return await this.flightService.sendItinerary(body);
    }

    @Post('fareQuote')
    async fareQuote(@Body() body: any): Promise<any> {
        return await this.flightService.fareQuote(body);
    }

    @Post('extraServices')
    async extraServices(@Body() body: any): Promise<any> {
        return await this.flightService.extraServices(body);
    }

    @Post('commitBooking')
    async commitBooking(@Body() body: /*CommintBookingDto*/ any): Promise<any> {
        return await this.flightService.commitBooking(body);
    }

    @Post('reservation')
    async reservation(@Body() body: any): Promise<any> {
        return await this.flightService.reservation(body);
    }



    @Post('cancellation')
    async cancellation(@Body() body: any): Promise<any> {
        return await this.flightService.cancellation(body);
    }

    @Post('void')
    async void(@Body() body: any): Promise<any> {
        return await this.flightService.void(body);
    }

    @Post('voucher')
    async voucher(@Body() body: any): Promise<any> {
        return await this.flightService.voucher(body);
    }

    @Post('reservationResponse')
    async redirectedReservationResponse(@Body() body: any): Promise<any> {
        return await this.flightService.redirectedReservationResponse(body);
    }

    @Post('ticketingRequest')
    async ticketingRequest(@Body() body: any): Promise<any> {
        return await this.flightService.ticketingRequest(body);
    }

    @Post('pnrRetrieve')
    async pnrRetrieve(@Body() body: any): Promise<any> {
        return await this.flightService.pnrRetrieve(body);
    }

    @Post('fareRule')
    async fareRule(@Body() body: any): Promise<any> {
        return await this.flightService.fareRule(body);
    }


    @Post('importPNR')
    async importPNR(@Body() body: any): Promise<any> {
        return await this.flightService.importPNR(body);
    }

    @Post("listFlightTopDestination")
    async listFlightTopDestination(@Body() body: ListFlightTopDestinationsDto): Promise<any> {

        return this.flightService.listFlightTopDestination(body);
    }

    @Post("flightEmail")
    async flightEmail(@Body() body: ListFlightTopDestinationsDto): Promise<any> {
        return this.flightService.flightEmail(body);
    }

    @Post("updatePassengerDetails")
    async updatePassengerDetails(@Body() body: any): Promise<any> {

        return this.flightService.updatePassengerDetails(body);
    }

    @HttpCode(200)
    @Post('addRecentSearch')
    @UseGuards(AuthGuard('jwt'))
    async addRecentSearch(@Req() req: any, @Body() body: any): Promise<any> {
        return await this.flightService.addRecentSearch(req, body);
    }

    @HttpCode(200)
    @Post('getRecentSearch')
    @UseGuards(AuthGuard('jwt'))
    async getRecentSearch(@Req() req: any, @Body() body: any) {
        return await this.flightService.getRecentSearch(req, body);
    }
    @HttpCode(200)
    @Post('deleteRecentSearch')
    @UseGuards(AuthGuard('jwt'))
    async deleteRecentSearch(@Req() req: any, @Body() body: any) {
        return await this.flightService.deleteRecentSearch(req, body);
    }


    @Post('documentUpload')
    @UseInterceptors(
        FilesInterceptor("image", 20, {
            storage: diskStorage({
                destination: flightDocumentsPath,
                filename: editFileName,
            }),
            fileFilter: imageFileFilter,
        })
    )
    async documenUpload(@Body() body: any, @UploadedFiles() files): Promise<any> {
        return await this.flightService.documentUpload(body, files);
    }

    @Post("flightDocuments/:imgpath")
    @UseGuards(AuthGuard("jwt"))
    seeUploadedFile(@Param("imgpath") image, @Res() res) {
        return res.sendFile(image, {
            root: flightDocumentsPath,
        });
    }

    @Post('seatAvailability')
    async seatAvailability(@Body() body: any): Promise<any> {
        return await this.flightService.seatAvailability(body);
    }

}
