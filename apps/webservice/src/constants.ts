//SERVER
// export const logStoragePath = "/var/www/html/booking247/node/test-data";
// export const flightDocumentsPath = "/var/www/html/booking247/node/uploads/flightDocuments/";

//LOCAL
 export const logStoragePath = "./test-data";
 export const flightDocumentsPath = "./uploads/flightDocuments/";

export const numberOfNights = (start: string, end: string): number => {
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();
  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
};
export const CRS_HOTEL_BOOKING_SOURCE = 'TLAPNO00003'
export const IRIX_HOTEL_BOOKING_SOURCE = 'IRIX00001214'

export let price = {
  CurrencyCode: "INR",
  RoomPrice: 0,
  Tax: 0,
  ExtraGuestCharge: 0,
  ChildCharge: 0,
  OtherCharges: 0,
  Discount: 0,
  PublishedPrice: 0,
  PublishedPriceRoundedOff: 0,
  OfferedPrice: 0,
  OfferedPriceRoundedOff: 0,
  AgentCommission: 0,
  AgentMarkUp: 0,
  ServiceTax: 0,
  TCS: 0,
  TDS: 0,
  ServiceCharge: 0,
  TotalGSTAmount: 0,
  GST: {
    CGSTAmount: 0,
    CGSTRate: 0,
    CessAmount: 0,
    CessRate: 0,
    IGSTAmount: 0,
    IGSTRate: 0,
    SGSTAmount: 0,
    SGSTRate: 0,
    TaxableAmount: 0,
  },
  Amount: 0,
  Currency: "INR",
  Commission: 0,
};
export const BOOKING_SOURCE_CRS = "HOTEL_CRS";

export const SUPPLIER_PASSWORD = "Supplier@123";

export const viatorApiKey = "ad5cf8cf-5a99-4d71-b18a-16d27fb6b9c5";
export const viatorUrl = "https://viatorapi.viator.com/service/";

//test
export const HB_ACTIVITY_URL =
  "https://api.test.hotelbeds.com/activity-api/3.0";
export const HB_ACTIVITY_CONTENT_URL =
  "https://api.test.hotelbeds.com/activity-content-api/3.0";
export const activityApiKey = "8d29e5c31471065939d8f9ab85b7979a";
export const secret = "f3c9753047";

export const activityApiKeyB2B = "8d29e5c31471065939d8f9ab85b7979a";
export const secretB2B = "f3c9753047";

//Live
// export const HB_ACTIVITY_URL =
//   "https://api.hotelbeds.com/activity-api/3.0";
// export const HB_ACTIVITY_CONTENT_URL =
//   "https://api.hotelbeds.com/activity-content-api/3.0";
// export const activityApiKey = "a36efb64fa9164f0e96fca7c403bacd0";
// export const secret = "4439808312";

export const SABRE_TOEKN_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Authorization: "Basic VmpFNk56azJNRE0xT2s0eU1FdzZRVUU9OmMyRjBZWFJqTWpRPQ==",
};
// VmpFNmEycHBOVE42YlhwbU5XVm5hSE50TXpwRVJWWkRSVTVVUlZJNlJWaFU6VWxBMGRWZHpObTQ9

// export const SABER_API_URL = 'https://api.havail.sabre.com/';
export const SABER_API_URL = "https://api-crt.cert.havail.sabre.com/";
export const PseudoCityCode = "N20L";
export const CompanyCode = "TN";

export const FARE_API_URL = "";
export const FARE_PATNERID = "=";
export const FARE_SIGN = "";

export const FARE_PHP_URL = "";

export const SUPPORT_EMAIL = "info@airwine.com";
// export const SUPPORT_EMAIL = "info@booking247.com";
export const UI_SERVER_IP = "http://54.198.46.240/booking247";
// export const UI_SERVER_IP = "https://booking247.com";
export const CANCEL_EMAIL = "ques@airwine.com";
// export const CANCEL_EMAIL = "ques@booking247.com";

export const RequestType = "200ITINS";

// export const TMX_USER_NAME = "TMX501668";
// export const TMX_PASSWORD = "TMX@604501";
// export const TMX_URL = "http://prod.services.travelomatix.com";
// export const TMX_SYSTEM = "live";
// export const TMX_DOMAINKEY = "TMX4775011665984787";

// export const TMX_USER_NAME = "test22926789";
// export const TMX_PASSWORD = "test@229";
// export const TMX_URL = "http://test.services.travelomatix.com";
// export const TMX_SYSTEM = "test";
// export const TMX_DOMAINKEY = "TMX1512291534825461";

// export const TMX_USER_NAME = "test245274";
// export const TMX_PASSWORD =  "test@245";
// export const TMX_URL = "http://test.services.travelomatix.com";
// export const TMX_SYSTEM = "test";
// export const TMX_DOMAINKEY = "TMX3372451534825527";

// export const TMX_USER_NAME = "TMX573335";
// export const TMX_PASSWORD =  "TMX@374573";
// export const TMX_URL = "http://prod.services.travelomatix.com";
// export const TMX_SYSTEM = "live";
// export const TMX_DOMAINKEY = "TMX4585731713519784";

export const TMX_USER_NAME = "test22926789";
export const TMX_PASSWORD = "test@229";
export const TMX_URL = "http://test.services.travelomatix.com";
export const TMX_SYSTEM = "test";
export const TMX_DOMAINKEY = "TMX1512291534825461";

// HYPERT GUEST
export const HYPER_GUEST_TOKEN = "43ad539134e84a389ecc6a7761888391";

//TBO Holidays credential
export const TBOH_USERNAME = "mzahidtraveltest";
export const TBOH_PASSWORD = "Mza@10616703";

// HUMMING BIRD CREDS

//Test
export const HMBT_URL = `https://api.hbtserver.net`;
export const HMBT_CLIENT_ID = "a1f7ca00-70c9-421d-8299-eb7facdf9e37";
export const HMBT_CLIENT_SECRET = "jJP81i8uoxiZP0uwMuobnjRH3OB0x7X82r5Y2asJ";
export const HMBT_USER_EMAIL = "mahmoud.fathi@booking247.com";

//Live Credentials
// export const HMBT_URL = `https://api.hummingbird.travel`;
// export const HMBT_CLIENT_ID = "f0a77a54-40ff-41f5-a58a-102114ad8489";
// export const HMBT_CLIENT_SECRET = "JIJuVNLtnHg9uNob1kryz7XXQ5ROEbeh4FidwqP6";
// export const HMBT_USER_EMAIL = "mahmoud.fathi@booking247.com";

export const CurrencyConvertorUrl = "https://xecdapi.xe.com/v1";
export const CurrencyConvertorUserName = "ptpvtltd397050740";
export const CurrencyConvertorPassword = "j4177rf70io6e7in789us8ct7s";

//Module List
export const META_HOTEL_COURSE = "ZBHM201120201458"; //Hotel
export const META_FLIGHT_COURSE = "ZBFM201120201459"; //Flight
export const META_CAR_COURSE = "ZBCM201120201500"; //Car
export const META_ACTIVITY_COURSE = "ZBAM201120201501"; //Activity
export const META_TL_HOTEL_COURSE = "TLHM281220201403"; //Hotel
export const META_TRANSFER_COURSE = "HBTM281220201401"; //Transfer

//API List
export const BOOKINGDOTCOM_HOTEL_BOOKING_SOURSE = "";
export const TRAVELPORT_FLIGHT_BOOKING_SOURCE = "ZBAPINO00002";
export const AMADEUS_FLIGHT_BOOKING_SOURCE = "";
export const TMX_HOTEL_BOOKING_SOURCE = "TLAPINO00003";
export const CARNECT_CAR_BOOKING_SOURCE = "";
export const VIATOR_ACTIVITY_BOOKING_SOURCE = "";
export const SMYROOMS_HOTEL_BOOKING_SOURCE = "";
export const GOGLOBAL_HOTEL_BOOKING_SOURCE = "";
export const SABRE_FLIGHT_BOOKING_SOURCE = "ZBAPINO00007";
export const FARE_FLIGHT_BOOKING_SOURCE = "";
export const USBANGLA_FLIGHT_BOOKING_SOURCE = "";
export const NOVO_FLIGHT_BOOKING_SOURCE = "";
export const TMX_FLIGHT_BOOKING_SOURCE = "ZBAPINO00010";
export const HOTELBEDS_HOTEL_BOOKING_SOURCE = "ZBAPINO00008";
export const TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE = "TLAPINO00004";
export const STUBA_HOTEL_BOOKING_SOURCE = "TLAPINO00005";
export const HOPPA_TRANSFER_BOOKING_SOURCE = "ZBAPINO00011";
export const DOTW_HOTEL_BOOKING_SOURCE = "TLAPINO00006";
export const HUMMING_BIRD_BOOKING_SOURCE = "TLAPINO00007";
export const HOTELBEDS_ACTIVITY_BOOKING_SOURCE = "ZBAPINO00003";
export const HYPER_GUEST_BOOKING_SOURCE = "HYPERST00001";

//Stripe payment gateway keys

export const STRIPE_SECRET_KEY = "";

// BARCLAYCART PAYMENT KEYS
export const PAYMENT_BARCLAYCART_API_KEY = "";
export const PAYMENT_BARCLAYCART_SECRET_KEY = "";
export const PAYMENT_PSPID = "epdq3008813";
/*
 |--------------------------------------------------------------------------
 | Application USER LIST
 |--------------------------------------------------------------------------
 */
export const AUTO_SYSTEM = 0;
export const ADMIN = 1;
export const SUB_ADMIN = 2;
export const B2B_USER = 3;
export const B2C_USER = 4;
export const B2E_USER = 5;
export const CALL_CENTER_USER = 6;

export const INACTIVE = 0;
export const FAILURE_STATUS = 0;
export const QUERY_FAILURE = 0;
export const ACTIVE = 1;
export const SUCCESS_STATUS = 1;
export const QUERY_SUCCESS = 1;
export const PENDING = 1;
export const ACCEPTED = 2;
export const DECLINED = 3;
export const SUCCESS_MESSAGE = 0;
export const ERROR_MESSAGE = 1;
export const WARNING_MESSAGE = 2;
export const INFO_MESSAGE = 3;

export const BOOKING_CONFIRMED = 1; //Booking completed
export const BOOKING_HOLD = 2; //Booking on hold
export const BOOKING_CANCELLED = 3; //Booked and cancelled
export const BOOKING_ERROR = 4; //unable to continue booking
export const BOOKING_INCOMPLETE = 5; //left in between
export const BOOKING_VOUCHERED = 6; //left in between
export const BOOKING_PENDING = 7; //left in between
export const BOOKING_FAILED = 8; //left in between
export const BOOKING_INPROGRESS = 9; //Booking is processing
export const CANCELLATION_INITIALIZED = 10; //Cancelled by user and Pending from API side

export const BaseCountry = "USA";
export const ExchangeRate_1_USD_to_BDT = 84.81;

export const ExchangeRate_1_INR_to_BDT = 1.4;

export const SEARCH_ERROR_STRING =
  "No flights found on this route for the requested date.";
export const BOOKING247_HELPLINE_NUMBER = "012345678";
export const SMS_USERNAME = "Airwin";
export const SMS_PASSWORD = "Airwin@0011";
export const SMS_FROM = "Airwin";

export const IS_MARKUP = true;
export const IS_COMMISSION = true;
export const IS_MARKUP_AND_COMMISSION = true;
export const IS_MARKUP_B2C = true;
export const ADVANCE_TAX_PERCENT = 0;

// Travelomatix credentials
// Prod
// export const UserName = 'TMX508760';
// export  const Password = 'TMX@760508';
// export  const DomainKey = 'TMX4415081674213501'
// export  const System = 'live'
// export const Url = 'http://prod.services.travelomatix.com/webservices/index.php/hotel_v3/service/'

// Test
export const Url =
  "http://test.services.travelomatix.com/webservices/index.php/hotel_v3/service/";
export const UserName = "test22926789";
export const Password = "test@229";
export const DomainKey = "TMX1512291534825461";
export const System = "test";

// TBO_URL
export const TBO_URL = "http://api.tbotechnology.in/TBOHolidays_HotelAPI";

// Stub_Common_URL

export const STUBA_URL = 'http://www.stubademo.com/RXLStagingServices/ASMX/XmlService.asmx'
export const STUBA_ORG = 'PLANET'
export const STUBA_USER = 'xmltest'
export const STUBA_PWD = 'xmltest' 
export const STUBA_CURRENCY = 'USD'

// export const STUBA_URL = 'http://booking247.stuba.com/RXLServices/ASMX/XmlService.asmx'
// export const STUBA_ORG = 'booking247'
// export const STUBA_USER = 'XML'
// export const STUBA_PWD = 'vd%F65xbjB' 
// export const STUBA_CURRENCY = 'GBP'



export const DOTW_URL = `http://xmldev.dotwconnect.com/gatewayV4.dotw`

export const DOTW_B2B_USERNAME = 'Booking247LtdDC'
export const DOTW_B2B_PASSWORD = 'Booking@247##**'
export const DOTW_B2B_COMPANYCODE = '2094055'

export const DOTW_B2C_USERNAME = 'Booking247B2C'
export const DOTW_B2C_PASSWORD = 'B2C@Booking247##'
export const DOTW_B2C_COMPANYCODE = '2094865'


export const BusUrl =
  "http://test.services.travelomatix.com/webservices/index.php/bus/service/";
// export const BusUrl = 'http://prod.services.travelomatix.com/webservices/index.php/bus_v3/service/';

export const KEY_PATH = "/secrets/nosafer.key";
export const CERT_PATH = "/secrets/nosafer.crt";

//Booking247
// export const HOTELBEDS_URL = "https://api.hotelbeds.com/hotel-api/1.0/" //Live
// export const HOTELBEDS_APIKEY = "763c4fd753e878a92c2636bd35689c79";//Live
// export const HOTELBEDS_SECRET = "0222898ee5"; //Live

//BKG247 HB B2B
// export const HOTELBEDS_URL = "https://api.hotelbeds.com/hotel-api/1.0/" //Live
// export const HOTELBEDS_B2B_APIKEY = "d9e12edef2cac4a917474d8557aaa0c3";//Live
// export const HOTELBEDS_B2B_SECRET = "f4580d43e4"; //Live

export const HOTELBEDS_URL = "https://api.test.hotelbeds.com/hotel-api/1.0/";
// export const HOTELBEDS_APIKEY = "6f07f6061e9773f5e8102dc3ccc2910e"; //Test
// export const HOTELBEDS_SECRET = "fa5dc5def2"; //Test

// export const HOTELBEDS_B2B_APIKEY = "6f07f6061e9773f5e8102dc3ccc2910e"; //Test
// export const HOTELBEDS_B2B_SECRET = "fa5dc5def2"; //Test

//Karthick Key use it only when bookig247 Quota Exceed
export const HOTELBEDS_APIKEY = "82a0816343c186737bee323713d89576";
export const HOTELBEDS_SECRET = "933667764f";

export const HOTELBEDS_B2B_APIKEY = "82a0816343c186737bee323713d89576"; //Test
export const HOTELBEDS_B2B_SECRET = "933667764f"; //Test


//Nosafer Credentials use it only when bookig247 Quota Exceed
// export const HOTELBEDS_APIKEY = "70da61eccc961febfcd3b1b83f2d9cb5";
// export const HOTELBEDS_SECRET = "47b8d47fa6";

// export const HOTELBEDS_B2B_APIKEY = "70da61eccc961febfcd3b1b83f2d9cb5"; //Test
// export const HOTELBEDS_B2B_SECRET = "47b8d47fa6"; //Test


export const ExchangeRate_1_GBP_to_INR = 105.13;
export const ExchangeRate_1_GBP_to_USD = 1.27;

export const ExchangeRate_1_EUR_to_INR = 90.46;
export const ExchangeRate_1_EUR_to_USD = 1.08;

export const BASE_CURRENCY = "GBP";
export const HMBT_CURRENCY : String = "USD"      //HummingBird Currency



//Live Credentials Travelport

export const TRAVELPORT_VERSION = "v52_0";
export const TRAVELPORT_SCHEMA =
  "http://www.travelport.com/schema/common_" + TRAVELPORT_VERSION;
export const TRAVELPORT_AIR_URL =
  "http://www.travelport.com/schema/air_" + TRAVELPORT_VERSION;
export const TRAVELPORT_API_URL =
  "https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService";
export const TRAVELPORT_API_URL_UNIVERSAL =
  "https://americas.universal-api.travelport.com/B2BGateway/connect/uAPI/UniversalRecordService";

export const TRAVELPORT_UNIVERSAL_URL =
  "http://www.travelport.com/schema/universal_" + TRAVELPORT_VERSION;
export const ProviderCode: string = "8S64";
export const TRAVELPORT_USERNAME = "uAPI2941727303-1acb5b36";
export const TRAVELPORT_PASSWORD = "8Re_*4DpHq";
export const TargetBranch = "P7221968";
export const MaxSolutions = "200";
export const BASIC_CODE = Buffer.from(TRAVELPORT_USERNAME+':'+TRAVELPORT_PASSWORD).toString('base64');
export const TRAVELPORT_HEADERS = {
  "Content-Type": "text/xml;charset=UTF-8",
  Authorization:
    `Basic ${BASIC_CODE}`,
};
//Live Credentials Travelport

export const HOPPA_TRANSFER_URL = "http://test.xmlp2p.com/xml/";
export const HOPPA_B2C_USERNAME = ""; 
export const HOPPA_B2C_PASSWORD = ""; 
export const HOPPA_B2B_USERNAME = "";
export const HOPPA_B2B_PASSWORD = "";

export const TOUR_AUTH_RADAR_URL =
  "https://oauth.api.sandbox.b2b.tourradar.com/";
export const TOUR_RADAR_URL = "https://api.sandbox.b2b.tourradar.com/";
export const TOUR_RADAR_CLIENT_ID = "fe1x837r3yclnilkbkellb9l6q";
export const TOUR_RADAR_CLIENT_SECRET =
  "p6n2t8p3phpe2pu6vg0ui0scvh82lysu2xv42992mq6iyg0pckd";
export const TMX_SIGHTSEEING_BOOKING_SOURCE = "BGTAPINO00001";
export const TR_SIGHTSEEING_BOOKING_SOURCE = "BGTAPINO00002";

export const META_SIGHTSEEING_COURSE = "BKGS200820241935"; //Holiday

export const GOOGLE_MAP_KEY = "AIzaSyB3N3Rg1vCjF6FmEc9qisxtS2JOpVUTKDM";

export const GIATA_IMAGE_BASE_URL = "https://photos.hotelbeds.com/giata/bigger/";

export const IXRIX_URL = "https://capitalsky.co/reseller/api/hotels/v1/";
export const IRIX_TOKEN_URL ="https://capitalsky.co/reseller/oauth2/token";
export const IRIX_AUTH_URL ="https://capitalsky.co/reseller/oauth2/authorize";
export const IRIX_CLIENT_ID ="8de26eac0d9a442bab36a7c9c417767d";
export const IRIX_CLIENT_SECRET ="a51ebe67c97c40acabffead482ad5359";


export const SAFARI_BOOKING_SOURCE = "SAFARI00012";

export const SAFARI_URL = "http://sandbox.kplus.com.tr/kplus/v0";

export const SAFARI_USERNAME = "Test_24425";
export const SAFARI_PASSWORD = "Ykqytl4LQ5EUmbY";


