import { Module } from '@nestjs/common';
import { HotelController } from './hotel/hotel.controller';
import { HotelService } from './hotel/hotel.service';
import { HotelDbService } from './hotel/hotel-db.service';
import * as thirdPartyServices from './hotel/third-party-services';
import { SharedModule } from '../shared/shared.module';
import { CommonService } from '../common/common/common.service';
import { TboHolidaysDotComService } from './hotel/third-party-services/tboHolidays-dot-com';
import { HotelBedsService } from './hotel/third-party-services/hotelbeds.service';
import { HotelBedsTransformService } from './hotel/third-party-services/hotelbeds-transform.service';
import { HotelTboTransformService } from './hotel/third-party-services/tboHolidays-transform.Service';
import { stubaDotComService } from './hotel/third-party-services/stuba.-dot-com';
import { HotelStubaTransformService } from './hotel/third-party-services/stuba-tranform.service';
import { DotwDotComService } from './hotel/third-party-services/dotw-dot-com';
import { HummingBirdDotComService } from './hotel/third-party-services/hmbt-dot-com';
import { HmbtTransformService } from './hotel/third-party-services/hmbt--transform.service';
import { HyperGuestDotComService } from './hotel/third-party-services/hyper-guest-dot-com';
import { HoterlCrsService } from './hotel/third-party-services/hotel-crs.service';
import { MiddlewareConsumer } from '@nestjs/common';
import { IpMiddleware } from './hotel/ip-address.middleware';
import { HotelDotwTransformService } from './hotel/third-party-services/dotw-transofrm-service';
import { ActivityDbService } from '../activity/activity/activity-db.service';
import { IRIXService } from './hotel/third-party-services/irix.service';
import { IRIXTransformService } from './hotel/third-party-services/irix-transform.service';



@Module({
  imports: [
    SharedModule
  ],
  controllers: [HotelController],
  providers: [
    HotelService,
    HotelDbService,
    CommonService,
    TboHolidaysDotComService,
    HotelBedsService,
    HotelBedsTransformService,
    HotelTboTransformService,
    stubaDotComService,
    HotelStubaTransformService,
    DotwDotComService,
    HummingBirdDotComService ,
    HmbtTransformService ,
    HyperGuestDotComService ,
    HotelDotwTransformService ,
    ActivityDbService,
    IRIXService,
    IRIXTransformService,
    ...Object.values(thirdPartyServices)
  ]
})

export class HotelModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IpMiddleware)
   
      .forRoutes('*'); // Apply to all routes or specify routes as needed
  }
}