
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GuestLoginDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    email: string;

    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    mobile: string;

    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    country_code: string;
    
}

export class GuestLoginDao {
    
}