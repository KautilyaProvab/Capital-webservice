import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber } from "class-validator";

export class SearchHotelDto {
  @ApiProperty({ example: "1", nullable: true })
  CityIds: number[];

  @ApiProperty({ example: "2020-12-10", nullable: true })
  CheckInDate: string;

  @ApiProperty({ example: "2020-12-12", nullable: true })
  CheckOutDate: string;

  @ApiProperty({ example: "in", nullable: true })
  GuestCountry: string;

  @ApiProperty({ example: "2", nullable: true })
  NoOfRooms: number;

  @ApiProperty({ example: "in", nullable: true })
  RoomGuests: string[];
}

export class SearchHotelDao {}
