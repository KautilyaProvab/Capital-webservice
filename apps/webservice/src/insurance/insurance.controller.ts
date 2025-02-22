import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InsuranceService } from "./insurance.service";

@Controller('insurance')
export class InsuranceController {
    constructor(private insuranceService: InsuranceService) {}

    @HttpCode(200)
    // @UseGuards(AuthGuard('jwt'))
    @Post('getPolicy')
    async getPolicy(@Req() req: any, @Body() body: any): Promise<any> {
      return this.insuranceService.getPolicy(req, body);
    }

    @HttpCode(200)
    // @UseGuards(AuthGuard('jwt'))
    @Post('createPolicy')
    async createPolicy(@Req() req: any, @Body() body: any): Promise<any> {
      return this.insuranceService.createPolicy(req, body);
    }

    @HttpCode(200)
    // @UseGuards(AuthGuard('jwt'))
    @Post('getPaymentConfig')
    async getPaymentConfig(@Req() req: any, @Body() body: any): Promise<any> {
      return this.insuranceService.getPaymentConfig(req, body);
    }
    @HttpCode(200)
    // @UseGuards(AuthGuard('jwt'))
    @Post('extractPolicy')
    async extractPolicy(@Req() req: any, @Body() body: any): Promise<any> {
      return this.insuranceService.extractPolicy(req, body);
    }
}