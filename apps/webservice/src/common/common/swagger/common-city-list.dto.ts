import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CommonCityListDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    city_name: string;
    
}

export class CommonCityListDao {
    city_name: string;
}