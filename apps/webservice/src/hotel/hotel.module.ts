import { Module } from '@nestjs/common';
import { HotelController } from './hotel/hotel.controller';
import { HotelService } from './hotel/hotel.service';
import { HotelDbService } from './hotel/hotel-db.service';
import * as thirdPartyServices from './hotel/third-party-services';
import { SharedModule } from '../shared/shared.module';
import { CommonService } from '../common/common/common.service';
import { MiddlewareConsumer } from '@nestjs/common';
import { IpMiddleware } from './hotel/ip-address.middleware';
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