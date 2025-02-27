import {
  Injectable,
  HttpService,
  HttpException,
  BadRequestException,
} from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import * as moment from "moment";
import {
  getPropValue,
  getPropValueOrEmpty,
  undefinedToSkip,
  debug,
} from "../../../app.helper";
import {
  DB_SAFE_SEPARATOR,
  RedisServerService,
} from "../../../shared/redis-server.service";
import { RequestResponseLogService } from "../../../shared/request-response-log.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { SafariTransformService } from "./safari-transform.service";
import { CommonService } from "apps/webservice/src/common/common/common.service";
import { SAFARI_BOOKING_SOURCE, SAFARI_URL, logStoragePath } from "../../../constants";

@Injectable()
export class SafariService extends FlightApi {
  constructor(
    private httpService: HttpService,
    private safariTransformService: SafariTransformService,
    private readonly redisServerService: RedisServerService,
    // private readonly requestResponseLogService: RequestResponseLogService,
    private readonly flightDbService: FlightDbService,
    private readonly commonService: CommonService
  ) {
    super();
  }
  async getToken(): Promise<any> {
    // let token = await this.redisServerService.read_list("safari_token");
    // if (token! == '' || token! == undefined || token! == 'NaN') {
    let request = {
      channelCredential: {
        ChannelCode: "Test_24425",
        ChannelPassword: "Ykqytl4LQ5EUmbY",
      },
    };
    let headers = {
      "Content-Type": "application/json",
    };

    let response = await this.httpService
      .post(`${SAFARI_URL}/General.svc/Rest/Json/CreateTokenV2`, request, {
        headers,
      })
      .toPromise();
    let token = response["Result"].TokenCode;
    // await this.redisServerService.store_list("safari_token", token);
    // }
    return token;
  }

  async search(body: any): Promise<any> {
    let jsonResponse: any = [];
    let token = await this.getToken();
    let request = await this.safariTransformService.searchRequest(body, token);
    let headers = {
      "Content-Type": "application/json",
    };
    const end1: any = new Date();
    const start2: any = new Date();
    const start1: any = new Date();
    console.log("For Third party request Format time:", end1 - start1);

    let response = await this.httpService
      .post(`${SAFARI_URL}/Air.svc/Rest/Json/SearchAvailability`, request, {
        headers,
      })
      .toPromise();
    if (this.isLogXml) {
      const fs = require("fs");
      fs.writeFileSync(
        `${logStoragePath}/flights/safari/Search_RQ.json`,
        JSON.stringify(request)
      );
      fs.writeFileSync(
        `${logStoragePath}/flights/safari/Search_RS.json`,
        JSON.stringify(response)
      );
    }
    const end2: any = new Date();
    let fs = require("fs");
    console.log("Third party response time:", end2 - start2);

    let formattedResponse = await this.safariTransformService.finalData(
      response,
      body,
      token
    );

    return formattedResponse;
  }

  async fareBranded(body: any): Promise<any> {
    let ResultToken = this.forceObjectToArray(body["ResultToken"]);
    let result: any = [];
    let FlightDetailParsed: any = [];
    let fareGBrand = [];
    body["ResultToken"] = ResultToken;
    for (let i = 0; i < ResultToken.length; i++) {
      let FlightDetail = await this.redisServerService.read_list(
        body["ResultToken"][i]
      );

      FlightDetailParsed.push(JSON.parse(FlightDetail));
      let headers = {
        "Content-Type": "application/json",
      };
      let request = {
        request: {
          FareAlternativeLegKeys: [
            `${FlightDetailParsed[i]["ApiData"]["FlightIds"]}`,
          ],
          Token: {
            TokenCode: `${FlightDetailParsed[i]["ApiData"]["token"]}`,
          },
        },
      };

      let response = await this.httpService
        .post(`${SAFARI_URL}/Air.svc/Rest/Json/GetBrandedFares`, request, {
          headers,
        })
        .toPromise();

      if (this.isLogXml) {
        const fs = require("fs");
        fs.writeFileSync(
          `${logStoragePath}/flights/safari/FareBranded_RQ.json`,
          JSON.stringify(request)
        );
        fs.writeFileSync(
          `${logStoragePath}/flights/safari/FareBranded_RS.json`,
          JSON.stringify(response)
        );
      }

      let results = response["Result"].SearchResults[0]["Results"][0].Fares;

      let fareBranded = [];
      for (let j = 0; j < results.length; j++) {
        let formattedResponse = await this.safariTransformService.fareBranded(
          results[j],
          body,
          FlightDetailParsed[0]["ApiData"]["token"],
          ResultToken
        );
        fareBranded.push(formattedResponse);
      }

      fareGBrand[i] = fareBranded;
    }
    return fareGBrand;
  }

  async fareQuote(body: any): Promise<any> {
    let ResultToken = this.forceObjectToArray(body["ResultToken"]);
    let result: any = [];
    let FlightDetailParsed: any = [];
    body["ResultToken"] = ResultToken;
    for (let i = 0; i < ResultToken.length; i++) {
      let FlightDetail = await this.redisServerService.read_list(
        body["ResultToken"][i]
      );

      FlightDetailParsed.push(JSON.parse(FlightDetail));

      let FDetails = await this.redisServerService.read_list(
        FlightDetailParsed[0]['FlightData']["FlightDataIndex"][i]
      )

      let PriceInfo = FlightDetailParsed[0].FlightData.PriceInfo
      let FlightData = JSON.parse(FDetails);

      let headers = {
        "Content-Type": "application/json",
      };
      let request = {
        request: {
          Air: {
            FareAlternativeLegKeys:[
            `${FlightDetailParsed[i]["ApiData"]["FlightIds"]}`,
          ]},
          Token: {
            TokenCode: `${FlightDetailParsed[i]["ApiData"]["token"]}`,
          },
        },
      };

      let response = await this.httpService
        .post(`${SAFARI_URL}/Air.svc/Rest/Json/Validate`, request, {
          headers,
        })
        .toPromise();

      if (this.isLogXml) {
        const fs = require("fs");
        fs.writeFileSync(
          `${logStoragePath}/flights/safari/FareQuote_RQ.json`,
          JSON.stringify(request)
        );
        fs.writeFileSync(
          `${logStoragePath}/flights/safari/FareQuote_RS.json`,
          JSON.stringify(response)
        );
      }

              let searchData = FlightData.FlightData.SearchData;
              const FlightInfo = {};
             let SelectedCurrencyPriceDetails = {};

              if (searchData["Currency"]) {
                    SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(searchData["Currency"], PriceInfo);
               
                
               }
            let previousData ={}

           

              // previousData["KeyData"] = key_data;
              previousData["JourneyList"] = {};
              previousData["JourneyList"][0] = {};
              previousData["JourneyList"][0][0] = {};
              previousData["JourneyList"][0][0]["FlightDetails"] =FlightData.FlightData.FlightInfo;
              previousData["JourneyList"][0][0]["Price"] = PriceInfo;
              previousData["JourneyList"][0][0]["Exchange_Price"] = SelectedCurrencyPriceDetails;
              previousData['SearchData'] = searchData;
              FlightInfo["FlightDetails"] = FlightData.FlightData.FlightInfo;
              FlightInfo["Price"] = PriceInfo;
              FlightInfo["Exchange_Price"] = SelectedCurrencyPriceDetails;
      
              // const Refundable = air_pricing_info[0]["Refundable"] ? 1 : 0;
              FlightInfo["Attr"] = { IsRefundable: 0, AirlineRemark: "", is_usa: false };
              const CabinClass = getPropValue(searchData["Segments"][0], 'CabinClass') || getPropValue(searchData["Segments"][0], 'CabinClassOnward');
              FlightInfo["JourneyType"] = searchData["JourneyType"];
              FlightInfo["CabinClass"] = CabinClass;
              previousData['api_response']=response['Result'];
              previousData['ApiData']=FlightDetailParsed[0].ApiData;
              const token = this.redisServerService.geneateResultToken(searchData);
              const ResultToken = await this.redisServerService.insert_record(
                  token,
                  JSON.stringify(previousData)
              );
              FlightInfo["ResultToken"] = ResultToken["access_key"];
              FlightInfo["booking_source"] = SAFARI_BOOKING_SOURCE;
      


             return { UpdateFareQuote: { FareQuoteDetails: { JourneyList: FlightInfo, SearchData: searchData } } };
    }
  }
   async commitBooking(body: any): Promise<any> {
  
          const flightBookings = await this.getGraphData(`query{flightBookings(where:{app_reference:{eq:"${body['AppReference']}"}}){app_reference}}`, 'flightBookings');
          if (flightBookings.length) {
              return { result: [], message: 'AppReference already exist!' };
          }
          const fareQuoteData = await this.redisServerService.read_list(body['ResultToken']);
          const LeadPax = body['Passengers'].find((t) => t.IsLeadPax) || {};
          const fareQuoteDataParsed = JSON.parse(fareQuoteData[0]);
         
          body['BookingTravelerRefObj'] = getPropValueOrEmpty(fareQuoteDataParsed, 'BookingTravelerRefObj');
          let Exchange_Price = {};
          if ( ['JourneyList'][0][0]['Exchange_Price']) {
              Exchange_Price = fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price'];
              fareQuoteDataParsed['JourneyList'][0][0]['Price'] = Exchange_Price;
          } else {
              Exchange_Price = fareQuoteDataParsed['JourneyList'][0][0]['Price'];
          }
          
          const Price = fareQuoteDataParsed['JourneyList'][0][0]['Exchange_Price'];
          const JourneyList = fareQuoteDataParsed['JourneyList'];
          const flight_booking_transactions = [];
          const CabinClass = getPropValue(fareQuoteDataParsed['SearchData']['Segments'][0], 'CabinClass') || getPropValue(fareQuoteDataParsed['SearchData']['Segments'][0], 'CabinClassOnward');
          let discountValue=0;
          const bodyPromoCode=body.PromoCode;
  
          const currencyDetails = Price['Currency'] !== "GBP" ? await this.formatPriceDetailToSelectedCurrency(Price['Currency']) : { value: 1, currency: "GBP" };
  
          if(bodyPromoCode != undefined || bodyPromoCode!=''){
              let promoCodeDetails=await this.commonService.getPromoCodeInfo({promocode:bodyPromoCode});
              promoCodeDetails=promoCodeDetails[0];
              if (promoCodeDetails && promoCodeDetails != "") {
                  if (promoCodeDetails.discount_type == "percentage") {
                      let amount: number
                      amount = (promoCodeDetails.discount_value / 100);
                      discountValue = Price.TotalDisplayFare * amount;
                  }
                  if (promoCodeDetails.discount_type == "plus") {
  
                      discountValue = Number((promoCodeDetails.discount_value * currencyDetails.value).toFixed(2));
                  }
              }
              else {
                  discountValue = 0;
              }
          }
  
          const flightDetail = {
              domain_origin: "safari",
              booking_from: body["BookingFrom"],
              app_reference: body['AppReference'],
              booking_source: body['BookingSource'],
              api_code: body['booking_source'],
              subagent_id: body["subagent_id"],
              trip_type: fareQuoteDataParsed['SearchData']['JourneyType'],
              phone_code: LeadPax['PhoneCode'],
              phone: LeadPax['ContactNo'],
              alternate_number: LeadPax['ContactNo'],
              email: LeadPax['Email'] || LeadPax['email'],
              journey_start:
                  fareQuoteDataParsed['SearchData']['Segments'][0]['DepartureDate'],
              journey_end:
                  fareQuoteDataParsed['SearchData']['Segments'][
                  fareQuoteDataParsed['SearchData']['Segments'].length - 1
                  ]['DepartureDate'],
              journey_from: fareQuoteDataParsed['SearchData']['Segments'][0]['Origin'],
              journey_to:
                  fareQuoteDataParsed['SearchData']['Segments'][
                  fareQuoteDataParsed['SearchData']['Segments'].length - 1
                  ]['Destination'],
              from_loc: '',
              to_loc: '',
              cabin_class: CabinClass,
              is_lcc: 0,
              payment_mode: "online",
              convinence_value: 0,
              convinence_value_type: "plus",
              convinence_per_pax: 0,
              convinence_amount: `${Price.ConvinenceFee}`,
              discount: `${discountValue}`,
              promo_code: '',
              currency: Price['Currency'],
              currency_conversion_rate: 1,
              version: 1,
              attributes: body["Remark"] || " ",
              gst_details: '',
              created_by_id: body['UserId'],
              booking_status: "BOOKING_INPROGRESS",
              BookingTravelerRefObj: JSON.stringify(body['BookingTravelerRefObj'])
          };
  
          // for (let i = 0; i < JourneyList.length; i++) {
          // for (let j = 0; j < JourneyListTemp.length; j++) {
          const flight_booking_transaction_data = {
              app_reference: body['AppReference'],
              pnr: '',
              // status: "BOOKING_INPROGRESS",
              status_description: '',
              gds_pnr: '',
              source: '',
              ref_id: '',
              total_fare: Price["TotalDisplayFare"],
              admin_commission: (Price['PriceBreakup']["CommissionDetails"]['AdminCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AdminCommission'] : 0,
              agent_commission: (Price['PriceBreakup']["CommissionDetails"]['AgentCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AgentCommission'] : 0,
              admin_tds: 0,
              agent_tds: 0,
              admin_markup: (Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup'] : 0,
              agent_markup: (Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup'] : 0,
              currency: Price['Currency'],
              getbooking_StatusCode: '',
              getbooking_Description: '',
              getbooking_Category: '',
              attributes: JSON.stringify(Price).replace(/'/g, '"'),
              sequence_number: "0",
              hold_ticket_req_status: "0",
              created_by_id: body['UserId'] ? body['UserId'] : 0,
          };
          const passengersArray = [];
          // const PassengersTemp = body['Passengers'];
          const itineraries = [];
          let PassengerContactDetails = {};
          const PassengersTemp = body['Passengers'].map(p => ({ ...p, PaxTypeSort: p.PaxType == 2 ? 3 : p.PaxType == 3 ? 2 : 1 }));
          const Passengers = PassengersTemp.sort((a, b) => a.PaxTypeSort - b.PaxTypeSort);
          for (let m = 0; m < Passengers.length; m++) {
              if (!moment(Passengers[m]['DateOfBirth']).isValid() || (Passengers[m]['PassportExpiryDate'] != "" && !moment(Passengers[m]['PassportExpiryDate']).isValid())) {
                  throw new BadRequestException('DateOfBirth or PassportExpiryDate is Invalid Date');
              }
              if (Passengers[m]['IsLeadPax'] == 1) {
                  PassengerContactDetails = {
                      Email: Passengers[m]['Email'],
                      Phone: Passengers[m]['ContactNo'],
                      PhoneExtension: LeadPax['PhoneCode']
                  }
              };
              // const PassengeTypeByDOB: any = this.getPassengeTypeByDOB(Passengers[m]['DateOfBirth']);
              // const PassengerType = PassengeTypeByDOB['text'];
              const PassengerType = Passengers[m]['PaxType'] == 1 ? 'Adult' : Passengers[m]['PaxType'] == 2 ? 'Child' : 'Infant';
              const GenderType = ['Mr', 'Mstr'].includes(Passengers[m]['Title']) ? 'Male' : 'Female';
              if (!['Mr', 'Ms', 'Mrs', 'Mstr', 'Miss'].includes(Passengers[m]['Title'])) {
                  throw new BadRequestException('Title is invalid');
              }
              // let Title = 'Mr';
              // if (GenderType == 'Male') {
              //     if (PassengeTypeByDOB.id > 1) {
              //         Title = 'Mstr';
              //     }
              // } else {
              //     if (PassengeTypeByDOB.id > 1) {
              //         Title = 'Miss';
              //     } else {
              //         Title = 'Ms';
              //     }
              // }
              let full_name = '';
              if (Passengers[m]['MiddleName'] != '') {
                  full_name = Passengers[m]['FirstName'] + " " + Passengers[m]['MiddleName'];
              } else {
                  full_name = Passengers[m]['FirstName'];
              }
              const passenger = {
                  app_reference: body['AppReference'],
                  passenger_type: PassengerType,
                  is_lead: Passengers[m]['IsLeadPax'],
                  title: Passengers[m]['Title'],
                  first_name: Passengers[m]['FirstName'],
                  middle_name: Passengers[m]['MiddleName'] || '',
                  last_name: Passengers[m]['LastName'],
                  date_of_birth: Passengers[m]['DateOfBirth'],
                  gender: GenderType,
                  passenger_nationality: Passengers[m]['CountryCode'],
                  passport_number: Passengers[m]['PassportNumber'] || '',
                  passport_issuing_country: Passengers[m]['PassportIssuingCountry'] || '',
                  passport_expiry_date: Passengers[m]['PassportExpiryDate'],
                  full_name,
                  // status: "BOOKING_INPROGRESS",
                  attributes: "[]",
              };
  
              passengersArray.push(passenger);
  
              Passengers[m]['PaxType'] = PassengerType;
              Passengers[m]['Gender'] = GenderType;
              // allPassengers.push(Passengers[m]);
  
          }
          for (let k = 0; k < JourneyList[0][0]['FlightDetails']['Details'].length; k++) {
              const FlightDetails = JourneyList[0][0]['FlightDetails']['Details'][k];
  
              for (let l = 0; l < FlightDetails.length; l++) {
                  let att = {
                      Duration: FlightDetails[l]['Duration']
                  };
                  const itinerary = {
                      app_reference: body['AppReference'],
                      airline_pnr: '',
                      segment_indicator: 0,
                      airline_code: FlightDetails[l]['OperatorCode'],
                      airline_name: FlightDetails[l]['OperatorName'],
                      flight_number: FlightDetails[l]['FlightNumber'],
                      fare_class: Price['PriceBreakup']['RBD'],
                      from_airport_code: FlightDetails[l]['Origin']['AirportCode'],
                      from_airport_name: FlightDetails[l]['Origin']['AirportName'],
                      to_airport_code: FlightDetails[l]['Destination']['AirportCode'],
                      to_airport_name: FlightDetails[l]['Destination']['AirportName'],
                      departure_datetime: FlightDetails[l]['Origin']['DateTime'],
                      arrival_datetime: FlightDetails[l]['Destination']['DateTime'],
                      cabin_baggage: FlightDetails[l]['Attr']['CabinBaggage'],
                      checkin_baggage: FlightDetails[l]['Attr']['Baggage'],
                      is_refundable: '0',
                      equipment: FlightDetails[l]['Equipment'],
                      // status: '',
                      operating_carrier: FlightDetails[l]['OperatorCode'], FareRestriction: 0,
                      FareBasisCode: 0,
                      FareRuleDetail: 0,
                      attributes: JSON.stringify(att),
                      departure_terminal: FlightDetails[l]['Origin']['Terminal'],
                      arrival_terminal: FlightDetails[l]['Destination']['Terminal'],
                  };
                  itineraries.push(itinerary);
              }
          }
          // }
          // }
  
          const booking = {
              ...flightDetail,
              flightBookingTransactions: [
                  {
                      ...flight_booking_transaction_data,
                      flightBookingTransactionItineraries: itineraries,
                      flightBookingTransactionPassengers: passengersArray,
                  },
              ],
          };
  
          const flight_booking_itineraries = await this.setGraphData(
              'FlightBookings',
              booking
          );
          const flightBookingTransactions = await this.getGraphData(`
          query {
              flightBookingTransactions(
                  where: {
                      app_reference: {
                          eq: "${body['AppReference']}"
                      }
                  }
              ) {
                 id,
                 app_reference
                 
              }
          }
      `, 'flightBookingTransactions');
          let totalSeatPrice: any = 0;
          let totalBaggagePrice: any = 0;
          let totalMealPrice: any = 0;
  
          const allPassengers = await this.getGraphData(`
              query {
                  flightBookingTransactionPassengers(
                      where: {
                          app_reference: {
                              eq: "${body['AppReference']}"
                          }
                      }
                  ) {
                      PassengerId: id,
                      PassengerType: passenger_type,
                      Title: title,
                      FirstName: first_name,
                      MiddleName: middle_name,
                      LastName: last_name,
                      DateOfBirth: date_of_birth,
                      Gender: gender,
                      PassportNumber: passport_number,
                      PassportIssuingCountry: passport_issuing_country,
                      PassportExpiryDate: passport_expiry_date,
                      Nationality: passenger_nationality
                  }
              }
          `, 'flightBookingTransactionPassengers');
          // let totalSeatPrice: any = 0;
          let updateTotalPrice = Price.TotalDisplayFare + totalSeatPrice + totalBaggagePrice + totalMealPrice - discountValue;
          let updateAgentTotalPrice = Price.AgentNetFare + totalSeatPrice + totalBaggagePrice + totalMealPrice;
              
              // if (fareQuoteDataParsed.SearchData.UserType === 'B2C') {
              //   updateTotalPrice += Price.ConvinenceFee;
              //   updateAgentTotalPrice += Price.ConvinenceFee;
              // }
              if (body.BookingSource === 'B2C') {
                  updateTotalPrice += Price.ConvinenceFee;
                  updateAgentTotalPrice += Price.ConvinenceFee;
              }
          fareQuoteDataParsed.JourneyList[0][0]['Exchange_Price'].TotalDisplayFare = parseFloat((updateTotalPrice).toFixed(2));
          fareQuoteDataParsed.JourneyList[0][0]['Exchange_Price'].AgentNetFare = parseFloat((updateAgentTotalPrice).toFixed(2));
          Price.TotalDisplayFare = parseFloat((updateTotalPrice).toFixed(2))
          
          console.log(flightBookingTransactions[0])
          await this.getGraphData(
              `mutation {
                  updateFlightBookingTransaction(id:${flightBookingTransactions[0].id},flightBookingTransactionPartial:{
                    total_fare: "${updateTotalPrice}",
                      attributes :"${JSON.stringify(fareQuoteDataParsed.JourneyList[0][0].Exchange_Price).replace(/"/g, "'")}"
                        })
                    }`,
              "updateFlightBookingTransaction"
          );
  
          const flightDetails = [];
          const seatFormatData = [];
          // let totalSeatPrice: any = 0;
          for (const transaction of booking.flightBookingTransactions) {
              for (const itinerary of transaction.flightBookingTransactionItineraries) {
                  const flight = {
                      from_airport_code: itinerary.from_airport_code,
                      to_airport_code: itinerary.to_airport_code,
                      airline_code: itinerary.airline_code,
                      flight_number: itinerary.flight_number,
                  };
                  flightDetails.push(flight);
              }
          }
  
          await Promise.all(Passengers.map(async (passenger: any, ind: any) => {
              const seatResultToken = passenger.SeatId;
              if (seatResultToken.length > 0) {
                  await Promise.all(seatResultToken.map(async (token: any, index: any) => {
                      if (token === null) {
                          // Skip processing if the token is null
                          return;
                      }
                      const FlightSeatData = await this.redisServerService.read_list(token);
                      const FlightSeatDataParsed = JSON.parse(FlightSeatData[0]);
  
                      const passengerId = allPassengers[ind].PassengerId;
  
                      const seatCharge = parseFloat(FlightSeatDataParsed.SeatCharge) || 0;
                      totalSeatPrice += seatCharge;
  
                      const result = {
                          ...flightDetails[index],
                          flight_booking_passenger_id: passengerId,
                          type: FlightSeatDataParsed.Type,
                          code: FlightSeatDataParsed.SeatCode,
                          price: FlightSeatDataParsed.SeatCharge ?? 0,
                          description: fareQuoteDataParsed.KeyData.key.Air_segment_key_list[index],
                          created_by_id: body['UserId'] ? body['UserId'] : 0,
                      };
                      seatFormatData.push(result);
                  }));
              }
          }));
  
          let seatData: any;
          if (seatFormatData.length > 0) {
              seatData = await Promise.all(seatFormatData.map(async (data) => {
                  const mutation = `
                  mutation {
                      createFlightBookingSeat(flightBookingSeat: {
                          flight_booking_passenger_id: "${data.flight_booking_passenger_id}"
                          from_airport_code: "${data.from_airport_code}"
                          to_airport_code: "${data.to_airport_code}"
                          airline_code: "${data.airline_code}"
                          flight_number: "${data.flight_number}"
                          description: "${data.description}",
                          price: "${data.price}"
                          code: "${data.code}"
                          type: "${data.type}"
                          created_by_id: ${data.created_by_id}
                      }) {
                          id
                          status
                          flight_booking_passenger_id
                          from_airport_code
                          to_airport_code
                          airline_code
                          flight_number
                          description
                          price
                          code
                          type
                          created_by_id
                          created_at
                      }
                  }
              `;
                  const result = await this.getGraphData(mutation, 'createFlightBookingSeat');
                  return result;
              }));
          }
  
          const result = {
              CommitBooking: {
                  BookingDetails: {
                      BookingId: '',
                      PNR: '',
                      GDSPNR: '',
                      PassengerContactDetails,
                      PassengerDetails: allPassengers.map((passenger: any) => {
                          const matchingSeats = seatData ? seatData.filter((seat: any) => seat.flight_booking_passenger_id === String(passenger.PassengerId)) : [];
                          const SeatInfo = matchingSeats.map((matchingSeat: any) => ({
                              FromAirportCode: matchingSeat.from_airport_code,
                              ToAirportCode: matchingSeat.to_airport_code,
                              AirlineCode: matchingSeat.airline_code,
                              FlightNumber: matchingSeat.flight_number,
                              Code: matchingSeat.code
                          }));
                          return {
                              ...passenger,
                              SeatInfo
                          };
                      }),
                      JourneyList: {
                          FlightDetails: fareQuoteDataParsed['FlightDetails'],
                      },
                      Price: { ...Price, TotalSeatPrice: parseFloat(totalSeatPrice.toFixed(2)) },
                      PromoCode: bodyPromoCode ?? "",
                      discount: discountValue,
                      Attr: '',
                      ResultToken: body['ResultToken'],
                      AppReference: body['AppReference'],
                      booking_source: SAFARI_BOOKING_SOURCE
                  },
              },
          };
          // console.log("result.CommitBooking.BookingDetails.Price:",result.CommitBooking.BookingDetails.Price)
  
          return { result, message: '' };
      }

      async formatPriceDetailToSelectedCurrency(currency: any) {
        try {
            const currencyDetails = await this.getGraphData(`
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
			`, "cmsCurrencyConversions"
            );
            if (currencyDetails.length < 1) {
                throw new Error("400 No Currency Conversion Found");
            }
            return currencyDetails[0];
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async reservation(body: any): Promise<any> {

      let jsonResponse:any = [];
      const commitBookingData = await this.redisServerService.read_list(body['ResultToken']);
      const commitBookingDataParsed = JSON.parse(commitBookingData[0]);
    
          const flightBookings = await this.getGraphData(
              `query {
                  flightBookings(
                      where: {
                          app_reference: {
                              eq: "${body['AppReference']}"
                          }
                      }
                  ){
                      email
                      phone
                      attributes
                  }
              }
              `, 'flightBookings'
          );

          const flightBookingTransactionPassengers = await this.getGraphData(
              `query {flightBookingTransactionPassengers(where:{
                      app_reference:{eq:"${body['AppReference']}"}
                  }){
                          id
                          app_reference
                          first_name
                          middle_name
                          last_name
                          title
                          gender
                          date_of_birth
                          passenger_type
                          passenger_nationality
                          passport_number
                          passport_issuing_country
                          passport_expiry_date   
                          full_name                         
              }}`,
              'flightBookingTransactionPassengers'
          );
          commitBookingDataParsed['BookingTravelerRefObj'] = getPropValueOrEmpty(commitBookingDataParsed, 'BookingTravelerRefObj');

          let pxDetails = [];


          for(let px=0; px<flightBookingTransactionPassengers.length;px++){

            let paxType = ''
            let paxGender = ''

            if(flightBookingTransactionPassengers[px] == 'Adult'){

              paxType = '0' 
            }else if(flightBookingTransactionPassengers[px] == 'Child'){
              paxType = '1'
            }else{
              paxType = '2'
              }
              if(flightBookingTransactionPassengers[px] == 'Male'){

                paxGender = '0' 
              }else if(flightBookingTransactionPassengers[px] == 'Female'){
                paxGender = '1'
              }

            pxDetails[px] ={
              "FlightPaxType":paxType,
                    "Pax": {
                      "DateOfBirth": this.formatDate(flightBookingTransactionPassengers[px].date_of_birth),
                      "Email": flightBookings[0].email,
                      "FirstName": flightBookingTransactionPassengers[px].first_name,
                      "GenderType": paxGender,
                      "LastName": flightBookingTransactionPassengers[px].last_name,
                      "MobilePhone": "string",
                      "NationalityCode": flightBookingTransactionPassengers[px].passenger_nationality,
                      "IdentityNumber": ""
                    }

            }

          }

          let paxGender=''

          if(flightBookingTransactionPassengers[0] == 'Male'){

            paxGender = '0' 
          }else if(flightBookingTransactionPassengers[0] == 'Female'){
            paxGender = '1'
          }


          let request = {
            "request": {
              "TokenCode": commitBookingDataParsed['ApiData']['token'],
              "ContactInfo": {
                "Email": flightBookings[0].email,
                "FirstName": flightBookingTransactionPassengers[0].first_name,
                "GenderType": paxGender,
                "LastName": flightBookingTransactionPassengers[0].last_name,
                "Phone": flightBookings[0].phone
              },
              "InvoiceInfo": {
                "Address": "",
                "CityCode": "",
                "CityName": "",
                "CompanyName": "",
                "CountryCode": "",
                "FirstName": flightBookingTransactionPassengers[0].first_name,
                "InvoiceInfoTitle": "",
                "InvoiceInfoType": "",
                "LastName":flightBookingTransactionPassengers[0].last_name,
                "PostalCode": "",
                "TaxNumber": "",
                "TaxOffice": ""
              },
              "PaxInfo": {
                "FlightPaxes":pxDetails
              },
              "PaymentInfo": {
                "PaymentType": "6",
                "PaymentItemId": "",
                "CardInfo": {
                  "CardExpMonth": 0,
                  "CardExpYear": 0,
                  "CardHolderName": "",
                  "CardNumber": "",
                  "Cv2": "",
                  "Email": "",
                  "ReturnUrl": "",
                  "IpAdress": ""
                }
              },
              "ResultKeys": [
                commitBookingDataParsed.ApiData.FlightIds
              ]
            }
          }
          let headers = {
            "Content-Type": "application/json",
          };
         
    
          let response = await this.httpService.post(`${SAFARI_URL}/Air.svc/Rest/Json/Book`, request, {
              headers,
            })
            .toPromise();
    
          if (this.isLogXml) {
            const fs = require("fs");
            fs.writeFileSync(
              `${logStoragePath}/flights/safari/Booking_RQ.json`,
              JSON.stringify(request)
            );
            fs.writeFileSync(
              `${logStoragePath}/flights/safari/Booking_RS.json`,
              JSON.stringify(response)
            );
          }

        
          
          // if (PassengerTypeArray["ADT"]) {
          //     AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][0]['PassengerType'] = PassengerTypeArray["ADT"];
          // }
          // if (PassengerTypeArray["CNN"]) {
          //     if (PassengerTypeArray["INF"]) {
          //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][2]['PassengerType'] = PassengerTypeArray["CNN"];
          //     } else {
          //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][1]['PassengerType'] = PassengerTypeArray["CNN"];
          //     }
          // }
          // if (PassengerTypeArray["INF"]) {
          //     if (PassengerTypeArray["CNN"]) {
          //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][1]['PassengerType'] = PassengerTypeArray["INF"];
          //     } else {
          //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][1]['PassengerType'] = PassengerTypeArray["INF"];
          //     }
          // }

                // for (let i = 0; i < AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'].length; i++) {
          //     const passengerTypeCode = AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"]["Code"];
          //     if (passengerTypeCode === "CNN") {
          //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"] = PassengerTypeArray["CNN"][CNNIndex];
          //         CNNIndex++;
          //     } else if (passengerTypeCode === "INF") {
          //         AirPricingSolutionTemp['AirPricingSolution']['AirPricingInfo'][i]["PassengerType"] = PassengerTypeArray["INF"][INFIndex];
          //         INFIndex++;
          //     }
          // }
          
         

      // if (!result) {
      //     message = 'Booking Failed!';
      // } else {

      //     // let param = {};
      //     // param['AppReference'] = body['AppReference'];
      //     // result = await this.pnrRetrieve(param);
      // }
      // return { result, message };
  }

  formatDate(dateStr) {
    // Create a new Date object from the input string (YYYY-MM-DD format)
    const date = new Date(dateStr);
  
    // Extract the day, month, and year from the Date object
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const year = date.getFullYear();
  
    // Return the date in the desired format: DD/MM/YYYY
    return `${day}/${month}/${year}`;
  }

    }

