import { ApiProperty } from "@nestjs/swagger";

export class AddUserTravellerDto{
    @ApiProperty({example:1})
    lead_user_id:number

    @ApiProperty({ example: 1 })
    title: number;

    @ApiProperty({ example: "xxx" })
    first_name: string;

    @ApiProperty({ example: "XXXX" })
    last_name: string;

    @ApiProperty({ example: "123456789" })
    phone_number: string;

    @ApiProperty({ example: "xx2@gmail.con" })
    email: string;

    @ApiProperty({ example: "test address" })
    address: string;

    @ApiProperty({ example: "test address2" })
    address1: string;

    @ApiProperty({ example: "Banglore" })
    city: string;

    @ApiProperty({ example: "Karnataka" })
    state: string;

    @ApiProperty({ example: 1 })
    country: number;

    @ApiProperty({ example: "582601" })
    postal_code: string;

    @ApiProperty({ example: "763-UHBV3-AKJBJA" })
    passport_no: string;

    @ApiProperty({ example: "01-01-2021" })
    passport_expiry: string;

    @ApiProperty({ example: "India" })
    issuing_country: string;

}

export class UpdateUserTravellerDto{
    @ApiProperty({example:1})
    id:number

    @ApiProperty({ example: 1 })
    title: number;

    @ApiProperty({ example: "xxx" })
    first_name: string;

    @ApiProperty({ example: "XXXX" })
    last_name: string;

    @ApiProperty({ example: "123456789" })
    phone_number: string;

    @ApiProperty({ example: "xx2@gmail.con" })
    email: string;

    @ApiProperty({ example: "test address" })
    address: string;

    @ApiProperty({ example: "test address2" })
    address1: string;

    @ApiProperty({ example: "Banglore" })
    city: string;

    @ApiProperty({ example: "Karnataka" })
    state: string;

    @ApiProperty({ example: 1 })
    country: number;

    @ApiProperty({ example: "582601" })
    postal_code: string;

    @ApiProperty({ example: "763-UHBV3-AKJBJA" })
    passport_no: string;

    @ApiProperty({ example: "01-01-2021" })
    passport_expiry: string;

    @ApiProperty({ example: 23 })
    issuing_country: number;

}

export class DeleteUserTravellerDto{
    @ApiProperty({example:1})
    id:number
}

export class UserTravellerListDto{
    @ApiProperty({example:1})
    id:number
}