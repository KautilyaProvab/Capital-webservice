
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class NearByHotelsDto {
    
    @ApiProperty({example: '12.09'})
    @IsNotEmpty()
    @IsString()
    Latitude: string;

    @ApiProperty({example: '74.98'})
    @IsNotEmpty()
    @IsString()
    Longitude: string;

    @ApiProperty({example: 'us'})
    @IsNotEmpty()
    @IsString()
    GuestCountry: string;
    
}

export class NearByHotelsDao {
    
}
