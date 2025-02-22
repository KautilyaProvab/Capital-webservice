
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class PaymentSubmitDto {
    
    @ApiProperty({example: 'test'})
    @IsNotEmpty()
    @IsString()
    card_details: any;
    
}

export class PaymentSubmitDao {
    
}