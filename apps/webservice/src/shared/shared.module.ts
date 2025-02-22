import { Module } from '@nestjs/common';
import { RedisServerService } from './redis-server.service';
import { RequestResponseLogService } from './request-response-log.service';

@Module({
    exports: [RedisServerService, RequestResponseLogService],
    providers: [RedisServerService, RequestResponseLogService]
})
export class SharedModule {}
