
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class HotelBookingVoucherDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    booking_id: string;
    
}

export class HotelBookingVoucherDao {
    
}