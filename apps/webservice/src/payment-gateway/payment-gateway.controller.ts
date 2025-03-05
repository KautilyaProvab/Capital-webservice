import { Body, Controller, Get, HttpCode, Post, Render, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PaymentGatewayService } from "./payment-gateway.service";


@Controller("paymentGateway")
export class PaymentGatewayController {
  constructor(private paymentGatewayService: PaymentGatewayService) {}

  @HttpCode(200)
  @Post('checkoutPayment')
  async checkoutPayment(@Body() body: any): Promise<any> {
      return await this.paymentGatewayService.checkoutPayment(body);
  }

  @HttpCode(200)
  @Post('new_test')
  async new_test(@Body() body: any): Promise<any> {
      return await this.paymentGatewayService.new_test();
  }

  @HttpCode(200)
  @Post('getPaymentGateWays')
  async getWsPaymentGateWays(): Promise<any> {
      return await this.paymentGatewayService.getPaymentGateWays();
  }
  
    @HttpCode(200)
    @Post('createOrder')
    async createOrder(@Body() body: any): Promise<any> {
      return await this.paymentGatewayService.createOrder(body);
      }

}
