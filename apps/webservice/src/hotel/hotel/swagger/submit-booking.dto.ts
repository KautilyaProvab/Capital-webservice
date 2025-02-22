
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class SubmitBookingDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    result_token: string;
    
}

export class SubmitBookingDao {
    
}