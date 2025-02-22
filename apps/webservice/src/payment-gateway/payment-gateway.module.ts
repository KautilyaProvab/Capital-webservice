import { Module, HttpModule } from '@nestjs/common';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';

@Module({
  imports: [HttpModule],
   controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService]
})
export class PaymentGatewayModule {}