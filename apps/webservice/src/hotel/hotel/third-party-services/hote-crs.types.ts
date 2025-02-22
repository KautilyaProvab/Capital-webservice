import {
  CancelPenalty,
  RoomDetail,
  RoomDetails,
  SearchRequest,
  Policy,
  RoomGuest,
} from "../hotel-types/hotel.types";

type GuestSearch = {
  NoOfAdults: number;
  NoOfChild: number;
  ChildAge: number[];
};

type PriceSearch = {
  room_view: string;
  meal_type: string;
  total_price: number;
  adult_price: number;
  child_price: number;
  guest: GuestSearch;
  room_id: number;
};

type RoomDetailsSearch = {
  origin: number;
  chl_fk: string;
  HotelCode: string;
  CityCode: string;
  name: string;
  type: string;
  board_type: string;
  occu: number;
  occupancy_child: number;
  occupancy_infant: number;
  occupancy_adult: number;
  room_view: string;
  no_of_room: number;
  cancellation_policy: string | null;
  meal_type: string;
  ameneties: string;
  room_description: string;
  room_code: string;
  room_status: number;
  bed_type: string;
  refundable: number;
  price: SimplePrice[][];
  price_per_night_minimum: number | null;
};

export type HotelSearch = {
  markupDetails: any;
  ResultIndex: string;
  origin: number;
  corporate_id: number | null;
  HotelCode: string;
  CityCode: string;
  HotelName: string;
  Latitude: string;
  Longitude: string;
  Address: string;
  Country: string;
  City: string;
  State: string;
  Starrating: number;
  Description: string;
  Amenities: string[];
  Email: string;
  mainimage: string;
  images: string | null;
  chain_group: string | null;
  price: number | null;
  gst_state: string;
  gst_number: string;
  location: string;
  beneficiary_name: string;
  beneficiary_account_number: string;
  bank_name: string;
  bank_branch: string | null;
  bank_city: string | null;
  ifsc_code: string;
  hotel_type: string;
  user_id: number;
  mob: string;
  prop_for: string | null;
  hotel_status: number;
  occu: number | null;
  contract_expiry: string;
  xl_hotel_code: string | null;
  priority: number;
  weekend_days: string;
  room_view_ids: string;
  local_timezone: string;
  check_in_time: string;
  check_out_time: string;
  children_free_before: number;
  paid_children_from_age: number;
  paid_children_to_age: number;
  status: number;
  meal_plans: string;
  currency: string;
  channel: string;
  roomDetails: RoomDetailsSearch[];
  minimum_price: number;
  no_of_nights: number;
  is_refundable: any;
  hotel_policy: string;
};

export type RoomSearch = RoomDB & {
  price: SimplePrice[][];
  price_per_night_minimum: number;
};
export type BookingDiscount = {
  days: number;
  discount_value: number;
  cancellable: boolean;
};
export type SimplePrice = {
  room_view: string;
  meal_type: string;
  total_price: number;
  adult_price: number;
  child_price: number;
  guest: RoomGuest;
  room_id: number;
  eligible_discount: number;
  cancellation_policy: string;
  is_refundable: boolean;
  rate_type: string;
  adult_range_discount: any;
  child_range_discount: any;
  adult_early_discount: any;
  child_early_discount: any;
  adult_duration_discount: any;
  child_duration_discount: any;
};
export type GroupedData = {
  [room_id: number]: {
    [room_view: string]: {
      [meal_type: string]: RoomPricing[];
    };
  };
};
export type ReducedGroupedData = {
  [room_id: number]: {
    [room_view: string]: {
      [meal_type: string]: ModifiedRoomPricings;
    };
  };
};
export type RoomPricing = {
  id: number;
  price_id: number;
  room_id: number;
  season_date: string;
  adult_price: string;
  child_price: string;
  infant_price: string;
  discount_value: string | null;
  discount_type: string | null;
  no_of_room: number;
  block_rooms: number;
  available_rooms: number;
  booked_rooms: number;
  board_type: string;
  meal_type: string;
  room_view: string;
  supplement_value: string;
  supplement_type: string;
  status: number;
  rate_type: string;
  is_refundable: number;
  hotel_room_cancellation_policy: string;
  non_refundable_discount: number;
  early_booking: string;
  duration_of_stay: string;
  minimum_stay: number;
  date_range_discount: number;
  range_discount_adult: any;
  range_discount_child: any;
  early_discount_adult: any;
  early_discount_child: any;
  duration_discount_adult: any;
  duration_discount_child: any;
};

export type ModifiedRoomPricing = Omit<
  RoomPricing,
  "adult_price" | "child_price" | "supplement_value" |"is_refundable"
> & {
  adult_price: Record<number, number>;
  child_price: Record<number, number>;
  elgible_discount: number;
  nonRefundableDiscountMapAdult: Record<number, number>;
  nonRefundableDiscountMapChild: Record<number, number>;
  is_refundable: boolean;
  range_discount_adult: Record<number, number>;
  range_discount_child: Record<number, number>;
  early_discount_adult: Record<number, number>;
  early_discount_child: Record<number, number>;
  duration_discount_adult: Record<number, number>;
  duration_discount_child: Record<number, number>;
};

export type ModifiedRoomPricings = Omit<
  RoomPricing,
  "adult_price" | "child_price" | "supplement_value" |"is_refundable"
> & {
  adult_price: Record<number, number>;
  child_price: Record<number, number>;
  elgible_discount: number;
  nonRefundableDiscountMapAdult: Record<number, number>;
  nonRefundableDiscountMapChild: Record<number, number>;
  is_refundable: boolean;
};

export type HotelDB = {
  origin: number;
  corporate_id: number | null;
  HotelCode: string;
  CityCode: string;
  HotelName: string;
  Latitude: string;
  Longitude: string;
  Address: string;
  Country: string;
  City: string;
  State: string;
  Starrating: number;
  Description: string;
  Amenities: string;
  Email: string;
  mainimage: string;
  images: string | null;
  chain_group: string | null;
  price: number | null;
  gst_state: string;
  gst_number: string;
  location: string;
  beneficiary_name: string;
  beneficiary_account_number: string;
  bank_name: string;
  bank_branch: string | null;
  bank_city: string | null;
  ifsc_code: string;
  hotel_type: string;
  user_id: number;
  contract_expiry: string | null;
  mob: string;
  prop_for: string | null;
  hotel_status: number;
  occu: number | null;
  xl_hotel_code: string | null;
  priority: number;
  weekend_days: string;
  room_view_ids: string;
  local_timezone: string;
  check_in_time: string;
  check_out_time: string;
  children_free_before: number;
  paid_children_from_age: number;
  paid_children_to_age: number;
  status: number;
  meal_plans: string;
  currency: string;
  channel: string;
};
export type RoomDB = {
  weekend_days: string;
  origin: number;
  chl_fk: string;
  HotelCode: string;
  CityCode: string;
  name: string;
  type: string;
  board_type: string;
  occu: number;
  occupancy_child: number;
  occupancy_infant: number;
  occupancy_adult: number;
  room_view: string;
  no_of_room: number;
  cancellation_policy: string | null;
  meal_type: string;
  ameneties: string;
  room_description: string;
  room_code: string;
  room_status: number;
  bed_type: string;
  refundable: number;
};
export type ModifiedRoomDB = RoomDB & {
  price: number;
  room_id: number;
  currency: string;
  room_pricing: ModifiedRoomPricing;
};
export interface HotelQueryParams {
  UserType: string;
  ResultToken: string;
  RoomResultToken: string[];
  booking_source: string;
}
export type BusinessEmailTypeRaw = {
  business_number: string;
  FullName: string;
  user_email: string;
  approvar: string;
};
export type BusinessEmailType = Omit<BusinessEmailTypeRaw, "approvar"> & {
  approver_email: string;
  ApprovarName: string;
};
export type cancelBookingHelper = {
  email: string;
  name: string;
  BookingType: string;
  hotel_name: string;
  ManagerRemoteEmployeeId?: string;
  request_id: string;
  corporate_origin: number;
};

type GstDetails = {
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
  GST: GstDetails;
  Amount: number;
  Currency: string;
  Commission: number;
}

// interface SearchRequest {
//     CheckIn: string;
//     CheckOut: string;
//     Currency: string;
//     Market: string;
//     CancellationPolicy: boolean;
//     CityIds: string[];
//     NoOfRooms: number;
//     RoomGuests: {
//         NoOfAdults: number;
//         NoOfChild: number;
//     }[];
//     booking_source: string;
//     UserId: number;
//     UserType: string;
// }

export interface HotelInfoSearch {
  Priority: number;
  HotelCode: string;
  HotelName: string;
  StarRating: number;
  NoOfNights: number;
  HotelDescription: string;
  HotelPromotion: string;
  HotelPolicy: string;
  HotelPicture: string;
  HotelAddress: string;
  MainImage: string;
  HotelContactNo: string;
  HotelMap: string;
  Latitude: number;
  Longitude: number;
  Breakfast: string;
  HotelLocation: string;
  SupplierPrice: string;
  OrginalHotelCode: string;
  HotelPromotionalContent: string;
  PhoneNumber: string;
  HotelAmenities: string[];
  Free_cancel_date: string;
  trip_adv_url: string;
  trip_rating: string;
  NoOfRoomsAvailableAtThisPrice: string;
  HotelCurrencyCode: string;
  NoOfReviews: string;
  ReviewScore: string;
  ReviewScoreWord: string;
  RoomDetails: RoomDetailVarient[][];
  booking_source: string;
  DealTagging: string;
  BoardType: string[];
  chain_group: string;
  Price: {
    Amount: number;
    Currency: string;
    Commission: number;
    Markup: number;
  };
  CheckIn: string;
  CheckOut: string;
  searchRequest: SearchRequest;
  ResultIndex: string;
  roomDetails: RoomDetailsSearch[];
  CreatedById: number;
}
export interface RoomDetailVarient {
  code: string;
  name: string;
  rate: Rate[];
}
export interface Rate {
  name: string;
  rateKey: string;
  rateClass: string;
  rateType: string;
  net: string;
  allotment: string;
  paymentType: string;
  packaging: boolean;
  boardCode: string;
  RoomType: string;
  NonRefundable: string;
  boardName: string;
  cancellationPolicies: CancellationPolicies;
  rooms: number;
  adults: number;
  children: number;
  offers: string;
}

export interface CancellationPolicies {
  $t: string | any[];
}
export interface HotelDetailedInfo
  extends Omit<HotelInfoSearch, "RoomDetails"> {
  RoomDetails: RoomDetails[][];
  Source: string;
  NoOfNights: number;
}
export interface ExtendedHotelDetailedInfo extends HotelDetailedInfo {
  HotelCategory: string;
  HotelPromotionContent: string;
  Refundable: string;
  Offers: any[];
  Fees: null;
  Remarks: string;
  CategoryId: string;
  HotelResultIndex: string;
  AgencyToken: string;
  HotelAmenities: string[];
  CancelPenalties: {
    CancelPenalty: CancelPenalty[];
  };
}

export interface HotelQueryResult {
  Priority: number;
  HotelCode: string;
  HotelName: string;
  StarRating: number;
  HotelDescription: string;
  HotelPromotion: string;
  HotelPolicy: string;
  HotelPicture: string; // Assuming 'images' column is a string. Adjust if it's an array or another type.
  HotelAddress: string;
  MainImage: string;
  HotelContactNo: string;
  HotelMap: string;
  Latitude: number;
  Longitude: number;
  Breakfast: string;
  HotelLocation: string;
  SupplierPrice: string;
  OrginalHotelCode: string;
  HotelPromotionalContent: string;
  PhoneNumber: string;
  HotelAmenities: string; // Assuming 'Amenities' column is a string. Adjust if it's an array or another type.
  Free_cancel_date: string;
  trip_adv_url: string;
  trip_rating: string;
  NoOfRoomsAvailableAtThisPrice: string;
  HotelCurrencyCode: string;
  NoOfReviews: number;
  ReviewScore: number;
  ReviewScoreWord: string;
  RoomDetails: string;
  booking_source: string;
  DealTagging: string;
  BoardType: string; // Adjust if 'board_type' is not a string.
  chain_group: string;
  Price: number; // Assuming 'Price' column is a number. Adjust if it's an object or another type.
  room_id: number; // Assuming 'r.origin' is a string.
  type: string;
  board_type: string;
  occu: number; // Assuming 'r.occu' is a number.
  no_of_room: number;
  cancellation_policy: string;
  ameneties: string; // Assuming 'r.ameneties' is a string.
  room_description: string;
}

export interface HandlebarsTemplateData {
  needsApproval: boolean;
  icicId: string;
  totalRoomPrice: number;
  address: string;
  email: string;
  name: string;
  guestDetails: GuestDetail[];
  toCity: string;
  reasonForTravel: string;
  checkIn: string;
  checkInTime: string;
  checkOutTime: string;
  checkOut: string;
  remarks: string;
  supervisorId: string;
  guestHouse: string;
  costCenter: string;
  department: string;
  designation: string;
  totalNumberOfNights: string;
  requestId: string;
  requestType: string;
  requestedBy: string;
  requestDate: string;
  companyName: string;
  created_by_id: number;
  Policies: Policy[];
  roomDetails: RoomDetailsTemplate[];
}
export interface RoomDetailsTemplate {
  roomType: string;
  roomName: string;
  roomPrice: number;
}
export interface HandlebarsTemplateDataApprovar {
  icicId: string;
  address: string;
  email: string;
  name: string;
  guestDetails: GuestDetail[];
  toCity: string;
  reasonForTravel: string;
  checkIn: string;
  checkInTime: string;
  checkOutTime: string;
  checkOut: string;
  remarks: string;
  supervisorId: string;
  guestHouse: string;
  costCenter: string;
  department: string;
  designation: string;
  totalNumberOfNights: string;
  requestId: string;
  requestType: string;
  requestedBy: string;
  requestDate: string;
  companyName: string;
  approvar_name?: string;
  rejectLink: string;
  approveLink: string;
}

interface GuestDetail {
  empCode: string;
  empName: string;
  empGender: string;
  empEmailId: string;
  empNumber: string;
  empBand: string;
}

//------

export interface HotelDetailsResult {
  ResultIndex: string;
  HotelCode: string;
  HotelName: string;
  HotelCategory: string;
  StarRating: number;
  HotelDescription: string;
  HotelPromotion: string;
  HotelPolicy: string[];
  Price: HotelDetailsPrice;
  HotelPicture: string[];
  HotelAddress: string;
  HotelContactNo: string;
  HotelMap: any;
  Latitude: string;
  Longitude: string;
  Breakfast: string;
  HotelLocation: HotelLocation;
  SupplierPrice: string;
  HotelAmenities: string[];
  OrginalHotelCode: string;
  Free_cancel_date: string;
  trip_adv_url: string;
  trip_rating: string;
  NoOfRoomsAvailableAtThisPrice: string;
  Refundable: string;
  HotelCurrencyCode: string;
  NoOfReviews: string;
  ReviewScore: string;
  PhoneNumber: string;
  ReviewScoreWord: string;
  CheckIn: string;
  CheckOut: string;
  Source: string;
  searchRequest: SearchRequest;
  booking_source: string;
  HotelPromotionContent: string;
  RoomDetails: HotelDetailsRoomDetail[][];
}

export interface HotelDetailsPrice {
  Amount: number;
  Currency: string;
  Commission: string;
}

export interface HotelLocation {
  Latitude: string;
  Longitude: string;
}

export interface HotelDetailsRoomDetail {
  AgencyToken: string;
  Rooms: HotelDetailsRoom[];
  ResultIndex: string;
  RoomUniqueId: string;
}

export interface HotelDetailsRoom {
  RoomName: string;
  Index: string;
  Price: Price2[];
  Id: string;
  Description: string;
  RoomType: string;
  NonRefundable: boolean;
  MealPlanCode: string;
  Occupancy: any;
  CancellationPolicies: CancellationPolicies;
  paxCount: string;
  AdultCount: number;
  ChildrenCount: number;
  Rooms: number;
  Supplements: any[];
  Message: string;
  AvailableRooms: string;
  mealsAmount: number;
  dateRangeDiscount: number;
  basePrice: number;
  markupDetails: any;
  getEarlyAndDurationDetails: any[];
  hotelTaxPlusValue: number;
  roomImages: any[];
}

export interface Price2 {
  FromDate: string;
  ToDate: string;
  Amount: string;
  Currency: string;
  Markup: number;
  EligibleDiscount: number;
  hotelTaxCharge: number
}

// export interface CancellationPolicies {
//   $t: string;
// }

//----------------

export interface BlockRoom {
  ResultIndex: string;
  HotelCode: string;
  HotelName: string;
  HotelCategory: string;
  StarRating: number;
  HotelDescription: string;
  HotelPromotion: string;
  HotelPolicy: HotelPolicy[];
  Price: PriceDetails;
  HotelPicture: string;
  HotelAddress: string;
  HotelContactNo: string;
  HotelMap: any;
  Latitude: string;
  Longitude: string;
  Breakfast: string;
  HotelLocation: any;
  SupplierPrice: any;
  RoomDetails: BlockRoomDetail[];
  OrginalHotelCode: string;
  HotelPromotionContent: string;
  PhoneNumber: string;
  HotelAmenities: string[];
  Free_cancel_date: string;
  trip_adv_url: string;
  trip_rating: number;
  NoOfRoomsAvailableAtThisPrice: string;
  Refundable: boolean;
  HotelCurrencyCode: string;
  NoOfReviews: number;
  ReviewScore: number;
  ReviewScoreWord: string;
  CheckIn: string;
  CheckOut: string;
  Source: string;
  searchRequest: SearchRequest;
  ResultToken: string;
  CreatedById: number;
}

export interface HotelPolicy {
  amount: number;
  from: string;
}

export interface PriceDetails {
  Amount: number;
  Currency: string;
  Commission: number;
  Markup: number;
  EligibleDiscount: number;
}

export interface BlockRoomDetail {
  Price: Price2;
  Index: string;
  code: string;
  Id: string;
  Description: string;
  RoomType: string;
  NonRefundable: boolean;
  MealPlanCode: string;
  Occupancy: number;
  cancellationPolicies: string;
  paxCount: string;
  AdultCount: number;
  ChildrenCount: number;
  Rooms: number;
  RoomName: string;
}
