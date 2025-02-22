import { ApiProperty } from "@nestjs/swagger";

export class AddPaymentDetailsDto{

    @ApiProperty({ example: 1 })
    created_by_id: number;

    @ApiProperty({ example: "Credit" })
    card_type: string;

    @ApiProperty({ example: "xxx" })
    card_holder_name: string;

    @ApiProperty({ example: "123456543212345" })
    card_number: string;

    @ApiProperty({ example: "11/2022" })
    expiry_date:string ;

    @ApiProperty({ example: true })
    set_as_preferred:boolean ;

    @ApiProperty({ example: "test address" })
    address: string;

    @ApiProperty({ example: "test address2" })
    address1: string;

    @ApiProperty({ example: "Banglore" })
    city: string;

    @ApiProperty({ example: "Karnataka" })
    state: string;

    @ApiProperty({ example: "India" })
    country: string;

    @ApiProperty({ example: "582601" })
    postal_code: string;

}
export class DeletePaymentDetailsDto{

    @ApiProperty({ example: 1 })
    id: number;

}

