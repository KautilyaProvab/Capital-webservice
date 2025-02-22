
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class HotelTopDestinationsAdminDto {
    
    @ApiProperty({ example: '1' })
    id: string;

    @ApiProperty({ example: "country" })
    country: string;

    @ApiProperty({ example: "country" })
    source: string;

    @ApiProperty({ example: "1235" })
    city_id: string;

    @ApiProperty({ example: "city_name" })
    city_name: string;

    @ApiProperty({ example: "check_in_date" })
    check_in: string;

    @ApiProperty({ example: "check_out_date" })
    check_out: string;

    @ApiProperty({ example: "custom_title" })
    custom_title: string;

    @ApiProperty({ example: "Image_url" })
    image: string;

    @ApiProperty({ example: "active" })
    status: string;
    
}

export class HotelTopDestinationsAdminDao {
    
}