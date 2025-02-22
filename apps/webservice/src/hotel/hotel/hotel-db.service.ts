import { MailerService } from "@nestjs-modules/mailer";
import { Body, HttpService, Injectable } from "@nestjs/common";
import * as moment from "moment";
import { InjectPdf, PDF } from "nestjs-pdf";
import { getExceptionClassByCode } from "../../all-exception.filter";
import {
  formatHotelDateTime,
  formatSearchDate,
  formatStringtDate,
} from "../../app.helper";
import { CommonService } from "../../common/common/common.service";
import {
  ExchangeRate_1_USD_to_BDT,
  SUPPORT_EMAIL,
  BOOKING247_HELPLINE_NUMBER,
  HOTELBEDS_HOTEL_BOOKING_SOURCE,
  BASE_CURRENCY,
  TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE,
  STUBA_HOTEL_BOOKING_SOURCE,
  HUMMING_BIRD_BOOKING_SOURCE,
  DOTW_HOTEL_BOOKING_SOURCE,
  STUBA_URL,
  logStoragePath,
  STUBA_ORG,
  STUBA_CURRENCY,
  STUBA_PWD,
  STUBA_USER,
  CRS_HOTEL_BOOKING_SOURCE,
} from "../../constants";
import { PaymentGatewayService } from "../../payment-gateway/payment-gateway.service";
import { RedisServerService } from "../../shared/redis-server.service";
import { HotelApi } from "../hotel.api";
import { RecentSearchDto } from "./swagger";
import { HotelTopDestinationsAdminDto } from "./swagger";
import { parse } from "querystring";
import { AddPaxDetailsHotelCRS } from "./hotel-types/hotel.types";
import { BlockRoom } from "./third-party-services/hote-crs.types";
import { ActivityDbService } from "apps/webservice/src/activity/activity/activity-db.service";
const fs = require("fs");
// const convertCurrency = require('nodejs-currency-converter');

@Injectable()
export class HotelDbService extends HotelApi {
  constructor(
    private redisServerService: RedisServerService,
    private readonly httpService: HttpService,
    private readonly mailerService: MailerService,
    private readonly commonService: CommonService,
    private readonly activityDbService: ActivityDbService,
    @InjectPdf() private readonly pdf: PDF
  ) {
    super();
  }

  async getCity(body: any): Promise<any[]> {
    // try {
    const result = await this.getGraphData(
      `query {
                    hotelMasterCities(
                        where: {
                            city_name: {
                                startsWith: "${body.city_name}"
                            }
                        }
                        take: 20
                    ) {
                        id
                        city_name
                        hotel_master_country_id
                        bdc_city_code
                        status
                        hotelMasterCountry {
                            name
                        }
                    }
                }`,
      "hotelMasterCities"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getCityUniversal(tempData);
    });
  }

  async getCityById(id: any) {
    const result = await this.getGraphData(
      `query {
                    hotelMasterCities(
                        where: {
                            bdc_city_code:{
                                eq: ${id}
                            } 
                        }
                    ) {
                        id
                        city_name
                    }
                }`,
      "hotelMasterCities"
    );
    return result;
  }

  async updateHotelbedsFacilities(id: any) {
    let token = "";
    do {
      var cityCode = await this.HotelbedsCityCode("1148");

      var hotelcode = await this.HotelbedsHotelCode(cityCode[0]["city_code"]);

      hotelcode = JSON.parse(JSON.stringify(hotelcode));

      hotelcode.map(async (t: any) => {
        let hotelInfo = await this.GetHotelFacilityInfo(t.hotel_code);

        let hotelFacilities = await this.HotelFacilitiesCheck(t.hotel_code);

        if (hotelFacilities[0] == undefined) {
          await this.InsertHotelBedsFacilities(
            t.hotel_code,
            JSON.parse(hotelInfo[0].hotel_faci)
          );
        }
      });
    } while (token);
  }

  async getCountryByCode(code: any) {
    const result = await this.getGraphData(
      `query {
                    hotelMasterCity(
                        id: "${code}"
                    ) {
                        id
                        city_name
                    }
                }`,
      "hotelMasterCity"
    );
  }

  async saveHotelMasterCities(body: any): Promise<any> {
    const result = await this.getGraphData(
      `
                mutation {
                    createHotelMasterCities(
                        hotelMasterCities: ${JSON.stringify(body).replace(
        /"(\w+)"\s*:/g,
        "$1:"
      )}
                    ) {
                        id
                        city_name
                        hotel_master_country_id
                        bdc_city_code
                        status
                    }
                }
            `,
      "createHotelMasterCities"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getCityUniversal(tempData);
    });
  }

  async saveHotelMasterHotels(body: any): Promise<any> {
    const hotel = await this.getGraphData(
      `
            query {
                hotelMasterHotels(
                    where: {
                        hotel_id: {
                            eq: ${body.hotel_id}
                        }
                    }
                ) {
                    id
                }
            }
        `,
      "hotelMasterHotels"
    );
    if (hotel.length === 0) {
      const result = await this.setGraphData(`HotelMasterHotel`, body);
      return result;
    } else {
      console.log("Inside else");
      return;
    }
  }

  async getSearchResult(body: any): Promise<any[]> {
    const result = await this.getGraphData(
      `query {
                hotelMasterHotels(
					where: {
						city_id: {
							eq: ${body.city_ids}
						}
					}
				){
					id
					hotel_id
					hotel_name
					hotel_type_id
					number_of_rooms
					city_id
					theme_ids
					ranking
					rating
					hotel_important_information
					checkin_checkout_times
					address
					creditcard_required
					book_domestic_without_cc_details
					spoken_languages
					url
					hotel_photos
					hotel_policies
					hotel_facilities
					hotel_description
					zip
					city_name
					location
				}
			}`,
      "hotelMasterHotels"
    );
    return result.map((t) => {
      let hotel_policies = [];
      const policies = JSON.parse(t.hotel_policies);
      policies.forEach((element) => {
        hotel_policies.push(element.name);
      });
      let hotel_facilities = [];
      const facilities = JSON.parse(t.hotel_facilities);
      facilities.forEach((element) => {
        hotel_facilities.push(element.name);
      });
      const tempData = {
        ...t,
        hotel_policies: hotel_policies,
        hotel_facilities: hotel_facilities,
        source: "db",
      };
      return tempData;
    });
  }

  async countryList(body: any): Promise<any[]> {
    const result = await this.getGraphData(
      `query {
			        coreCountries(take:1000) {
                        id
                        name
                        code
                    }
                }`,
      "coreCountries"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.countryListUniversal(tempData);
    });
  }

  async stateList(body: any): Promise<any[]> {
    const result = await this.getGraphData(
      `query {
				coreStates(where:{core_country_id:{eq:${body.country_id}}},take:1000) {
					id
				  	name
				}
			}`,
      "coreStates"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.countryListUniversal(tempData);
    });
  }

  async cityList(body: any): Promise<any[]> {
    const result = await this.getGraphData(
      `query {
				coreCities(where:{core_state_id:{eq:${body.core_state_id}}},take:1000) {
				  	id
				  	name
				}
			}`,
      "coreCities"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.countryListUniversal(tempData);
    });
  }

  async getFacilityById(body: any): Promise<any[]> {
    const result = await this.getGraphData(
      `
				query {
					hotelMasterHotelFacilityTypes(
						where: {
							hotel_facility_type_id: {
								in: "${body}"
							}
                        }
                        take: 500
					) {
						name
						hotelMasterFacilityType {
                            name
                            icon
						}
					}
				}
			`,
      "hotelMasterHotelFacilityTypes"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getFacilityBiIdUniversal(tempData);
    });
  }

  async getHotelRoomTypeById(body: any): Promise<any> {
    const result = await this.getGraphData(
      `
				query {
					hotelMasterRoomType(
						id: ${body}
					) {
						name
					}
				}
			`,
      "hotelMasterRoomType"
    );
    return result;
  }

  async addHotelBookingPaxDetails(body: any): Promise<any> {
    let resp = await this.getHotelRespById(body.ResultToken);
    let convertedResp = resp["response"].replace(/'/g, '"');
    convertedResp = convertedResp.replace(/~/g, "'");
    let parsedData = JSON.parse(convertedResp);

    parsedData["appRef"] = body.AppReference;
    parsedData["userId"] = body.UserId;
    parsedData["source"] = "B2C";
    parsedData["domainOrigin"] = "booking.com";

    const appRefInDB = await this.getGraphData(
      `query {
                    hotelHotelBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        app_reference
                    }
                }
                `,
      "hotelHotelBookingDetails"
    );
    if (appRefInDB.length > 0) {
      const errorClass: any = getExceptionClassByCode(
        "409 Duplicate entry for AppReference"
      );
      throw new errorClass("409 Duplicate entry for AppReference");
    } else {
      let paxDetails = body.RoomDetails[0].PassengerDetails;
      // paxDetails.push(body.RoomDetails[0].AddressDetails);
      const email = body.RoomDetails[0].AddressDetails.Email
      const formattedPaxDetails = await this.formatPaxDetailsUniversal(
        paxDetails,
        body
      );
      parsedData.email = email

      const bookingDetailsResp = await this.addHotelBookingDetails(
        parsedData
      );
      const bookingItineraryResp = await this.addHotelBookingItineraryDetails(
        parsedData
      );

      const bookingPaxDetailsResp = await this.getGraphData(
        `mutation {
                        createHotelHotelBookingPaxDetails(
                            hotelHotelBookingPaxDetails: ${JSON.stringify(
          formattedPaxDetails
        ).replace(/"(\w+)"\s*:/g, "$1:")}
                        ) {
                            id
                            app_reference
                            title
                            first_name
                            middle_name
                            last_name
                            phone
                            email
                            pax_type
                            date_of_birth
                            age
                            passenger_nationality
                            passport_number
                            passport_issuing_country
                            passport_expiry_date
                            address
                            address2
                            city
                            state
                            country
                            postal_code
                            phone_code
                            status
                            attributes
                        }
                    }`,
        "createHotelHotelBookingPaxDetails"
      );

      return this.getHotelBookingPaxDetailsUniversal(body,
        bookingPaxDetailsResp,
        bookingDetailsResp,
        bookingItineraryResp
      );
    }
  }

  async getHotelRespById(id) {
    const result = await this.getGraphData(
      `
				query {
					hotelHotelResponse (
						id: ${id}
					) {
						response
					}
				}
			`,
      "hotelHotelResponse"
    );
    return result;
  }

  async addHotelBookingDetails(body: any): Promise<any> {
    const hotelBody = body["HotelData"];
    let BlockRoomId = [];
    let RoomDetails = [];
    console.log('====================================');
    console.log("body-",body.parsedInfo.RoomDetails);
    console.log('====================================');

    let refundable =false;

    if(body.parsedInfo.RoomDetails[0] != undefined && body.parsedInfo.RoomDetails[0].NonRefundable != undefined && body.parsedInfo.RoomDetails[0].NonRefundable == false){
      refundable =true;
    }
    if (body.source == HOTELBEDS_HOTEL_BOOKING_SOURCE) {
      body.RoomData.forEach((roomElement) => {
        BlockRoomId.push(roomElement.roomId);
      });
      body.parsedInfo.BlockRoomId = BlockRoomId;
      body.parsedInfo.RoomDetails = body.RoomData;
      body.parsedInfo.searchRequest = hotelBody.searchRequest;
    }
    const roomData = body["RoomData"][0];
   
    const query = `SELECT * FROM core_payment_charges WHERE module = 'Hotel';`
    const queryResponse = await this.manager.query(query);

    let responseToken;
    
    if (hotelBody.searchRequest.booking_source == HUMMING_BIRD_BOOKING_SOURCE) {
      responseToken = body.parsedInfo.responseToken;
    }

    body.userId = body.userId ? body.userId : 0;
    let cancellation_policy = "";
    let conversionRate = 1;
    let totalPrice = 0;
    let ExchangeRate: any = 1;
    let ConvenienceFee = 0;
    let stuba_currency_conversion = 1
     let currencyDetails;
     let  OrginalCancelationPolicy  = ''
  


    // body.parsedInfo.RoomDetails
    // if (hotelBody.searchRequest.booking_source == STUBA_HOTEL_BOOKING_SOURCE) {
    //   if(!Array.isArray(body.BookingPrepareResult.Booking.HotelBooking)){
    //     body.BookingPrepareResult.Booking.HotelBooking = [body.BookingPrepareResult.Booking.HotelBooking]
    //   }
    //   body.BookingPrepareResult.Booking.HotelBooking.forEach((roomprice)=>{
    //     // console.log(parseFloat(roomprice.TotalSellingPrice.amt)   , '==========>>>>>>>>>>>>>>>>///');
    //     // StubaRoomPrice  += parseFloat(roomprice.TotalSellingPrice.amt)    
            
    //   })

    //     if (body.BookingPrepareResult['Currency']['$t'] !== BASE_CURRENCY  && body.BookingPrepareResult['Currency']['$t']  !== hotelBody.searchRequest.Currency  )  {
    //       currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.BookingPrepareResult.Currency['$t']);
    //       stuba_currency_conversion = currencyDetails?.value ?? 1;
    //       totalPrice = totalPrice / stuba_currency_conversion;
    //   }    
    // } 

    
     if (hotelBody.searchRequest.booking_source == HUMMING_BIRD_BOOKING_SOURCE || hotelBody.searchRequest.booking_source  == STUBA_HOTEL_BOOKING_SOURCE || hotelBody.searchRequest.booking_source == DOTW_HOTEL_BOOKING_SOURCE){
      totalPrice += parseFloat(body.parsedInfo?.Price?.Amount);
    }else {
      totalPrice += roomData.price;
    }
    // let markup

    // if(hotelBody.searchRequest.booking_source == STUBA_HOTEL_BOOKING_SOURCE){ 
    //   // if (hotelBody.searchRequest.Currency !== BASE_CURRENCY &&  body.BookingPrepareResult.Currency['$t']  !== hotelBody.searchRequest.Currency) { 
    //   //   currencyDetails = await this.formatPriceDetailToSelectedCurrency(hotelBody.searchRequest.Currency);
    //   //   conversionRate = currencyDetails['value'] ?? 1;
    //   //   totalPrice = totalPrice * conversionRate
    //   // }
    //   markup = await this.getMarkup(hotelBody.searchRequest)
    //   let markupDetails = await this.markupDetails(markup, totalPrice);
    //   if (hotelBody.searchRequest.UserType == "B2B"){
    //        totalPrice = (totalPrice + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2) ;
    
    //   }else if (hotelBody.searchRequest.UserType == "B2C"){
    //     totalPrice = parseFloat(markupDetails.AdminMarkup);
    //     totalPrice = Number((totalPrice + markupDetails.AdminMarkup ).toFixed(2))
    //   }
    // }

    
     if (roomData.currency && roomData.currency != BASE_CURRENCY) {
      currencyDetails = await this.formatPriceDetailToSelectedCurrency(roomData.currency);
      conversionRate = currencyDetails['value'] ?? 1;
    }
   

    let promoCode: any = [];
    if (body.PromoCode) {
      promoCode = await this.getGraphData(
        `{
            corePromocodes(where:{
                promo_code:{
                    eq: "${body.PromoCode}"
                }
                }){
                    id
                    promo_code
                    discount_type
                    discount_value
                    use_type
                }
            }`,
        "corePromocodes"
      );
    }

    let discountAmount: any = 0;
    let firstPromo: any = "";
    if (promoCode.length > 0 && body.BookingSource === "B2C") {
      firstPromo = promoCode[0];
      if (firstPromo.discount_type === "percentage") {
        // let totalPrice: any;
        // if (data.Price.Currency != "GBP") {
        //     totalPrice = parseFloat((data?.Price?.TotalDisplayFare/data.exchangeRate).toFixed(2))
        // }

        // discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

        // if (data.Price.Currency != "GBP") {
        //     discountAmount = parseFloat((discountAmount *data.exchangeRate).toFixed(2))
        // }
        // data.Price.TotalDisplayFare -= discountAmount;

        discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

        totalPrice -= discountAmount;

      } else if (firstPromo.discount_type === "plus") {
        discountAmount = firstPromo.discount_value;
        discountAmount = discountAmount * conversionRate
        totalPrice -= discountAmount;
      }
    }

    if (firstPromo != "" && firstPromo.use_type === "Single") {
      const query = `UPDATE core_promocodes SET status = 0 WHERE id = ${firstPromo.id}`;
      this.manager.query(query);
    }
    if ( hotelBody.searchRequest.booking_source == HOTELBEDS_HOTEL_BOOKING_SOURCE) {
      if (roomData.currency != BASE_CURRENCY) {   
        let currencyDetails = await this.formatPriceDetailToSelectedCurrency(
          roomData.currency
        );
        conversionRate = currencyDetails["value"];
      }
      
      hotelBody.cancellationPolicy = JSON.parse(hotelBody.cancellationPolicy);
      let cancelationString = ``;
      hotelBody.cancellationPolicy.forEach((cancelElement) => {
        cancelationString += ` Cancellation Charge ${cancelElement.amount} ${hotelBody.searchRequest.Currency} From ${cancelElement.from
          } ,`;
      });
      cancellation_policy = body.parsedInfo.CancelPolicy;
      totalPrice =body.parsedInfo.Price.Amount - discountAmount;
    } else if (hotelBody.searchRequest.booking_source == STUBA_HOTEL_BOOKING_SOURCE){
      hotelBody.checkin = await this.changeDateFormatIfNeeded(hotelBody.checkin);
      hotelBody.checkout = await this.changeDateFormatIfNeeded(hotelBody.checkout);

      if (!Array.isArray(body.BookingPrepareResult['Booking']['HotelBooking'])) {
        body.BookingPrepareResult['Booking']['HotelBooking'] = [body.BookingPrepareResult['Booking']['HotelBooking']];
    }
    if (body.BookingPrepareResult['Currency']['$t'] !== BASE_CURRENCY  && body.BookingPrepareResult['Currency']['$t']  !== hotelBody.searchRequest.Currency  )  {
      currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.BookingPrepareResult.Currency['$t']);
      stuba_currency_conversion = currencyDetails?.value ?? 1;
   }   

   let StubaPolicyMarkup = await this.getMarkup(hotelBody.searchRequest)

  let StubacancellationTextOriginal = '';
  let StubacancellationMinus3Days = ''
  const cancellationDataOriginal: Record<string, { totalAmount: number; currency: string; policyStatus: string }> = {};
  const cancellationDataModified: Record<string, { totalAmount: number; currency: string; policyStatus: string }> = {};
  
  body.BookingPrepareResult['Booking']['HotelBooking'].forEach((Room) => {
      let StubaRoom = Room['Room'];
      const policyStatus = StubaRoom?.CancellationPolicyStatus?.['$t'] || 'NoNRefundable';
      
      let stubaFees = StubaRoom?.CanxFees?.Fee;
      if (!Array.isArray(stubaFees)) {
          stubaFees = stubaFees ? [stubaFees] : [];
      }
      stubaFees.forEach((fee) => {
          const originalDateKey = fee?.from || 'NoDate';
          let modifiedDateKey = originalDateKey;
  
          if (originalDateKey !== 'NoDate') {
              const originalDate = new Date(originalDateKey);
              originalDate.setDate(originalDate.getDate() - 3);
              const day = String(originalDate.getDate()).padStart(2, '0');
              const month = String(originalDate.getMonth() + 1).padStart(2, '0');
              const year = originalDate.getFullYear();
              const time = originalDate.toISOString().split('T')[1]; 
              modifiedDateKey = `${day}-${month}-${year} T ${time}`;
          }
  
          const amount = (fee.Amount.amt / stuba_currency_conversion) * conversionRate;
          if (!cancellationDataOriginal[originalDateKey]) {
              cancellationDataOriginal[originalDateKey] = { totalAmount: 0, currency: hotelBody.searchRequest.Currency, policyStatus };
          }
          cancellationDataOriginal[originalDateKey].totalAmount += amount;

          if (!cancellationDataModified[modifiedDateKey]) {
              cancellationDataModified[modifiedDateKey] = { totalAmount: 0, currency: hotelBody.searchRequest.Currency, policyStatus };
          }
          cancellationDataModified[modifiedDateKey].totalAmount += amount;
      });
  });
  
  for (const [date, data] of Object.entries(cancellationDataOriginal)) {
      if (date !== 'NoDate') {
           let markupDetails = await this.markupDetails(StubaPolicyMarkup, data.totalAmount);
      if (hotelBody.searchRequest.UserType == "B2B"){
       data.totalAmount = (data.totalAmount + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2) ;
      }else if (hotelBody.searchRequest.UserType == "B2C"){
        data.totalAmount = parseFloat(markupDetails.AdminMarkup);
        data.totalAmount = Number((data.totalAmount + markupDetails.AdminMarkup ).toFixed(2))
      }
          StubacancellationTextOriginal += `The cancellation policy is ${data.policyStatus} and Cancellation Charge ${data.totalAmount} ${data.currency} From ${date} , `;
      } else {
        let markupDetails = await this.markupDetails(StubaPolicyMarkup, data.totalAmount);
        if (hotelBody.searchRequest.UserType == "B2B"){
         data.totalAmount = (data.totalAmount + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2) ;
        }else if (hotelBody.searchRequest.UserType == "B2C"){
          data.totalAmount = parseFloat(markupDetails.AdminMarkup);
          data.totalAmount = Number((data.totalAmount + markupDetails.AdminMarkup ).toFixed(2))
        }
          StubacancellationTextOriginal += `The cancellation policy is ${data.policyStatus} and Cancellation Charge ${data.totalAmount} ${data.currency}, `;
      }
  }

  for (const [date, data] of Object.entries(cancellationDataModified)) {
      if (date !== 'NoDate') {
        let markupDetails = await this.markupDetails(StubaPolicyMarkup, data.totalAmount);
        if (hotelBody.searchRequest.UserType == "B2B"){
         data.totalAmount = (data.totalAmount + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2) ;
        }else if (hotelBody.searchRequest.UserType == "B2C"){
          data.totalAmount = parseFloat(markupDetails.AdminMarkup);
          data.totalAmount = Number((data.totalAmount + markupDetails.AdminMarkup ).toFixed(2))
        }
        StubacancellationMinus3Days += `The cancellation policy is ${data.policyStatus} and Cancellation Charge ${data.totalAmount} ${data.currency} From ${date} , `;
      } else {
        let markupDetails = await this.markupDetails(StubaPolicyMarkup, data.totalAmount);
        if (hotelBody.searchRequest.UserType == "B2B"){
         data.totalAmount = (data.totalAmount + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2) ;
        }else if (hotelBody.searchRequest.UserType == "B2C"){
          data.totalAmount = parseFloat(markupDetails.AdminMarkup);
          data.totalAmount = Number((data.totalAmount + markupDetails.AdminMarkup ).toFixed(2))
        }
        StubacancellationMinus3Days += `The cancellation policy is ${data.policyStatus} and Cancellation Charge ${data.totalAmount} ${data.currency}, `;
      }
  }
     OrginalCancelationPolicy = StubacancellationTextOriginal.trim().replace(/, $/, '.');
     cancellation_policy   = StubacancellationMinus3Days.trim().replace(/, $/, '.');

    }
    else {
      if (hotelBody.cancellationPolicy) {
        cancellation_policy = hotelBody.cancellationPolicy.replace(/"/g, "'");      
      }
    }
    let pay_mode="wallet";
    if (body.HotelData.searchRequest['UserType'] === "B2C") {
      pay_mode="payment_gateway";
    }
      if (queryResponse[0].status == 1) {

        if (queryResponse[0].fees_type === 'percentage') {
  
          const percentageAdvanceTax = (totalPrice * queryResponse[0].fees) / 100;
          ConvenienceFee += Number(percentageAdvanceTax.toFixed(2));
  
        } else if (queryResponse[0].fees_type === 'plus') {
          // const percentageAdvanceTax = queryResponse[0].fees * ExchangeRate;
          const percentageAdvanceTax = queryResponse[0].fees *  conversionRate
          ConvenienceFee += Number(percentageAdvanceTax.toFixed(2));
        }
  
        if (queryResponse[0].added_per_pax === "Yes") {
          let totalAdultsAndChildren = body.parsedInfo.searchRequest.RoomGuests.reduce((acc: any, item: any) => {
            acc += item.NoOfAdults + item.NoOfChild;
            return acc;
          }, 0);
          ConvenienceFee = Number((ConvenienceFee * totalAdultsAndChildren).toFixed(2));
        }
      }
     
      // totalPrice = totalPrice + ConvenienceFee;
    // }

    if(body.source == TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE){
      if(body.parsedInfo.RoomDetails[0].RateConditions){
        delete body.parsedInfo.RoomDetails[0].RateConditions
      }
    }

    if ( hotelBody.searchRequest.booking_source == DOTW_HOTEL_BOOKING_SOURCE) {
      cancellation_policy = body.parsedInfo.RoomDetails[0].cancellationPolicies
    }
    
    let  cancellationDeadline = body.parsedInfo.RoomDetails[0]?.cancellationDeadline ?? ""
    if(cancellationDeadline != "" && hotelBody.searchRequest.booking_source != STUBA_HOTEL_BOOKING_SOURCE){
      cancellationDeadline= new Date(body.parsedInfo.RoomDetails[0].cancellationDeadline)
    }
    console.log("cancellationDeadline-",cancellationDeadline);
    cancellationDeadline = await this.changeDateFormatIfNeeded(cancellationDeadline);
    console.log("cancellationDeadline2-",cancellationDeadline);
    let  APICancellationDeadline = body.parsedInfo.RoomDetails[0]?.APICancellationDeadline ?? ""
    let PaymentMode = body?.payment_mode ?? pay_mode;

    const result = await this.getGraphData(
      `mutation {
					createHotelHotelBookingDetail(
				  		hotelHotelBookingDetail: {
							              status: "BOOKING_HOLD"
                            booking_from:"${body.booking_from}"
							              app_reference: "${body.appRef}"
                            booking_source: "${body.BookingSource}"
                            Api_id: "${body.Api_id}"
                            domain_origin: "${hotelBody.domainOrigin}"
                            confirmation_reference : "${body.confirmation_reference
      }"
                            hotel_name: "${hotelBody.hotelName}"
                            star_rating: ${hotelBody.starRating ? parseInt(hotelBody.starRating) : 0}
                            hotel_code: "${hotelBody.hotelId}"
                            hotel_address: "${hotelBody.address}"
                            hotel_photo: "${hotelBody.hotelPhoto.replace(
        /"/g,
        "'"
      )}"
							              email: "${body.addressDetails.Email}"
                            phone_number: "${body.addressDetails.Contact}"
							              hotel_check_in: "${hotelBody.checkin}"
                            hotel_check_out: "${hotelBody.checkout}"
                            currency: "${roomData.currency
        ? roomData.currency
        : roomData[0].currency
          ? roomData[0].currency
          : ""
      }"
                            created_by_id: "${body.userId}"
                            booking_reference: "${hotelBody.remarks}"
                            cancellation_policy: "${cancellation_policy}"
                            refundable:"${refundable}"
                            cancel_deadline :"${cancellationDeadline}"
                            API_cancel_deadline  :"${APICancellationDeadline}"
                            payment_mode:"${PaymentMode}"
                            payment_status:"Not Paid"
                            attributes: "${JSON.stringify({
        BlockRoomId: body.parsedInfo.BlockRoomId,
        ResultToken: body.parsedInfo.ResultToken,
        RoomDetails: body.parsedInfo.RoomDetails,
        searchRequest: body.parsedInfo.searchRequest,
        Supplements: roomData.Supplements,
        responseToken: responseToken ? responseToken : "",
        OrginalCancelationPolicy : OrginalCancelationPolicy ? OrginalCancelationPolicy : '',
        addressDetails: body.addressDetails
      }).replace(/"/g, "'")}"
                            created_datetime: "${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}",
                            convinence_value: "${ConvenienceFee}"
                            convinence_value_type: "${queryResponse[0].fees_type ?? 'N/A'}"
                            promo_code: "${body.PromoCode ?? ''}"
                            discount: "${discountAmount}"
                            TotalAmount: ${totalPrice}
			}
					) {
						id
						domain_origin
						status
						app_reference
						confirmation_reference
            booking_reference
						hotel_name
            star_rating
            hotel_address
            hotel_code
            hotel_photo
						phone_number
						alternate_number
						email
						hotel_check_in
						hotel_check_out
						payment_mode
            payment_status
						convinence_value
						convinence_value_type
						convinence_per_pax
						convinence_amount
						promo_code
						discount
						currency
						currency_conversion_rate
						attributes
						created_by_id
            created_at
            cancelled_datetime
            cancellation_policy
            created_datetime
            Api_id
            TotalAmount
            refundable
            cancel_deadline
					}
			  	}
			`,
      "createHotelHotelBookingDetail"
    );
    return result;
  }

  async changeDateFormatIfNeeded(date) {
    // Regular expression to check if the date is in DD-MM-YYYY format
    const regex = /^\d{2}-\d{2}-\d{4}$/;

    if (regex.test(date)) {
        const [day, month, year] = date.split('-');
        return `${year}-${month}-${day}`;
    } else {
        return date;
    }
}

  async addHotelBookingItineraryDetails(body: any): Promise<any> {
    // console.log("body-", body);

    let markupBody = {
      booking_source: body["HotelData"]["searchRequest"].booking_source,
      UserId: body["HotelData"]["searchRequest"].UserId,
      UserType: body["HotelData"]["searchRequest"].UserType,
      MarkupCity: body["HotelData"]["searchRequest"].MarkupCity,
      MarkupCountry: body["HotelData"]["searchRequest"].MarkupCountry
    }
    let markup: any;
    if (body["domainOrigin"] == "B2B" && body["userId"]) {
      markup = await this.getMarkupDetails(
        body["domainOrigin"],
        body["userId"],
        markupBody
      );
      body["agent_markup"] =
        markup.value_type == "percentage" ? markup.value + "%" : markup.value;
    } else {
      body["agent_markup"] = 0;
    }

    const formattedData = this.formatBookingItineraryDetailsUniversal(body);

    const result = await this.getGraphData(
      `mutation {
            		createHotelHotelBookingItineraryDetails(
                        hotelHotelBookingItineraryDetails:  ${JSON.stringify(
        formattedData
      ).replace(/"(\w+)"\s*:/g, "$1:")}
            		) {
            			id
            			app_reference
            			location
            			check_in
            			check_out
            			room_id
                  room_count
            			room_type_name
            			bed_type_code
                  status
                  adult_count
                  child_count
            			smoking_preference
            			total_fare
            			admin_markup
            			agent_markup
            			currency
            			attributes
            			room_price
                  tax
                  max_occupancy
            			extra_guest_charge
                  cancellation_policy
            			child_charge
            			other_charges
            			discount
            			service_tax
                  agent_commission
            			tds
                  gst
                  created_by_id
            		}
              	}
            `,
      "createHotelHotelBookingItineraryDetails"
    );
    return result;
  }

  async saveBlockRoomRespInDB(body: any): Promise<any> {
    // const result = await this.setGraphData('HotelHotelResponses', body);
    // const queryVal = `INSERT INTO hotel_hotel_responses(id, response) values(DEFAULT, '${body}')`;
    // const result = await this.manager.query(queryVal);
    const result = await this.getGraphData(
      `
			mutation {
				createHotelHotelResponse (
					hotelHotelResponse: {
						response: "${body}"
					}
				) {
                    id
                }
			}
		`,
      "createHotelHotelResponse"
    );
    return result;
  }

  async getHotelBookingPaxDetails(body: any) {
    try {
      const result = await this.getGraphData(
        `
			query {
				hotelHotelBookingPaxDetails(
				  where: {
					app_reference: {
					  eq: "${body.AppReference}"
					}
				  }
				) {
				  id
				  app_reference
				  title
				  first_name
				  last_name
          middle_name
          date_of_birth
				  phone
				  email
				  pax_type
				  address
				  address2
          attributes
				  city
				  state
				  postal_code
				  phone_code
				  country
				  status
				}
			  }
			`,
        "hotelHotelBookingPaxDetails"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
 async payLaterCheck(body){
  try{
    let response= true;
    const HotelBookingDetails=await this.getHotelBookingDetails(body);
 
   if(HotelBookingDetails[0].status != 'BOOKING_HOLD' || HotelBookingDetails[0].booking_source != 'B2B' || HotelBookingDetails[0].refundable != 'true'){
    throw new Error("409 Pay later is not available for this Booking");  
   }else{
    const query = `UPDATE hotel_hotel_booking_details SET payment_mode = "pay_later" WHERE app_reference = "${body.AppReference}" `;
    this.manager.query(query);
   }
    
  } catch (error) {
    const errorClass: any = getExceptionClassByCode(error.message);
    throw new errorClass(error.message);
}
 }
  async getHotelBookingDetails(body: any) {
    try {
      const result = await this.getGraphData(
        `
				query {
					hotelHotelBookingDetails(
					    where: {
						    app_reference: {
						        eq: "${body.AppReference}"
						    }
					    }
					) {
                        id
                        app_reference
                        status
                        booking_source
                        Api_id
                        booking_reference
                        confirmation_reference
                        booking_id
                        hotel_name
                        star_rating
                        hotel_code
                        hotel_address
                        hotel_photo
                        phone_number
                        alternate_number
                        pincode
                        email
                        hotel_check_in
                        hotel_check_out
                        payment_mode
                        payment_status
                        discount
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id
                        cancelled_datetime
                        cancellation_policy
                        attributes
                        created_at
                        created_datetime
                        booking_source
                        TotalAmount
                        convinence_value
                        convinence_amount
                        cancel_deadline
                        refundable
                        hcn_number
					}
				}
			`,
        "hotelHotelBookingDetails"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getHotelBookingItineraryDetails(body: any) {
    try {
      const result = await this.getGraphData(
        `
			query {
				hotelHotelBookingItineraryDetails(
				  where: {
					app_reference: {
					  eq: "${body.AppReference}"
					}
				  }
				) {
				  id
				  app_reference
                  status
                  adult_count
                  child_count
				  location
				  check_in
				  check_out
				  room_id
          room_count
				  room_type_name
				  bed_type_code
          meal_plan_code
          room_name
				  total_fare
				  room_price
				  discount
                  tax
                  max_occupancy
                  currency
                  cancellation_policy
				  attributes
				}
			  }
			`,
        "hotelHotelBookingItineraryDetails"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async updateHotelBookingDetails(body) {
    let result: any;
    if (body.phone_number) {
      result = await this.getGraphData(
        `
                mutation {
                    updateHotelHotelBookingDetail(
                        id: ${body.id}
                        hotelHotelBookingDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                            booking_id: "${body.booking_id}"
                            confirmation_reference: "${body.booking_id}"
                            phone_number: "${body.phone_number}"
                            created_datetime: "${body.created_date}"
                            pincode: "${body.pincode}"
                        }
                    )
                } 
            `,
        "updateHotelHotelBookingDetail"
      );
    } else {
      result = await this.getGraphData(
        `
                mutation {
                    updateHotelHotelBookingDetail(
                        id: ${body.id}
                        hotelHotelBookingDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                            booking_id: "${body.booking_id}"
                            confirmation_reference: "${body.booking_id}"
                            created_datetime: "${body.created_date}"
                        }
                    )
                } 
            `,
        "updateHotelHotelBookingDetail"
      );
    }
    return result;
  }

  async updateHotelBookingItineraryDetails(body, amount) {
    console.log("123456789", amount);
    const result = await this.getGraphData(
      `
                mutation {
                    updateHotelHotelBookingItineraryDetail(
                        id: ${body}
                        hotelHotelBookingItineraryDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                            total_fare:${amount}
                        }
                    )
                } 
            `,
      "updateHotelHotelBookingItineraryDetail"
    );
    return result;
  }

  async updateHotelBookingPaxDetails(body) {
    const result = await this.getGraphData(
      `
                mutation {
                    updateHotelHotelBookingPaxDetail(
                        id: ${body}
                        hotelHotelBookingPaxDetailPartial: {
                            status: "BOOKING_CONFIRMED"
                        }
                    )
                } 
            `,
      "updateHotelHotelBookingPaxDetail"
    );
    return result;
  }

  async updateHotelDetails(
    result,
    body,
    bookingPaxDetails,
    bookingDetails,
    bookingItineraryDetails
  ) {
    let markup: any;
    if (result.Price.Currency == "USD") {
      var converted_currency_Amount = (
        ExchangeRate_1_USD_to_BDT * result.Price.Amount
      ).toFixed(2);
      result.Price.Currency = "BDT";
      result.Price.Amount = converted_currency_Amount;
    }

    if (bookingDetails["booking_source"] && bookingDetails["created_by_id"]) {
      markup = await this.getMarkupDetails(
        bookingDetails["booking_source"],
        bookingDetails["created_by_id"],
        body
      );
    }
    if (markup && markup.markup_currency == result["Price"]["Currency"]) {
      result["Price"]["Amount"] = parseFloat(result["Price"]["Amount"]);
      if (markup.value_type == "percentage") {
        let percentVal = (result["Price"]["Amount"] * markup["value"]) / 100;
        console.log("percentVal", percentVal);
        result["Price"]["Amount"] += percentVal;
        result["Price"]["Amount"] = parseFloat(
          result["Price"]["Amount"].toFixed(2)
        );
      } else if (markup.value_type == "plus") {
        result["Price"]["Amount"] += markup["value"];
      }
    }
    let bookingDetailsBody = {};
    if (result.reservation_id) {
      bookingDetailsBody["id"] = bookingDetails.id;
      bookingDetailsBody["phone_number"] =
        result.hotel_contact_info["hotel_telephone"];
      bookingDetailsBody["booking_id"] = result.reservation_id;
      bookingDetailsBody["pincode"] = result.pincode;
    } else if (result.ProviderLocator) {
      bookingDetailsBody["id"] = bookingDetails.id;
      bookingDetailsBody["booking_id"] = result.ProviderLocator;
    }
    let createdDate = moment.utc(Date.now()).format("YYYY-MM-DD HH:mm:ss");
    bookingDetailsBody["created_date"] = createdDate;
    const bookingDetailsResp = await this.updateHotelBookingDetails(
      bookingDetailsBody
    );
    let bookingItineraryResp;
    bookingItineraryDetails.forEach(async (element) => {
      bookingItineraryResp = await this.updateHotelBookingItineraryDetails(
        element.id,
        result.Price.Amount
      );
    });
    let bookingPaxResp;
    bookingPaxDetails.forEach(async (element) => {
      bookingPaxResp = await this.updateHotelBookingPaxDetails(element.id);
    });
    // if (bookingDetailsResp) {
    const bookingDetailsByAppRef = await this.getHotelBookingDetails(body);
    const bookingPaxDetailsByAppRef = await this.getHotelBookingPaxDetails(
      body
    );
    const bookingItineraryDetailsByAppRef = await this.getHotelBookingItineraryDetails(
      body
    );
    const response = this.getHotelBookingPaxDetailsUniversal(
      body,
      bookingPaxDetailsByAppRef,
      bookingDetailsByAppRef[0],
      bookingItineraryDetailsByAppRef
    );
    return response;
    // }
  }

  async bookingConfirmed(body: any) {
    try {
      const bookingDetails = (await this.getHotelBookingDetails(body))[0];
      bookingDetails["created_datetime"] = moment(
        parseInt(bookingDetails.created_datetime)
      ).format("YYYY-MM-DD HH:mm:ss");
      const bookingPaxDetails = await this.getHotelBookingPaxDetails(body);
      const bookingItineraryDetails = await this.getHotelBookingItineraryDetails(
        body
      );
      console.log(bookingItineraryDetails);
      // const room_details = [];


      const result = this.getHotelBookingPaxDetailsUniversal(
        body,
        bookingPaxDetails,
        bookingDetails,
        bookingItineraryDetails
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async updateHotelCancelDetails(bookingDetails, requestData) {
    let bookingDetailsBody = {};
    bookingDetailsBody["id"] = bookingDetails.id;
    bookingDetailsBody["reason"] = requestData.Reason;
    let cancelledDate = moment.utc(Date.now()).format("YYYY-MM-DD HH:mm:ss");
    bookingDetailsBody["cancelled_date"] = cancelledDate;
    const bookingPaxDetails = await this.getHotelBookingPaxDetails(requestData);
    const bookingItineraryDetails = await this.getHotelBookingItineraryDetails(
      requestData
    );

    const bookingDetailsResp = await this.updateCancelledHotelBookingDetails(
      bookingDetailsBody
    );

    let bookingItineraryResp;
    bookingItineraryDetails.forEach(async (element) => {
      bookingItineraryResp = await this.updateCancelledHotelBookingItineraryDetails(
        element.id
      );
    });

    let bookingPaxResp;
    bookingPaxDetails.forEach(async (element) => {
      bookingPaxResp = await this.updateCancelledHotelBookingPaxDetails(
        element.id
      );
    });
    if (bookingDetailsResp) {
      const bookingDetailsByAppRef = await this.getHotelBookingDetails(
        requestData
      );
      const bookingPaxDetailsByAppRef = await this.getHotelBookingPaxDetails(
        requestData
      );
      const bookingItineraryDetailsByAppRef = await this.getHotelBookingItineraryDetails(
        requestData
      );

      const result = this.getHotelBookingPaxDetailsUniversal(
        "",
        bookingPaxDetailsByAppRef,
        bookingDetailsByAppRef[0],
        bookingItineraryDetailsByAppRef
      );
      return result;
    }
  }

  async updateCancelledHotelBookingDetails(body) {
    //   attributes: "${body.reason}"
    const result = await this.getGraphData(
      `
                mutation {
                    updateHotelHotelBookingDetail(
                        id: ${body.id}
                        hotelHotelBookingDetailPartial: {
                            status: "BOOKING_CANCELLED"
                            cancelled_datetime: "${body.cancelled_date}"
                          
                        }
                    )
                } 
            `,
      "updateHotelHotelBookingDetail"
    );
    return result;
  }

  async updateCancelledHotelBookingItineraryDetails(body) {
    const result = await this.getGraphData(
      `
                mutation {
                    updateHotelHotelBookingItineraryDetail(
                        id: ${body}
                        hotelHotelBookingItineraryDetailPartial: {
                            status: "BOOKING_CANCELLED"
                        }
                    )
                } 
            `,
      "updateHotelHotelBookingItineraryDetail"
    );
    return result;
  }

  async updateCancelledHotelBookingPaxDetails(body) {
    const result = await this.getGraphData(
      `
                mutation {
                    updateHotelHotelBookingPaxDetail(
                        id: ${body}
                        hotelHotelBookingPaxDetailPartial: {
                            status: "BOOKING_CANCELLED"
                        }
                    )
                } 
            `,
      "updateHotelHotelBookingPaxDetail"
    );
    return result;
  }

  async getCountries() {
    const result = await this.getGraphData(
      `
                query {
                    coreCountries(take:500) {
                        id
                        name
                        code
                        flag_url
                        phone_code
                        status
                    }
                }
            `,
      "coreCountries"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getCountriesUniversal(tempData);
    });
  }

  //Smyrooms.com

  async addHotelList(body: any): Promise<any> {
    body.forEach((element) => {
      const query = `INSERT INTO smyroom_hotels
                (hotel_id,name,address,town,zip_code,latitude,longitude,country_code,email,telephone,fax,destination_id,destination_name,id) 
                VALUES (${element.Code},'${element.Name}','${element.Address}','${element.Town}','${element.ZipCode}',${element.Latitude},${element.Longitude},'${element.CountryIsoCode[0]}',${element.Contact["Email"]},'${element.Contact["Telephone"]}',${element.Contact["Fax"]},'${element.AvailDestination["Code"]}','${element.AvailDestination["Name"]}',NULL);`;
      const result = this.manager.query(query);
    });
    return true;
  }

  async getDestByName(body: any): Promise<any> {
    const search = `INSERT INTO hotel_search_id (id, de_du_token, status, created_at) VALUES (NULL, NULL, '0', current_timestamp());`
    const searchId = await this.manager.query(search);

    const wsQuery = `SELECT source_key as booking_source FROM ws_apis WHERE module_type='hotel' AND ${body.userType.toLowerCase() + '_status'}=1;`
    const api = await this.manager.query(wsQuery);

    const bookingSource = api.map(packet => packet.booking_source).join(', ');

    const query = `SELECT DISTINCT city_id, city_name as city, country_name, country_code , "${bookingSource}" as booking_source, "${searchId.insertId}" as searchId   FROM giata_city WHERE city_name LIKE('${body.city_name}%')`;

    // const query1 = `SELECT DISTINCT CityCode as city_id, CityName as city,CountryCode as country_code , "TLAPINO00004" as booking_source   FROM hotel_hotel_cityId WHERE CityName LIKE('${body.city_name}%')`;
    // const query2 = `SELECT DISTINCT city_id, city, country_code,"TLAPINO00002" as  booking_source  FROM goglobal_hotels WHERE city LIKE('${body.city_name}%')`;
    // const query2 = `SELECT DISTINCT city_code as city_id, city_name as city, country_code,"ZBAPINO00008" as  booking_source  FROM hb_city_list WHERE city_name LIKE('${body.city_name}%')`;
    // const query3 = `SELECT DISTINCT regionId as city_id, regionName as city ,"TLAPINO00005" as  booking_source  FROM hotel_hotel_stuba_regionId WHERE regionName  LIKE('${body.city_name
    //   .charAt(0)
    //   .toUpperCase() + body.city_name.slice(1)}%')`;
    // const query4 = `SELECT DISTINCT destination_code as city_id, destination_name as city,"TLAPINO00007" as  booking_source  FROM humming_bird_destination WHERE destination_name LIKE('${body.city_name
    //   .charAt(0)
    //   .toUpperCase() + body.city_name.slice(1)}%')`;
    // const query5 = ` SELECT DISTINCT
    //     city_id,
    //     city_name as city,
    //     country_code,
    //     country_name,
    //     "${CRS_HOTEL_BOOKING_SOURCE}" as booking_source
    //     FROM giata_city
    //     WHERE city_name LIKE('${body.city_name}%');`;
    // const query6 = `SELECT DISTINCT city_code as city_id, city_name as city, country_code , "TLAPINO00006" as booking_source  , country_name FROM dotw_city_list WHERE city_name LIKE('${body.city_name}%')`;
    // const result = await this.manager.query(query);
    const result = await this.manager.query(query);
    // const result2 = await this.manager.query(query2);
    // // const result3 = await this.manager.query(query3);
    // // const result4 = await this.manager.query(query4);
    // const result5 = await this.manager.query(query5);
    // const result6 = await this.manager.query(query6);
    // const result = result1.concat(result2).concat(result3).concat(result4)
    // const result = result1.concat(result5).concat(result6);
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getCityUniversal(tempData);
    });
  }

  async hotelGiataId(hotelId: any, api: any): Promise<any> {
    let hotelcode: any = ``;
    let availStatus: any = ``;

    if (api == HOTELBEDS_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` hotelbeds `;
      availStatus = ` hotelbeds_status `
    } else if (api == TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` TravelBoutiqueOnline `;
      availStatus = ` TravelBoutiqueOnline_status `

    } else if (api == STUBA_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` roomsxml `;
      availStatus = ` roomsxml_status `

    } else if (api == HUMMING_BIRD_BOOKING_SOURCE) {
      hotelcode = ` hummingbird_travel `;
      availStatus = ` hummingbird_status `

    } else if (api == DOTW_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` DOTW `;
      availStatus = ` DOTW_status `

    } else {


    }


    const query = `SELECT giata_code,${hotelcode} as hotel_code FROM giata_property_data WHERE ${hotelcode} IN (${hotelId}) AND ${hotelcode} !='' `;
    const result = await this.manager.query(query);
    const formattedResult = result.reduce((acc, item) => {
      acc[item.hotel_code] = { giata_code: item.giata_code, hotel_code: item.hotel_code }; // Or any property of item you want to keep
      return acc;
    }, {});
    return formattedResult;
  }

  async getHotelIdsByGiataId(destId: any, api: any): Promise<any> {
   
    let hotelcode: any = ``;
    let availStatus: any = ``;

    if (api == HOTELBEDS_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` hotelbeds `;
      availStatus = ` hotelbeds_status `
    } else if (api == TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` TravelBoutiqueOnline `;
      availStatus = ` TravelBoutiqueOnline_status `

    } else if (api == STUBA_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` roomsxml `;
      availStatus = ` roomsxml_status `

    } else if (api == HUMMING_BIRD_BOOKING_SOURCE) {
      hotelcode = ` hummingbird_travel `;
      availStatus = ` hummingbird_status `

    } else if (api == DOTW_HOTEL_BOOKING_SOURCE) {
      hotelcode = ` DOTW `;
      availStatus = ` DOTW_status `

    } else {

    }

    const query = `SELECT ${hotelcode} as hotel_code , city_name FROM giata_property_data WHERE city_code = ${destId} AND ${hotelcode} !='' LIMIT 100`;
    const result = await this.manager.query(query);
    let hotelIds = [];
    result.forEach((element) => {
      hotelIds.push(element.hotel_code);
    });
    if (api == DOTW_HOTEL_BOOKING_SOURCE) {
      return {
        hotelIds,
        city_name: result[0].city_name
      };
    } else {
      return hotelIds;
    }
  }


  async getHotelIdsByDestId(destId: any): Promise<any> {
    const query = `SELECT hotel_id FROM smyroom_hotels WHERE destination_id = ${destId}`;
    const result = await this.manager.query(query);
    let hotelIds = [];
    result.forEach((element) => {
      hotelIds.push(element.hotel_id);
    });
    return hotelIds;
  }

  async getHotelIds(offset: any): Promise<any> {
    const query = `SELECT hotel_id FROM smyroom_hotels WHERE description = ''`;
    const result = await this.manager.query(query);
    let hotelIds = [];
    result.forEach((element) => {
      hotelIds.push(element.hotel_id);
    });
    return hotelIds;
  }

  async updateSmyroomsHotel(hotelData): Promise<any> {
    // console.log(hotelData);
    hotelData.Description = hotelData.Description.replace(/'/g, "^");
    const imagesArr = [];
    if (hotelData["Images"].length > 0) {
      hotelData["Images"].forEach((element) => {
        imagesArr.push(element.Url);
      });
    }
    const images = JSON.stringify(imagesArr);
    const servicesArr = [];
    if (hotelData["Services"].length > 0) {
      hotelData["Services"].forEach((element) => {
        servicesArr.push(element.Description);
      });
    }
    const services = JSON.stringify(servicesArr);
    const query = `UPDATE smyroom_hotels SET description = '${hotelData.Description}', images = '${images}', amenities = '${services}', check_in_time = '${hotelData.CheckIn}', check_out_time = '${hotelData.CheckOut}' WHERE hotel_id = '${hotelData.Code}'`;
    // const query = `UPDATE smyroom_hotels SET WHERE hotel_id = '${hotelData.Code}'`;
    return this.manager.query(query);
  }

  async getHotelDetails(hotelIds: any): Promise<any> {
    const query = `SELECT * FROM smyroom_hotels WHERE hotel_id IN(${hotelIds})`;
    return this.manager.query(query);
  }

  formatHotelRoomData(dat: any) {

    let data = dat['HotelData']
    if (data.searchRequest.booking_source == HUMMING_BIRD_BOOKING_SOURCE) {
      data.HotelPolicy = data.RoomDetails[0].cancellationPolicies
    }

    if (data.searchRequest.booking_source == TBO_HOLIDAYS_HOTEL_BOOKING_SOURCE) {
      data.HotelPolicy = data.RoomDetails[0].cancellationPolicies
    }

    if (data.searchRequest.booking_source == STUBA_HOTEL_BOOKING_SOURCE) {
      data.HotelPicture;
    } else {
      data.HotelPicture = JSON.stringify(data.HotelPicture);
    }

    if (data)
      // data.Remarks = data.Remarks.replace(/\n/g, ' ');
      data.Remarks = "";
    let HotelData = {
      hotelName: data.HotelName,
      hotelId: data.HotelCode,
      starRating: data.StarRating,
      address: data.HotelAddress,
      countryCode: "",
      pincode: "",
      hotelContactNo: data.HotelContactNo,
      email: "",
      latitude: data.Latitude,
      longitude: data.Longitude,
      checkin: data.CheckIn,
      checkout: data.CheckOut,
      hotelPhoto: data.HotelPicture,
      remarks: data.Remarks,
      domainOrigin: data.Source,
      cancellationPolicy: data.HotelPolicy
        ? JSON.stringify(data.HotelPolicy)
        : JSON.stringify(data.CancelPenalties),
      searchRequest: data.searchRequest ? data.searchRequest : "",
    };

    let RoomData = [];
    let RoomsData = [];

    if (typeof data["RoomDetails"]["Rooms"] != "undefined") {
      RoomsData = data["RoomDetails"]["Rooms"];
    } else {
      RoomsData = data["RoomDetails"];
    }

    RoomsData.forEach((room) => {
      let rooms = {};
      console.log("fff-",room.Price);
      if (
        data.booking_source === HUMMING_BIRD_BOOKING_SOURCE ||
        data.booking_source === STUBA_HOTEL_BOOKING_SOURCE ||
        data.booking_source === DOTW_HOTEL_BOOKING_SOURCE
      ) {
        room.Price["Amount"] = room.Price[0].Amount;
      }

      rooms = {
        roomId: room.Id,
        room_count: room.Rooms,
        roomName: room.Description.replace(/'/g, " "),
        checkin: data.CheckIn,
        checkout: data.CheckOut,
        currency: room.Price["Currency"]
          ? room.Price["Currency"]
          : room.Price[0].Currency,
        price: Math.round(room.Price["Amount"] * 100) / 100,
        tax: "",
        discount: "",
        blockId: room.Id,
        maxOccupancy: room.Occupancy,
        maxChildFree: "",
        maxChildFreeAge: "",
        mealPlanCode: room.MealPlanCode,
        cancellationInfo: "",
        AdultCount: room.AdultCount,
        ChildrenCount: room.ChildrenCount,
        paxCount: room.paxCount,
        Supplements: room?.Supplements ?? [],
        cancellationDeadline : room?.CancellationDeadline,
        APICancellationDeadline : room?.APICancellationDeadline,
      };
      // data["CancelPenalties"]["CancelPenalty"]
      RoomData.push(rooms);
    });

    return { HotelData, RoomData };
  }

  calculateAge(dateOfBirth) {
    const birthDate = new Date(parseInt(dateOfBirth, 10));
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  async addHotelBookingDetailsCRS(
    body: AddPaxDetailsHotelCRS,
    hotelBody: BlockRoom,
    total_cost: number
  ): Promise<any> {
    const cancellationPolicy = new Buffer(
      hotelBody.RoomDetails.map((room) => room.cancellationPolicies).join(
        "\t\t\t"
      )
    ).toString("base64");
    const attributes = Buffer.from(
      JSON.stringify({ body, hotelBody })
    ).toString("base64");

    const query = `SELECT * FROM core_payment_charges WHERE module = 'Hotel';`
    const queryResponse = await this.manager.query(query);
    console.log('queryResponse:', queryResponse);

    let ConvenienceFee = 0;
    let totalAdultsAndChildren = 0;
    let convinenceValueType = '';
    let percentageAdvanceTax = 0;

    if (queryResponse[0].status == 1) {

      if (queryResponse[0].fees_type === 'percentage') {
        convinenceValueType = queryResponse[0].fees_type;
        percentageAdvanceTax = ((total_cost * queryResponse[0].fees) / 100);
        ConvenienceFee += Number(percentageAdvanceTax.toFixed(2));

      } else if (queryResponse[0].fees_type === 'plus') {
        convinenceValueType = queryResponse[0].fees_type;
        percentageAdvanceTax = queryResponse[0].fees;
        ConvenienceFee += Number(percentageAdvanceTax.toFixed(2));
      }

      if (queryResponse[0].added_per_pax === "Yes") {
        totalAdultsAndChildren = hotelBody.searchRequest.RoomGuests.reduce((acc: any, item: any) => {
          acc += item.NoOfAdults + item.NoOfChild;
          return acc;
        }, 0);
        ConvenienceFee = Number((ConvenienceFee * totalAdultsAndChildren).toFixed(2));
      }
    }

    let hotelCurrency = hotelBody.HotelCurrencyCode;
    let conversion: any;
    let currencyData;
    if (hotelCurrency && hotelCurrency !== BASE_CURRENCY && queryResponse[0].fees_type === 'plus') {
      currencyData = await this.activityDbService.formatPriceDetailToSelectedCurrency(hotelCurrency);
      conversion = currencyData['value'];
      ConvenienceFee = ConvenienceFee / Number(conversion);
    }

    let conversionRate = 1;
    if (hotelBody.searchRequest.Currency && hotelBody.searchRequest.Currency != BASE_CURRENCY) {
      let currencyDetails = await this.formatPriceDetailToSelectedCurrency(hotelBody.searchRequest.Currency);
      conversionRate = currencyDetails['value'] ?? 1;
    }

    if (queryResponse[0].fees_type === 'plus') {
      ConvenienceFee = parseFloat((ConvenienceFee * conversionRate).toFixed(2));
    }

    console.log({ 'conversionRate': conversionRate, 'ConvenienceFee': ConvenienceFee, 'percentageAdvanceTax': percentageAdvanceTax, 'convinenceValueType': convinenceValueType });
    total_cost = parseFloat((total_cost + ConvenienceFee).toFixed(2));
    console.log('total_cost:', total_cost);

    let promoCode: any = [];
    if (body.PromoCode) {
      promoCode = await this.getGraphData(
        `{
            corePromocodes(where:{
                promo_code:{
                    eq: "${body.PromoCode}"
                }
                }){
                    id
                    promo_code
                    discount_type
                    discount_value
                    use_type
                }
            }`,
        "corePromocodes"
      );
    }

    let discountAmount: any = 0;
    let firstPromo: any = "";
    if (promoCode.length > 0 && body.UserType === "B2C") {
      firstPromo = promoCode[0];
      if (firstPromo.discount_type === "percentage") {
        discountAmount = parseFloat(((firstPromo.discount_value / 100) * total_cost).toFixed(2));
        total_cost -= discountAmount;

      } else if (firstPromo.discount_type === "plus") {
        discountAmount = firstPromo.discount_value;
        total_cost -= discountAmount;
      }
    }

    if (firstPromo != "" && firstPromo.use_type === "Single") {
      const query = `UPDATE core_promocodes SET status = 0 WHERE id = ${firstPromo.id}`;
      this.manager.query(query);
    }

    const result = await this.getGraphData(
      `mutation {
					createHotelHotelBookingDetail(
				  		hotelHotelBookingDetail: {
							status: "BOOKING_HOLD"
                            booking_from:""
							app_reference: "${body.AppReference}"
                            booking_source: "${hotelBody.searchRequest.UserType}"
                            Api_id: "${body.booking_source}"
                            domain_origin: "CRS"
                            confirmation_reference : ""
							hotel_name: "${hotelBody.HotelName}"
							star_rating: ${hotelBody.StarRating || 0}
                            hotel_code: "${hotelBody.HotelCode}"
                            hotel_address: "${hotelBody.HotelAddress}"
                            hotel_photo: "${hotelBody.HotelPicture}"
                            phone_number: "${body.RoomDetails[0].AddressDetails.Contact
      }"
              email: "${body.RoomDetails[0].AddressDetails.Email}"
							hotel_check_in: "${hotelBody.searchRequest.CheckIn}"
                            hotel_check_out: "${hotelBody.searchRequest.CheckOut
      }"
                            convinence_value: "${ConvenienceFee}"
                            convinence_value_type: "${convinenceValueType}"
                            convinence_per_pax: ${totalAdultsAndChildren}
                            convinence_amount: "${ConvenienceFee}"
                            currency: "${hotelBody?.Price?.Currency}"
                            created_by_id: "${body.UserId}"
                            booking_reference: ""
                            cancellation_policy: "${cancellationPolicy}"
                            attributes: "${attributes}"
                            created_datetime: "${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}"
                            promo_code: "${body.PromoCode ?? ''}"
              TotalAmount: ${total_cost}
              supplier_id: ${hotelBody.CreatedById}
			}
					) {
						id
						domain_origin
						status
						app_reference
						confirmation_reference
                        booking_source
                        Api_id
                        booking_reference
						hotel_name
                        star_rating
                        hotel_address
                        hotel_code
                        hotel_photo
						phone_number
						alternate_number
						email
						hotel_check_in
						hotel_check_out
						payment_mode
						convinence_value
						convinence_value_type
						convinence_per_pax
						convinence_amount
						promo_code
						discount
						currency
						currency_conversion_rate
						attributes
						created_by_id
                        created_at
                        cancelled_datetime
                        cancellation_policy
                        created_datetime
                        TotalAmount
					}
			  	}
			`,
      "createHotelHotelBookingDetail"
    );
    return result;
  }
  async addHotelItenaryDetailsCRS(
    body: AddPaxDetailsHotelCRS,
    hotelBody: BlockRoom
  ): Promise<any> {
    const formattedData = this.formatBookingItineraryDetailsUniversalCRS(
      body,
      hotelBody
    );
    const result = await this.getGraphData(
      `mutation {
            		createHotelHotelBookingItineraryDetails(
                        hotelHotelBookingItineraryDetails:  ${JSON.stringify(
        formattedData
      ).replace(/"(\w+)"\s*:/g, "$1:")}
            		) {
            			id
            			app_reference
            			location
            			check_in
            			check_out
            			room_id
            			room_type_name
            			bed_type_code
                        status
                        adult_count
                        child_count
            			smoking_preference
            			total_fare
            			admin_markup
            			agent_markup
            			currency
            			attributes
            			room_price
                        tax
                        max_occupancy
            			extra_guest_charge
                        cancellation_policy
            			child_charge
            			other_charges
            			discount
            			service_tax
                        agent_commission
            			tds
                        gst
                        created_by_id
                        meal_plan_code
                        room_name
                  supplier_id
            		}
              	}
            `,
      "createHotelHotelBookingItineraryDetails"
    );
    return result;
  }

  async addHotelPaxDetailsCRS(paxDetails: any[]): Promise<any> {
    const bookingPaxDetailsResp = await this.getGraphData(
      `mutation {
                    createHotelHotelBookingPaxDetails(
                        hotelHotelBookingPaxDetails: ${JSON.stringify(
        paxDetails
      ).replace(/"(\w+)"\s*:/g, "$1:")}
                    ) {
                        id
                        app_reference
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        date_of_birth
                        age
                        passenger_nationality
                        passport_number
                        passport_issuing_country
                        passport_expiry_date
                        address
                        address2
                        city
                        state
                        country
                        postal_code
                        phone_code
                        status
                        attributes
                        supplier_id
                    }
                }`,
      "createHotelHotelBookingPaxDetails"
    );
    return bookingPaxDetailsResp;
  }

  async addPaxDetailsCRS(body: AddPaxDetailsHotelCRS) {
    const appRefInDB = await this.getGraphData(
      `query {
                    hotelHotelBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        app_reference
                    }
                }
                `,
      "hotelHotelBookingDetails"
    );
    if (appRefInDB.length > 0) {
      const errorClass: any = getExceptionClassByCode(
        "409 Duplicate entry for AppReference"
      );
      throw new errorClass("409 Duplicate entry for AppReference");
    }
    let resp = await this.redisServerService.read_list(body.ResultToken);
    let parsedInfo: BlockRoom = JSON.parse(resp);

    let total_cost = parsedInfo.RoomDetails.reduce((acc, room) => acc + (+room.Price.Amount), 0);
    console.log('total_cost:', total_cost);

    const hotelHotelDetails = await this.addHotelBookingDetailsCRS(
      body,
      parsedInfo,
      total_cost
    );
    const hotelHotelItenaryDetails = await this.addHotelItenaryDetailsCRS(
      body,
      parsedInfo
    );
    const formatterPaxDetails = this.formatPaxDetailsUniversalCRS(
      body,
      parsedInfo
    );
    const hotelHotelpaxDetails = await this.addHotelPaxDetailsCRS(formatterPaxDetails)
    //  await this.manager.query("UPDATE hotel_hotel_booking_detail SET TotalAmount = ? WHERE app_reference = ?", [total_cost, body.AppReference]);
    return this.getHotelBookingPaxDetailsUniversal(
      body,
      hotelHotelpaxDetails,
      hotelHotelDetails,
      hotelHotelItenaryDetails
    );
  }

  async addPaxDetails(body: any): Promise<any> {
    if (body.booking_source == CRS_HOTEL_BOOKING_SOURCE) {
      return this.addPaxDetailsCRS(body);
    }
    let resp = await this.redisServerService.read_list(body.ResultToken);
    let parsedInfo = JSON.parse(resp);
   
    let Rooms = [];
    let BlockRoomId = [];
    
    let parsedData = this.formatHotelRoomData(parsedInfo);

    let total_fare;
    let BookingPrepareResult;


    body.booking_from = "";

     
    parsedData["appRef"] = body.AppReference;
    parsedData["userId"] = body.UserId ? body.UserId : "";
    parsedData["userType"] = body.UserType ? body.UserType : "";
    parsedData["source"] = body.booking_source;
    parsedData["booking_from"] = body.booking_from;
    parsedData["Email"] = body.Email;
    parsedData["PromoCode"] = body.PromoCode;
    parsedData["payment_mode"] = body.payment_mode;

    const appRefInDB = await this.getGraphData(
      `query {
                    hotelHotelBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        app_reference
                    }
                }
                `,
      "hotelHotelBookingDetails"
    );
    if (appRefInDB.length > 0) {
      const errorClass: any = getExceptionClassByCode(
        "409 Duplicate entry for AppReference"
      );
      throw new errorClass("409 Duplicate entry for AppReference");
    } else {
      let paxDetails = body.RoomDetails[0].PassengerDetails;

      // paxDetails.push(body.RoomDetails[0].AddressDetails);
      const formattedPaxDetails = await this.formatPaxDetailsUniversal(
        paxDetails,
        body
      );
      parsedInfo=parsedInfo.HotelData
      let hotelBookingData: any = {
        ...parsedData,
        parsedInfo,
        addressDetails: body.RoomDetails[0].AddressDetails,
      };


      hotelBookingData.BookingSource = body?.BookingSource ?? ''
      hotelBookingData.Api_id = body?.booking_source ?? '';


      const bookingDetailsResp = await this.addHotelBookingDetails(
        hotelBookingData
      );

      const bookingItineraryResp = await this.addHotelBookingItineraryDetails(
        parsedData
      );
      // const amount = parsedInfo.HotelPolicy[0].amount;
      // const cancelAmountInDb = `UPDATE hotel_hotel_booking_details 
      // SET cancelAmount = ${amount} 
      // WHERE app_reference = '${body.AppReference}';`;
      // const resp =  await this.manager.query(cancelAmountInDb);
      const bookingPaxDetailsResp = await this.getGraphData(
        `mutation {
                        createHotelHotelBookingPaxDetails(
                            hotelHotelBookingPaxDetails: ${JSON.stringify(
          formattedPaxDetails
        ).replace(/"(\w+)"\s*:/g, "$1:")}
                        ) {
                            id
                            app_reference
                            title
                            first_name
                            middle_name
                            last_name
                            phone
                            email
                            pax_type
                            date_of_birth
                            age
                            passenger_nationality
                            passport_number
                            passport_issuing_country
                            passport_expiry_date
                            address
                            address2
                            city
                            state
                            country
                            postal_code
                            phone_code
                            status
                            attributes
                        }
                    }`,
        "createHotelHotelBookingPaxDetails"
      );
      return this.getHotelBookingPaxDetailsUniversal(
        body,
        bookingPaxDetailsResp,
        bookingDetailsResp,
        bookingItineraryResp
      );
    }
  }

  

  async getMarkupDetails(body: any, module_type: any, markup_level: any): Promise<any[]> {
    let response: any[] = [];

    if (body.UserType == "B2B" && body.UserId) {
        const query = `SELECT agent_group_id FROM auth_users WHERE id = ${body.UserId}`;
        const agent_group = await this.manager.query(query);
        let agent_group_id_condition = ``;

        if (agent_group && agent_group.length > 0) {
            const agent_group_id = agent_group[0].agent_group_id;
            agent_group_id_condition = `group_id: {
                                eq: ${agent_group_id}
                            }`;
        }


        const result1 = await this.getGraphData(
            `
                query {
                    coreMarkups (
                        where: {
                            module_type:{
                                eq: "${module_type}"
                            }
                            type: {
                                eq: "agent_group"
                            }
                            markup_level:{
                              eq: "${markup_level}"
                          }
                          countryCode:{
                            eq:"${body.MarkupCountry}"
                          }
                            ${agent_group_id_condition}
                            supplier_id: {
                                eq: "${body.booking_source}"
                            } 
                            is_deleted: { 
                                eq: "1" 
                            }
                        }
                    ) {
                        id 
                        markup_level
                        type
                        fare_type
                        module_type 
                        flight_airline_id
                        value
                        value_type
                        supplier
                        domain_list_fk
                        markup_currency
                    }
                }
            `,
            "coreMarkups"
        );

        if (result1 && result1.length > 0 && body.MarkupCountry !== "" && body.MarkupCity !== "") {
            const api = body.booking_source;
            let supplier = JSON.parse(result1[0].supplier);

            if (supplier[api]) {
                let priceArray = supplier[api];
                if (priceArray.value && priceArray.value != 0) {
                    result1[0].value_type = priceArray.value_type;
                    result1[0].value = Number(priceArray.value);
                }

                if (supplier[api].country) {
                    const countryMarkup = supplier[api].country;
                    const MarkupCountry = body.MarkupCountry;

                    if (countryMarkup[MarkupCountry]) {
                        priceArray = countryMarkup[MarkupCountry];
                        if (priceArray.value && priceArray.value != 0) {
                            result1[0].value_type = priceArray.value_type;
                            result1[0].value = Number(priceArray.value);
                        }
                    }
                }

                if (supplier[api].city) {
                    const cityMarkup = supplier[api].city;
                    const MarkupCity = body.MarkupCity;

                    if (cityMarkup[MarkupCity]) {
                        priceArray = cityMarkup[MarkupCity];
                        if (priceArray.value && priceArray.value != 0) {
                            result1[0].value_type = priceArray.value_type;
                            result1[0].value = Number(priceArray.value);
                        }
                    }
                }
            }

            response = [result1[0]];
        } else if (result1.length==0 && markup_level=="b2b_admin"){
          const resultSupplier = await this.getGraphData(
            `
                query {
                    coreMarkups (
                        where: {
                            module_type:{
                                eq: "${module_type}"
                            }
                            type: {
                                eq: "agent_group"
                            }
                            markup_level:{
                              eq: "${markup_level}"
                          }
                            ${agent_group_id_condition}
                            supplier_id: {
                                eq: "${body.booking_source}"
                            } 
                        countryCode:{
                            eq:"0"
                          }
                            is_deleted: { 
                                eq: "1" 
                            }
                        }
                    ) {
                        id 
                        markup_level
                        type
                        fare_type
                        module_type 
                        flight_airline_id
                        value
                        value_type
                        supplier
                        domain_list_fk
                        markup_currency
                    }
                }
            `,
            "coreMarkups"
        );

        if (resultSupplier && resultSupplier.length > 0 && body.MarkupCountry !== "" && body.MarkupCity !== "") {
          const api = body.booking_source;
          let supplier = JSON.parse(resultSupplier[0].supplier);

          if (supplier[api]) {
              let priceArray = supplier[api];
              if (priceArray.value && priceArray.value != 0) {
                  resultSupplier[0].value_type = priceArray.value_type;
                  resultSupplier[0].value = Number(priceArray.value);
              }

          }

          response = [resultSupplier[0]];
      }
        
        }
          else {
            const result2 = await this.getGraphData(
                `
                    query {
                        coreMarkups (
                            where: {
                                module_type:{
                                    eq: "${module_type}"
                                }
                                markup_level:{
                                  eq: "${markup_level}"
                              }
                                type: {
                                    eq: "generic"
                                }
                                auth_user_id: {
                                    eq: ${body.UserId}
                                }
                                is_deleted: { 
                                    eq: "1" 
                                }
                            }
                        ) {
                            id 
                            markup_level
                            type
                            fare_type
                            module_type 
                            flight_airline_id
                            value
                            value_type
                            domain_list_fk
                            markup_currency
                        }
                    }
                `,
                "coreMarkups"
            );
            response = result2.length > 0 ? [result2[0]] : [];
        }
    } else {
        const resultB2C = await this.getGraphData(
            `
                query {
                    coreMarkups (
                        where: {
                            module_type:{
                                eq: "${module_type}"
                            }
                            markup_level:{
                              eq: "${markup_level}"
                          }
                            type: {
                                eq: "supplier"
                            }
                            supplier_id: {
                                eq: "${body.booking_source}"
                            }    
                            countryCode: {
                            eq: "${body.MarkupCountry}"
                            }    
                            is_deleted: { 
                                eq: "1" 
                            }
                        }
                    ) {
                        id 
                        markup_level
                        type
                        fare_type
                        module_type 
                        supplier
                        domain_list_fk
                        markup_currency
                    }
                }
            `,
            "coreMarkups"
        );

        if (resultB2C && resultB2C.length > 0 && body.MarkupCountry !== "" && body.MarkupCity !== "") {
            const api = body.booking_source;
            let supplier = JSON.parse(resultB2C[0].supplier);

            if (supplier[api]) {
                let priceArray = supplier[api];
                if (priceArray.value && priceArray.value != 0) {
                    resultB2C[0].value_type = priceArray.value_type;
                    resultB2C[0].value = Number(priceArray.value);
                }

                if (supplier[api].country) {
                    const countryMarkup = supplier[api].country;
                    const MarkupCountry = body.MarkupCountry;

                    if (countryMarkup[MarkupCountry]) {
                        priceArray = countryMarkup[MarkupCountry];
                        if (priceArray.value && priceArray.value != 0) {
                            resultB2C[0].value_type = priceArray.value_type;
                            resultB2C[0].value = Number(priceArray.value);
                        }
                    }
                }

                if (supplier[api].city) {
                    const cityMarkup = supplier[api].city;
                    const MarkupCity = body.MarkupCity;

                    if (cityMarkup[MarkupCity]) {
                        priceArray = cityMarkup[MarkupCity];
                        if (priceArray.value && priceArray.value != 0) {
                            resultB2C[0].value_type = priceArray.value_type;
                            resultB2C[0].value = Number(priceArray.value);
                        }
                    }
                }
            }

            response = [resultB2C[0]];
        } else {
            const result3 = await this.getGraphData(
                `
                    query {
                        coreMarkups (
                            where: {
                                module_type:{
                                    eq: "${module_type}"
                                }
                                markup_level:{
                                  eq: "${markup_level}"
                              }
                                type: {
                                    eq: "supplier"
                                }
                                supplier_id: {
                                    eq: "${body.booking_source}"
                                }     
                                is_deleted: { 
                                    eq: "1" 
                                }
                            }
                        ) {
                            id 
                            markup_level
                            type
                            fare_type
                            module_type
                            value
                            value_type 
                            supplier
                            domain_list_fk
                            markup_currency
                        }
                    }
                `,
                "coreMarkups"
            );

            if (result3 && result3.length > 0) {
                response = [result3[0]];
            } else {
                const result2 = await this.getGraphData(
                    `
                        query {
                            coreMarkups (
                                where: {
                                    module_type:{
                                        eq: "${module_type}"
                                    }
                                    markup_level:{
                                      eq: "${markup_level}"
                                  }
                                    type: {
                                        eq: "generic"
                                    }
                                    is_deleted: { 
                                        eq: "1" 
                                    }
                                }
                            ) {
                                id 
                                markup_level
                                type
                                fare_type
                                module_type 
                                flight_airline_id
                                value
                                value_type
                                domain_list_fk
                                markup_currency
                            }
                        }
                    `,
                    "coreMarkups"
                );
                response = result2.length > 0 ? [result2[0]] : [];
            }
        }
    }
// console.log("markup_response-",response);return;
    return response;
}

async markupDetails(body: any, totalFare: any, exchangeRate: any = 1): Promise<any> {
  let AdminMarkup = 0;
  let AgentMarkup = 0;
  const markupDetails: any = body.markupDetails;  
  if (markupDetails.adminMarkup && markupDetails.adminMarkup.length > 0) {
      markupDetails.adminMarkup.forEach((markup: any) => {
          markup.value = parseFloat((markup.value).toFixed(2));
          if (markup.value_type === "plus") {
              AdminMarkup += markup.value;
          } else if (markup.value_type === "percentage") {
              AdminMarkup += (totalFare * markup.value) / 100
          }
      });
  }

  if (markupDetails.agentMarkup && markupDetails.agentMarkup.length > 0) {
      markupDetails.agentMarkup.forEach((markup: any) => { 
          markup.value = parseFloat((markup.value).toFixed(2));
          if (markup.value_type === "plus") {
              AgentMarkup += (markup.value + AdminMarkup);
          } else if (markup.value_type === "percentage") {
              AgentMarkup += ((totalFare + AdminMarkup) * markup.value) / 100
          }
      });
  }

  return {
      AdminMarkup,
      AgentMarkup
  }
}



  async addRecentSearche(req: any, body: any) {
    const child_age = body.child_age.replace(/"/g, "").replace(/\\/g, "");
    try {
      const result = await this.getGraphData(
        `mutation{
            createHotelRecentSearches(hotelRecentSearches:{
              city_ids:${body.city_ids}
              booking_source:"b2c"
              hotel_check_in:"${body.hotel_check_in}"
              hotel_check_out:"${body.hotel_check_out}"
              adult:${body.adult}
              child:${body.child}
              rooms:${body.rooms}
              created_by_id :${req.user.id}
              price : "${body.price}"
              hotel_name:"${body.hotel_name}"
              location_name:"${body.location_name}"
              hotel_image:"${body.hotel_image}"
              currency:"${body.currency}"
              guest_country:"${body.guest_country}"
              child_age:"${child_age}"
              hotel_id:"${body.hotel_id}"
              status:${1}
            }){
                id
                created_at
                created_by_id
                city_ids
                status
                booking_source
                hotel_id
                hotel_check_in
                hotel_check_out
                adult
                child
                rooms
                price
                location_name
                hotel_name
                hotel_image
                currency
                guest_country
                child_age
            }
          }`,
        `createHotelRecentSearches`
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getRecentSearch(req: any, body: any) {
    try {
      const result = await this.getGraphData(
        `{
            hotelRecentSearches(take : 4 
          order:{
          created_at:DESC}
            where:{
          created_by_id:{
            eq:${req.user.id}
          }
          status:{
            eq:${1}
        }
        booking_source:{
            eq:"b2c"
        }
            }){
              id
            created_at
            created_by_id
            city_ids
            status
            booking_source
            hotel_id
            hotel_check_in
            hotel_check_out
            adult
            child
            rooms
            price
            location_name
            hotel_name
            hotel_image
            currency
            guest_country
            child_age
            }
          }`,
        `hotelRecentSearches`
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getRecentSearchOfWeek(req, body) {
    try {
      const hotelQuery = `SELECT * FROM hotel_recent_searches 
           WHERE DATE(created_at) between DATE("${body.date}") and DATE_ADD("${body.date}", INTERVAL 6 DAY);`;
      const flightQuery = `SELECT * FROM flight_recent_searches 
           WHERE DATE(created_at) between DATE("${body.date}") and DATE_ADD("${body.date}", INTERVAL 6 DAY);`;
      const carQuery = `SELECT * FROM car_recent_searches 
           WHERE DATE(created_at) between DATE("${body.date}") and DATE_ADD("${body.date}", INTERVAL 6 DAY);`;
      const hotelResult = await this.manager.query(hotelQuery);
      const fightResult = await this.manager.query(flightQuery);
      const carResult = await this.manager.query(carQuery);

      return {
        hotelResult,
        fightResult,
        carResult,
      };
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
  async deleteRecentSearch(req, body) {
    try {
      const result = await this.getGraphData(
        `mutation{
              deleteHotelRecentSearch(id:${body.id})
            }`,
        `deleteHotelRecentSearch`
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  //GoGlobal

  async getAutoComplete(body: any): Promise<any> {
    const query = `SELECT DISTINCT city_id, city, country_code FROM goglobal_hotels WHERE city LIKE('${body.city_name}%')`;
    const result = await this.manager.query(query);
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getCityUniversal(tempData);
    });
  }

  async getHotelById(hotelId: any): Promise<any> {
    try {
      const query = `SELECT * FROM goglobal_hotels WHERE hotel_id = '${hotelId}'`;
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async GetHotelInfo(hotelCode: any): Promise<any> {
    // const query = `SELECT * FROM master_hotel_details WHERE hotel_code IN (${hotelCode})`;
    const query = `SELECT giata_code,hotelbeds,TravelBoutiqueOnline,hummingbird_travel,roomsxml,country_name,city_name,country_code,city_code,hotel_name,address,
    phone_number,email,website,star_rating,latitude,longitude,chainId,chainName,hotel_faci,image FROM giata_property_data WHERE hotelbeds IN (${hotelCode})`;
    return await this.manager.query(query);
  }

  async GetHotelFacilityInfo(hotelCode: any): Promise<any> {
    const query = `SELECT hotel_faci FROM master_hotel_details WHERE hotel_code IN (${hotelCode})`;
    return await this.manager.query(query);
  }

  async HotelFacilitiesCheck(hotelCode: any): Promise<any> {
    const query = `SELECT origin FROM hb_hotel_facilities WHERE hotel_code = ${hotelCode} LIMIT 1`;
    return await this.manager.query(query);
  }

  async GetHotelFacilities(hotelCode: any): Promise<any> {
    const query = `SELECT   hbfd.description
        FROM hb_hotel_facilities as hbf
        INNER JOIN hb_hotel_facilities_description as hbfd ON hbf.facility_description_id=hbfd.origin 
        WHERE hbf.hotel_code IN (${hotelCode});
        `;
    return await this.manager.query(query);
  }

  async GetHotelFacilitiesGiata(hotelCode: any): Promise<any> {
    // const query = `SELECT * FROM master_hotel_details WHERE hotel_code IN (${hotelCode})`;
    const query = `SELECT hotel_fac FROM giata_amenities_new WHERE giata_code IN (${hotelCode})`;
    return await this.manager.query(query);
  }

  async GetHotelTenFacilities(hotelCode: any): Promise<any> {
    const query = `SELECT   hbfd.description
        FROM hb_hotel_facilities as hbf
        INNER JOIN hb_hotel_facilities_description as hbfd ON hbf.facility_description_id=hbfd.origin 
        WHERE hbf.hotel_code = ${hotelCode} LIMIT 10 ;
        `;
    return await this.manager.query(query);
  }
  async InsertHotelBedsFacilities(hotelCode: any, Facilities: any): Promise<any> {
    console.log("IN");
    for (const element of Facilities) {

      let hotelFacilityDescription = await this.HotelBedsFacilities(hotelCode, element);

      if (hotelFacilityDescription[0]) {
        const query = `INSERT INTO hb_hotel_facilities
    (facility_description_id,hotel_id,hotel_code,facility_code,facility_group_code,hotel_order,indFee,indYesOrNo,indLogic,number) 
    VALUES (${hotelFacilityDescription[0].origin},'${parseInt(hotelCode)}','${parseInt(hotelCode)}','${parseInt(element.facilityCode)}','${parseInt(element.facilityGroupCode)}',${parseInt(element.order)},${element.indFee ? element.indFee : 0},'${element.indYesOrNo == true ? 1 : 0}',${element.indLogic == true ? 1 : 0},'${element.number ? 1 : 0}');`
        const result = this.manager.query(query);
      }
    }

    return this.GetHotelTenFacilities(hotelCode);
  }

  async HotelBedsFacilities(hotelCode: any, Facilities: any): Promise<any> {
    const queryF = `SELECT  origin
        FROM  hb_hotel_facilities_description
        WHERE facility_code = ${Facilities.facilityCode} AND facility_group_code  = ${Facilities.facilityGroupCode};
        `;
    return await this.manager.query(queryF);
  }
  async HotelbedsHotelCode(CityId: any): Promise<any> {
    try {
      const query = `SELECT hotel_code FROM master_hotel_details WHERE city_code = '${CityId}'`;
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async HotelCityCountryCode(CityId: any): Promise<any> {
    try {
      // const query = `SELECT id as city_id,iso_code as country_code FROM hb_city_list WHERE city_code = '${CityId}'`;
      const query = `SELECT city_id,country_code FROM giata_city WHERE city_id = '${CityId}'`;
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }


  async duplicationHotelCodeGiataId(CityId: any): Promise<any> {
    try {
      // const query = `SELECT id as city_id,iso_code as country_code FROM hb_city_list WHERE city_code = '${CityId}'`;
      const query = `SELECT giata_code,"1000000" as price  FROM giata_property_data WHERE city_code = '${CityId}' AND  (DOTW IS NOT NULL AND DOTW != '')
  + (hotelbeds IS NOT NULL AND hotelbeds != '')
  + (TravelBoutiqueOnline IS NOT NULL AND TravelBoutiqueOnline != '') + (roomsxml IS NOT NULL AND roomsxml != '')  + (hummingbird_travel IS NOT NULL AND hummingbird_travel != '') > 1`;
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async HotelbedsCityCode(CityId: any): Promise<any> {
    try {
      const query = `SELECT city_code FROM hb_city_list WHERE id = '${CityId}'`;
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async listHotelTopDestinationsAdmin(
    @Body() body: HotelTopDestinationsAdminDto
  ): Promise<any> {
    try {
      const result = await this.getGraphData(
        `
                    query {
                        hotelTopDestinations(where:{
                            source: {
                            eq: "${body.source}"
                        }  
                       status:{
                       eq:${1}
                    }
                   }
                   order: {created_at:DESC}
                    ) {
                        id
                        country
                        city_id
                        city_name
                        check_in
                        check_out
                        custom_title
                        image
                        source
                        status    
                    }
                }
            `,
        "hotelTopDestinations"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async listHotelTopDestinations(
    @Body() body: HotelTopDestinationsAdminDto
  ): Promise<any> {
    try {
      const result = await this.getGraphData(
        `
                    query {
                        hotelTopDestinations(where:{
                            source: {
                            eq: "B2C"
                        }  
                       status:{
                       eq:${1}
                    }
                   }
                   order: {created_at:DESC}
                    ) {
                        id
                        country
                        city_id
                        city_name
                        check_in
                        check_out
                        custom_title
                        image
                        source
                        status    
                    }
                }
            `,
        "hotelTopDestinations"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async emailHotelDetails(body) {
    let result = await this.getHotelBookingDetails(body);
    // const get_query = `SELECT images FROM contract_hotel_list_dcb WHERE HotelCode = ?`;
    // const res = await this.manager.query(get_query, [result[0].hotel_code]);
    const images = result[0].hotel_photo.replace(/'/g, '') // JSON.parse(res[0]?.images || "[]");
    console.log('images:', images);

    let resultPassengers = await this.getHotelBookingPaxDetails(body);
    let itineraries = await this.getHotelBookingItineraryDetails(body);

    let ticketTimeString = "";
    let subjectString = "";
    let attchment: any;
    let mailObject: any;
    var filename = result[0].app_reference;
    console.log("++++++++++++++++");
    console.log(result);
    console.log("++++++++++++++++");
    console.log(resultPassengers);
    console.log("++++++++++++++++");
    console.log('itineraries:', itineraries);
    const totalFareSum = itineraries.reduce((acc, item) => acc + item.total_fare, 0);
    console.log('totalFareSum:', totalFareSum);
    
    const bookedOn = formatStringtDate(result[0].created_at);

    let formattedJson: any = {};
    let earlyBird = 0;
    let durationDiscount = 0;
    if (result[0].Api_id === CRS_HOTEL_BOOKING_SOURCE) {
      // attributes
      const buff = Buffer.from(result[0].attributes, "base64");
      const text = buff.toString("utf-8");
      formattedJson = JSON.parse(text);
      // earlyBird = formattedJson.body.EarlyBirdValue;
      // durationDiscount = formattedJson.body.DurationOfStayValue;
      result[0].attributes = formattedJson;

      // cancellation_policy
      const bufff = Buffer.from(result[0].cancellation_policy, "base64");
      result[0].cancellation_policy = bufff
        .toString("utf-8")
        .split("\t\t\t");
      console.log('cancellation_policy', result[0].cancellation_policy);
      let timeZoneOffset = formattedJson.hotelBody.LocalTimeZone;
      result[0].cancellation_policy = Array.isArray(result[0].cancellation_policy) ? JSON.parse(result[0].cancellation_policy[0]) : JSON.parse(result[0].cancellation_policy);
      if (result[0].cancellation_policy.$t && result[0].cancellation_policy.$t.length) {
        result[0].cancellation_policy = result[0].cancellation_policy.$t;
        result[0].cancellation_policy = await this.formatCancellationDetails(result[0].cancellation_policy, timeZoneOffset, result[0].TotalAmount);
        console.log(result[0].cancellation_policy.join('\n\n'));
      } else {
        result[0].cancellation_policy = null;
      }
    }

    let discountHtml = '';
    if (result[0].Api_id === CRS_HOTEL_BOOKING_SOURCE) {
      discountHtml = `
        <tr>
          <td><span>Early Bird - </span></td>
          <td><span>${earlyBird}</span></td>
        </tr>
        <tr>
          <td><span>Duration Discount - </span></td>
          <td><span>${durationDiscount}</span></td>
        </tr>
      `;
    }
    // const priceDetails = JSON.parse(result[0].flightBookingTransactions[0].attributes)
    // const created_by_id = result[0].created_by_id;

    // const agencyResult = await this.getGraphData(
    //   `
    // query {
    //     authUser(id:${created_by_id})
    //     {
    //         id
    //         business_name
    //         business_number
    //         auth_role_id
    //     }
    // }
    // `,
    //   `authUser`
    // );
    let itinerariesHtml = "";
    itineraries.forEach((element, index) => {
      itinerariesHtml =
        itinerariesHtml +
        ` <span style="display:block; font-size: 13px; padding-left:0%">
        ${element.room_type_name}
        </span> `;
    });

    let PassengerDetails = resultPassengers;
    const adultCount = PassengerDetails.filter((ele) => ele.pax_type === "Adult" && ele.pax_type != null).length;
    const childCount = PassengerDetails.filter((ele) => ele.pax_type === "Child" && ele.pax_type != null).length;
    const adultInfo = PassengerDetails.filter((ele) => ele.pax_type === "Adult" && ele.pax_type != null);
    
    const addressInfo = typeof result[0].attributes !== "object" ? JSON.parse(result[0].attributes.replace(/'/g, '"')) : {addressDetails: {PhoneCode: result[0].attributes.body.RoomDetails[0].AddressDetails.PhoneCode}};
    

    let passengerDataHtml = [];
    let PassengerData = [];
    let PassengerContactInfo = PassengerDetails[0];

    result[0].hotel_check_in = await this.convertTimestampToISOStringNew(result[0].hotel_check_in);
    result[0].hotel_check_out = await this.convertTimestampToISOStringNew(result[0].hotel_check_out);

    for (const [index, element] of PassengerDetails.entries()) {
      const dateOfBirth = element.date_of_birth
        ? await this.convertTimestampToISOStringNew(element.date_of_birth)
        : 'N/A';

      // Construct the HTML row
      passengerDataHtml.push(`
        <tr style="border-bottom: 1px solid #eee;" *ngFor="let t of voucher?.BookingPaxDetails; index as i">
                                                    <td style="padding:10px 15px; background: #e7f2fd; font-weight: 600;">
                                                        ${index + 1}
                                                    </td>
                                                    <td style="padding:10px 15px; background: #e7f2fd; font-weight: 600;">
                                                      
                                                            <span class="text-uppercase">
                                                                ${element.first_name} ${element.middle_name ? element.middle_name : ''} ${element.last_name} <br>
                                                            </span>
                                                    </td>
                                                    <td
                                                        style="padding:10px 15px; background: #e7f2fd; font-weight: 600; text-align: center;">
                                                        ${element.pax_type}
                                                    </td>
                                               
                                                   
                                                </tr>

      `);

      element.index = index + 1;
      PassengerData.push(element);
    }

    const finalPassengerDataHtml = passengerDataHtml.join('');

    // cancellationPolicy html
    let cancellationHtml = '';
    if (result[0].cancellation_policy) {
      let cancellationPolicy = result[0].cancellation_policy;
      if (Array.isArray(cancellationPolicy) && result[0].Api_id === CRS_HOTEL_BOOKING_SOURCE) {
        cancellationPolicy = cancellationPolicy.join('\n'); // Join array elements with newline
      } else if (typeof cancellationPolicy !== 'string' && result[0].Api_id === CRS_HOTEL_BOOKING_SOURCE) {
        // If it's not a string, we can stringify it
        cancellationPolicy = String(cancellationPolicy);
      }

      // Replace newlines with <br> to ensure line breaks in the HTML email
      const formattedCancellationPolicy = (result[0].Api_id === CRS_HOTEL_BOOKING_SOURCE) ? cancellationPolicy.replace(/\n/g, '<br>') : cancellationPolicy;

      cancellationHtml = `<table style="width: 100%; margin-top: 15px;box-shadow: 0 0 2px 0 rgba(0,0,0,.08), 0 2px 8px 0 rgba(0,0,0,.16);">
                            <tbody>
                                <section style="background-color: #092e53;color: white;">
                                    <h5 style="font-size: 17px; margin:0px; padding:10px;" class="p-2 m-0">Cancellation Policy</h5>
                                </section>
                                
                                    <tr>
                                        <td colspan="7"
                                            style="line-height:20px; font-size:14px; background: #fff; padding: 15px; color:#555" >
                        
                                            <span > ${formattedCancellationPolicy} </span>
                                        
                                        </td>
                                        <td>
                                         
                                        </td>
                                    </tr>
                          
                            </tbody>
                        </table>`
    }

    // await this.pdf({
    //     filename: "./voucher/hotel/" + filename + ".pdf",
    //     template: "hotel",
    //     viewportSize: {
    //         width: 1500
    //     },
    //     locals: {
    //         hotelInfo: result[0],
    //         app_reference: result[0].app_reference,
    //         passengerDetails: PassengerData,
    //         business_name: (agencyResult.business_name)?agencyResult.business_name:'',
    //         business_number: (agencyResult.business_number)?agencyResult.business_number:'',
    //         booked_on: bookedOn
    //     },
    // });
    const { cc } = await this.getEmailConfig();
    if (result[0].status === "BOOKING_CONFIRMED" || result[0].status === "BOOKING_HOLD") {
      subjectString = `HOTEL BOOKING DETAILS : ${result[0].app_reference}`;
      // await this.pdf({
      //       filename: "./voucher/hotel/" + filename + ".pdf",
      //       template: "hotel",
      //       viewportSize: {
      //           width: 1500
      //       },
      //       locals: {
      //           hotelInfo: result[0],
      //           app_reference: result[0].app_reference,
      //           PassengerDetails,
      //           booked_on: bookedOn,
      //           images,
      //           noOfRooms: itineraries.length,
      //           itineraries,
      //           adultCount,
      //           childCount,
      //           totalFareSum,
      //       },
      // });

      // attchment = {
      //     filename: `${result[0].app_reference}.pdf`,
      //     contentType: "application/pdf",
      //     path:
      //         process.cwd() +
      //         "/voucher/hotel/" + filename +
      //         ".pdf",
      // }

      mailObject = {
        to: `${result[0].email}`,
        cc,
        from: `"Booking247" <${SUPPORT_EMAIL}>`,
        subject: subjectString,
        // attachments: [
        //     attchment
        // ],
      };
    }

    if (result[0].status === "BOOKING_CANCELLED") {
      subjectString = `HOTEL BOOKING CANCELLED : ${result[0].app_reference}`

      mailObject = {
          to: `${result[0].email}`,
          cc,
          from: `"Booking247" <${SUPPORT_EMAIL}>`,
          subject: subjectString,
      }
    }
    console.log('mailObject:', mailObject);
    const booking247Logo = process.env.NODE_ENV == "LOCAL" || process.env.NODE_ENV == "UAT"
      ? "http://54.198.46.240/booking247/supervision/assets/images/login-images/l-logo.png"
      : "https://www.booking247.com/supervision/assets/images/login-images/l-logo.png";

    const htmlData = ` <table cellpadding="0" border-collapse="" cellspacing="0" width="100%"
        style="font-size:12px;font-family:'Open Sans',sans-serif;max-width:850px;border:2px solid #ddd;border-radius:5px;margin:10px auto;background-color:#fff;padding:20px;border-collapse:separate;color:#000">
       <tbody>
                <tr>
                    <td style="padding:0px; border-top: unset">
                        <table width="100%" style="border-collapse: collapse;" cellpadding="0" cellspacing="0">
                            <tbody>
                            
                                <tr>
                                    <td style="padding: 0px; border-top: 1px solid transparent; border-bottom: 1px solid #082E53;"><img
                                            style="width:190px; padding: 10px 0px; -webkit-print-color-adjust: exact;"
                                            src="${booking247Logo}">
                                    </td>
                                   
                                </tr>
                            </tbody>
                        </table>
                        <table style="width: 100%;">
                            <tbody>

                                <tr>
                                    <td colspan="2" style="padding: 0px; border: none;">
                                        <table style="width: 100%;">
                                            <tr><td style="height: 5px; border: none; padding: 0px;"></td></tr>
                                            

                                            <tr><td style="height: 5px; border: none; padding: 0px;"></td></tr>

                                                <tr>
                                                <td style="border:none; padding:0px 0px 15px; line-height: 25px; font-size: 15px; width: 50%;">
                                                <strong class="label"
                                                style=" font-size:17px;">

                                                <ng-container>
                                                <span class="text-uppercase">
                                                    ${adultInfo[0].first_name} ${adultInfo[0].middle_name ? adultInfo[0].middle_name : ''} ${adultInfo[0].last_name}<br>
                                                </span>
                                            </ng-container>
                                                </strong>
                                                <span><img src="https://booking247.com/assets/images/telephone-ic.png"> +${addressInfo.addressDetails.PhoneCode} ${result[0].phone_number}</span>
                                                <br>
                                                <span><img src="https://booking247.com/assets/images/envelope-ic.png"> ${result[0].email}</span>
                                                </td>

                                                <td style="border:none; padding:0px 0px 15px; line-height: 25px; font-size: 15px; width: 50%; text-align: right;">
                                                    <span>
                                                        Confirmation Ref: <strong>${result[0].confirmation_reference}</strong><br>
                                                    </span>
                                                    <span>
                                                        Booking Ref: <strong>${result[0].app_reference}</strong><br>
                                                    </span>
                                                    <span>Booking Date: <strong>${bookedOn}</strong></span><br>
                                                    <span>Booking Status: <strong>${result[0].status}</strong></span>
                                                    
                                                    </td>
                                                </tr>
                                                <tr><td style="height: 5px; border: none; padding: 0px;"></td></tr>
                                      </table>
                                    </td>
                                </tr>


                                <tr>
                                    <td style="padding:0px;" colspan="1">
                                        <table style="width: 100%;">
                                            <tr>
                                    <td style="padding:10px 0px; width: 25%;"><img
                                        style="width:100%; object-fit:cover; height:125px; border-radius: 10px;"
                                        src="${images}">
                                </td>
                               
                                    <td valign="top" style="padding:15px 15px;"> <span style="line-height:normal;font-size:22px;color:#2a2a2a;vertical-align:middle;font-weight: 700;">${result[0].hotel_name
                                    }
                                        </span> <br> <span
                                            style="display: block;line-height:22px;font-size: 13px; margin-top:4px;">
                                            ${result[0].hotel_address
                                            }
                                        </span> 
                                        <div class="mt-2"
                                        >
                                          <img src="http://54.198.46.240/nosafer/assets/images/star_rating_black_${result[0].star_rating}.png">
                                     
                                        </div>
                                    
                                     </td>
                                    </tr>
                                     </table>
                                     
                                     </td>
                                </tr>
                                
                                <tr><td colspan="2" style="padding:12px 0px 0px; font-size: 18px;"><img src="https://booking247.com/assets//images/htldtl-ic.png">&nbsp;<span style="font-weight: 500;">Hotel Details</span></td></tr>
                                <tr>
                                    <td width="100%;" style="padding:0px; border-top:0px; border: none;">
                                        <table width="100%" cellpadding="5" cellspacing="2"
                                            style="font-size: 13px; border-collapse: separate;  box-shadow: 0 0 2px 0 rgba(0,0,0,.08), 0 2px 8px 0 rgba(0,0,0,.16); background: #fff;">
                                            <tbody>
                                                <tr style="white-space:nowrap; background: #092e53; color: #fff; font-weight: 500;">
                                                    <th>Room Type</th>
                                                    
                                                    <th>Check In</th>
                                                    <th>Check Out</th>
                                                    <th>Adults</th>
                                                    <th>Child</th>
                                                </tr>

                                                <tr style="background: #e7f2fd; text-align:center;">
                                                    <td style="width: 27%;">
                                                    ${itinerariesHtml}
                                                    </td>

                                                
                                                    <td><span
                                                        style="display: block; font-size: 14px; color: #333; margin-top: 1px;">${result[0].hotel_check_in
                                                        }
                                                    </span></td>

                                                    <td><span
                                                        style="display: inline-block;  font-size: 14px; color: #333; margin-top: 1px;">
                                                        ${result[0].hotel_check_out
                                                        }
                                                    </span>
                                                   </td>

                                                    <td>
                                                        <span
                                                        style="display: inline-block;  font-size: 14px; color: #333; margin-top: 1px;">
                                                          ${adultCount} </span>
                                                    </td>

                                                    <td>${childCount}
                                                    </td>
                                                </tr>
                                                
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table
                            style="width: 100%; margin-top: 15px;">
                            <tbody>

                                <tr><td colspan="2" style="padding:12px 0px 0px; font-size: 18px; border: none;"><img src="https://booking247.com/assets/images/users-ic.png">&nbsp;<span style="font-weight: 500;">Guest(s) Details</span></td></tr>
                                <tr>
                                    <td colspan="2" width="100%" style="padding:0px; width:100%; ">
                                        <table width="100%" cellpadding="5" cellspacing="2"
                                            style="font-size: 13px; border-collapse: separate;  box-shadow: 0 0 2px 0 rgba(0,0,0,.08), 0 2px 8px 0 rgba(0,0,0,.16); background: #fff;">
                                            <tbody>
                                                <tr style="white-space:nowrap; background: #092e53; color: #fff;">
                                                    <td
                                                        style=" -webkit-print-color-adjust: exact;padding:10px 15px;color: #fff; width: 5%; font-weight: 700;">
                                                        Sl.No</td>
                                                    <td
                                                        style="-webkit-print-color-adjust: exact; width:30%; padding:10px 15px;color: #fff; font-weight: 700;">
                                                        Guest's&nbsp;Name</td>
                                                    <td
                                                        style="-webkit-print-color-adjust: exact; width:20%; padding:10px 15px;color: #fff; font-weight: 700; text-align: center;">
                                                        Type</td>
                                                    
                                                </tr>
                                                

                                                ${finalPassengerDataHtml}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        

                    

                        <table style="width: 100%; margin-top: 15px;">
                            <tbody>

                                <tr><td colspan="2" style="padding:12px 0px 0px; font-size: 18px; border: none;"><img src="https://booking247.com/assets/images/payment-ic.png">&nbsp;<span style="font-weight: 500;">Payment Details</span></td></tr>
                                <tr>
                                    <td colspan="2" width="100%" style="padding:0px; width:100%;border: none; ">
                                        <table width="100%" cellpadding="5" cellspacing="2"
                                            style="font-size: 14px; border-collapse: separate;  box-shadow: 0 0 2px 0 rgba(0,0,0,.08), 0 2px 8px 0 rgba(0,0,0,.16); background: #fff;">
                                            <tbody>

                                             <tr style="white-space:nowrap; background: #092e53;">
                                                    <td style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500; 
                                                    color: #fff;">
                                                        Payment Breakup</td>
                                                    <td
                                                        style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; color: #fff; font-weight: 500;">
                                                       Amount (${result[0].currency})</td>
                                                    
                                                </tr>

                                                <tr style="white-space:nowrap; background: #f5f5f5;">
                                                    <td
                                                        style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500;">
                                                        Base Price</td>
                                                    <td
                                                        style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 500;">
                                                        ${totalFareSum}</td>
                                                    
                                                </tr>

                                                 <tr style="white-space:nowrap; background: #f5f5f5;">
                                                    <td
                                                        style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500;">
                                                        Convinence Fee +</td>
                                                    <td
                                                        style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 500;">
                                                        ${result[0].convinence_amount}</td>
                                                    
                                                </tr> 


                                               

                                                <tr style="white-space:nowrap; background: #e7f2fd;">
                                                    <td
                                                        style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 600;">
                                                        Total Amount</td>
                                                    <td
                                                        style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 600;">
                                                        ${result[0].TotalAmount}</td>
                                                    
                                                </tr>
                                               
                                                
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        ${cancellationHtml}
                    </td>
                </tr>

                <tr>
                    <td style="padding: 0px; border: none;">
                        <table style="width: 100%;">
                        <tr>
                         <td style="width: 50%;
                         background: #fff;
                         border: none;
                         color: #092e53; vertical-align:bottom;
                         padding: 0px;
                         line-height: 22px;
                         font-size: 14px;">
                            41, Victoria Street<br>
 Blackburn, Lancashire, United Kingdom - BB1 6DN<br>
 care.uk@booking247.com | + 44 1254 66 22 22
                         </td>
                         <td style="width: 50%; border: none; padding: 0px;"><img style="width: 100%;" src="https://booking247.com/assets/images/voucher_foot.jpg"></td>
                         </tr>
                         </table>
                         </td>
                    </tr>
            </tbody>
    </table>`;
    mailObject.html = htmlData;
    await this.mailerService.sendMail(mailObject);
    // let msg = "";
    // var Check_In = await formatHotelDateTime(result[0].hotel_check_in);
    // console.log(Check_In, "Check_In");
    // var Check_Out = await formatHotelDateTime(result[0].hotel_check_out);
    // console.log(Check_Out, "Check_Out");
    // if (result[0].booking_source === "B2B") {
    //   msg = `
    //         Dear ${PassengerDetails[0].first_name} ${PassengerDetails[0].middle_name} ${PassengerDetails[0].last_name} 
    //         Thank you for chooshing Booking247. 
    //         Hotel : ${result[0].hotel_name}
    //         Hotel Adress : ${result[0].hotel_address}
    //         Your Booking247 Ref No : ${result[0].app_reference}.
    //         Check In : ${Check_In}
    //         Check Out : ${Check_Out}
    //         Booking247 Help Line : ${BOOKING247_HELPLINE_NUMBER}
    //         Booking247 Email: ${SUPPORT_EMAIL}`;
    // } else if (result[0].booking_source === "B2C") {
    //   msg = `
    //         Dear ${PassengerDetails[0].first_name
    //       ? PassengerDetails[0].first_name
    //       : ""
    //     } ${PassengerDetails[0].middle_name ? PassengerDetails[0].middle_name : ""
    //     } ${PassengerDetails[0].last_name ? PassengerDetails[0].last_name : ""} 
    //         Thank you for chooshing Booking247. 
    //         Hotel : ${result[0].hotel_name}
    //         Hotel Adress : ${result[0].hotel_address}
    //         Your Booking247 Ref No : ${result[0].app_reference}.
    //         Check In : ${formatHotelDateTime(result[0].hotel_check_in)}
    //         Check Out : ${formatHotelDateTime(result[0].hotel_check_out)}
    //         Booking247 Help Line : ${BOOKING247_HELPLINE_NUMBER}
    //         Booking247 Email: ${SUPPORT_EMAIL}`;
    // }
    // console.log(msg);
    // const sendSmsResponse = this.commonService.sendSMS(msg , PassengerContactInfo.phone_code+PassengerContactInfo.phone)
    // if(sendSmsResponse)
    return true;
    // const udh_content = btoa("HeaderTEST")
    // const username = `${SMS_USERNAME}`
    // const password = `${SMS_PASSWORD}`
    // const to = result[0].phone_code + result[0].phone
    // const from = `${SMS_FROM}`
    // var url = `https://http.myvfirst.com/smpp/sendsms?username=${username}&password=${password}&to=${to}&udh=${udh_content}&from=${from}&text=${msg}&dlr-url=http://54.198.46.240:4008/b2b/common/dlrurl`
    // var givenUrl = `https://http.myvfirst.com/smpp/sendsms?username=${username}&password=${password}&to=${to}&from=${from}&text=${msg}&category=bulk`
    // const smsResult: any = await this.httpService.get(givenUrl, {
    //     headers: {
    //         'Accept': 'application/json',
    //         'Accept-Language': 'en',
    //     }
    // }).toPromise();
  }

  async getEmailConfig() {
    try {
      const emailConfig = await this.manager.query(`
                SELECT * FROM cms_emailconfigs LIMIT 1
      `);

      const ccArr = emailConfig[0].cc.split(',').map((email: string) => email.trim())
      return { ...emailConfig[0], cc: ccArr }
    } catch (error) {
        console.log(error);
        return error
    }
  }

  async formatPriceDetailToSelectedCurrency(currency: any) {
    try {
      const currencyDetails = await this.getGraphData(
        `
				query {
					cmsCurrencyConversions(where: {
                        currency: {
                            eq:"${currency}"
                        } 
                    }
                    ) {
						id
						currency
						value
						status
					}
			  	}
			`,
        "cmsCurrencyConversions"
      );
      if (currencyDetails.length < 1) {
        throw new Error("400 No Currency Conversion Found");
      }
      return currencyDetails[0];
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async TboHotelHotelCode(CityId: any): Promise<any> {
    try {
      const query = `SELECT code as hotel_code FROM hotel_hotel_tbo WHERE CityId = '${CityId}'`;
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async GetHotelImages(hotelCode: any): Promise<any> {
    const query = `SELECT hotel_desc,images FROM giata_hotel_desc WHERE giata_code IN (${hotelCode})`;
    return await this.manager.query(query);
  }

  async getCanelCappingDays(module: any): Promise<any> {
    const query = `SELECT days FROM cancellation_capping WHERE module = '${module}' `;
    return await this.manager.query(query);
  }

  async getHotelMarkupDetails(
    searchData: any,
    module_type: any,
    markup_level: any
  ): Promise<any> {
    const result = await this.getGraphData(
      `
                query {
                    coreMarkups (
                        where: {
                            module_type:{
                                eq: "${module_type}"
                            }
                            markup_level:{
                                eq: "${markup_level}"
                            }
                            auth_user_id: {
                                in: "0,${searchData["UserId"]}"
                            }
                            is_deleted: { 
                                eq: "1" 
                            }
                        }
                    ) {
                        id 
                        markup_level
                        type
                        fare_type
                        module_type 
                        auth_user_id
                        value
                        value_type
                        domain_list_fk
                        markup_currency
                        segment_list
                    }
                }
            `,
      "coreMarkups"
    );
    return result;
  }

  async getMarkupDetailsPrice(body: any) {
    let admin_markup: any = [],
      agent_markup: any = [],
      markupDetails: any = {};

    if (body["UserType"]) {
      if (body["UserType"] == "B2B") {
        admin_markup = await this.getHotelMarkupDetails(
          body,
          "b2b_hotel",
          "b2b_admin"
        );
        markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];

        agent_markup = await this.getHotelMarkupDetails(
          body,
          "b2b_hotel",
          "b2b_own"
        );
        markupDetails.agentMarkup = agent_markup.length > 0 ? agent_markup : [];
      } else {
        body["UserId"] = 0;
        admin_markup = await this.getHotelMarkupDetails(
          body,
          "b2c_hotel",
          "b2c_admin"
        );
        markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
      }
    } else {
      body["UserId"] = 0;
      admin_markup = await this.getHotelMarkupDetails(
        body,
        "b2c_hotel",
        "b2c_admin"
      );
      markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
    }
    return markupDetails;
  }

  async convertTimestampToISOString(timestampString: any) {
    const date = moment(parseInt(timestampString));
    const isoString = date.format('YYYY-MM-DD');
    return isoString;
  }

  async convertTimestampToISOStringNew(timestampString: any) {
    const date = moment(parseInt(timestampString));
    const isoString = date.format('DD-MM-YYYY');
    return isoString;
  }

  //added
  async getMarkup(body: any): Promise<any> {
    let admin_markup: any = [], agent_markup: any = [], markupDetails: any = {};
    if (body['UserType']) {
      if (body['UserType'] == "B2B") {

        admin_markup = await this.getMarkupDetails(body,  "b2b_hotel", "b2b_admin");
        markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
        // markupDetails.adminMarkup = Object.keys(admin_markup).length > 0 ? admin_markup : [];

        agent_markup = await this.getMarkupDetails(body,  "b2b_hotel", "b2b_own");
        markupDetails.agentMarkup = agent_markup.length > 0 ? agent_markup : [];
        // markupDetails.agentMarkup = Object.keys(agent_markup).length > 0 ? agent_markup : [];

      } else {
        body["UserId"] = 1;
        admin_markup = await this.getMarkupDetails(body,  "b2c_hotel", "b2c_admin");
        markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
      }
    } 
    return {
      markupDetails
    }
  }
  async getConvineneceFee(amount,currency,count){
    let ConvenienceFee = 0;
    let conversionRate = 1;
    if (currency && currency != BASE_CURRENCY) {
      let currencyDetails = await this.formatPriceDetailToSelectedCurrency(currency);
      conversionRate = currencyDetails['value'] ?? 1;
    }

    const query = `SELECT * FROM core_payment_charges WHERE module = 'Hotel';`
    const queryResponse = await this.manager.query(query);
    if (queryResponse[0].status == 1) {

      if (queryResponse[0].fees_type === 'percentage') {

        const percentageAdvanceTax = (amount * queryResponse[0].fees) / 100;
        ConvenienceFee += Number(percentageAdvanceTax.toFixed(2));

      } else if (queryResponse[0].fees_type === 'plus') {
        // const percentageAdvanceTax = queryResponse[0].fees * ExchangeRate;
        const percentageAdvanceTax = queryResponse[0].fees *  conversionRate
        ConvenienceFee += Number(percentageAdvanceTax.toFixed(2));
      }

      if (queryResponse[0].added_per_pax === "Yes") {
        let totalAdultsAndChildren = count
        // .reduce((acc: any, item: any) => {
        //   acc += item.NoOfAdults + item.NoOfChild;
        //   return acc;
        // }, 0);
        ConvenienceFee = Number((ConvenienceFee * totalAdultsAndChildren).toFixed(2));
      }
    }
    return ConvenienceFee
  }

  async formatCancellationDetails(cancellationDetails, timeZoneOffset, total_price) {
  
    // Format cancellation messages
    const formattedCancellationMessages = cancellationDetails.map(policy => {
      let freeCancellationDate = new Date(policy.date_from);
      freeCancellationDate.setDate(freeCancellationDate.getDate() - 1);
      let updatedDateFrom = moment((freeCancellationDate)).format("DD-MM-YYYY");
  
      policy.date_from = moment((policy.date_from)).format("DD-MM-YYYY");
      // Format the message for free cancellation
      const freeCancellationMessage = `- Free Cancellation Until ${updatedDateFrom} 12:00 AM ${timeZoneOffset}`;
  
      // Create the charge message
      let chargeMessage = `- Cancellations from ${policy.date_from} 12:01 AM ${timeZoneOffset} will be charged ${policy.charge} ${policy.currency}`;
  
      // Concatenate the messages with newline characters between them
      return `${freeCancellationMessage}\n${chargeMessage}`;
    });
  
    // Add the No Show charge message at the end
    const noShowMessage = `- No Show will be Charged ${total_price} ${cancellationDetails[0].currency}`;
  
    // Return all messages with the No Show message at the end
    return [...formattedCancellationMessages, noShowMessage];
  }


  async getPayLaterUnpaidHotelBookings(status: any, currentDate: any) {
    const query1 = `SELECT app_reference,Api_id  FROM hotel_hotel_booking_details WHERE cancel_deadline LIKE '${currentDate}%'  AND booking_source = 'B2B' AND payment_mode = 'pay_later' AND payment_status='Not Paid'  AND status='${status}' AND paid_mode IS NULL`

const UnpaidBookingDetails = await this.manager.query(query1);
const result = UnpaidBookingDetails;
    return result;
}
}
