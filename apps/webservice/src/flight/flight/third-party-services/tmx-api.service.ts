import { BadRequestException, Body, Injectable, HttpService, HttpException, } from "@nestjs/common";
import { logStoragePath, ADVANCE_TAX_PERCENT, TMX_USER_NAME, TMX_PASSWORD, TMX_URL, TMX_SYSTEM, TMX_DOMAINKEY, TMX_FLIGHT_BOOKING_SOURCE } from "apps/webservice/src/constants";
import * as moment from "moment";
import { getPropValue, debug } from "../../../app.helper";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { TmxTransformService } from "../third-party-services/tmx-transform.service";
import { FlightDbService } from "../flight-db.service";
import { existsTypeAnnotation } from "@babel/types";
const fs = require('fs');

@Injectable()
export class TmxApiService extends FlightApi {

  constructor(
    private httpService: HttpService,
    private tmxTransformService: TmxTransformService,
    private readonly flightDbService: FlightDbService,
    private readonly redisServerService: RedisServerService) {
    super();
  }
  private async runCurl(requestURL: string, apiRequestBody: any, requestName: any, appReference): Promise<any> {

    const https = require('https');

    const options = {
      headers: {
        "Content-Type": "application/json",
        "x-Username": TMX_USER_NAME,
        "x-Password": TMX_PASSWORD,
        "x-System": TMX_SYSTEM,
        "x-DomainKey": TMX_DOMAINKEY
      }
    };

    //const xmlResponse = await this.httpService.post(`${TMX_URL}`, apiRequestBody, options).toPromise();
    let result: any;
    if (1) {
      // console.log(TMX_URL + '/webservices/flight/service/' + requestName);
      // console.log(apiRequestBody);
      // console.log(options);

      result = await this.httpService.post(TMX_URL + '/webservices/flight/service/' + requestName, apiRequestBody, options).toPromise();

      // console.log(result);
      // return false;
      if (this.isLogXml) {
        fs.writeFileSync(`${logStoragePath}/flights/tmx/${appReference}-${requestURL}_RQ.json`, JSON.stringify(apiRequestBody));
        fs.writeFileSync(`${logStoragePath}/flights/tmx/${appReference}-${requestURL}_RS.json`, JSON.stringify(result));
      }

      // result =await this.xmlToJson(result);
      //fs.writeFileSync(`${logStoragePath}/flights/novo/${requestURL}_RS.json`, JSON.stringify(result));

    } else {
      result = JSON.parse(fs.readFileSync(`${logStoragePath}/flights/tmx/${appReference}-CreateBooking_RS.xml`, 'utf-8'))
    }

    return result;
  }
  async searchRequest(body: any) {
    // console.log(body);
    // return false;
    if (body['JourneyType'] === 'Oneway') {
      body['JourneyType'] = 'OneWay';
    }
    body["CabinClass"] = body["Segments"][0]["CabinClassOnward"];

    if (body['JourneyType'] === 'multicity') {
      body['JourneyType'] = 'Multicity';
      body["CabinClass"] = body["Segments"][0]["CabinClass"];
    }

    const searchRequest = body;
    return searchRequest;
  }
  async search(@Body() body) {

    const searchRequest: any = await this.searchRequest(body);

    const result = await this.runCurl("SearchFlights", searchRequest, 'Search', '');
    
    try {
      if (result['Status'] == 1 && result['Search'] != undefined) {

        return await this.tmxTransformService.finalData(result, body);
      } else {
        return { result: {}, message: "No flights found." };
      }
    } catch (error) {
      console.log(error);
    }


  }

  public async fareQuote(body: any): Promise<any> {
    let ResultToken = this.forceObjectToArray(body['ResultToken']);
    let result: any = [];
    let FlightDetailParsed: any = [];
    body['ResultToken'] = ResultToken;

    for (let i = 0; i < ResultToken.length; i++) {
      let FlightDetail = await this.redisServerService.read_list(body["ResultToken"][i]);

      FlightDetailParsed.push(JSON.parse(FlightDetail));
      let SearchData = FlightDetailParsed[0]['SearchData'];

      let FareQuoteRequest = { ResultToken: FlightDetailParsed[i]['FlightList'][0]['ResultToken'] };
      let apiResponse = await this.runCurl("FareQuote", FareQuoteRequest, 'UpdateFareQuote', '');
      // let apiResponse = `{"Status":1,"Message":"","UpdateFareQuote":{"FareQuoteDetails":{"JourneyList":{"FlightDetails":{"Details":[[{"Origin":{"AirportCode":"BLR","CityName":"Bangalore","AirportName":"Bangalore","DateTime":"2022-12-29 00:40:00"},"Destination":{"AirportCode":"DEL","CityName":"Delhi","AirportName":"Delhi","DateTime":"2022-12-29 03:30:00"},"OperatorCode":"I5","DisplayOperatorCode":"","ValidatingAirline":"I5","OperatorName":"Air Asia","FlightNumber":"722","CabinClass":"XC","Operatedby":"","equipment":"","Duration":170,"Attr":{"Baggage":"15 Kg","CabinBaggage":"7 Kg"}}]]},"Price":{"Currency":"INR","TotalDisplayFare":1420,"PriceBreakup":{"BasicFare":50,"Tax":1370,"AgentCommission":0,"AgentTdsOnCommision":0},"PassengerBreakup":{"ADT":{"BasePrice":50,"Tax":1370,"TotalPrice":1420,"PassengerCount":1}}},"ResultToken":"de39270f1a8d80ae0abad17fb68a4bd4*_*363*_*ZPinkYhyq31wj7NP","Attr":{"IsRefundable":true,"AirlineRemark":"I5 TEST.","IsLCC":true},"HoldTicket":false}}}}`;
      // result.push(JSON.parse(apiResponse));
      result.push(apiResponse);

    }

    let markup, specific_markup, commission: any;
    if (result[0]['Status'] == 1) {
      return await this.tmxTransformService.formatFareQuote(result, body, FlightDetailParsed, markup, specific_markup, commission);
    } else {
      return [];
    }
  }

  public async fareRule(body: any): Promise<any> {
    let FlightDetail = await this.redisServerService.read_list(body["ResultToken"]);
    FlightDetail = JSON.parse(FlightDetail[0]);

    let FareRuleRequest = { ResultToken: FlightDetail['FlightList'][0]['ResultToken'] };
    let apiResponse = await this.runCurl("FareRule", FareRuleRequest, 'FareRule', '');

    // console.log(JSON.stringify(apiResponse));

    return await this.tmxTransformService.formatFareRule(apiResponse['FareRule']['FareRuleDetail'][0]['FareRules']);
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
    let HoldTicket = 0;
    if (JourneyList['HoldTicket'] == false) {
      HoldTicket = 1;
    }
    const flight_booking_transactions = [];
    const CabinClass = getPropValue(fareQuoteDataParsed["SearchData"]["Segments"][0], 'CabinClass') || getPropValue(fareQuoteDataParsed["SearchData"]["Segments"][0], 'CabinClassOnward');
    const flightDetail = {
      domain_origin: "Travelomatix",
      app_reference: body["AppReference"],
      booking_source: body["BookingSource"],
      api_code: body['booking_source'],
      subagent_id:body["subagent_id"],
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
      is_lcc: HoldTicket,
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
      BookingTravelerRefObj: JSON.stringify(fareQuoteDataParsed)
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
      admin_commission: 0,
      agent_commission: Price["PriceBreakup"]["AgentCommission"],
      admin_tds: 0,
      agent_tds: Price["PriceBreakup"]["AgentTdsOnCommision"],
      admin_markup: 0,
      agent_markup: 0,
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
      if (!moment(Passengers[m]['DateOfBirth']).isValid() || (Passengers[m]['PassportExpiryDate'] != "" && !moment(Passengers[m]['PassportExpiryDate']).isValid())) {
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
          segment_indicator: k,
          airline_code: FlightDetails[l]["OperatorCode"],
          airline_name: FlightDetails[l]["OperatorName"],
          flight_number: FlightDetails[l]["FlightNumber"],
          fare_class: "",
          from_airport_code: FlightDetails[l]["Origin"]["AirportCode"],
          from_airport_name: FlightDetails[l]["Origin"]["AirportName"],
          to_airport_code: FlightDetails[l]["Destination"]["AirportCode"],
          to_airport_name: FlightDetails[l]["Destination"]["AirportName"],
          departure_datetime: FlightDetails[l]["Origin"]["DateTime"],
          arrival_datetime: FlightDetails[l]["Destination"]["DateTime"],
          cabin_baggage: FlightDetails[l]["Attr"]["CabinBaggage"] ? FlightDetails[l]["Attr"]["CabinBaggage"] : '7 KG',
          checkin_baggage: FlightDetails[l]["Attr"]["Baggage"],
          is_refundable: "0",
          // status: "",
          equipment: FlightDetails[l]['Equipment'],
          operating_carrier: FlightDetails[l]["OperatorCode"],
          FareRestriction: 0,
          FareBasisCode: 0,
          FareRuleDetail: 0,
          created_by_id: body['UserId'] ? body['UserId'] : 0,
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
          HoldTicket: fareQuoteDataParsed["FlightInfo"]["HoldTicket"],
          ResultToken: body['ResultToken'],
          AppReference: body['AppReference'],
          booking_source: TMX_FLIGHT_BOOKING_SOURCE
        },
      },
    };
    return { result, message: "" };
  }


  public async reservation(body: any): Promise<any> {

    const commitBookingData = await this.redisServerService.read_list(body["ResultToken"]);

    const commitBookingDataParsed = JSON.parse(commitBookingData[0]);
    let Tmx_ResultToken: any = [];
    let result: any = [];
    Tmx_ResultToken = this.forceObjectToArray(commitBookingDataParsed['Tmx_ResultToken']);
    for (let r = 0; r < Tmx_ResultToken.length; r++) {
      commitBookingDataParsed['Tmx_ResultToken'] = Tmx_ResultToken[r];

      let reservationRequest: any = await this.tmxTransformService.reservationRequest(commitBookingDataParsed, body, r);
      // let reservationResponse = JSON.parse(fs.readFileSync(`${logStoragePath}/flights/tmx/${body["AppReference"] + "_" + r}-CommitBooking_RS.json`, 'utf-8'))

      let reservationResponse = await this.runCurl("HoldTicket", reservationRequest, 'HoldTicket', body["AppReference"] + "_" + r)
      result.push(reservationResponse);
    }
    const commitBookingResponse = await this.tmxTransformService.formatReservation(result, body, commitBookingDataParsed);
    return commitBookingResponse;
  }

  async pnrRetrieve(body: any): Promise<any> {

    let jsonResponse:any = [];
    let result = '';
    let finalresult = '';
    if (this.isDevelopment) {
      //if (this.isDevelopment) {
      const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/tmx/${body['AppReference']}-TicketingFlights_RS.xml`, 'utf-8');
      jsonResponse =await this.xmlToJson(xmlResponse);
    } else {
      const flightBookings = await this.getGraphData(`query {
            flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
              BookingTravelerRefObj
              UniversalRecordLocatorCode
              AirReservationLocatorCode
              is_lcc
            }
          }`, 'flightBookings');


      if (flightBookings[0]['is_lcc'] != 1) {
        if (!flightBookings[0]['AirReservationLocatorCode']) {
          console.log('need to throw error');
        }
      }


      if (flightBookings[0]['is_lcc'] == 1) {
        let commitBookingDataParsed = JSON.parse(flightBookings[0]['BookingTravelerRefObj']);
        let Tmx_ResultToken: any = [];
        let result: any = [];
        Tmx_ResultToken = this.forceObjectToArray(commitBookingDataParsed['Tmx_ResultToken']);
        for (let r = 0; r < Tmx_ResultToken.length; r++) {
          flightBookings['Tmx_ResultToken'] = Tmx_ResultToken[r];

          let reservationRequest: any = await this.tmxTransformService.reservationRequest(flightBookings, body, r);
          // let reservationResponse = JSON.parse(fs.readFileSync(`${logStoragePath}/flights/tmx/${body["AppReference"] + "_" + r}-CommitBooking_RS.json`, 'utf-8'))

          // let reservationResponse = `{"Status":"1","Message":"","CommitBooking":{"BookingDetails":{"BookingId":"","PNR":"XNBKMH","GDSPNR":null,"PassengerDetails":[{"PassengerId":"22862","TicketId":"22862","PassengerType":"ADT","Title":"Mr","FirstName":"MD NAHID","LastName":"ISLAM","TicketNumber":"XNBKMH"},{"PassengerId":"22863","TicketId":"22863","PassengerType":"CHD","Title":"","FirstName":"MD NAKI","LastName":"ISLAM","TicketNumber":"XNBKMH"},{"PassengerId":"22864","TicketId":"22864","PassengerType":"INF","Title":"","FirstName":"MD JANI","LastName":"ISLAM","TicketNumber":"XNBKMH"}],"JourneyList":{"FlightDetails":{"Details":[[{"Origin":{"AirportCode":"BLR","CityName":"Bangalore","AirportName":"Bangalore","DateTime":"2022-11-30 00:46:00","FDTV":1669749360,"Terminal":null},"Destination":{"AirportCode":"DEL","CityName":"Delhi","AirportName":"Delhi","DateTime":"2022-11-30 03:41:00","FATV":1669759860,"Terminal":null},"AirlinePNR":"XNBKMH","OperatorCode":"6E","DisplayOperatorCode":"6E","OperatorName":"Indigo","FlightNumber":"6991","CabinClass":"Econo","Attr":""}]]}},"Price":{"Currency":"INR","TotalDisplayFare":5358,"PriceBreakup":{"Tax":3358,"BasicFare":2000,"CommissionEarned":0,"PLBEarned":120,"TdsOnCommission":0,"TdsOnPLB":6,"AgentCommission":120,"AgentTdsOnCommision":6},"PassengerBreakup":{"ADT":{"PassengerCount":1,"BasePrice":1000,"Tax":804,"TotalPrice":1804},"CHD":{"PassengerCount":1,"BasePrice":1000,"Tax":804,"TotalPrice":1804},"INF":{"PassengerCount":1,"BasePrice":0,"Tax":1750,"TotalPrice":1750}}},"Attr":""}}}`;
          let reservationResponse = await this.runCurl("CommitBooking", reservationRequest, 'CommitBooking', body["AppReference"] + "_" + r)
          result.push(reservationResponse);
        }
        finalresult = await this.tmxTransformService.formatCommitBooking(result, body, flightBookings);

      } else {

        const issueHoldTicketRequest = await this.issueHoldTicketRequest(flightBookings, body);
        result = await this.runCurl("IssueHoldTicket", issueHoldTicketRequest, 'IssueHoldTicket', body['AppReference']);
        finalresult = await this.tmxTransformService.pnrRetrieveResponse(result, body, flightBookings);
      }
    }
    return { FinalBooking: finalresult['FinalBooking'], message: '' };
  }

  async issueHoldTicketRequest(flightBookings: any, body: any): Promise<any> {

    const issueHoldTicketRequest = {
      AppReference: body['AppReference'],
      SequenceNumber: "0",
      Pnr: flightBookings[0]['AirReservationLocatorCode'],
      BookingId: flightBookings[0]['UniversalRecordLocatorCode']
    };

    return issueHoldTicketRequest;
  }

  async cancellation(body: any): Promise<any> {
    const app_reference = body.AppReference;
    const query = `UPDATE flight_bookings SET 
    booking_status = "BOOKING_CANCELLED" 
    WHERE app_reference = "${app_reference}"`;
    await this.manager.query(query);
    const query2 = `UPDATE flight_booking_transactions SET 
    booking_status = "BOOKING_CANCELLED" 
    WHERE app_reference = "${app_reference}"`;
    await this.manager.query(query2);
    const query3 = `UPDATE flight_booking_transaction_itineraries SET 
    booking_status = "BOOKING_CANCELLED" 
    WHERE app_reference = "${app_reference}"`;
    await this.manager.query(query3);
    const flightBookings = await this.getGraphData(`query {
        flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
          booking_status
        }
      }`, 'flightBookings');

    const result = {
      BookingStatus: flightBookings[0].booking_status
    }
    return result;
  }

  async importPNR(body: any): Promise<any> {

    let jsonResponse:any = [];
    if (this.isDevelopment) {
      const xmlResponse = fs.readFileSync(`${logStoragePath}/flights/tmx/${body['AppReference']}:UniversalRecordRetrieveRes.xml`, 'utf-8');
    } else {
      const flightBookings = await this.getGraphData(`query {
            flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
              BookingTravelerRefObj
              UniversalRecordLocatorCode
              AirReservationLocatorCode
            }
          }`, 'flightBookings');
      if (!flightBookings[0]) {
        console.log('need to throw error');
      }

      const getBookingreq = {
        AppReference: body['AppReference']
      };

      const result = await this.runCurl("BookingDetails", getBookingreq, 'BookingDetails', body['AppReference']);

      const finalresult = await this.tmxTransformService.formatGetBookingDetails(result, body, flightBookings);

      return result;
    }
  }

}
