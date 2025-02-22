import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AutocompleteDto {

	@ApiProperty()
	@IsString()
	@IsNotEmpty()
	text: string;

}

export class AutocompleteDao {
	
}