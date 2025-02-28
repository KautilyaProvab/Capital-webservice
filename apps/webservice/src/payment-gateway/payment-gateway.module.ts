import { Module, HttpModule } from '@nestjs/common';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { RedisServerService } from '../shared/redis-server.service';

@Module({
  imports: [HttpModule],
   controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService,RedisServerService]
})
export class PaymentGatewayModule {}