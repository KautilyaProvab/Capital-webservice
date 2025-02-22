import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CityDto {

    @ApiProperty({example: 'blr'})
    @IsNotEmpty()
    text: string;

}

export class CityDao {
    city_code: number;
    city_name: string;
    country_name: string;
    country_code?: string;
}