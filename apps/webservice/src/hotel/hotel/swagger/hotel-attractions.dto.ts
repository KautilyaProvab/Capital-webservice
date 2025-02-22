
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber } from "class-validator";

export class HotelAttractionsDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsNumber()
    hotel_id: number[];
    
}

export class HotelAttractionsDao {
    
}