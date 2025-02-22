import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from 'class-transformer';

class Segments {

	@ApiProperty({ example: 'BLR' })
	@IsNotEmpty()
	@IsString()
	Origin: string;

	@ApiProperty({ example: 'DXB' })
	@IsNotEmpty()
	@IsString()
	Destination: string;

	@ApiProperty({ example: '2020-12-25T00:00:00' })
	@IsNotEmpty()
	@IsString()
	DepartureDate: string;

	@ApiProperty({ example: '2020-12-30T00:00:00' })
	@IsOptional()
	@IsString()
	ReturnDate: string;

	@ApiProperty({ example: 'Economy' })
	@IsOptional()
	@IsString()
	CabinClassOnward: string;

	@ApiProperty({ example: 'Economy' })
	@IsOptional()
	@IsString()
	CabinClassReturn: string;

}

export class SearchDto {

	@ApiProperty({ example: 1 })
	@IsNotEmpty()
	@IsString()
	AdultCount: string;

	@ApiProperty({ example: 1 })
	@IsNotEmpty()
	@IsString()
	ChildCount: string;

	@ApiProperty({ example: 1 })
	@IsNotEmpty()
	@IsString()
	InfantCount: string;

	@ApiProperty({ example: 'OneWay' })
	@IsNotEmpty()
	@IsString()
	JourneyType: string;

	@ApiProperty({ example: [] })
	@IsNotEmpty()
	@IsArray()
	PreferredAirlines: string;

	@ApiProperty({ type: [Segments] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type((_) => Segments)
	Segments: Segments[];

}