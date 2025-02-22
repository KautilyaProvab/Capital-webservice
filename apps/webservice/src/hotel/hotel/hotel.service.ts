import { Injectable } from "@nestjs/common";
import { BaseApi } from "../../base.api";
import {
  HOTELBEDS_HOTEL_BOOKING_SOURCE,
  META_TL_HOTEL_COURSE,
  TMX_HOTEL_BOOKING_SOURCE,
  TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE,
  STUBA_HOTEL_BOOKING_SOURCE,
  DOTW_HOTEL_BOOKING_SOURCE,
  HUMMING_BIRD_BOOKING_SOURCE,
  HYPER_GUEST_BOOKING_SOURCE,
  CRS_HOTEL_BOOKING_SOURCE,
  IRIX_HOTEL_BOOKING_SOURCE
} from "../../constants";
import { HotelDbService } from "./hotel-db.service";
import {
  ApplyPromocodeDao,
  ApplyPromocodeDto,
  AutoCompleteDao,
  AutoCompleteDto,
  CityListDao,
  CityListDto,
  CountryListDao,
  CountryListDto,
  FiveStarHotelsDao,
  FiveStarHotelsDto,
  GuestLoginDao,
  GuestLoginDto,
  HotelAttractionsDao,
  HotelAttractionsDto,
  HotelBookingVoucherDao,
  HotelBookingVoucherDto,
  HotelDealsDao,
  HotelDealsDto,
  HotelDetailsDao,
  HotelDetailsDto,
  NearByHotelsDao,
  NearByHotelsDto,
  PaymentSubmitDao,
  PaymentSubmitDto,
  PreBookingDao,
  PreBookingDto,
  RecentSearchDao,
  RecentSearchDto,
  SearchDto,
  SendMeDealsDao,
  SendMeDealsDto,
  StateListDao,
  StateListDto,
  SubmitBookingDao,
  SubmitBookingDto,
  TitleListDao,
  TitleListDto,
  TopHotelDestinationsDao,
  TopHotelDestinationsDto,
} from "./swagger";
import { formatDate } from '../../app.helper';
import { GoGlobalService } from "./third-party-services";
import { TravelomatixDotComService } from "./third-party-services/travelomatix-dot-com.service";
import { HotelBedsService } from "./third-party-services/hotelbeds.service";
import { TboHolidaysDotComService } from "./third-party-services/tboHolidays-dot-com";
import { stubaDotComService } from "./third-party-services/stuba.-dot-com";
import { DotwDotComService } from "./third-party-services/dotw-dot-com";
import { HummingBirdDotComService } from "./third-party-services/hmbt-dot-com";
import { HyperGuestDotComService } from "./third-party-services/hyper-guest-dot-com";
import { HoterlCrsService } from "./third-party-services/hotel-crs.service";
import { IRIXService } from "./third-party-services/irix.service";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";

@Injectable()
export class HotelService extends BaseApi {
  private currentSuppliers: any = [];
  constructor(
    private travelomatixDotComService: TravelomatixDotComService,
    private HotelBedsService: HotelBedsService,
    private hotelDbService: HotelDbService,
    private goglobal: GoGlobalService,
    private tboHolidaysDotComService: TboHolidaysDotComService,
    private stubaDotComService: stubaDotComService,
    private DotwDotComService: DotwDotComService,
    private HummingBirdDotComService: HummingBirdDotComService,
    private HyperGuestDotComService: HyperGuestDotComService,
    private hotelCrsService: HoterlCrsService,
    private redisServerService: RedisServerService,
    private irixService: IRIXService
  ) {
    super();
    // this.currentSuppliers.push({ name: TMX_HOTEL_BOOKING_SOURCE, service: this.travelomatixDotComService });
    this.currentSuppliers.push({
      name: TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE,
      service: this.tboHolidaysDotComService,
    });
    this.currentSuppliers.push({
      name: HOTELBEDS_HOTEL_BOOKING_SOURCE,
      service: this.HotelBedsService,
    });
    this.currentSuppliers.push({
      name: STUBA_HOTEL_BOOKING_SOURCE,
      service: this.stubaDotComService,
    });
    this.currentSuppliers.push({
      name: DOTW_HOTEL_BOOKING_SOURCE,
      service: this.DotwDotComService,
    });
    this.currentSuppliers.push({
      name: HUMMING_BIRD_BOOKING_SOURCE,
      service: this.HummingBirdDotComService,
    });
    this.currentSuppliers.push({
      name: HYPER_GUEST_BOOKING_SOURCE,
      service: this.HyperGuestDotComService,
    });
    // this.currentSuppliers.push({
    //   name: CRS_HOTEL_BOOKING_SOURCE,
    //   service: this.hotelCrsService,
    // });
    this.currentSuppliers.push({
      name: IRIX_HOTEL_BOOKING_SOURCE,
      service: this.irixService,
    });
  }

  async searchCRS(body: any): Promise<any> {
    return await this.hotelCrsService.search(body);
  }
//   async hotelDetails2(body: any): Promise<any> {
//     return await this.hotelCrsService.hotelDetails(body);
//   }

  // async hotelDetailsTravelomatix(body:any):Promise<any>{
  //     const hotelDetailsTravelomatix = await this.travelomatixDotComService.getHotelDetails(body);
  //     return hotelDetailsTravelomatix;
  // }
  async roomListTravelomatix(body: any): Promise<any> {
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    return await source["service"].getRoomList(body);
  }

  async addRecentSearch(req: any, body: any) {
    const addRecentSearch = await this.hotelDbService.addRecentSearche(
      req,
      body
    );
    return addRecentSearch;
  }

  async getRecentSearch(req: any, body: any): Promise<any[]> {
    const getRecentSearch = await this.hotelDbService.getRecentSearch(
      req,
      body
    );

    return getRecentSearch;
  }

  async getRecentSearchOfWeek(req: any, body: any) {
    const getRecentSearchByDate = await this.hotelDbService.getRecentSearchOfWeek(
      req,
      body
    );

    return getRecentSearchByDate;
  }

  async deleteRecentSearch(req: any, body: any) {
    return await this.hotelDbService.deleteRecentSearch(req, body);
  }

  async sendMeDeals(body: SendMeDealsDto): Promise<SendMeDealsDao[]> {
    return [];
  }

  // async hotelDetails(body: HotelDetailsDto): Promise<HotelDetailsDao[]> {
  //     return [];
  // }

  async hotelAttractions(
    body: HotelAttractionsDto
  ): Promise<HotelAttractionsDao[]> {
    return [];
  }

  async guestLogin(body: GuestLoginDto): Promise<GuestLoginDao[]> {
    return [];
  }

  async countryList(body: CountryListDto): Promise<CountryListDao[]> {
    return await this.hotelDbService.countryList(body);
  }

  async stateList(body: StateListDto): Promise<StateListDao[]> {
    return await this.hotelDbService.stateList(body);
  }

  async cityList(body: CityListDto): Promise<CityListDao[]> {
    return await this.hotelDbService.cityList(body);
  }

  async addBookingDetails(body: any): Promise<any[]> {
    return await this.hotelDbService.addHotelBookingDetails(body);
  }

  async addBookingPaxDetails(body: any): Promise<any[]> {
    return await this.hotelDbService.addHotelBookingPaxDetails(body);
  }

  async addBookingItineraryDetails(body: any): Promise<any[]> {
    return await this.hotelDbService.addHotelBookingItineraryDetails(body);
  }

  async applyPromocode(body: ApplyPromocodeDto): Promise<ApplyPromocodeDao[]> {
    return [];
  }

  async preBooking(body: PreBookingDto): Promise<PreBookingDao[]> {
    return [];
  }

  async paymentSubmit(body: PaymentSubmitDto): Promise<PaymentSubmitDao[]> {
    return [];
  }

  async submitBooking(body: SubmitBookingDto): Promise<SubmitBookingDao[]> {
    return [];
  }

  async bookingConfirmed(body: any): Promise<any> {
    const result = await this.hotelDbService.bookingConfirmed(body);
    return result;
  }

  async hotelBookingVoucher(
    body: HotelBookingVoucherDto
  ): Promise<HotelBookingVoucherDao[]> {
    return [];
  }

  async autoCompleteSmyrooms(body: any): Promise<any> {
    return await this.hotelDbService.getDestByName(body);
  }

  async autoComplete(body: any): Promise<any> {
    return await this.hotelDbService.getDestByName(body);
  }

  async hotelsAvailability(body: any): Promise<any> {
    if (body.booking_source == CRS_HOTEL_BOOKING_SOURCE) {
      return this.hotelCrsService.search(body);
    }
    var query = `SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
                    FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
                    JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
                    JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
                    WHERE BS.booking_engine_status=1 
                    AND AC.status=1 AND BS.meta_course_key = '${META_TL_HOTEL_COURSE}'
                    AND DL.id = 1`;
    if (body.booking_source) {
      query = `${query}  AND BS.source_key='${body.booking_source}'`;
    }
    query = `${query}  ORDER BY BS.id DESC`;
    let suppliers: any = await this.manager.query(query);
    // suppliers=JSON.parse(JSON.stringify(suppliers))
    
    if(body.DeDuToken == undefined || body.DeDuToken == ""){
    var duplicationHotelCodeGiataId= await this.hotelDbService.duplicationHotelCodeGiataId(body['CityIds'][0]); 
   
    const formattedResult = duplicationHotelCodeGiataId.reduce((acc, item) => {
      acc[item.giata_code] = {giata_code: item.giata_code, price: item.price }; // Or any property of item you want to keep
      return acc;
    }, {});
    formattedResult.uniqueHotelId = 0;
    const token = this.redisServerService.geneateResultToken(body.searchId);
    
    const duplicatHotelList = await this.redisServerService.insert_record(token, JSON.stringify(formattedResult));

    const DeDuToken = duplicatHotelList["access_key"];
    body.DeDuToken = DeDuToken;
  
  }else{
    // const duplicatHotelListData =await this.redisServerService.read_list(body.DeDuToken);
     
    // const duplicatHotelList= JSON.parse(duplicatHotelListData);
    // console.log("duplicatHotelList-",duplicatHotelList);
  }
    //get city and country id 
    if(body.booking_source == HOTELBEDS_HOTEL_BOOKING_SOURCE||STUBA_HOTEL_BOOKING_SOURCE||HUMMING_BIRD_BOOKING_SOURCE||TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE){
    // var HotelCityCountryCode= await this.hotelDbService.HotelCityCountryCode(body['CityIds'][0]); 
    var HotelCityCountryCode= await this.hotelDbService.HotelCityCountryCode(body['CityIds'][0]); 
    
    body.MarkupCity=HotelCityCountryCode[0].city_id;
    body.MarkupCountry=HotelCityCountryCode[0].country_code;
    }else{
      body.MarkupCity="";
    body.MarkupCountry="";
    }
    if (suppliers.length) {
      let allResults = [];
      for (let i = 0; i < suppliers.length; i++) {
        const source = this.currentSuppliers.find(
          (t) => t.name == suppliers[i]["booking_source"]
        );
         const result = await source["service"].search(body);

        // const result = await source['service'].search(body);
        // BookingTravelerRefObj[suppliers[i]['booking_source']] = result['BookingTravelerRefObj'];
        // allResults.push(...result);
        return result;
      }
    }
  }

  async hotelDetails(body: any): Promise<any> {
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    return await source["service"].getHotelDetails(body);
  }

  async hotelsValuation(body: any): Promise<any> {
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    return await source["service"].hotelsValuation(body);
  }

  async addPaxDetails(body: any): Promise<any[]> {
    return await this.hotelDbService.addPaxDetails(body);
  }

  async hotelsReservation(body: any): Promise<any> {
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
   
    if(body.payment_mode != undefined &&  body.payment_mode == "pay_later"){
      await this.hotelDbService.payLaterCheck(body);   
    }
   
    return await source["service"].hotelsReservation(body);
  }

  async hotelsCancellation(body: any): Promise<any> {
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    // return "Booking not permitted"
    return await source["service"].hotelsCancellation(body);
  }

  async hotelEmail(body: any): Promise<any> {
    return await this.hotelDbService.emailHotelDetails(body);
  }

  // async hotelsReservationList(body: any): Promise<any> {
  //     return await this.smyroomsDotComService.hotelsReservationList(body);
  // }

  async hotelList(body: any): Promise<any> {
    return await this.hotelDbService.addHotelList(body);
  }

  // async reservationRead(body: any): Promise<any> {
  //     return await this.smyroomsDotComService.reservationRead(body);
  // }u

  //goGlobal
  async autoCompleteGoGlobal(body: any): Promise<any> {
    return await this.hotelDbService.getAutoComplete(body);
  }

  async searchHotelGoGlobal(body: any): Promise<any> {
    return await this.goglobal.search(body);
  }

  async hotelDetailsGoGlobal(body: any): Promise<any> {
    return await this.goglobal.getHotelDetails(body);
  }

  async blockRoomGoGlobal(body: any): Promise<any> {
    return await this.goglobal.hotelsValuation(body);
  }

  async reservationGoGlobal(body: any): Promise<any> {
    return await this.goglobal.hotelsReservation(body);
  }

  async listHotelTopDestinationsAdmin(body: any): Promise<any> {
    return await this.hotelDbService.listHotelTopDestinationsAdmin(body);
  }

  async listHotelTopDestinations(body: any): Promise<any> {
    return await this.hotelDbService.listHotelTopDestinations(body);
  }

  async updateHotelbedsFacilities(id: any) {
    return await this.hotelDbService.updateHotelbedsFacilities(id);
  }

  async searchAvailableHotels(body: any): Promise<any> {
    var query = `SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
                    FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
                    JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
                    JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
                    WHERE BS.booking_engine_status=1 
                    AND AC.status=1 AND BS.meta_course_key = '${META_TL_HOTEL_COURSE}'
                    AND DL.id in (1)`;
    if (body.booking_source) {
      query = `${query}  AND BS.source_key='${body.booking_source}'`;
    }
    query = `${query}  ORDER BY BS.id DESC`;
    const suppliers: any = await this.manager.query(query);
    console.log("Suppliers", suppliers);
    if (suppliers.length) {
      let allResults = [];
      for (let i = 0; i < suppliers.length; i++) {
        const source = this.currentSuppliers.find(
          (t) => t.name == suppliers[i]["booking_source"]
        );
        const result = await source["service"].Create(body);
        return result;
      }
    }
  }

 async InsertCityData(body: any): Promise<any> {
  var query = `SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
                  FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
                  JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
                  JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
                  WHERE BS.booking_engine_status=1 
                  AND AC.status=1 AND BS.meta_course_key = '${META_TL_HOTEL_COURSE}'
                  AND DL.id in (1)`;
  if (body.booking_source) {
    query = `${query}  AND BS.source_key='${body.booking_source}'`;
  }
  query = `${query}  ORDER BY BS.id DESC`;
  const suppliers: any = await this.manager.query(query);
  console.log("Suppliers", suppliers);
  if (suppliers.length) {
    let allResults = [];
    for (let i = 0; i < suppliers.length; i++) {
      const source = this.currentSuppliers.find(
        (t) => t.name == suppliers[i]["booking_source"]
      );
      const result = await source["service"].getAllCities(body);
      return result;
    }
  }
}


  async unpaidBookings(body: any) {
    let today = new Date();
    let currentDate = formatDate(today);
    const hotelBooking = await this.hotelDbService.getPayLaterUnpaidHotelBookings('BOOKING_HOLD', currentDate);// await this.manager.query(hotelQuery);
    // const tourBooking = await this.bookingsDbService.getToursBookings('BOOKING_HOLD', body.user.id, currentDate);
    // const transferBooking = await this.bookingsDbService.getPayLaterUnpaidTransferBookings('BOOKING_HOLD', body.user.id, currentDate);
    // const hotelbedsActivityBooking = await this.bookingsDbService.getPayLaterUnpaidActivityBookings('BOOKING_HOLD', body.user.id, currentDate)
    
    return  hotelBooking;
  }


  async CityData(): Promise<any> {
    return await this.tboHolidaysDotComService.CountryList();
  }

  async insertCities(body:any){
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    return await source["service"].insertCities(body);
  }

  async insertCountries(body:any){
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    return await source["service"].insertCountries(body);
  }

  async insertHotelDetails(body:any){
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
    );
    return await source["service"].insertHotelDetails(body);
  }

  async insertHotelXml(body:any){
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
      );
      console.log(source.service);
      return await source["service"].insertHotelXml(body);
  }

  async insertLocationXml(body:any){
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
      );
      console.log(source.service);
      return await source["service"].insertLocationXml(body);
  }

  async insertNationXml(body:any){
    const source = this.currentSuppliers.find(
      (t) => t.name == body["booking_source"]
      );
      console.log(source.service);
      return await source["service"].insertNationXml(body);
  }


}
