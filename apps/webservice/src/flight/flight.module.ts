import { RequestMethod } from '@nestjs/common';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { BodyModifyMiddleware } from './flight/body-modify.middleware';
import { FlightDbService } from './flight/flight-db.service';
import { FlightController } from './flight/flight.controller';
import { FlightService } from './flight/flight.service';

import { TmxApiService } from './flight/third-party-services/tmx-api.service';
import { TmxTransformService } from './flight/third-party-services/tmx-transform.service';
import { SabreApiService } from './flight/third-party-services/sabre-api.service';
import { SabreTransformService } from './flight/third-party-services/sabre-transform.service';

import { TravelportApiService } from './flight/third-party-services/travelport-api.service';
import { TravelportTransformService } from './flight/third-party-services/travelport-transform.service';
import { SafariService } from './flight/third-party-services/safari-api.service';
import { SafariTransformService } from './flight/third-party-services/safari-transform.service';


import { FareApiService } from './flight/third-party-services/fare-api.service';
import { FareTransformService } from './flight/third-party-services/fare-transform.service';

import { CommonService } from '../common/common/common.service';


@Module({
  imports: [
    SharedModule
  ],
  controllers: [FlightController],
  providers: [
    FlightService,
    FlightDbService,
    TmxApiService,
    TmxTransformService,
    SabreApiService,
    SabreTransformService,
    TravelportApiService,
    TravelportTransformService,
    FareApiService,
    FareTransformService,
    CommonService,
    SafariService,
    SafariTransformService
  ]
})
export class FlightModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
          .apply(BodyModifyMiddleware)
          .forRoutes({
            path: '*', method: RequestMethod.ALL
          });
      }
}
