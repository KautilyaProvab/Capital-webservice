import { Module } from "@nestjs/common";
import { SuppliersController } from "./supplier.controller";
import { SuppliersService } from "./supplier.service";
import { TransportConfigService } from "../transport-config.service";

@Module({
  imports: [],
  controllers: [SuppliersController],
  providers: [SuppliersService, TransportConfigService],
  exports: [],
})
export class SupplierModule {}
