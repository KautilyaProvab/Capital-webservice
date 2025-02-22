import {
  IsString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  IsDateString,
  Length,
  Matches,
  IsEmail,
} from "class-validator";
import { Type } from "class-transformer";

enum Channel {
  EXTRANET = "Extranet",
  STAAH_CM = "Staah CM",
  HOTELRUNNER_CM = "HotelRunner CM",
  RATEGATE_CM = "Rategain CM",
  EZEE_CENTRIX_CM = "Ezee Centrix CM",
  AXISROOMS_CM = "AxisRooms CM",
  YIELDPANET_CM = "Yieldplanet CM",
}
export class CreateSupplierDto {
  @IsInt()
  @Min(1)
  @Max(5)
  title: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  job_title: string;

  @IsString()
  @Matches(/^[0-9]{10,15}$/)
  phone_number: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  alternate_phone_number: string;

  @IsString()
  @IsOptional()
  alternate_email: string;
}
export class SupplierWithId extends CreateSupplierDto {
  @IsInt()
  id: number;
}

export class PropertyDto {
  @IsString()
  @IsNotEmpty()
  propertyName: string;

  @IsString()
  @IsNotEmpty()
  currency: string;


  @IsString()
  @IsNotEmpty()
  propertyType: string;

  @IsInt()
  @Min(1)
  @Max(5)
  propertyRating: number;

  @IsString()
  @IsNotEmpty()
  country: string; 

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty() 
  city_code: string;


  @IsString()
  @IsNotEmpty()
  propertyAddress: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @IsArray()
  mealPlans: string[];

  @IsArray()
  @IsString({ each: true })
  weekendDays: string[];

  @IsArray()
  roomViews: string[];

  @IsString()
  @IsNotEmpty()
  propertyLocalTimezone: string;

  @IsNotEmpty()
  checkInTime: string;

  @IsNotEmpty()
  checkOutTime: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  childrenFreeBefore: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  paidChildrenFromAge: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  paidChildrenToAge: number;

  @IsEnum(Channel)
  @IsNotEmpty()
  channel: Channel;
  
  @IsString()
  @IsOptional()
  hotel_policy: string;

  @IsOptional()
  contract_expiry_date: string;
}

export class PropertyDtoId extends PropertyDto {
  @IsInt()
  id: number;
}
