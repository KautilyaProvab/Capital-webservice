
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class AutoCompleteDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    city_name: string;
    
}

export class AutoCompleteDao {
    city_name: string;
}