import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { CommonService } from "./common.service";
import { CommonCityListDto } from "./swagger/common-city-list.dto";
import { AuthGuard } from "@nestjs/passport";

@Controller("common")
export class CommonController {
  constructor(private readonly commonService: CommonService) {}
  @Post("generateOTP")
  async generateOTP(@Body() body: any): Promise<any> {
    return await this.commonService.generateOTP(body.email);
  }
  @Post("validateOTP")
  async validateOTP(@Body() body: any): Promise<any> {
    return await this.commonService.validateOTP(body.req, body.email, body.otp);
  }
  @Post("autoComplete")
  async autoComplete(@Body() body: CommonCityListDto): Promise<any> {
    const result = await this.commonService.getCommonCities(body);
    return result;
  }

  @Post("usdToAnyCurrency")
  async usdToAnyCurrency(@Body() body: any): Promise<any> {
    const result = await this.commonService.usdToAnyCurrency(body);
    return result;
  }

  @Post("anyCurrencyToUSD")
  async anyCurrencyToUSD(@Body() body: any): Promise<any> {
    const result = await this.commonService.anyCurrencyToUSD(body);
    return result;
  }

  @Post("getpaymentCharges")
  async getPaymentCharges(@Body() body: any): Promise<any> {
    const result = await this.commonService.getPaymentCharges(body);
    return result;
  }

  @Post("getPromoCodeInfo")
  async getPromoCodeInfo(@Body() body: any): Promise<any> {
    const result = await this.commonService.getPromoCodeInfo(body);
    return result;
  }

  @Post("mainBannerImagesList")
  async mainBannerImagesList(@Body() body: any): Promise<any> {
    const result = await this.commonService.mainBannerImagesList(body);
    return result;
  }

  @Post("getStaticPageModule")
  async getStaticPageModule(@Body() body: any): Promise<any> {
    return this.commonService.getStaticPageModules(body);
  }

  @Post("listPromocode")
  async listPromocode(@Body() body: any): Promise<any> {
    return this.commonService.listPromocode(body);
  }

  @Post("CountryList")
  @HttpCode(200)
  async CountryList(): Promise<any> {
    return await this.commonService.CountryList();
  }

  @Post("listRefundPolicies")
  async listRefundPolicies(@Body() body: any): Promise<any> {
    return this.commonService.listRefundPolicies(body);
  }

  @Post("coreTestimonialContentList")
  async coreTestimonialContentList(@Body() body: any): Promise<any> {
    return this.commonService.coreTestimonialContentList(body);
  }

  @Post("coreDiscountContentList")
  async coreDiscountContentList(@Body() body: any): Promise<any> {
    return this.commonService.coreDiscountContentList(body);
  }

  @Post("phoneCodeList")
  async phoneCodeList(): Promise<any> {
    return await this.commonService.getPhoneCodeList();
  }

  @Post("currentMonthRecordList")
  @UseGuards(AuthGuard("jwt"))
  async currentMonthRecordList(
    @Body() body: any,
    @Req() req: any
  ): Promise<any> {
    return await this.commonService.currentMonthRecordList(body, req);
  }

  @Post("createAppReference")
  async createAppReference(@Body() body: any): Promise<any> {
    return await this.commonService.createAppReference(body);
  }

  @HttpCode(200)
  @Post("titleList")
  async titleList(@Body() body: any): Promise<any[]> {
    return await this.commonService.titleList(body);
  }

  @Post("paymentConfirmation")
  async paymentConfirmation(@Body() body: any, @Req() req: any): Promise<any> {
    return this.commonService.paymentConfirmation(body, req);
  }

  @Post("authorizationKey")
  async authorizationKey(@Body() body: any): Promise<any> {
    return await this.commonService.authorizationKey();
  }

  @Post("sendSMS")
  async sendSMS(@Body() body: any): Promise<any> {
    return await this.commonService.sendSMS(body.sms, body.to);
  }

  @Post("meals/findAll")
  async findAllMeals(@Body() body: any): Promise<any> {
    return await this.commonService.findAllMeals();
  }

  @Post("AddContactList")
  async addContactList(@Body() body: any): Promise<any> {
    return this.commonService.AddContactList(body);
  }

  @Post("hotelType/findAll")
  async findAllHotelType(@Body() body: any): Promise<any> {
    return await this.commonService.findAllHotelType();
  }

  @Post("city/findAll")
  async findAllCity(@Body("query") query: string): Promise<any> {
    return await this.commonService.findAllCity(query);
  }
  @Post("state/findAll")
  async findAllState(
    @Body() body: { core_country_id: string; offset: number; limit: number }
  ): Promise<any> {
    return await this.commonService.findAllState(body);
  }

  @Post("weekend/findAll")
  async findAllWeekend(@Body() body: any): Promise<any> {
    return "Thursday Friday Saturday Sunday".split(" ").map((day, i) => {
      return {
        day: day,
        id: i,
      };
    });
  }

  @Post("country/findAll")
  async findAllCountry(@Body() body: any): Promise<any> {
    return await this.commonService.findAllCountry();
  }

  @Post("views/findAll")
  async findAllViews(@Body() body: any): Promise<any> {
    return await this.commonService.findAllViews();
  }
  @Post("ListFaq")
  async listFaq(@Body() body: any): Promise<any> {
    return this.commonService.ListFaq(body);
  }
  @Post("ListCustomerFaq")
    async listCustomerFaq(@Body() body:any):Promise<any>{
        return this.commonService.ListCustomerFaq(body);
    }

    @Post('insertHotelDetails')
    @HttpCode(200)
    async insertHotelDetails(@Body() body: any): Promise<any> {
      return await this.commonService.insertHotelDetails();
    }
}
