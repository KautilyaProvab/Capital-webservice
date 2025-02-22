import { ApiProperty } from "@nestjs/swagger";

export class ListFlightTopDestinationsDto {

    @ApiProperty({ example: '1' })
    id: string;

    @ApiProperty({ example: "xxxx" })
    from_airport_code: string;

    @ApiProperty({ example: "Name" })
    from_airport_name: string;

    @ApiProperty({ example: "XXXX" })
    to_airport_code: string;

    @ApiProperty({ example: "Airport_name" })
    to_airport_name: string;

    @ApiProperty({ example: "Image_url" })
    image: string;

    @ApiProperty({ example: "Image_url" })
    source: string;

    @ApiProperty({ example: "active" })
    status: string;

}



