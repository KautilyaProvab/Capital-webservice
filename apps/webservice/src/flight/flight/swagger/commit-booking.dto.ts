import { ApiProperty } from "@nestjs/swagger";
import {
	ArrayMinSize,
	IsArray,
	IsEmail,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class Passengers {
	@ApiProperty({ example: 1 })
	@IsNotEmpty()
	@IsNumber()
	IsLeadPax: number;

	@ApiProperty({ example: "Mr" })
	@IsNotEmpty()
	@IsString()
	Title: string;

	@ApiProperty({ example: 'Sulthan' })
	@IsNotEmpty()
	@IsString()
	FirstName: string;

	@ApiProperty({ example: 'Mamusa' })
	@IsNotEmpty()
	@IsString()
	LastName: string;

	@ApiProperty({ example: 'M' })
	@IsOptional()
	@IsString()
	MiddleName: string;

	@ApiProperty({ example: 1 })
	@IsNotEmpty()
	@IsNumber()
	PaxType: number;

	@ApiProperty({ example: 1 })
	@IsNotEmpty()
	@IsNumber()
	Gender: number;

	@ApiProperty({ example: '1986-15-02' })
	@IsNotEmpty()
	@IsString()
	DateOfBirth: string;

	@ApiProperty({ example: 'PASS1234567890' })
	@IsNotEmpty()
	@IsString()
	PassportNumber: string;

	@ApiProperty({ example: '2030-20-10' })
	@IsNotEmpty()
	@IsString()
	PassportExpiryDate: string;

	@ApiProperty({ example: 'IN' })
	@IsNotEmpty()
	@IsString()
	PassportIssuingCountry: string;

	@ApiProperty({ example: 'IN' })
	@IsNotEmpty()
	@IsString()
	CountryCode: string;

	@ApiProperty({ example: 'India' })
	@IsNotEmpty()
	@IsString()
	CountryName: string;

	@ApiProperty({ example: '9876543210' })
	@IsNotEmpty()
	@IsString()
	ContactNo: string;

	@ApiProperty({ example: '080' })
	@IsNotEmpty()
	@IsString()
	PhoneAreaCode: string;

	@ApiProperty({ example: '91' })
	@IsNotEmpty()
	@IsString()
	PhoneExtensionCode: string;

	@ApiProperty({ example: 'Bangalore' })
	@IsNotEmpty()
	@IsString()
	City: string;

	@ApiProperty({ example: '560021' })
	@IsNotEmpty()
	@IsString()
	PinCode: string;

	@ApiProperty({ example: 'Test' })
	@IsNotEmpty()
	@IsString()
	AddressLine1: string;

	@ApiProperty({ example: 'Test' })
	@IsNotEmpty()
	@IsString()
	AddressLine2: string;

	@ApiProperty({ example: 'test@example.com' })
	@IsNotEmpty()
	@IsEmail()
	email: string;
}

export class CommintBookingDto {
	@ApiProperty({ example: 'FBT-1234-56789' })
	@IsNotEmpty()
	@IsString()
	AppReference: string;

	@ApiProperty({ example: 0 })
	@IsNotEmpty()
	@IsNumber()
	SequenceNumber: number;

	@ApiProperty({ example: '04fb6c6a8fee3eb6767f366066fbf243***1***6853' })
	@IsNotEmpty()
	@IsString()
	ResultToken: string;

	@ApiProperty({ type: [Passengers] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type((_) => Passengers)
	Passengers: Passengers[];
}

/*
{
	"AppReference": "236",
	"SequenceNumber": 0,
	"ResultToken": "04fb6c6a8fee3eb6767f366066fbf243***1***6853",
	"Passengers": [
		{
			"IsLeadPax": 1,
			"Title": "Mr",
			"FirstName": "Rajeshh",
			"LastName": "Malakarr",
			"MiddleName": "Kr",
			"PaxType": 1,
			"Gender": 2,
			"DateOfBirth": "2007-01-31",
			"PassportNumber": "PASSPORT14",
			"PassportExpiryDate": "2030-01-23",
			"PassportIssuingCountry": "in",
			"CountryCode": "IN",
			"CountryName": "India",
			"ContactNo": "8050584929",
			"PhoneAreaCode": "080",
			"PhoneExtensionCode": "91",
			"City": "Bangalore",
			"PinCode": "560100",
			"AddressLine1": "2nd Floor, Venkatadri IT Park, HP Avenue, Konnappana Agrahara, Electronic city",
			"AddressLine2": "2nd Floor, Venkatadri IT Park, HP Avenue, Konnappana Agrahara, Electronic city",
			"email": "abc@gmail.com"
		}
	]
}
*/
