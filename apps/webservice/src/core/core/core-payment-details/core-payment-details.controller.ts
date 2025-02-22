import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CorePaymentDetailsService } from "./core-paymet-details.service";
import { AddPaymentDetailsDto, DeletePaymentDetailsDto } from "./swagger/core-payment-details.dto";

@Controller("core/core-payment-details")
export class CorePaymentDetailsController {
  constructor(
    private readonly corePaymetDetailsService: CorePaymentDetailsService
  ) {}

  @Post("corePaymentDetailsList")
  @UseGuards(AuthGuard('jwt'))
  async corePaymentDetailsList(@Body() body: any ,@Req() req: any ): Promise<any> {
    const result = await this.corePaymetDetailsService.getCorePaymentDetailsList(
      body,req
    );
    return result;
  }

  @Post("addCorePaymentDetails")
  @UseGuards(AuthGuard('jwt'))
  async addCorePaymentDetails(@Body() body: AddPaymentDetailsDto,@Req() req: any ): Promise<any> {
    const result = await this.corePaymetDetailsService.addCorePaymentDetails(body,req);
    return result;
  }

  @Post("deleteCorePaymentDetails")
  @UseGuards(AuthGuard('jwt'))
  async createUserTraveller(@Body() body: DeletePaymentDetailsDto, @Req() req: any): Promise<any> {
    const result = await this.corePaymetDetailsService.deleteCorePaymentDetails(
      body,req
    );
    return result;
  }
}
