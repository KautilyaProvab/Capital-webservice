
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber } from "class-validator";

export class HotelDetailsDto {

    @ApiProperty({ example: '1, 2', nullable: true })
    hotel_ids: number[];

}

export class HotelDetailsDao {

}