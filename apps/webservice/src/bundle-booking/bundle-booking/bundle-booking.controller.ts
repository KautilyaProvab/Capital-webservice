import { Controller, Post, Body, Req, Res } from "@nestjs/common";

import { BundleBookingService } from "./bundle.booking.service";

@Controller("bundle-booking")
export class BundleBookingController {
  constructor(
    private readonly bundleBookingService: BundleBookingService
  ) {}

  @Post("addBundleBooking")
  async addBundleBooking(
    @Body() body: any,
  ): Promise<any> {
    const result = await this.bundleBookingService.addBundleBooking(
      body,
    );
    return result;
  }

  @Post("getBundleBooking")
  async getBundleBooking(
    @Body() body: any,
  ): Promise<any> {
    const result = await this.bundleBookingService.getBundleBooking(
      body,
    );
    return result;
  }

  @Post("removeBundleBooking")
  async removeBundleBooking(
    @Body() body: any,
  ): Promise<any> {
    const result = await this.bundleBookingService.removeBundleBooking(
      body,
    );
    return result;
  }

  @Post("addPaxDetails")
  async addPaxDetails(
    @Body() body: any,
  ): Promise<any> {
    const result = await this.bundleBookingService.addPaxDetails(
      body,
    );
    return result;
  }

  @Post("reservation")
  async reservation(
    @Body() body: any,
  ): Promise<any> {
    const result = await this.bundleBookingService.reservation(
      body,
    );
    return result;
  }

  @Post("bundleReport")
  async bundleReport(
    @Body() body: any,
  ): Promise<any> {
    const result = await this.bundleBookingService.bundleReport(
      body,
    );
    return result;
  }

  @Post('bundleVoucher')
    async bundleVoucher(@Body() body: any): Promise<any> {
        return await this.bundleBookingService.bundleVoucher(body);
    }
}
