
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ApplyPromocodeDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    code: string;
    
}

export class ApplyPromocodeDao {
    code: string;
}