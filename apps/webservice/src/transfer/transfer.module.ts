import { Module } from '@nestjs/common';
import { TransferController } from './transfer/transfer.controller';
import { TransferService } from './transfer/transfer.service';
import { TransferDbService } from './transfer/transfer-db.service';
import * as thirdPartyServices from './transfer/third-party-services';
import { SharedModule } from '../shared/shared.module';
import { CommonService } from '../common/common/common.service';

@Module({
  imports: [
    SharedModule
  ],
  controllers: [TransferController],
  providers: [
    TransferService,
    TransferDbService,
    CommonService,
    ...Object.values(thirdPartyServices)
  ]
})
export class TransferModule { }
