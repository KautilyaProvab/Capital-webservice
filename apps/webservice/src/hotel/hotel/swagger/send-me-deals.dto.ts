
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class SendMeDealsDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    email: string;
    
}

export class SendMeDealsDao {
    
}