import { ApiProduces, ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";

export enum ModuleEnum {
    Hotel = "Hotel",
    Flight = "Flight",
    Car = "Car",
    Activity = "Activity",
    Restaurant = "Restaurant"
}

export class AddReviewDto {

    @ApiProperty({ example: 3 })
    @IsNumber()
    @IsNotEmpty()
    StarRating: number;

    @ApiProperty({ example: 'Comment' })
    @IsString()
    @IsNotEmpty()
    Comment: string;

    @ApiProperty({ example: 'photo.png' })
    @IsString()
    @IsNotEmpty()
    PhotoUrl: string

    @ApiProperty({ example: 'Hotel' })
    @IsEnum(ModuleEnum)
    @IsNotEmpty()
    ModuleName: string;

    @ApiProperty({ example: '288089' })
    @IsString()
    @IsNotEmpty()
    ModuleRecordId: string;

    @ApiProperty({ example: 'test@gmail.com' })
    @IsString()
    @IsNotEmpty()
    UserName: string;

    @ApiProperty({ example: 30 })
    LikeCount: number;

    @ApiProperty({ example: '2020-12-15' })
    @IsString()
    @IsNotEmpty()
    PostedOn: Date;
}