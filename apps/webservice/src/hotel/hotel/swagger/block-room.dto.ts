
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class BlockRoomDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    result_token: string;
    
}

export class BlockRoomDao {
    result_token: string;
}