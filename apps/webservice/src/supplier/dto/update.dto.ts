import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateSupplierDto {
  @IsBoolean()
  accept: boolean;

  @IsNumber()
  supplier_id: number;

  @IsString()
  @IsOptional()
  reason: string
}
