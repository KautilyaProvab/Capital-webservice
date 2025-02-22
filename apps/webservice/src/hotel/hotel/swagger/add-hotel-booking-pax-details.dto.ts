import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AddHotelBookingPaxDetailsDto {

    @ApiProperty({example: '123456'})
    app_reference: string;

    @ApiProperty({example: 'Mr'})
    title: string;

    @ApiProperty({example: 'Raju'})
    first_name: string;

    @ApiProperty({example: 'M'})
    middle_name: string;

    @ApiProperty({example: 'K'})
    last_name: string;

    @ApiProperty({example: '9878456598'})
    phone: string;

    @ApiProperty({example: 'test@---.com'})
    email: string;

    @ApiProperty({example: 'Adult or Child'})
    pax_type: string;

    @ApiProperty({example: '1995-10-03'})
    date_of_birth: string;

    @ApiProperty({example: 'Indian'})
    passenger_nationality: string;

    @ApiProperty({example: '125487986598'})
    passport_number: string;

    @ApiProperty({example: 'India'})
    passport_issuing_country: string;

    @ApiProperty({example: 'YYYY-MM-DD'})
    passport_expiry_date: string;

    @ApiProperty({example: 'BOOKING_HOLD'})
    status: string;

    @ApiProperty({example: 'test'})
    attributes: string;
}