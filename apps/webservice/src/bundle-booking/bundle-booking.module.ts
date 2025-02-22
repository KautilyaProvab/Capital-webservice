import { Module } from "@nestjs/common";
import { BundleBookingController } from "./bundle-booking/bundle-booking.controller";
import { BundleBookingService } from "./bundle-booking/bundle.booking.service";
import { SharedModule } from "../shared/shared.module";
import { FlightService } from "../flight/flight/flight.service";
import { HotelService } from "../hotel/hotel/hotel.service";
import { HotelDbService } from "../hotel/hotel/hotel-db.service";
import { TransferService } from "../transfer/transfer/transfer.service";
import { TransferDbService } from "../transfer/transfer/transfer-db.service";
import { FlightModule } from "../flight/flight.module";
import { HotelModule } from "../hotel/hotel.module";
import { TransferModule } from "../transfer/transfer.module";
import { FlightDbService } from "../flight/flight/flight-db.service";
import { TmxApiService } from "../flight/flight/third-party-services/tmx-api.service";
import { TravelportApiService } from "../flight/flight/third-party-services/travelport-api.service";
import { FareApiService } from "../flight/flight/third-party-services/fare-api.service";
import { SabreApiService } from "../flight/flight/third-party-services/sabre-api.service";
import { TboHolidaysDotComService } from "../hotel/hotel/third-party-services/tboHolidays-dot-com";
import { GoGlobalService, GoGlobalTransformService, HotelBedsService, HotelBedsTransformService, HoterlCrsService, TravelomatixDotComService ,IRIXService } from "../hotel/hotel/third-party-services";
import { HotelTboTransformService } from "../hotel/hotel/third-party-services/tboHolidays-transform.Service";
import { stubaDotComService } from "../hotel/hotel/third-party-services/stuba.-dot-com";
import { HotelStubaTransformService } from "../hotel/hotel/third-party-services/stuba-tranform.service";
import { DotwDotComService } from "../hotel/hotel/third-party-services/dotw-dot-com";
import { HummingBirdDotComService } from "../hotel/hotel/third-party-services/hmbt-dot-com";
import { HmbtTransformService } from "../hotel/hotel/third-party-services/hmbt--transform.service";
import { HyperGuestDotComService } from "../hotel/hotel/third-party-services/hyper-guest-dot-com";
import { HotelDotwTransformService } from "../hotel/hotel/third-party-services/dotw-transofrm-service";
import { ActivityDbService } from "../activity/activity/activity-db.service";
import { CommonService } from "../common/common/common.service";
import * as thirdPartyServices from "../transfer/transfer/third-party-services";
import { TmxTransformService } from "../flight/flight/third-party-services/tmx-transform.service";
import { TravelportTransformService } from "../flight/flight/third-party-services/travelport-transform.service";
import { SabreTransformService } from "../flight/flight/third-party-services/sabre-transform.service";
import { FareTransformService } from "../flight/flight/third-party-services/fare-transform.service";
import * as hotelThirdPartyServices from '../hotel/hotel/third-party-services';
import { ActivityModule } from "../activity/activity.module";
import { HotelBedsActivity } from "../activity/activity/third-party-services/hotelbedsActivity-api.service";
import { ViatorApiService } from "../activity/activity/third-party-services/viator-api.service";
import { ActivityService } from "../activity/activity/activity.service";

import { SafariService } from "../flight/flight/third-party-services/safari-api.service";
import { SafariTransformService } from "../flight/flight/third-party-services/safari-transform.service";


@Module({
    imports: [
      SharedModule,
      FlightModule,
      HotelModule,
      TransferModule,
      ActivityModule,
    ],
    controllers: [
      BundleBookingController
    ],
    providers: [
      BundleBookingService,
      FlightService,
      HotelService,
      HotelDbService,
      TransferService,
      TransferDbService,
      FlightDbService,
      TmxApiService,
      TravelportApiService,
      TravelportTransformService,
      FareApiService,
      SabreApiService,HotelService,
      HotelDbService,
      TboHolidaysDotComService,
      HotelBedsService,
      HotelBedsTransformService,
      HotelTboTransformService,
      stubaDotComService,
      HotelStubaTransformService,
      DotwDotComService,
      HummingBirdDotComService,
      HmbtTransformService ,
      HyperGuestDotComService ,
      HotelDotwTransformService ,
      ActivityDbService,
      TravelomatixDotComService,
      GoGlobalService,
      HoterlCrsService,
      CommonService,
      TmxTransformService,
      SabreTransformService,
      FareTransformService,
      GoGlobalTransformService, 
      IRIXService,
      SafariService,
      SafariTransformService,
      ...Object.values(thirdPartyServices),
      ...Object.values(hotelThirdPartyServices),
      HotelBedsActivity,
      ViatorApiService,
      ActivityDbService,
      ActivityService,
      // DotwDotComService,
    ]
})
export class BundleBookingModule { }