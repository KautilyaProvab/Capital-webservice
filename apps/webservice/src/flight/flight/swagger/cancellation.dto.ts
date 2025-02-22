import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CancellationDto {

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	AppReference: string;

}

export class CancellationDao {}