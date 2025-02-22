
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class TopHotelDestinationsDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    latitude: string;

    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    longitude: string;
    
}

export class TopHotelDestinationsDao {
    
}