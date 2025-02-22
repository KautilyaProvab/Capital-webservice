import { Module } from '@nestjs/common';
import * as thirdPartyServices from './bus/third-party-services';
import { SharedModule } from '../shared/shared.module';
import { CommonService } from '../common/common/common.service';
import { BusService } from './bus/bus.service';
import { BusDbService } from './bus/bus-db.service'
import { BusController } from './bus/bus.controller';

@Module({
    imports: [
        SharedModule
    ],
    controllers: [BusController],
    providers: [
        BusService,
        BusDbService,
        CommonService,
        ...Object.values(thirdPartyServices)
    ]
})
export class BusModule { }