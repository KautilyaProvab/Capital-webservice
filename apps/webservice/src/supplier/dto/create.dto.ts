import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { PropertyDto, CreateSupplierDto } from "./property.dto";

export class CreatePropertiesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyDto)
  properties: PropertyDto[];

  @Type(() => CreateSupplierDto)
  @ValidateNested()
  supplier: CreateSupplierDto;
}
