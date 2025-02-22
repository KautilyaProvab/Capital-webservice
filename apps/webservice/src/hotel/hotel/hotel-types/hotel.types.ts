import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  NotAcceptableException,
  RequestTimeoutException,
  ConflictException,
  GoneException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  ImATeapotException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotImplementedException,
  BadGatewayException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from "@nestjs/common";



export type MoreInfoRoomType = {
  id: number;
  type: string;
  board_type: string[];
  occu: number;
  no_of_room: number;
  cancellation_policy: {
    [key: string]: string;
  };
  ameneties: string;
  room_description: string;
};
export type PriceFromDB = {
  gst: number;
  [x: string]: number;
  single_room: number;
  double_room: number;
  extra_room: number;
};
interface BoardType {
  BB: number;
  RO: number;
  HB: number;
}

export type RoomPrice = {
    gst: number;
    board_type: Partial<BoardType>;
    single_room: number;
    double_room: number;
    extra_room: number;
    currency: string;
}
export interface CancelPenalty {
  Charge: number;
  ChargeType: number;
  Currency: string;
  FromDate: string;
  ToDate: string;
  NonRefundable: string;
  CancelPenalty: string;
}

export type RoomDetailRoomWithResultIndex = {
  NoOfAdults:number;
  NoOfChild:number;
  ResultIndex: any;
  RoomTypeCode: string;
  Description: string;
  Price: {
    CurrencyCode: string;
    RoomPrice: number;
    Tax: number;
    ExtraGuestCharge: number;
    ChildCharge: number;
    OtherCharges: number;
    Discount: number;
    PublishedPrice: number;
    PublishedPriceRoundedOff: number;
    OfferedPrice: number;
    OfferedPriceRoundedOff: number;
    AgentCommission: number;
    AgentMarkUp: number;
    ServiceTax: number;
    TCS: number;
    TDS: number;
    ServiceCharge: number;
    TotalGSTAmount: number;
    GST: {
      CGSTAmount: number;
      CGSTRate: number;
      CessAmount: number;
      CessRate: number;
      IGSTAmount: number;
      IGSTRate: number;
      SGSTAmount: number;
      SGSTRate: number;
      TaxableAmount: number;
    };
    Amount: number;
    Currency: string;
    Commission: number;
  };
  MealPlanCode: string;
  BoardType: string;
  CancelPenalties: CancelPenalty[];
  SmokingPreference: string;
  RatePlanCode: string;
  NonRefundable: string;
  Occupancy: number;
  Amenities: string[];
};


export type RoomDetail = {
  ResultIndex?: string;
  Price: Price;
  RoomNumberIndex: number;
  AgenyToken?: string;
  CategoryId?: string;
  Rooms?: RoomDetailRoomWithResultIndex[];
  CancelPolicy?: string;
  RatePlanCode?: string;
  RoomIndex?: number;
  RoomTypeName?: string;
  IsPassportMandatory?: boolean;
  IsPANMandatory?: boolean;
  FixedCombination?: boolean;
};

export interface GSTDetails {
  CGSTAmount: number;
  CGSTRate: number;
  CessAmount: number;
  CessRate: number;
  IGSTAmount: number;
  IGSTRate: number;
  SGSTAmount: number;
  SGSTRate: number;
  TaxableAmount: number;
}

export interface Price {
  CurrencyCode: string;
  RoomPrice: number;
  Tax: number;
  ExtraGuestCharge: number;
  ChildCharge: number;
  OtherCharges: number;
  Discount: number;
  PublishedPrice: number;
  PublishedPriceRoundedOff: number;
  OfferedPrice: number;
  OfferedPriceRoundedOff: number;
  AgentCommission: number;
  AgentMarkUp: number;
  ServiceTax: number;
  TCS: number;
  TDS: number;
  ServiceCharge: number;
  TotalGSTAmount: number;
  GST: GSTDetails;
  Amount: number;
  Currency: string;
  Commission: number;
}


export interface SavedData {
  Remarks: string;
  HotelName: string;
  HotelCode: string;
  StarRating: string ;
  HotelAddress: string;
  HotelContactNo: string;
  Latitude: number;
  Longitude: number;
  CheckIn: string;
  CheckOut: string;
  HotelPicture: string[];
  Source: any;
  HotelPolicy: any;
  CancelPenalties: { CancelPenalty: any };
  searchRequest: SearchRequest;
  RoomDetails: {
    Rooms: {
      Description: any;
      Price: { Currency: any; Amount: number; Tax: any };
      Occupancy: any;
      MealPlanCode: any;
    }[];
    RoomTypeName: any;
  }[];
  AgencyToken: any;
}
export interface RoomDetailDriectBooking {
  RoomId: number;
  max_occupancy: number;
  isClubBooking: boolean;
  passenger_count?: number
}
export interface ClubBooking {
  RoomId: number;
  person_name: string;
  cost_center: string;
  emp_id: string;
  request_id: string;
  Department: string;
  EmployeeBand: string;
  MobileNo: string;
  Email: string;
}

export interface RoomCharges {
  basic_fare: string;
  client_supplementary_charge: string;
  Tax: string;
  TotalFare: number;
  supplier_basic: string;
  supplier_supplementary_charge: string;
  supplier_tax: string;
  supplier_payable: string;
}

export interface DirectBookingBody {
  BookingDetails: {
    is_club_booking: boolean;
    roomDetails: RoomDetailDriectBooking[];
    Club?: ClubBooking;
    single_room_charges: RoomCharges;
    double_room_charges: RoomCharges;
    PersonalRemarks: string;
    Remarks: string;
    StarRating: string;
    RoomType: string;
    City: string;
    Location:string;
    GuesthouseName: string;
    BookingId: string;
    HotelName: string;
    HotelCode: string;
    HotelAddress: string;
    HotelContactNo: string;
    PaymentMode: string;
    HotelCheckIn: string;
    MaxOccupancy: number;
    HotelCheckOut: string;
    checkout_time: string;
    checkin_time: string;
    early_checkin: string;
    late_checkout: string;
    property: string;
    early_check_in_client_charge: string;
    early_check_out_client_charge: string;
    early_check_in_supplier_charge: string;
    early_check_out_supplier_charge: string;
    dcb_rate: string;
    voucher_occupancy: string;
  };
  select_reason: string;
  gender: string; // gender we entered in icic_hotel_booking field
  other_reason: string;
  status: string;
  created_by_id: number;
  UserType: string;
  NoOfRooms: number;
  AppReference: string;
  IciciHotelBookingRef: string;
  Email: string;
  RoomDetails: RoomDetails[];
  booking_reference: string;
  booking_source: string;
}
export interface PassengerDetail {
  Address?: string;
  Address2?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Email?: string;
  PhoneCode?: string;
  Contact?: null;
  Country?: string;
  Title?: string;
  FirstName?: string;
  LastName?: string;
  Dob?: string;
  PassengerSelectionAdult?: string;
  RoomId: number;
  PanNumber?: string;
  PassportNumber?: string;
  Age?: number;
  PaxType?: string;
  LeadPassenger?: boolean;
  EmployeeCostCenter: string;
  request_id?: string;
  EmployeeId?: string;
  MobileNo?: string;
  Department?: string;
  EmployeeBand?: string;
  IsClubBooking?: boolean;
  TotalFare?: number;
  max_occupancy?: number;
  Gender?: string;
}


interface AddressDetails {
  Title: string;
  FirstName: string;
  LastName: string;
  Address: string;
  Address2: string;
  City: string;
  State: string;
  PostalCode: string;
  Email: string;
  PhoneCode: string;
  Contact: string;
  Country: string;
}

export interface RoomDetails {
  PassengerDetails: PassengerDetail[];
  AddressDetails: AddressDetails;
}

interface HotelData {
  hotelName: string;
  hotelId: string;
  starRating:  number;
  address: string;
  countryCode: string;
  pincode: string;
  hotelContactNo: string;
  email: string;
  latitude: number;
  longitude: number;
  checkin: string | null;
  checkout: string | null;
  hotelPhoto: string;
  remarks: string;
  domainOrigin: string;
  cancellationPolicy: string;
  searchRequest: SearchRequest;
}

export interface Room {
  roomId: number;
  room_type_name: string;
  roomName: string;
  checkin: string | null;
  checkout: string | null;
  currency: string;
  price: number;
  tax: string;
  discount: string;
  blockId: string;
  maxOccupancy: string;
  maxChildFree: string;
  maxChildFreeAge: string;
  mealPlanCode: string;
  cancellationInfo: any | null;
}

export interface FormattedHotelRoomData {
  HotelData: HotelData;
  RoomData: Room[];
}
export interface ExtendedFormattedHotelRoomData extends FormattedHotelRoomData {
  appRef?: string;
  userId?: number;
  source?: string;
  state:string;
  booking_from?: string;
  email?: string;
  contact?: string;
  name?: string;
  domainOrigin?: string;
  agent_markup?: string;
}


export interface BookingData {
  PaymentMode: string;
  ResultToken: string;
  PromoCode: string;
  Email: string;
  AppReference: string;
  UserId: number;
  RoomDetails: RoomDetails[];
  booking_source: string;
  BookingSource: string;
  PolicyDetails:Policy[];
  TripId:string;
  TripName:string
}

export interface FormattedPaxDetail {
  app_reference: string;
  title: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  age: number | null;
  pax_type: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  email: string;
  phone_code: string;
  phone: string | null;
  country: string;
  status: string;
  created_by_id: number | null;
  attributes: string;
}

export interface HotelBookingDetail {
  id: any;
  domain_origin: any;
  status: any;
  app_reference: any;
  confirmation_reference: any;
  booking_reference: any;
  hotel_name: any;
  star_rating: any;
  hotel_address: any;
  hotel_code: any;
  hotel_photo: any;
  phone_number: any;
  alternate_number: any;
  email: any;
  hotel_check_in: any;
  hotel_check_out: any;
  payment_mode: any;
  convinence_value: any;
  convinence_value_type: any;
  convinence_per_pax: any;
  convinence_amount: any;
  promo_code: any;
  discount: any;
  currency: any;
  currency_conversion_rate: any;
  attributes: any;
  created_by_id: any;
  created_at: any;
  cancelled_datetime: any;
  cancellation_policy: any;
}
export type ExceptionClass =
  | typeof BadRequestException
  | typeof UnauthorizedException
  | typeof ForbiddenException
  | typeof NotFoundException
  | typeof MethodNotAllowedException
  | typeof NotAcceptableException
  | typeof RequestTimeoutException
  | typeof ConflictException
  | typeof GoneException
  | typeof PayloadTooLargeException
  | typeof UnsupportedMediaTypeException
  | typeof ImATeapotException
  | typeof UnprocessableEntityException
  | typeof InternalServerErrorException
  | typeof NotImplementedException
  | typeof BadGatewayException
  | typeof ServiceUnavailableException
  | typeof GatewayTimeoutException;

export interface FormattedBookingItineraryDetails {
  app_reference: string;
  location: string;
  room_type_name: string;
  bed_type_code: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
  cancellation_policy: string;
  total_fare: number;
  currency: string;
  room_price: number;
  tax: string;
  discount: string;
  max_occupancy: string;
  adult_count: string;
  child_count: string;
  created_by_id: number;
  agent_markup: string;
}
export interface HotelBookingItineraryDetail {
  id: any;
  app_reference: any;
  location: any;
  check_in: any;
  check_out: any;
  room_id: any;
  room_type_name: any;
  bed_type_code: any;
  status: any;
  adult_count: any;
  child_count: any;
  smoking_preference: any;
  total_fare: any;
  admin_markup: any;
  agent_markup: any;
  currency: any;
  attributes: any;
  room_price: any;
  tax: any;
  max_occupancy: any;
  extra_guest_charge: any;
  cancellation_policy: any;
  child_charge: any;
  other_charges: any;
  discount: any;
  service_tax: any;
  agent_commission: any;
  tds: any;
  gst: any;
  created_by_id: any;
}
export interface PolicyDB {
  eligibilityCheck: string;
  eligible: string;
  selected: string;
  policyType: string;
  remark: string;
  app_reference: string;
  module: string;
}
export interface RoomGuest {
  NoOfAdults: number;
  NoOfChild: number;
  ChildAge: number[];
}

export interface SearchRequest {
  UserId: number;
  UserType: string;
  CheckIn: string;
  CheckOut: string;
  Currency: string;
  Market: string;
  CancellationPolicy: boolean;
  CheckInTime: string;
  CheckOutTime: string;
  CityIds: string[];
  NoOfRooms: number;
  NoOfNights: number;
  RoomGuests: RoomGuest[];
  booking_source: string;
  CorporateID: number;
  Purpose: string;
  BookingType: string;
  TrainingId: string | null;
  TripId:string;
TripName:string
}



export interface PaxDetailsLocal {
  app_reference: string;
  gender:string;
  title: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  age: number | null;
  pax_type: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  request_id: string
  postal_code: string;
  email: string;
  phone_code: string;
  phone: string | null;
  max_occupancy: number;
  RoomId: number;
  country: string;
  status: string;
  created_by_id: number | null;
  TotalFare: number;
  icici_attributes?: string;
  attributes: string;
  middle_name: string; // actually used to store EmployeeBand
}
export interface BookingPaxDetialDB {
  id: any;
  icici_attributes:string;
  gender:string;
  app_reference: any;
  title: any;
  first_name: any;
  middle_name: string;
  last_name: any;
  phone: any;
  email: any;
  pax_type: any;
  date_of_birth: any;
  address: any;
  address2: any;
  city: any;
  state: any;
  country: any;
  postal_code: any;
  phone_code: any;
  status: any;
  attributes: string;
}
export interface BookingPaxDetail {
  Id: any;
  AppReference: any;
  Gender: string;
  EmployeeBand: string;
  Title: any;
  FirstName: any;
  MiddleName: any;
  LastName: any;
  Phone: any;
  Email: any;
  PaxType: string;
  DateOfBirth: any;
  Address: any;
  Address2: any;
  City: any;
  State: any;
  Country: any;
  PostalCode: any;
  PhoneCode: any;
  Status: any;
  Attributes: string;
  LeadPax: any;
  Department:any;
  EmployeeId: any;
  EmployeeCostCenter:any;
}
export interface BookingItineraryDetail {
  Id: number;
  AppReference: string;
  Location: string;
  CheckIn: string;
  CheckOut: string;
  RoomDescription: string;
  RoomTypeName: string;
  Status: string;
  MaxChildFree: number;
  MaxChildFreeAge: number;
  SmokingPreference: string;
  TotalFare: number;
  AdminMarkup: number;
  AgentMarkup: number;
  Currency: string;
  Attributes: string;
  RoomPrice: number;
  Tax: string;
  BlockQuantity: number;
  ExtraGuestCharge: number;
  ChildCharge: number;
  OtherCharges: string;
  Discount: number;
  ServiceTax: number;
  AgentCommission: number;
  CancellationPolicy: any[];
  TDS: number;
  GST: number;
  MealPlanCode: string;
  VoucherOccupancy: string;
}
export interface BookingItineraryDetailDB {
  cancellation_policy: string;
  id: any;
  app_reference: any;
  location: any;
  check_in: any;
  check_out: any;
  room_id: any;
  room_type_name: string;
  status: string;
  adult_count: any;
  child_count: any;
  smoking_preference: any;
  total_fare: any;
  admin_markup: any;
  agent_markup: any;
  currency: any;
  attributes: any;
  room_price: any;
  tax: any;
  max_occupancy: any;
  extra_guest_charge: any;
  child_charge: any;
  other_charges: any;
  discount: any;
  service_tax: any;
  agent_commission: any;
  tds: any;
  gst: any;
  bed_type_code: any;
}
export interface BookingDetails {
  Id: any;
  Corporate: string;
  request_id: string;
  booking_source: any;
  DomainOrigin: any;
  Status: any;
  AppReference: any;
  ConfirmationReference: any;
  HotelName: any;
  StarRating: number;
  HotelCode: any;
  HotelPhoto: any;
  HotelAddress: any;
  PhoneNumber: any;
  AlternateNumber: any;
  Email: any;
  HotelCheckIn: string;
  HotelCheckOut: string;
  PaymentMode: any;
  ConvinenceValue: any;
  ConvinenceValueType: any;
  ConvinencePerPax: any;
  ConvinenceAmount: any;
  PromoCode: any;
  Discount: any;
  Currency: any;
  CurrencyConversionRate: any;
  CancellationReason: any;
  CreatedById: any;
  CreatedDatetime: string;
  CancelledDatetime: string;
  CancellationPolicy: any;
  Remarks: any;
  NoOfNights: number;
  NoOfRooms: number;
  TotalFair: any;
  Name: any;
  GuesthouseName: string;
  Type: string;
  Purpose: string;
}
export interface BookingDetailsWithCorporate extends BookingDetails {
  Corporate: string;
  MainImage:string;
  CheckInTime: string,
  CheckOutTime: string,
  TrainingId:string,
  Reason: string,
}
export interface HotelVoucher {
  BookingPaxDetails: BookingPaxDetail[];
  BookingDetails: BookingDetailsWithCorporate;
  BookingItineraryDetails: BookingItineraryDetail[];
}
export interface BookingDetailFromDB {
  booking_reference: string
  hotel_check_in?: string;
  hotel_check_out?: string;
  attributes?: string;
  id?: any;
  domain_origin?: any;
  status?: any;
  app_reference?: any;
  booking_id?: any;
  hotel_name?: any;
  star_rating: number;
  hotel_code?: string;
  hotel_photo?: any;
  hotel_address?: any;
  phone_number?: any;
  alternate_number?: any;
  email?: any;
  payment_mode?: any;
  convinence_value?: any;
  convinence_value_type?: any;
  convinence_per_pax?: any;
  convinence_amount?: any;
  promo_code?: any;
  discount?: any;
  currency?: any;
  currency_conversion_rate?: any;
  created_by_id?: any;
  created_at?: any;
  cancelled_datetime?: any;
  cancellation_policy?: any;
  booking_source: string;
  corporate_origin:number;
  trip_id: string;
  trip_name: string;
  approvar_stage_two: string;
}


export interface Traveller {
  Age: number;
  Dob: string;
  FirstName: string;
  LastName: string;
  LeadPassenger: boolean;
  PanNumber: string;
  PassengerSelectionAdult: string;
  PassportNumber: string;
  PaxType: string;
  Title: string;
  type: string;
}

export interface RoomDetailsNew {
  AddressDetails: AddressDetails;
  PassengerDetails: { RoomId: number; travellers: Traveller[] }[][];
}

export interface BookingDataNew {
  PaymentMode: string;
  AppReference: string;
  booking_source: string;
  BookingSource: string;
  Email: string;
  PromoCode: string;
  ResultToken: string;
  RoomDetails: RoomDetailsNew[];
  UserId: number;
  PolicyDetails:Policy[];
  TripId:string;
  TripName:string
}

export type Policy = {
  Eligible: string;
  Selected: string;
  PolicyType: string;
  Remark: string;
  EligibilityCheck: string;
};


//------------

export interface AddPaxDetailsHotelCRS {
  MealsCharge: number;
  AccomdationCharge: number;
  ResultToken: string
  BlockRoomId: number
  AppReference: string
  UserId: number
  RoomDetails: RoomDetailHotelCRS[]
  booking_source: string
  BookingSource: string
  PromoCode: string
  UserType: string
  EarlyBirdValue: number
  DurationOfStayValue: number
}

export interface RoomDetailHotelCRS {
  PassengerDetails: PassengerDetailHotelCRS[]
  AddressDetails: AddressDetailsHotelCRS
}

export interface PassengerDetailHotelCRS {
  Title: string
  FirstName: string
  LastName: string
  PassengerSelectionAdult: string
  RoomId: number
  PaxType: string
  LeadPassenger: boolean
  Dob: string
  Age: number
}

export interface AddressDetailsHotelCRS {
  Address: string
  City: string
  State: string
  PostalCode: string
  Email: string
  PhoneCode: string
  Contact: string
  Country: string
}
