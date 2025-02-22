import { BadRequestException, Body, Injectable, HttpService, HttpException, } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { omitDeep } from "apps/webservice/src/apollo-connection";
import { logStoragePath, FARE_API_URL, FARE_PATNERID, FARE_SIGN, FARE_PHP_URL, FARE_FLIGHT_BOOKING_SOURCE } from "apps/webservice/src/constants";
import { response } from "express";
import * as moment from "moment";
import { getPropValue, debug, formatStringtDate, formatStringtDateNoSpace } from "../../../app.helper";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { FareTransformService } from "../third-party-services/fare-transform.service";
import { stringify } from "querystring";
//const fetch = require("node-fetch");
const fs = require('fs');

@Injectable()
export class FareApiService extends FlightApi {
  constructor(
    private httpService: HttpService,
    private fareTransformService: FareTransformService,
    private readonly redisServerService: RedisServerService) {
    super();
  }
  async searchRequest(body: any) {
    const segment_details: any = body.Segments;
    const searchAirLegs = [];
    for (let i: number = 0; i < segment_details.length; i++) {
      let seg: any = {};
      // let dep = moment.utc(segment_details[i].DepartureDate).format("YYYY-MM-DD HH:mm:ss")
      seg = {
        cabinClass: segment_details[i].CabinClassOnward,
        departureDate: moment.utc(segment_details[i].DepartureDate).format("YYYY-MM-DD"),
        destination: segment_details[i].Destination,
        origin: segment_details[i].Origin
      }
      searchAirLegs.push(seg);
    }
    if (body.JourneyType == "Return") {
      let seg: any = {};
      seg = {
        cabinClass: segment_details[0].CabinClassReturn,
        departureDate: moment.utc(segment_details[0].ReturnDate).format("YYYY-MM-DD"),
        destination: segment_details[0].Origin,
        origin: segment_details[0].Destination
      }
      searchAirLegs.push(seg);
    }

    // const CabinClass = getPropValue(body.Segments[0], 'CabinClass') || getPropValue(body.Segments[0], 'CabinClassOnward');

    let p_airline: any = '';
    if (body.PreferredAirlines != undefined) {
      if (body.PreferredAirlines.length >= 1) {
        p_airline = body.PreferredAirlines[0];
      }
    }

    let searchRequest: any = {
      search: {
        adults: Number(body.AdultCount),
        children: Number(body.ChildCount),
        infants: Number(body.InfantCount),
        nonstop: Number(body.NonStopFlights),
        airline: p_airline,
        searchAirLegs: searchAirLegs,
        solutions: 200
      }, authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    };
    return searchRequest;
  }
  async search(@Body() body) {

    let url: string = FARE_API_URL + "shoppingV2";
    const searchRequest: any = await this.searchRequest(body);
// console.log(url);
// return false;
    let php_data = {
      request: searchRequest,
      url: url
    }
    let result: any = {};
    //if (this.isNotHitApi) 
    if (0) {
      const fs = require('fs');
      result = JSON.parse(fs.readFileSync('./test-data/flights/fare/shoppingV2RS.json', 'utf-8'))
    } else {

      result = await this.httpService.post(FARE_PHP_URL, (php_data), {
        headers: {
          "Content-Type": "application/json"
        }
      }).toPromise();
      if (this.isLogXml) {
        fs.writeFileSync(`${logStoragePath}/flights/fare/shoppingV2RQ.json`, JSON.stringify(searchRequest));
        fs.writeFileSync(`${logStoragePath}/flights/fare/shoppingV2RS.json`, JSON.stringify(result));
      }
    }
    try {
      if (result['errorCode'] == 0 && result['data'] != null) {
        const FlightDataList = await this.fareTransformService.finalData(result, body);
        return FlightDataList;
      } else {
        return { result: {}, message: "No flights found." };
      }

    } catch (error) {
      console.log(error);
    }


  }

  async fareQuoteRequest(body: any) {
    const flightDetails = body;
    const segment_details: any = flightDetails['FlightInfo']['FlightDetails']['Details'];
    const searchData: any = flightDetails['SearchData'];
    const journeys: any = {};
    for (let s: number = 0; s < segment_details.length; s++) {
      const Flight: any = [];
      for (let i = 0; i < segment_details[s].length; i++) {
        let single_seg: any = segment_details[s][i];
        let o_dates = single_seg['Origin']['DateTime'].split(' ');
        let d_dates = single_seg['Destination']['DateTime'].split(' ');
        let flight_details: any = {
          airline: single_seg['DisplayOperatorCode'],
          bookingCode: single_seg['CabinClass'],
          flightNum: single_seg['FlightNumber'],
          departure: single_seg['Origin']['AirportCode'],
          departureDate: o_dates[0],
          departureTime: o_dates[1],
          arrival: single_seg['Destination']['AirportCode'],
          arrivalDate: d_dates[0],
          arrivalTime: d_dates[1]
        };
        Flight.push(flight_details);

      }
      journeys['journey_' + s] = Flight;
    }

    const fareQuoteRequest: any = {
      pricing: {
        adults: Number(searchData.AdultCount),
        children: Number(searchData.ChildCount),
        infants: Number(searchData.InfantCount),
        solutionKey: flightDetails['SolutionKey'],
        journeys: journeys
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    };
    return fareQuoteRequest;
  }



  async fareQuote(body: any): Promise<any> {

    const FlightDetail = await this.redisServerService.read_list(body["ResultToken"]);

    const FlightDetailParsed = JSON.parse(FlightDetail);

    const SearchData = FlightDetailParsed['SearchData'];

    let url: string = FARE_API_URL + "precisePricing_V2";
    const fareQuoteRequest: any = await this.fareQuoteRequest(FlightDetailParsed);

    let php_data = {
      request: fareQuoteRequest,
      url: url
    }



    let result: any = {};
    //if (this.isNotHitApi) 
    if (0) {
      const fs = require('fs');
      result = JSON.parse(fs.readFileSync('./test-data/flights/fare/precisePricing_V2RS.json', 'utf-8'))
    } else {
      result = await this.httpService.post(FARE_PHP_URL, (php_data), {
        headers: {
          "Content-Type": "application/json"
        }
      }).toPromise();
      if (this.isLogXml) {
        fs.writeFileSync(`${logStoragePath}/flights/fare/precisePricing_V2RQ.json`, JSON.stringify(fareQuoteRequest));
        fs.writeFileSync(`${logStoragePath}/flights/fare/precisePricing_V2RS.json`, JSON.stringify(result));
      }
    }
    try {
      if (result['errorCode'] == 0 && result['data'] != null) {
        const fareQuoteDetail = await this.fareTransformService.fareQuoteDataFormat(result, SearchData, FlightDetailParsed);
        return { result: { UpdateFareQuote: { FareQuoteDetails: { JourneyList: fareQuoteDetail[0] } } }, message: "" };
      } else {
        return { result: {}, message: "No price available." };
      }

    } catch (error) {
      console.log(error);
    }

  }
  async commitBooking(body: any): Promise<any> {

    const flightBookings = await this.getGraphData(`query{flightBookings(where:{app_reference:{eq:"${body['AppReference']}"}}){app_reference}}`, 'flightBookings');
    if (flightBookings.length) {
      return { result: [], message: 'AppReference already exist!' };
    }
    const fareQuoteData = await this.redisServerService.read_list(body["ResultToken"]);

    const LeadPax = body["Passengers"].find((t) => t.IsLeadPax) || {};
    const fareQuoteDataParsed = JSON.parse(fareQuoteData[0]);

    const Price = fareQuoteDataParsed['FlightInfo']['Price'];

    const JourneyList = fareQuoteDataParsed["FlightInfo"];

    const flight_booking_transactions = [];
    const CabinClass = getPropValue(fareQuoteDataParsed["SearchData"]["Segments"][0], 'CabinClass') || getPropValue(fareQuoteDataParsed["SearchData"]["Segments"][0], 'CabinClassOnward');
    const flightDetail = {
      domain_origin: "Fare",
      app_reference: body["AppReference"],
      booking_source: body["BookingSource"],
      api_code: body['booking_source'],
      subagent_id: body["subagent_id"],
      trip_type: fareQuoteDataParsed["SearchData"]["JourneyType"],
      phone_code: LeadPax["PhoneCode"],
      phone: LeadPax["ContactNo"],
      alternate_number: LeadPax["ContactNo"],
      email: LeadPax["Email"] || LeadPax["email"],
      journey_start:
        fareQuoteDataParsed["SearchData"]["Segments"][0]["DepartureDate"],
      journey_end:
        fareQuoteDataParsed["SearchData"]["Segments"][
        fareQuoteDataParsed["SearchData"]["Segments"].length - 1
        ]["DepartureDate"],
      journey_from: fareQuoteDataParsed["SearchData"]["Segments"][0]["Origin"],
      journey_to:
        fareQuoteDataParsed["SearchData"]["Segments"][
        fareQuoteDataParsed["SearchData"]["Segments"].length - 1
        ]["Destination"],
      from_loc: "",
      to_loc: "",
      cabin_class: CabinClass,
      is_lcc: 0,
      payment_mode: "online",
      convinence_value: 0,
      convinence_value_type: "plus",
      convinence_per_pax: 0,
      convinence_amount: 0,
      discount: 0,
      promo_code: "",
      currency: Price["Currency"],
      currency_conversion_rate: 1,
      version: 1,
      attributes: "",
      gst_details: "",
      created_by_id: body['UserId'] ? body['UserId'] : 0,
      booking_status: "BOOKING_INPROGRESS",
    };
    // for (let i = 0; i < JourneyList.length; i++) {
    // for (let j = 0; j < JourneyListTemp.length; j++) {
    const flight_booking_transaction_data = {
      app_reference: body["AppReference"],
      pnr: "",
      // status: "BOOKING_INPROGRESS",
      status_description: "",
      gds_pnr: "",
      source: "",
      ref_id: "",
      total_fare: Price["TotalDisplayFare"],
      admin_commission: (Price['PriceBreakup']["CommissionDetails"]['AdminCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AdminCommission'] : 0,
      agent_commission: (Price['PriceBreakup']["CommissionDetails"]['AgentCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AgentCommission'] : 0,
      admin_tds: 0,
      agent_tds: 0,
      admin_markup: (Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup'] : 0,
      agent_markup: (Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup'] : 0,
      currency: Price["Currency"],
      getbooking_StatusCode: "",
      getbooking_Description: "",
      getbooking_Category: "",
      attributes: JSON.stringify(Price).replace(/'/g, '"'),
      sequence_number: "0",
      hold_ticket_req_status: "0",
      created_by_id: body['UserId'] ? body['UserId'] : 0,
    };
    const passengersArray = [];
    const Passengers = body["Passengers"];
    const itineraries = [];
    let PassengerContactDetails = {};
    for (let m = 0; m < Passengers.length; m++) {
      if (!moment(Passengers[m]["DateOfBirth"]).isValid() || !moment(Passengers[m]["PassportExpiryDate"]).isValid()) {
        throw new BadRequestException('DateOfBirth or PassportExpiryDate is Invalid Date');
      }
      if (Passengers[m]["IsLeadPax"] == 1) {
        PassengerContactDetails = {
          Email: Passengers[m]["Email"],
          Phone: Passengers[m]["ContactNo"],
          PhoneExtension: Passengers[m]["PhoneCode"]
        }
      };
      const PassengerType =
        Passengers[m]["PaxType"] == 1
          ? "Adult"
          : Passengers[m]["PaxType"] == 2
            ? "Child"
            : "Infant";
      const GenderType = ["Mr", "Mstr"].includes(Passengers[m]["Title"])
        ? "Male"
        : "Female";


      let full_name = '';
      full_name = (Passengers[m]['FirstName'].toUpperCase()).replace(' ', '');

      const passenger = {
        app_reference: body["AppReference"],
        passenger_type: PassengerType,
        is_lead: Passengers[m]["IsLeadPax"],
        title: Passengers[m]["Title"],
        first_name: Passengers[m]["FirstName"],
        middle_name: Passengers[m]["MiddleName"] || "",
        last_name: Passengers[m]["LastName"],
        date_of_birth: Passengers[m]["DateOfBirth"],
        gender: GenderType,
        passenger_nationality: Passengers[m]["CountryCode"],
        passport_number: Passengers[m]["PassportNumber"] || "",
        passport_issuing_country: Passengers[m]["PassportIssuingCountry"] || "",
        passport_expiry_date: Passengers[m]["PassportExpiryDate"] || "",
        // status: "BOOKING_INPROGRESS",
        created_by_id: body['UserId'] ? body['UserId'] : 0,
        full_name,
        attributes: "[]",
      };
      passengersArray.push(passenger);

      Passengers[m]["PaxType"] = PassengerType;
      Passengers[m]["Gender"] = GenderType;
      // allPassengers.push(Passengers[m]);
    }
    for (
      let k = 0;
      k < JourneyList["FlightDetails"]["Details"].length;
      k++
    ) {
      const FlightDetails = JourneyList["FlightDetails"]["Details"][k];

      for (let l = 0; l < FlightDetails.length; l++) {
        let att = {
          Duration: FlightDetails[l]['Duration']
        };
        const itinerary = {
          app_reference: body["AppReference"],
          airline_pnr: "",
          segment_indicator: 0,
          airline_code: FlightDetails[l]["OperatorCode"],
          airline_name: FlightDetails[l]["OperatorName"],
          flight_number: FlightDetails[l]["FlightNumber"],
          fare_class: Price["PriceBreakup"]["RBD"],
          from_airport_code: FlightDetails[l]["Origin"]["AirportCode"],
          from_airport_name: FlightDetails[l]["Origin"]["AirportName"],
          to_airport_code: FlightDetails[l]["Destination"]["AirportCode"],
          to_airport_name: FlightDetails[l]["Destination"]["AirportName"],
          departure_datetime: FlightDetails[l]["Origin"]["DateTime"],
          arrival_datetime: FlightDetails[l]["Destination"]["DateTime"],
          cabin_baggage: FlightDetails[l]["Attr"]["CabinBaggage"],
          checkin_baggage: FlightDetails[l]["Attr"]["Baggage"],
          is_refundable: "0",
          // status: "",
          operating_carrier: FlightDetails[l]["OperatorCode"],
          FareRestriction: 0,
          FareBasisCode: 0,
          FareRuleDetail: 0,
          created_by_id: body['UserId'] ? body['UserId'] : 0,
          attributes: JSON.stringify(att),
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
      "FlightBookings",
      booking
    );


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
                PassportExpiryDate: passport_expiry_date
            }
        }
    `, 'flightBookingTransactionPassengers');
    const result = {
      CommitBooking: {
        BookingDetails: {
          BookingId: "",
          PNR: "",
          GDSPNR: "",
          PassengerContactDetails,
          PassengerDetails: allPassengers,
          JourneyList: {
            FlightDetails: fareQuoteDataParsed["FlightInfo"]["FlightDetails"],
          },
          Price: Price,
          Attr: "",
          ResultToken: body['ResultToken'],
          AppReference: body['AppReference'],
          booking_source: FARE_FLIGHT_BOOKING_SOURCE
        },
      },
    };
    return { result, message: "" };
  }

  async reservationRequest(flightData: any, body: any) {


    const flightBookings = await this.getGraphData(
      `query {
          flightBookings(
              where: {
                  app_reference: {
                      eq: "${body["AppReference"]}"
                  }
              }
          ){
              email
              phone
          }
      }
      `, "flightBookings"
    );

    const flightBookingTransactionPassengers = await this.getGraphData(
      `query {flightBookingTransactionPassengers(where:{
              app_reference:{eq:"${body["AppReference"]}"}
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
                  passport_number
                  passport_expiry_date
                  passport_issuing_country
                  passenger_nationality
                  
      }}`,
      "flightBookingTransactionPassengers"
    );

    let PersonName: any = [];
    for (let p = 0; p < flightBookingTransactionPassengers.length; p++) {

      let pax_type: any;
      if (flightBookingTransactionPassengers[p]['passenger_type'] == "Adult") {
        pax_type = "ADT";
      } else if (flightBookingTransactionPassengers[p]['passenger_type'] == "Child") {
        pax_type = "CHD";
      } else {
        pax_type = "INF";
      }
      let PersonDetails = {
        firstName: flightBookingTransactionPassengers[p]['first_name'].toUpperCase(),
        lastName: flightBookingTransactionPassengers[p]['last_name'].toUpperCase(),
        birthday: flightBookingTransactionPassengers[p]['date_of_birth'],
        cardExpiredDate: flightBookingTransactionPassengers[p]['passport_expiry_date'],
        cardNum: flightBookingTransactionPassengers[p]['passport_number'],
        cardType: 'P',
        nationality: flightBookingTransactionPassengers[p]['passenger_nationality'],
        psgType: pax_type,
        sex: flightBookingTransactionPassengers[p]['gender'][0]
      };
      PersonName.push(PersonDetails);
    }

    const SearchData = flightData['SearchData'];
    const segment_details = flightData['FlightInfo']['FlightDetails']['Details'];

    const journeys: any = {};
    for (let s: number = 0; s < segment_details.length; s++) {
      const Flight: any = [];
      for (let i = 0; i < segment_details[s].length; i++) {
        let single_seg: any = segment_details[s][i];
        let o_dates = single_seg['Origin']['DateTime'].split(' ');
        let d_dates = single_seg['Destination']['DateTime'].split(' ');
        let flight_details: any = {
          airline: single_seg['DisplayOperatorCode'],
          bookingCode: single_seg['CabinClass'],
          flightNum: single_seg['FlightNumber'],
          departure: single_seg['Origin']['AirportCode'],
          departureDate: o_dates[0],
          departureTime: o_dates[1],
          arrival: single_seg['Destination']['AirportCode'],
          arrivalDate: d_dates[0],
          arrivalTime: d_dates[1]
        };
        Flight.push(flight_details);

      }
      journeys['journey_' + s] = Flight;
    }

    let adtFare: any = 0.0;
    let adtTax: any = 0.0;
    let chdFare: any = 0.0;
    let chdTax: any = 0.0;
    if (flightData['FlightInfo']['Price']['PassengerBreakup']['ADT'] != undefined) {
      adtFare = flightData['FlightInfo']['Price']['PassengerBreakup']['ADT']['BasePrice'];
      adtTax = flightData['FlightInfo']['Price']['PassengerBreakup']['ADT']['Tax'];
    }

    if (flightData['FlightInfo']['Price']['PassengerBreakup']['CHD'] != undefined) {
      chdFare = flightData['FlightInfo']['Price']['PassengerBreakup']['CHD']['BasePrice'];
      chdTax = flightData['FlightInfo']['Price']['PassengerBreakup']['CHD']['Tax'];
    }

    const reservationRequest: any = {
      booking: {
        passengers: PersonName,
        ancillary: [],
        solution: {
          adtFare,
          adtTax,
          chdFare,
          chdTax,
          journeys: journeys
        }
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    };
    return reservationRequest;
  }


  async reservation(body: any): Promise<any> {
    const commitBookingData = await this.redisServerService.read_list(body["ResultToken"]);
    const commitBookingDataParsed = JSON.parse(commitBookingData[0]);

    let url: string = FARE_API_URL + "preciseBooking_V2";
    const reservationRequest: any = await this.reservationRequest(commitBookingDataParsed, body);

    let php_data = {
      request: reservationRequest,
      url: url
    }

    let result: any = {};
    //if (this.isNotHitApi) 
    if (0) {
      const fs = require('fs');
      result = JSON.parse(fs.readFileSync('./test-data/flights/fare/preciseBooking_V2RS.json', 'utf-8'))
    } else {
      result = await this.httpService.post(FARE_PHP_URL, (php_data), {
        headers: {
          "Content-Type": "application/json"
        }
      }).toPromise();
      if (this.isLogXml) {
        fs.writeFileSync(`${logStoragePath}/flights/fare/${body['AppReference']}preciseBooking_V2RQ.json`, JSON.stringify(reservationRequest));
        fs.writeFileSync(`${logStoragePath}/flights/fare/${body['AppReference']}preciseBooking_V2RS.json`, JSON.stringify(result));
      }
    }


    result = this.fareTransformService.reservationResponseFormat(result, body, commitBookingDataParsed)
    return result;
  }

  async orderRequestFormat(app_reference) {

    const flightBookings = await this.getGraphData(`query {
      flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
        BookingTravelerRefObj
        UniversalRecordLocatorCode
        AirReservationLocatorCode
      }
    }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }

    const requestFormat = {
      orderPricing: {
        orderNum: flightBookings[0]['AirReservationLocatorCode']
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    }
    return requestFormat
  }

  async orderDetailsRequestFormat(app_reference) {

    const flightBookings = await this.getGraphData(`query {
      flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
        BookingTravelerRefObj
        UniversalRecordLocatorCode
        AirReservationLocatorCode
      }
    }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }

    const requestFormat = {
      data: {
        orderNum: flightBookings[0]['AirReservationLocatorCode'],
        includeFields: "passengers,journeys,solutions,ancillary"
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    }
    return requestFormat
  }
  async ticketRequestFormat(app_reference) {

    const flightBookings = await this.getGraphData(`query {
      flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
        BookingTravelerRefObj
        UniversalRecordLocatorCode
        AirReservationLocatorCode
        email
        phone
      }
    }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }
    const flightBookingTransactionPassengers = await this.getGraphData(
      `query {flightBookingTransactionPassengers(where:{
            app_reference:{eq:"${app_reference}"}
          }){
                id
                app_reference
                first_name
                last_name
                title
                gender
                date_of_birth
                passenger_type
                passport_expiry_date
                passport_issuing_country
                passenger_nationality
                

    }}`,
      "flightBookingTransactionPassengers"
    );
    let name = flightBookingTransactionPassengers[0]['last_name'] + "/" + flightBookingTransactionPassengers[0]['first_name'];
    const requestFormat = {
      ticketing: {
        orderNum: flightBookings[0]['AirReservationLocatorCode'],
        email: flightBookings[0]['email'],
        name: name,
        telNum: flightBookings[0]['phone'],
        PNR: flightBookings[0]['UniversalRecordLocatorCode'],
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    }
    return requestFormat
  }

  async pnrRetrieve(body: any) {
    let jsonResponse = '';
    if (this.isDevelopment) {
      const response = fs.readFileSync(`${logStoragePath}/flights/fare/${body.AppReference}:orderPricingV2.json`, 'utf-8');
    } else {
      // const reservation = await this.redisServerService.read_list(body["ResultToken"]);


      let order_url: string = FARE_API_URL + "orderPricingV2";
      const orderRequest: any = await this.orderRequestFormat(body.AppReference);
      let order_data = {
        request: orderRequest,
        url: order_url
      }

      let orderResult: any = {};
      orderResult = await this.httpService.post(FARE_PHP_URL, (order_data), {
        headers: {
          "Content-Type": "application/json"
        }
      }).toPromise();
      if (this.isLogXml) {
        fs.writeFileSync(`${logStoragePath}/flights/fare/${body['AppReference']}orderPricingV2RQ.json`, JSON.stringify(orderRequest));
        fs.writeFileSync(`${logStoragePath}/flights/fare/${body['AppReference']}orderPricingV2RS.json`, JSON.stringify(orderResult));
      }

      //========================================================

      if (orderResult['errorCode'] == 0) {
        let url: string = FARE_API_URL + "ticketing";
        const ticketingRequest: any = await this.ticketRequestFormat(body.AppReference);
        let php_data = {
          request: ticketingRequest,
          url: url
        }

        let result: any = {};
        result = await this.httpService.post(FARE_PHP_URL, (php_data), {
          headers: {
            "Content-Type": "application/json"
          }
        }).toPromise();
        if (this.isLogXml) {
          fs.writeFileSync(`${logStoragePath}/flights/fare/${body['AppReference']}ticketingRQ.json`, JSON.stringify(ticketingRequest));
          fs.writeFileSync(`${logStoragePath}/flights/fare/${body['AppReference']}ticketingRS.json`, JSON.stringify(result));
        }
        result = this.fareTransformService.ticketingResponseFormat(result, body, 'ticketing')
        return result;

      } else {
        orderResult = this.fareTransformService.ticketingResponseFormat(orderResult, body, 'order')
        return orderResult;
      }

    }

  }

  async cancellation(body: any): Promise<any> {
    let jsonResponse: any = '';

    const flightBookings = await this.getGraphData(`query {
            flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
              BookingTravelerRefObj
              UniversalRecordLocatorCode
              AirReservationLocatorCode
            }
          }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }

    let url: string = FARE_API_URL + "cancel";

    const cancellationRequest = {
      cancel: {
        orderNum: flightBookings[0]['AirReservationLocatorCode'],
        virtualPnr: flightBookings[0]['UniversalRecordLocatorCode']
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    }
    let php_data = {
      request: cancellationRequest,
      url: url
    }

    let result: any = {};
    jsonResponse = await this.httpService.post(FARE_PHP_URL, (php_data), {
      headers: {
        "Content-Type": "application/json"
      }
    }).toPromise();
    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/fare/cancelRQ.json`, JSON.stringify(cancellationRequest));
      fs.writeFileSync(`${logStoragePath}/flights/fare/cancelRS.json`, JSON.stringify(jsonResponse));
    }

    console.log(jsonResponse);
    return false;
    if (jsonResponse.errors) {
      const errorClass: any = getExceptionClassByCode(JSON.stringify("500 " + jsonResponse.errors));
      throw new errorClass(jsonResponse.errors);
    }
    if (jsonResponse.booking.travelers.length) {
      return this.fareTransformService.updateReservationCancellation(body['AppReference'], jsonResponse)
    }
  }
  async void(body: any): Promise<any> {
    let jsonResponse: any = '';
    let result: any = {}
    let tickets: any = []

    let url: string = FARE_API_URL + "voiding/v2";
    const flightBookings = await this.getGraphData(`query {
          flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
            BookingTravelerRefObj
            UniversalRecordLocatorCode
            AirReservationLocatorCode
          }
        }`, 'flightBookings');
    if (!flightBookings[0]['AirReservationLocatorCode']) {
      console.log('need to throw error');
    }
    const flightPassengersDetails = await this.getGraphData(`query {
        flightBookingTransactionPassengers(where:{app_reference:{eq:"${body['AppReference']}"}}){
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
          PassportExpiryDate: passport_expiry_date
      }
    }`, 'flightBookingTransactionPassengers')
    flightPassengersDetails.forEach(element => {
      tickets.push(element.ticket_no)
    });

    let passengers = [];
    for (let i = 0; i < flightPassengersDetails.length; i++) {
      let gender: any;
      if (flightPassengersDetails[i]['Gender'] == "Male") {
        gender = "M";
      }
      let pax = {
        lastName: flightPassengersDetails[i]['LastName'],
        firstName: flightPassengersDetails[i]['FirstName'],
        birthday: flightPassengersDetails[i]['DateOfBirth'],
        sex: gender
      };
      passengers.push(pax);
    }

    const voidRequest = {
      cancel: {
        passengers,
        orderNum: flightBookings[0]['AirReservationLocatorCode']
      },
      authentication: {
        partnerId: FARE_PATNERID,
        sign: FARE_SIGN
      }
    };

    let php_data = {
      request: voidRequest,
      url: url
    }

    jsonResponse = await this.httpService.post(FARE_PHP_URL, (php_data), {
      headers: {
        "Content-Type": "application/json"
      }
    }).toPromise();
    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/fare/voidlRQ.json`, JSON.stringify(voidRequest));
      fs.writeFileSync(`${logStoragePath}/flights/fare/voidRS.json`, JSON.stringify(jsonResponse));
    }

    console.log(voidRequest);
    return false;



  }



  async importPNR(body: any): Promise<any> {

    let jsonResponse: any = '';
    let result: any = {}
    let tickets: any = []
    const flightBookings = await this.getGraphData(`query {
      flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
        BookingTravelerRefObj
        UniversalRecordLocatorCode
        AirReservationLocatorCode
        LastDateToTicket
      }
    }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }

    let url: string = FARE_API_URL + "orderDetail/v3";
    const orderDetailsRequest: any = await this.orderDetailsRequestFormat(body.AppReference);
    let php_data = {
      request: orderDetailsRequest,
      url: url
    }

    result = await this.httpService.post(FARE_PHP_URL, (php_data), {
      headers: {
        "Content-Type": "application/json"
      }
    }).toPromise();

    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/fare/orderDetailRQ.json`, JSON.stringify(orderDetailsRequest));
      fs.writeFileSync(`${logStoragePath}/flights/fare/orderDetailRS.json`, JSON.stringify(result));
    }

    if (result['errorCode'] == 0) {
      const ticker_res = this.forceObjectToArray(result['data']['passengers']);
      let flag = 0;

      for (let i = 0; i < ticker_res.length; i++) {
        let f_name = ticker_res[i]['firstName'];
        if (ticker_res[i]['ticketNum'] != '') {
          let query1 = `UPDATE flight_booking_transaction_passengers SET 
          booking_status = "BOOKING_CONFIRMED" ,
          ticket_no = "${ticker_res[i]['ticketNum']}" 
          WHERE full_name="${f_name.trim()}" 
          and last_name="${ticker_res[i]['lastName']}" 
          and app_reference = "${body['AppReference']}"`;

          await this.manager.query(query1);
          flag = 1;
        }

      }
      if (flag == 1) {
        const query1 = `UPDATE flight_bookings SET 
        booking_status = "BOOKING_CONFIRMED" 
        WHERE app_reference = "${body["AppReference"]}"`;
        await this.manager.query(query1);
        const query2 = `UPDATE flight_booking_transactions SET 
        booking_status = "BOOKING_CONFIRMED" 
        WHERE app_reference = "${body["AppReference"]}"`;
        await this.manager.query(query2);
        const query3 = `UPDATE flight_booking_transaction_itineraries SET 
        booking_status = "BOOKING_CONFIRMED" 
        WHERE app_reference = "${body["AppReference"]}"`;
        await this.manager.query(query3);
      }
    }
    return result;
  }
}
