import { Module } from '@nestjs/common';
import { TourController } from './tour/tour.controller';
import { TourService } from './tour/tour.service';
import { TourDbService } from './tour/tour-db.service';
import { SharedModule } from '../shared/shared.module';
import { CommonService } from '../common/common/common.service';
import { ToursRadarService } from './tour/third-party-services/tours-radar.service';
import { ToursRadarTransformService } from './tour/third-party-services/tours-radar-transform.service';

@Module({
  imports: [
    SharedModule
  ],
  controllers: [TourController],
  providers: [
    TourService,
    TourDbService,
    CommonService,
    ToursRadarService,
    ToursRadarTransformService
  ]
})
export class TourModule { }
