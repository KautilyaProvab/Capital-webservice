
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class PreBookingDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    result_token: string;

    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    travellers_info: string;

    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    address: string;
    
}

export class PreBookingDao {
    
}