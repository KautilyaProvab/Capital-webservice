import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { HotelService } from "./hotel.service";
import {
  ApplyPromocodeDao,
  ApplyPromocodeDto,
  CityListDao,
  CityListDto,
  CountryListDao,
  CountryListDto,
  FiveStarHotelsDao,
  FiveStarHotelsDto,
  GuestLoginDao,
  GuestLoginDto,
  HotelAttractionsDao,
  HotelAttractionsDto,
  HotelBookingVoucherDao,
  HotelBookingVoucherDto,
  HotelDealsDao,
  HotelDealsDto,
  HotelTopDestinationsAdminDto,
  NearByHotelsDao,
  NearByHotelsDto,
  PaymentSubmitDao,
  PaymentSubmitDto,
  PreBookingDao,
  PreBookingDto,
  SearchHotelDao,
  SearchHotelDto,
  SendMeDealsDao,
  SendMeDealsDto,
  StateListDao,
  StateListDto,
  TopHotelDestinationsDao,
  TopHotelDestinationsDto,
} from "./swagger";
import { Request } from 'express';
import { HotelDbService } from "./hotel-db.service";

@Controller("hotel/hotel")
export class HotelController {
  constructor(
        private hotelService: HotelService,
        private hotelDbService: HotelDbService,
    ) {}

  // @HttpCode(200)
  // @Post('autoComplete')
  // async autoComplete(@Body() body: AutoCompleteDto): Promise<AutoCompleteDao[]> {
  //     return await this.hotelService.autoComplete(body);
  // }

  @Get('getHello')
  getHello(@Req() req: Request): string {
    const clientIp = req['clientIp']; // Access the IP address added by middleware
    return `Client IP is ${clientIp}`;
  }

  // Travelomatix APIs
  @HttpCode(200)
  @Post("searchHotels")
  async searchHotelTravelomatix(@Body() body: any): Promise<[]> {
    return await this.hotelService.hotelsAvailability(body);
  }

  @HttpCode(200)
  @Post("InsertHotels")
  async CreateHotelHummingBird(@Body() body: any): Promise<[]> {
    return await this.hotelService.searchAvailableHotels(body);
  }

  @HttpCode(200)
  @Post("InsertCity")
  async InsertCity(@Body() body: any): Promise<[]> {
    return await this.hotelService.InsertCityData(body);
  }

  

  @HttpCode(200)
  @Post("hotelDetails")
  async hotelDetailsTravelomatix(@Body() body: any): Promise<[]> {
    return await this.hotelService.hotelDetails(body);
  }

  @HttpCode(200)
  @Post("roomList")
  async roomListTravelomatix(@Body() body: any): Promise<[]> {
    return await this.hotelService.roomListTravelomatix(body);
  }

  @HttpCode(200)
  @Post("blockRooms")
  async blockRoomsTravelomatix(@Body() body: any): Promise<any> {
    return await this.hotelService.hotelsValuation(body);
  }

  @HttpCode(200)
  @Post("reservation")
  async commitBookingTravelomatix(@Body() body: any): Promise<[]> {
    const data = await this.hotelService.hotelsReservation(body);
    if (data) {
      await this.hotelDbService.emailHotelDetails(body)
    }
    return data;
  }

  @HttpCode(200)
  @Post("cancellation")
  async cancelBookingTravelomatix(@Body() body: any): Promise<[]> {
    const data = await this.hotelService.hotelsCancellation(body);
    if (data) {
      await this.hotelDbService.emailHotelDetails(body)
    }
    return data;
  }

  /* need to work */
  @HttpCode(200)
  @Post("addRecentSearch")
  @UseGuards(AuthGuard("jwt"))
  async addRecentSearch(@Req() req: any, @Body() body: any): Promise<any> {
    return await this.hotelService.addRecentSearch(req, body);
  }

  @HttpCode(200)
  @Post("getRecentSearch")
  @UseGuards(AuthGuard("jwt"))
  async getRecentSearch(@Req() req: any, @Body() body: any) {
    return await this.hotelService.getRecentSearch(req, body);
  }

  @HttpCode(200)
  @Post("getRecentSearchOfWeek")
  async getRecentSearchByDate(@Req() req: any, @Body() body: any) {
    return await this.hotelService.getRecentSearchOfWeek(req, body);
  }

  @HttpCode(200)
  @Post("deleteRecentSearch")
  @UseGuards(AuthGuard("jwt"))
  async deleteRecentSearch(@Req() req: any, @Body() body: any) {
    return await this.hotelService.deleteRecentSearch(req, body);
  }

  /* need to work */
  @Post("sendMeDeals")
  async sendMeDeals(@Body() body: SendMeDealsDto): Promise<SendMeDealsDao[]> {
    return await this.hotelService.sendMeDeals(body);
  }

  // @HttpCode(200)
  // @Post('hotelDetails')
  // async hotelDetails(@Body() body: HotelDetailsDto): Promise<HotelDetailsDao[]> {
  //     return await this.hotelService.getHotelDetails(body);
  // }

  /* need to work */
  @Post("hotelAttractions")
  async hotelAttractions(
    @Body() body: HotelAttractionsDto
  ): Promise<HotelAttractionsDao[]> {
    return await this.hotelService.hotelAttractions(body);
  }

  /* need to work */
  @Post("guestLogin")
  async guestLogin(@Body() body: GuestLoginDto): Promise<GuestLoginDao[]> {
    return await this.hotelService.guestLogin(body);
  }

  @HttpCode(200)
  @Post("countryList")
  async countryList(@Body() body: CountryListDto): Promise<CountryListDao[]> {
    return await this.hotelService.countryList(body);
  }

  @HttpCode(200)
  @Post("stateList")
  async stateList(@Body() body: StateListDto): Promise<StateListDao[]> {
    return await this.hotelService.stateList(body);
  }

  @HttpCode(200)
  @Post("cityList")
  async cityList(@Body() body: CityListDto): Promise<CityListDao[]> {
    return await this.hotelService.cityList(body);
  }

  @HttpCode(200)
  @Post("addHotelBookingDetails")
  async addHotelBookingDetails(@Body() body: any): Promise<any[]> {
    return await this.hotelService.addBookingDetails(body);
  }

  @HttpCode(200)
  @Post("addHotelBookingPaxDetails")
  async addHotelBookingPaxDetails(@Body() body: any): Promise<any[]> {
    return await this.hotelService.addBookingPaxDetails(body);
  }

  @HttpCode(200)
  @Post("addHotelBookingItineraryDetails")
  async addHotelBookingItineraryDetails(@Body() body: any): Promise<any[]> {
    return await this.hotelService.addBookingItineraryDetails(body);
  }

  /* need to work */
  @Post("applyPromocode")
  async applyPromocode(
    @Body() body: ApplyPromocodeDto
  ): Promise<ApplyPromocodeDao[]> {
    return await this.hotelService.applyPromocode(body);
  }

  /* need to work */
  @Post("preBooking")
  async preBooking(@Body() body: PreBookingDto): Promise<PreBookingDao[]> {
    return await this.hotelService.preBooking(body);
  }

  /* need to work */
  @Post("paymentSubmit")
  async paymentSubmit(
    @Body() body: PaymentSubmitDto
  ): Promise<PaymentSubmitDao[]> {
    return await this.hotelService.paymentSubmit(body);
  }

  @Post("voucher")
  async bookingConfirmed(@Body() body: any): Promise<any[]> {
    return await this.hotelService.bookingConfirmed(body);
  }

  @Post("hotelBookingVoucher")
  async hotelBookingVoucher(
    @Body() body: HotelBookingVoucherDto
  ): Promise<HotelBookingVoucherDao[]> {
    return await this.hotelService.hotelBookingVoucher(body);
  }

  @HttpCode(200)
  @Post("autoCompleteSmyrooms")
  async autoCompleteSmyrooms(@Body() body: any,@Req() request: any): Promise<any> {
    const ipAddress = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    return await this.hotelService.autoCompleteSmyrooms(body);
  }

  @HttpCode(200)
  @Post("autoComplete")
  async autoComplete(@Body() body: any): Promise<any> {
    return await this.hotelService.autoComplete(body);
  }

  @HttpCode(200)
  @Post("addPaxDetails")
  async addPaxDetails(@Body() body: any): Promise<any[]> {
    return await this.hotelService.addPaxDetails(body);
  }

  @HttpCode(200)
  @Post('reservations')
  async reservation(@Body() body: any): Promise<any> {
 
      return await this.hotelService.hotelsReservation(body);
  }

  @Post("hotelEmail")
  async hotelEmail(@Body() body): Promise<any> {
    return this.hotelService.hotelEmail(body);
  }

  // @HttpCode(200)
  // @Post('reservation')
  // async reservationSmyrooms(@Body() body: any): Promise<any> {
  //     return await this.hotelService.hotelsReservationSmyroom(body);
  // }

  @HttpCode(200)
  @Get("reservation/:app_reference")
  async getreservation(@Param() param: any): Promise<any> {
    return await this.hotelService.hotelsReservation(param);
  }

  // @HttpCode(200)
  // @Post('reservationList')
  // async hotelsReservationList(@Body() body: any): Promise<any> {
  //     return await this.hotelService.hotelsReservationList(body);
  // }

  @HttpCode(200)
  @Post("hotelList")
  async hotelList(@Body() body: any): Promise<any> {
    return await this.hotelService.hotelList(body);
  }

  // @HttpCode(200)
  // @Post('reservationRead')
  // async reservationRead(@Body() body:any): Promise<any> {
  //     return await this.hotelService.reservationRead(body);
  // }

  //GoGlobal APIs
  @HttpCode(200)
  @Post("autoCompleteGoGlobal")
  async autoCompleteGoGlobal(@Body() body: any): Promise<any> {
    return await this.hotelService.autoCompleteGoGlobal(body);
  }

  @Post("listHotelTopDestinationsAdmin")
  async listHotelTopDestinationsAdmin(
    @Body() body: HotelTopDestinationsAdminDto
  ): Promise<any> {
    return this.hotelService.listHotelTopDestinationsAdmin(body);
  }

  @Post("listHotelTopDestinations")
  async listHotelTopDestinations(
    @Body() body: HotelTopDestinationsAdminDto
  ): Promise<any> {
    return this.hotelService.listHotelTopDestinations(body);
  }

  @HttpCode(200)
  @Post("HotelbedsFacilityUpdate")
  async HotelbedsFacilityUpdate(@Body() body: any): Promise<any> {
    return await this.hotelService.updateHotelbedsFacilities(body);
  }


  @Post('automaticCancellation')
  @HttpCode(200)
  async automaticCancellation(@Req() req: any): Promise<any> {
      const unpaidPayLaterBooking = await this.hotelService.unpaidBookings(req);
      if(unpaidPayLaterBooking && unpaidPayLaterBooking[0]){
    
        for (let index = 0; index < unpaidPayLaterBooking.length; index++) {
          const booking = unpaidPayLaterBooking[index];
          const cancelRequest = {
            "AppReference": booking.app_reference,
            "booking_source": booking.Api_id
        }
          const cancelBooking = await this.cancelBookingTravelomatix(cancelRequest)
        }
        
      }
  }
}
