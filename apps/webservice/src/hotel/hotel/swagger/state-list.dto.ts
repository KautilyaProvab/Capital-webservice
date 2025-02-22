
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class StateListDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    country_id: number;
    
}

export class StateListDao {
    
}