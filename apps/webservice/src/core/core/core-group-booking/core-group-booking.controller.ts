import { CoreGroupBookingService } from "./core-group-booking.service";
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req
} from "@nestjs/common";

import {
  CreateCarGroupBookingDto,
  CreateFlightGroupBookingDto,
  CreateHotelGroupBookingDto,
} from "./swagger/group-booking.dto";

@Controller("core/core-groupBooking")
export class CoreGroupBookingController {
  constructor(
    private readonly coreGroupBookingService: CoreGroupBookingService
  ) {}
  @Post("createCarGroupBooking")
  @HttpCode(200)
  async createCarGroupBooking(
    @Body() body: CreateCarGroupBookingDto,
    @Req() req: any
  ) {
    return this.coreGroupBookingService.createCarGroupBooking(body, req);
  }

  @Post("createFlightGroupBooking")
  @HttpCode(200)
  async createFlightGroupBooking(
    @Body() body: CreateFlightGroupBookingDto,
    @Req() req: any
  ) {
    return this.coreGroupBookingService.createFlightGroupBooking(body, req);
  }
  @Post("createhotelGroupBooking")
  @HttpCode(200)
  async createHotelGroupBooking(
    @Body() body: CreateHotelGroupBookingDto,
    @Req() req: any
  ) {
    return this.coreGroupBookingService.createHotelGroupBooking(body, req);
  }
}
