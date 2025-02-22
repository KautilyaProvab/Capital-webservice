import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber } from "class-validator";

export class SearchBusDto {

  @ApiProperty({ example: "1982", nullable: true })
  @IsNotEmpty()
  @IsString()
  FromCityId: string;

  @ApiProperty({ example: "6372", nullable: true })
  @IsNotEmpty()
  @IsString()
  ToCityId: string;

  @ApiProperty({ example: "2020-12-12", nullable: true })
  @IsNotEmpty()
  @IsString()
  JourneyDate : string;
}

export class SearchBusDao {}