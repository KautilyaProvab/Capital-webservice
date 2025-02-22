
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class FiveStarHotelsDto {
    
    @ApiProperty({example: '12.3256'})
    @IsNotEmpty()
    @IsString()
    Latitude: string;

    @ApiProperty({example: '74.3689'})
    @IsNotEmpty()
    @IsString()
    Longitude: string;
    
}

export class FiveStarHotelsDao {
   
}