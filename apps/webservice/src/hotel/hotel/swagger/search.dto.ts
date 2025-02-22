import { ApiProperty } from "@nestjs/swagger";

class RoomGuests {
    @ApiProperty({example: ''})
    checkInDate: string;

    @ApiProperty({example: ''})
    noOfNights: string;
}

export class SearchDto {
    /* {
        "CheckInDate": "20-10-2020",
        "NoOfNights": 1,
        "CountryCode": "TR",
        "CityId": 766,
        "GuestNationality": "TR",
        "NoOfRooms": 1,
        "RoomGuests": [
          {
            "NoOfAdults": 1,
            "NoOfChild": 0
          }
        ],
        "PreferredHotel": "",
        "MinRating": 0,
        "MaxRating": 5,
        "SortBy": 0,
        "OrderBy": 0
      } */
    @ApiProperty({example: ''})
    checkInDate: string = "test";

    @ApiProperty({example: ''})
    noOfNights: string;

    @ApiProperty({example: ''})
    countryCode: string;

    @ApiProperty({example: ''})
    cityId: string;

    @ApiProperty({example: ''})
    guestNationality: string;

    @ApiProperty({type: RoomGuests})
    noOfRooms: RoomGuests;

    @ApiProperty({example: ''})
    preferredHotel: string;

    @ApiProperty({example: ''})
    minRating: number;
   
    @ApiProperty({example: ''})
    maxRating: number;
    
    @ApiProperty({example: ''})
    sortBy: number;

    @ApiProperty({example: ''})
    orderBy: number;

}


export class SearchDao {

}