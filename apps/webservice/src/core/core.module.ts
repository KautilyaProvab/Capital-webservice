import { Module } from "@nestjs/common";
import { CoreDomainController } from "./core/core-domain/core-domain.controller";
import { CoreDomainService } from "./core/core-domain/core-domain.service";
import { CoreEmailSubscriptionsController } from "./core/core-email-subscriptions/core-email-subscriptions.controller";
import { CoreEmailSubscriptionsService } from "./core/core-email-subscriptions/core-email-subscriptions.service";
import { CoreGroupBookingController } from "./core/core-group-booking/core-group-booking.controller";
import { CoreGroupBookingService } from "./core/core-group-booking/core-group-booking.service";
import { CorePaymentDetailsController } from "./core/core-payment-details/core-payment-details.controller";
import { CorePaymentDetailsService } from "./core/core-payment-details/core-paymet-details.service";
import { CoreStaticPageContentController } from "./core/core-static-page-content/core-static-page-content.controller";
import { CoreStaticPageContentService } from "./core/core-static-page-content/core-static-page-content.service";


@Module({
  imports: [],
  controllers: [CorePaymentDetailsController,CoreDomainController,CoreEmailSubscriptionsController,CoreStaticPageContentController,CoreGroupBookingController],
  providers: [CorePaymentDetailsService,CoreDomainService,CoreEmailSubscriptionsService,CoreStaticPageContentService,CoreGroupBookingService],
})
export class CoreModule {}
