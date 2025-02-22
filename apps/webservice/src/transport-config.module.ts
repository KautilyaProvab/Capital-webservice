import { Module } from '@nestjs/common';
import { TransportConfigService } from './transport-config.service';

@Module({
    providers: [TransportConfigService],
    exports: [TransportConfigService], // Ensure it's exported
})
export class TransportConfigModule {}
