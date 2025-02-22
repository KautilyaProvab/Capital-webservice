import { ApiProperty } from "@nestjs/swagger";

export class CreateCarGroupBookingDto {
  @ApiProperty({ example: "Pending" })
  status: string;

  @ApiProperty({ example: "xxxxx" })
  first_name: string;

  @ApiProperty({ example: "XXXX" })
  last_name: string;

  @ApiProperty({ example: "example@gmail.com" })
  email: string;

  @ApiProperty({ example: "911234567899" })
  phone: string;

  @ApiProperty({ example: "xxxx International Airport (BLR)" })
  from: string;

  @ApiProperty({ example: "xxxx International Airport (BLR)" })
  to: string;

  @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
  pick_up_date: string;

  @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
  drop_off_date: string;

  @ApiProperty({ example: 10})
  total_pax:number

  @ApiProperty({ example: "09:30:00", format: "hh.mm.ss" })
  pick_up_time: string;

  @ApiProperty({ example: "15:00:00", format: "hh.mm.ss" })
  drop_off_time: string;

  @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
  recievedOn: string;

  @ApiProperty({ example: "Additional info description" })
  comments: string;
}

export class CreateFlightGroupBookingDto {
    @ApiProperty({ example: "Pending" })
    status: string;
  
    @ApiProperty({ example: "xxxxx" })
    first_name: string;
  
    @ApiProperty({ example: "XXXX" })
    last_name: string;
  
    @ApiProperty({ example: "example@gmail.com" })
    email: string;
  
    @ApiProperty({ example: "911234567899" })
    phone: string;
  
    @ApiProperty({ example: "One Way" })
    trip_type: string;
  
    @ApiProperty({ example: "xxxx International Airport (BLR)" })
    from: string;
  
    @ApiProperty({ example: "xxxx International Airport (BLR)" })
    to: string;
  
    @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
    departure_date: string;
  
    @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
    return_date: string;
  
    @ApiProperty({ example: 7 })
    adult: number;
  
    @ApiProperty({ example: 7 })
    child: number;
  
    @ApiProperty({ example: 2 })
    infant: number;
  
    @ApiProperty({ example: "Economy" })
    class: string;
  
    @ApiProperty({ example: "Air India Limited (AI)" })
    carrier: string;
  
    @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
    recievedOn: string;
  
    @ApiProperty({ example: "Additional info description" })
    comments: string;
}

export class CreateHotelGroupBookingDto {
    @ApiProperty({ example: "Pending" })
    status: string;
  
    @ApiProperty({ example: "xxxxx" })
    first_name: string;
  
    @ApiProperty({ example: "XXXX" })
    last_name: string;
  
    @ApiProperty({ example: "example@gmail.com" })
    email: string;
  
    @ApiProperty({ example: "911234567899" })
    phone: string;
  
    @ApiProperty({ example: "Newyork" })
    city: string;
  
    @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
    check_in: string;
  
    @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
    check_out: string;
  
    @ApiProperty({ example: 7 })
    adult: number;
  
    @ApiProperty({ example: 7 })
    child: number;
  
    @ApiProperty({ example: 2 })
    nignts: number;
  
    @ApiProperty({ example: "2020-06-10", format: "YYYY-MM-DD" })
    recievedOn: string;
  
    @ApiProperty({ example: "Additional info description" })
    comments: string;
  }