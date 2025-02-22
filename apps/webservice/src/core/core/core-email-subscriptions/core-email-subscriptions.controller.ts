import {
    Body,
    Controller,
    HttpCode,
    Post,
    Req,
    UseGuards,
  } from "@nestjs/common";
  import { AuthGuard } from "@nestjs/passport";
import { CoreEmailSubscriptionsService } from "./core-email-subscriptions.service";
import { AddCoreEamilSubscriptionsDto } from "./swagger/core-email-subscriptions.dto";
  
  @Controller("core/email-subscriptions")
  export class CoreEmailSubscriptionsController {
    constructor(private readonly coreEmailSubscriptionsService: CoreEmailSubscriptionsService) {}
  
    @Post("emailSubscriptionsList")
    @UseGuards(AuthGuard("jwt"))
    @HttpCode(200)
    async domainInformationList(
      @Body() body: any,
      @Req() req: any
    ): Promise<any> {
      const result = await this.coreEmailSubscriptionsService.emailSubscriptionsList(
        body,
        req
      );
      return result;
    }

    @Post("addEmailSubscription")
    @HttpCode(200)
    async addEmailSubacription(
      @Body() body: AddCoreEamilSubscriptionsDto,
    ): Promise<any> {
      const result = await this.coreEmailSubscriptionsService.addemailSubscription(
        body
      );
      return result;
    }
  }
  