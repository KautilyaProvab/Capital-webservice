
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class BookingConfirmedDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    result_token: string;
    
}

export class BookingConfirmedDao {
    result_token: string;
}