import { Module } from '@nestjs/common';
import { ActivityController } from './activity/activity.controller';
import { ActivityService } from './activity/activity.service';
import { ViatorApiService } from './activity/third-party-services/viator-api.service';
import { ActivityDbService } from './activity/activity-db.service';
import { HotelBedsActivity } from './activity/third-party-services/hotelbedsActivity-api.service';
import { RedisServerService } from '../shared/redis-server.service';

@Module({
  imports: [],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    ActivityDbService,
    ViatorApiService,
    HotelBedsActivity,
    RedisServerService ,
    
  ]
})
export class ActivityModule {}
