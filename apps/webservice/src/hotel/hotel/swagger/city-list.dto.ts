
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CityListDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    city_name: string;
    
}

export class CityListDao {
    city_name: string;
}