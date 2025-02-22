import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {

    @ApiProperty({ example: 2 })
    auth_role_id: number;

    @ApiProperty({ example: 'agent@provab.com' })
    email: string;

    @ApiProperty({ example: 'test@123' })
    password: string;

    @ApiProperty({ example: 'Dream Travel' })
    business_name: string;

    @ApiProperty({ example: 'DT123' })
    business_number: string;

    @ApiProperty({ example: '9877457000' })
    business_phone: string;

    @ApiProperty({ example: '1' })
    title: string;

    @ApiProperty({ example: 'Anitha' })
    first_name: string;

    @ApiProperty({ example: 'K' })
    last_name: string;

    @ApiProperty({ example: 'Bangalore' })
    address: string;

    @ApiProperty({ example: 'India' })
    country: string;

    @ApiProperty({ example: '9856895685' })
    phone: string;
}

export class ForgotPasswordDto {
    @ApiProperty() @IsEmail() email: string;
}

export class ResetPasswordDto {
    @ApiProperty() @IsNotEmpty() password: string;
    @ApiProperty() @IsNotEmpty() encdata: string;
}

export class LoginDto {
    @ApiProperty() @IsEmail() email: string;
    @ApiProperty() @IsNotEmpty() password: string;
}
