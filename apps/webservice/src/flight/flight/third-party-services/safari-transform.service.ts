import { Injectable } from "@nestjs/common";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import {  logStoragePath } from "../../../constants";


import {
  getDuration,
  getPropValue,
  nl2br,
  undefinedToUndefined,
  debug,
  formatSearchDate,
  formatVoucherDate,
} from "../../../app.helper";
import { SAFARI_BOOKING_SOURCE } from "apps/webservice/src/constants";

@Injectable()
export class SafariTransformService extends FlightApi {
  constructor(
    private readonly redisServerService: RedisServerService,
    private readonly flightDbService: FlightDbService
  ) {
    super();
  }
  async convertDateToFormat(date: any, format: any) {
    let d = new Date(date);
    let month = d.getMonth() + 1;
    let day = d.getDate();
    let year = d.getFullYear();
    let formattedDate = format;
    formattedDate = formattedDate.replace(
      "dd",
      day.toString().padStart(2, "0")
    );
    formattedDate = formattedDate.replace(
      "MM",
      month.toString().padStart(2, "0")
    );
    formattedDate = formattedDate.replace("yyyy", year.toString());
    return formattedDate;
  }
  async searchRequest(body: any, token: any): Promise<any> {
    let AdultCount = body.AdultCount;
    let ChildCount = body.ChildCount;
    let InfantCount = body.InfantCount;
    let CabinClass = body.CabinClass;
    let JourneType = body.JourneyType;
    let segments = body.Segments;

    let legs = await Promise.all(
      segments.map(async (segment) => {
        let Origin = segment.Origin;
        let Destination = segment.Destination;
        let DepartureDate = segment.DepartureDate;

        // Convert DepartureDate to 25.10.2024
        let DepartureDateConverted = await this.convertDateToFormat(
          DepartureDate,
          "dd.MM.yyyy"
        );

        return {
          ArrivalPoint: {
            Code: Destination,
            HotpointType: "1",
          },
          Date: DepartureDateConverted,
          DeparturePoint: {
            Code: Origin,
            HotpointType: "1",
          },
        };
      })
    );

    let request = {
      request: {
        AdvancedOptions: {
          Air: {
            OnlyBestFares: false,
            OnlyDirectFlights: false,
            OnlyRefundableFlights: false,
            PermittedAirlineCodes: [],
          },
        },
        Legs: legs,
        Passengers: [
          {
            Count: AdultCount,
            PaxType: "0",
          },
          {
            Count: ChildCount,
            PaxType: "1",
          },
          {
            Count: InfantCount,
            PaxType: "2",
          },
        ],
        SearchType: "0",
        Token: {
          TokenCode: token,
        },
      },
    };

    return request;
  }

  formatFlightDetail(
    OriginAirportCode,
    OriginCityName,
    OriginAirportName,
    OriginDateTime,
    OriginTerminal,
    DestinationAirportCode,
    DestinationCityName,
    DestinationAirportName,
    DestinationDateTime,
    DestinationTerminal,
    OperatorCode,
    DisplayOperatorCode,
    OperatorName,
    FlightNumber,
    CabinClass,
    Operatedby,
    Equipment,
    Distance,
    FlightTime,
    AttrBaggage,
    AttrCabinBaggage,
    AttrAvailableSeats,
    WaitingTime
  ) {
    const Duration = this.convertToHoursMins(FlightTime);
    let LayoverTime = "";
    if (WaitingTime > 0) {
      LayoverTime = this.convertToHoursMins(WaitingTime);
    }
    return {
      Origin: {
        AirportCode: OriginAirportCode,
        CityName: OriginCityName,
        AirportName: OriginAirportName,
        DateTime: formatSearchDate(OriginDateTime),
        Terminal: OriginTerminal,
        SupplierDateTime: OriginDateTime,
      },
      Destination: {
        AirportCode: DestinationAirportCode,
        CityName: DestinationCityName,
        AirportName: DestinationAirportName,
        DateTime: formatSearchDate(DestinationDateTime),
        Terminal: DestinationTerminal,
        SupplierDateTime: DestinationDateTime,
      },
      OperatorCode: OperatorCode,
      DisplayOperatorCode: DisplayOperatorCode,
      OperatorName: OperatorName,
      FlightNumber: FlightNumber,
      CabinClass: CabinClass,
      Operatedby: Operatedby,
      Equipment: Equipment,
      Duration: Duration,
      FlightTime: FlightTime,
      LayoverTime: LayoverTime != "" ? LayoverTime : undefined,
      Distance: Distance,
      Attr: {
        Baggage: AttrBaggage,
        CabinBaggage: AttrCabinBaggage,
        AvailableSeats: AttrAvailableSeats,
      },
    };
  }

  // async finalData(response: any, body: any, tokenCode: any): Promise<any> {
  //   const FlightParameters = { FlightList: [] };

  //   const searchData: any = body;
  //   // Markup and Commission Start
  //   // const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(searchData);
  //   //Add Commission Start
  //   let airlineMarkupAndCommission = {};
  //   this.airport_codes = await this.getSearchAirports();
  //   const token = this.redisServerService.geneateResultToken(searchData);

  //   let flight_details = response.Result.SearchResults;
  //   let flight_req = response.Result.SearchRequest;
  //   let FlightInfo = {}

  //   const FlightDataList = { JourneyList: [] };
  //   FlightDataList["JourneyList"][0] = [];

  //   let apiResponse = [];
  //   let details = [];

  //   let key: number = 0;
  //   let FlightJourney = { Details: [] };
  //   for (let f_val of flight_details) {
  //     if (f_val.ResultType === 1) {
  //       let result = f_val.Results;
  //       let cnt = 0;
  //       for (let [key3, res] of result.entries()) {
  //         console.log("resCont", cnt++);
  //         let flightFares = this.forceObjectToArray(res.Fares);
  //         let legs = this.forceObjectToArray(res.Legs);
    
  //         let faresData = flightFares[0];
  //         let legsData = legs[0].AlternativeLegs[0];
  //         let alterNativeRef = legsData.alternativeRef;
  //         let segments = legsData.Segments;
    
  //         let total_duration = 0;
  //         let duration_list = [];
  //         let airportCache = {};
  //         let airlineCache = {};
    
  //         // Initialize `details` as an array
  //         let details = [];
    
  //         for (let seg of segments) {
  //           total_duration += Number(seg.FlightDuration);
    
  //           let { Code: Equipment } = seg.Equipment || {};
  //           let { Code: Origin } = seg.DepartureAirport;
  //           let { Code: Destination } = seg.ArrivalAirport;
  //           let { Code: Carrier } = seg.OperatingAirline;
    
  //           const tempAirportOrigin =
  //             airportCache[Origin] || (airportCache[Origin] = this.airport_codes.find((t) => t.code === Origin) || {});
  //           const OriginCityName = tempAirportOrigin.city || Origin;
  //           const OriginAirportName = tempAirportOrigin.name || Origin;
    
  //           const tempAirportDestination =
  //             airportCache[Destination] ||
  //             (airportCache[Destination] = this.airport_codes.find((t) => t.code === Destination) || {});
  //           const DestinationCityName = tempAirportDestination.city || Destination;
  //           const DestinationAirportName = tempAirportDestination.name || Destination;
    
  //           const tempAirline =
  //             airlineCache[Carrier] || (airlineCache[Carrier] = this.airline_codes.find((t) => t.code == Carrier) || {});
  //           const OperatorName = tempAirline.name || Carrier;
    
  //           const DepartureDate = new Date(seg.Departure);
  //           const ArrivalDate = new Date(seg.ArrivalDate);
    
  //           const DepartureTime = DepartureDate.toTimeString().split(" ")[0];
  //           const ArrivalTime = ArrivalDate.toTimeString().split(" ")[0];
    
  //           // Append the flight detail to the `details` array
  //           details.push(
  //             this.formatFlightDetail(
  //               Origin,
  //               OriginCityName,
  //               OriginAirportName,
  //               DepartureTime,
  //               "",
  //               Destination,
  //               DestinationCityName,
  //               DestinationAirportName,
  //               ArrivalTime,
  //               "",
  //               Carrier,
  //               Carrier,
  //               OperatorName,
  //               seg.FlightNumber,
  //               "",
  //               Carrier,
  //               Equipment,
  //               seg.Distance || "",
  //               seg.FlightDuration,
  //               "",
  //               "",
  //               0,
  //               seg.WaitingDuration
  //             )
  //           );
    
  //           // Add duration to the list
  //           duration_list.push(this.convertToHoursMins(total_duration));
  //         }
    
  //         // Update the FlightJourney details with all the segments
  //         FlightJourney["Details"][0] = details;
    
  //         // Passenger and Price Information
  //         let { BasePrice, TaxAmount: Taxes, TotalAmount: TotalPrice, ServiceFee: Fees } = faresData.TotalPrice;
  //         const PaxCount = faresData.PassengerFares.length;
    
  //         // Tax Calculation Optimization
  //         const TaxBreakupDetails = faresData.TotalPrice.TaxList.reduce((acc, t_info) => {
  //           const taxAmount = this.getPrice(t_info.Amount) * PaxCount;
  //           acc[t_info.TaxCode] = (acc[t_info.TaxCode] || 0) + taxAmount;
  //           return acc;
  //         }, {});
    
  //         // Prepare Passenger Breakup
  //         const PassengerBreakup = {};
  //         for (let passenger of faresData.PassengerFares) {
  //           const passengerType = passenger.PassengerType === 1 ? "CHD" : passenger.PassengerType === 2 ? "INF" : "ADT";
  //           PassengerBreakup[passengerType] = PassengerBreakup[passengerType] || {
  //             BasePrice,
  //             Tax: Taxes + Fees,
  //             TotalPrice: BasePrice + Taxes + Fees,
  //             PassengerCount: 0,
  //           };
  //           PassengerBreakup[passengerType].PassengerCount++;
  //         }
    
  //         // Fetch markup and commission details
  //         let PriceInfo = await this.flightDbService.formatPriceDetail(
  //           body.UserId,
  //           body.UserType,
  //           "INR",
  //           TotalPrice,
  //           BasePrice,
  //           Taxes,
  //           0,
  //           0,
  //           "",
  //           this.tax_breakup(TaxBreakupDetails),
  //           "Regular Fare",
  //           PassengerBreakup,
  //           {},
  //           ""
  //         );
    
  //         let SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(
  //           body.Currency,
  //           PriceInfo
  //         );
    
  //         FlightInfo = {
  //           FlightDetails: FlightJourney,
  //           Price: PriceInfo,
  //           Exchange_Price: SelectedCurrencyPriceDetails,
  //           Attr: {
  //             IsRefundable: flightFares[0]["Refundable"] ? 1 : 0,
  //             AirlineRemark: "",
  //             DurationList: duration_list,
  //           },
  //           ResultToken: await this.redisServerService
  //             .insert_record(token, JSON.stringify({
  //               FlightData: { SearchData: body, FlightInfo, Connection: "" },
  //               ApiData: { token: tokenCode, FlightIds: alterNativeRef }
  //             }))
  //             .then((res) => res.access_key),
  //           booking_source: SAFARI_BOOKING_SOURCE,
  //         };
  //         FlightDataList["JourneyList"][0].push(FlightInfo);

  //       }
  //     }
  //   }
    
    
    
  
  //   let PlusMinus3Calender: any = [];
  //   let finalResponse = [];
  //   let finalCalender: any = [];
  //   let finalFlightList: any = { JourneyList: [] };
  //   finalFlightList["JourneyList"][0] = [];
  //   // if (searchData.PlusMinus3Days) {
  //   //   //Fare calender +-3 days
  //   //   if (searchData.JourneyType == "Return") {
  //   //     FlightDataList["JourneyList"][0].forEach((element, FlightKey) => {
  //   //       let onwardFlight = element.FlightDetails.Details[0][0];
  //   //       let returnFlight = element.FlightDetails.Details[1][0];
  //   //       let flightPrice = element.Price;
  //   //       let departureDatetime = onwardFlight.Origin.DateTime;
  //   //       let returnDatetime = returnFlight.Origin.DateTime;
  //   //       let departureDatetimeArray = departureDatetime.split(" ");
  //   //       let returnDatetimeArray = returnDatetime.split(" ");
  //   //       if (PlusMinus3Calender[departureDatetimeArray[0]] == undefined) {
  //   //         PlusMinus3Calender[departureDatetimeArray[0]] = [];
  //   //       }
  //   //       if (
  //   //         PlusMinus3Calender[departureDatetimeArray[0]][
  //   //           returnDatetimeArray[0]
  //   //         ] == undefined
  //   //       ) {
  //   //         PlusMinus3Calender[departureDatetimeArray[0]][
  //   //           returnDatetimeArray[0]
  //   //         ] = [];
  //   //         PlusMinus3Calender[departureDatetimeArray[0]][
  //   //           returnDatetimeArray[0]
  //   //         ] = {
  //   //           OperatorName: onwardFlight.OperatorName,
  //   //           OperatorCode: onwardFlight.OperatorCode,
  //   //           FlightNumber: onwardFlight.FlightNumber,
  //   //           TotalDisplayFare: Number(flightPrice.TotalDisplayFare),
  //   //           Currency: flightPrice.Currency,
  //   //           OnwardFlightDate: departureDatetimeArray[0],
  //   //           ReturnFlightDate: returnDatetimeArray[0],
  //   //           SearchData: {
  //   //             AdultCount: searchData.AdultCount,
  //   //             ChildCount: searchData.ChildCount,
  //   //             InfantCount: searchData.InfantCount,
  //   //             JourneyType: searchData.JourneyType,
  //   //             PreferredAirlineName: searchData.PreferredAirlineName,
  //   //             PreferredAirlines: searchData.PreferredAirlines,
  //   //             NonStopFlights: searchData.NonStopFlights,
  //   //             PlusMinus3Days: searchData.PlusMinus3Days,
  //   //             Segments: [
  //   //               {
  //   //                 CabinClassOnward: searchData.Segments[0].CabinClassOnward,
  //   //                 CabinClassReturn: searchData.Segments[0].CabinClassReturn,
  //   //                 DepartureDate: departureDatetimeArray[0] + "T00:00:00",
  //   //                 ReturnDate: returnDatetimeArray[0] + "T00:00:00",
  //   //                 Destination: searchData.Segments[0].Destination,
  //   //                 Origin: searchData.Segments[0].Origin,
  //   //               },
  //   //             ],
  //   //             UserType: searchData.UserType,
  //   //             UserId: searchData.UserId,
  //   //             booking_source: SAFARI_BOOKING_SOURCE,
  //   //             Currency: searchData.Currency,
  //   //           },
  //   //         };
  //   //       } else if (
  //   //         PlusMinus3Calender[departureDatetimeArray[0]][
  //   //           returnDatetimeArray[0]
  //   //         ].TotalDisplayFare > Number(flightPrice.TotalDisplayFare)
  //   //       ) {
  //   //         PlusMinus3Calender[departureDatetimeArray[0]][
  //   //           returnDatetimeArray[0]
  //   //         ] = [];
  //   //         PlusMinus3Calender[departureDatetimeArray[0]][
  //   //           returnDatetimeArray[0]
  //   //         ] = {
  //   //           OperatorName: onwardFlight.OperatorName,
  //   //           OperatorCode: onwardFlight.OperatorCode,
  //   //           FlightNumber: onwardFlight.FlightNumber,
  //   //           TotalDisplayFare: Number(flightPrice.TotalDisplayFare),
  //   //           Currency: flightPrice.Currency,
  //   //           OnwardFlightDate: departureDatetimeArray[0],
  //   //           ReturnFlightDate: returnDatetimeArray[0],
  //   //           SearchData: {
  //   //             AdultCount: searchData.AdultCount,
  //   //             ChildCount: searchData.ChildCount,
  //   //             InfantCount: searchData.InfantCount,
  //   //             JourneyType: searchData.JourneyType,
  //   //             PreferredAirlineName: searchData.PreferredAirlineName,
  //   //             PreferredAirlines: searchData.PreferredAirlines,
  //   //             NonStopFlights: searchData.NonStopFlights,
  //   //             PlusMinus3Days: searchData.PlusMinus3Days,
  //   //             Segments: [
  //   //               {
  //   //                 CabinClassOnward: searchData.Segments[0].CabinClassOnward,
  //   //                 CabinClassReturn: searchData.Segments[0].CabinClassReturn,
  //   //                 DepartureDate: departureDatetimeArray[0] + "T00:00:00",
  //   //                 ReturnDate: returnDatetimeArray[0] + "T00:00:00",
  //   //                 Destination: searchData.Segments[0].Destination,
  //   //                 Origin: searchData.Segments[0].Origin,
  //   //               },
  //   //             ],
  //   //             UserType: searchData.UserType,
  //   //             UserId: searchData.UserId,
  //   //             booking_source: SAFARI_BOOKING_SOURCE,
  //   //             Currency: searchData.Currency,
  //   //           },
  //   //         };
  //   //       }

  //   //       let fromDate = departureDatetimeArray[0] + "T00:00:00";
  //   //       let toDate = returnDatetimeArray[0] + "T00:00:00";

  //   //       if (
  //   //         searchData.Segments[0].DepartureDate == fromDate &&
  //   //         searchData.Segments[0].ReturnDate == toDate
  //   //       ) {
  //   //         finalFlightList["JourneyList"][0].push(element);
  //   //       }
  //   //     });
  //   //     PlusMinus3Calender = Object.values(PlusMinus3Calender);
  //   //     PlusMinus3Calender.forEach(
  //   //       (particularDayFlight, particularDayFlightKey) => {
  //   //         finalCalender[particularDayFlightKey] = Object.values(
  //   //           particularDayFlight
  //   //         );
  //   //       }
  //   //     );
  //   //   } else {
  //   //     FlightDataList["JourneyList"][0].forEach((element) => {
  //   //       let onwardFlight = element.FlightDetails.Details[0][0];

  //   //       let flightPrice = element.Price;
  //   //       let departureDatetime = onwardFlight.Origin.DateTime;

  //   //       let departureDatetimeArray = departureDatetime.split(" ");

  //   //       if (PlusMinus3Calender[departureDatetimeArray[0]] == undefined) {
  //   //         PlusMinus3Calender[departureDatetimeArray[0]] = [];
  //   //         PlusMinus3Calender[departureDatetimeArray[0]] = {
  //   //           OperatorName: onwardFlight.OperatorName,
  //   //           OperatorCode: onwardFlight.OperatorCode,
  //   //           FlightNumber: onwardFlight.FlightNumber,
  //   //           TotalDisplayFare: Number(flightPrice.TotalDisplayFare),
  //   //           Currency: flightPrice.Currency,
  //   //           FlightDate: departureDatetimeArray[0],
  //   //           SearchData: {
  //   //             AdultCount: searchData.AdultCount,
  //   //             ChildCount: searchData.ChildCount,
  //   //             InfantCount: searchData.InfantCount,
  //   //             JourneyType: searchData.JourneyType,
  //   //             PreferredAirlineName: searchData.PreferredAirlineName,
  //   //             PreferredAirlines: searchData.PreferredAirlines,
  //   //             NonStopFlights: searchData.NonStopFlights,
  //   //             PlusMinus3Days: searchData.PlusMinus3Days,
  //   //             Segments: [
  //   //               {
  //   //                 CabinClass: searchData.Segments[0].CabinClass,
  //   //                 DepartureDate: departureDatetimeArray[0] + "T00:00:00",
  //   //                 Destination: searchData.Segments[0].Destination,
  //   //                 Origin: searchData.Segments[0].Origin,
  //   //               },
  //   //             ],
  //   //             UserType: searchData.UserType,
  //   //             UserId: searchData.UserId,
  //   //             booking_source: SAFARI_BOOKING_SOURCE,
  //   //             Currency: searchData.Currency,
  //   //           },
  //   //         };
  //   //       } else if (
  //   //         PlusMinus3Calender[departureDatetimeArray[0]].TotalDisplayFare >
  //   //         Number(flightPrice.TotalDisplayFare)
  //   //       ) {
  //   //         PlusMinus3Calender[departureDatetimeArray[0]] = [];
  //   //         PlusMinus3Calender[departureDatetimeArray[0]] = {
  //   //           OperatorName: onwardFlight.OperatorName,
  //   //           OperatorCode: onwardFlight.OperatorCode,
  //   //           FlightNumber: onwardFlight.FlightNumber,
  //   //           TotalDisplayFare: Number(flightPrice.TotalDisplayFare),
  //   //           Currency: flightPrice.Currency,
  //   //           FlightDate: departureDatetimeArray[0],
  //   //           SearchData: {
  //   //             AdultCount: searchData.AdultCount,
  //   //             ChildCount: searchData.ChildCount,
  //   //             InfantCount: searchData.InfantCount,
  //   //             JourneyType: searchData.JourneyType,
  //   //             PreferredAirlineName: searchData.PreferredAirlineName,
  //   //             PreferredAirlines: searchData.PreferredAirlines,
  //   //             NonStopFlights: searchData.NonStopFlights,
  //   //             PlusMinus3Days: searchData.PlusMinus3Days,
  //   //             Segments: [
  //   //               {
  //   //                 CabinClass: searchData.Segments[0].CabinClass,
  //   //                 DepartureDate: departureDatetimeArray[0] + "T00:00:00",
  //   //                 Destination: searchData.Segments[0].Destination,
  //   //                 Origin: searchData.Segments[0].Origin,
  //   //               },
  //   //             ],
  //   //             UserType: searchData.UserType,
  //   //             UserId: searchData.UserId,
  //   //             booking_source: SAFARI_BOOKING_SOURCE,
  //   //             Currency: searchData.Currency,
  //   //           },
  //   //         };
  //   //       }
  //   //       let fromDate = departureDatetimeArray[0] + "T00:00:00";

  //   //       if (searchData.Segments[0].DepartureDate == fromDate) {
  //   //         finalFlightList["JourneyList"][0].push(element);
  //   //       }
  //   //     });
  //   //     finalCalender = Object.values(PlusMinus3Calender);
  //   //   }
  //   //   finalResponse[0] = finalFlightList["JourneyList"][0];

  //   //   finalResponse["CalenderList"] = finalCalender;
  //   // } else {
      
  //   // }
  //   finalResponse[0] = FlightDataList["JourneyList"][0];
  //   finalResponse["CalenderList"] = [];
  //   if (this.isLogXml) {
  //         const fs = require("fs");
         
  //         fs.writeFileSync(
  //           `${logStoragePath}/flights/safari/SearchForm_RS.json`,
  //           JSON.stringify(finalResponse)
  //         );
  //       }

  //   return finalResponse;
  // }
  async finalData(response: any, body: any, tokenCode: any): Promise<any> {
    const FlightDataList = { JourneyList: [[]] }; // Initialize JourneyList[0] as an empty array
    const searchData: any = body;
  
    this.airport_codes = await this.getSearchAirports();
    const token = this.redisServerService.geneateResultToken(searchData);
  
    const flight_details = response.Result.SearchResults.filter((f_val) => f_val.ResultType === 1);
  
    // Cache for airports and airlines to avoid redundant lookups
    const airportCache = {};
    const airlineCache = {};
  
    // Process flight details sequentially using async/await
    for (const f_val of flight_details) {
      const results = Object.values(f_val.Results);
      let AlterNaId ='';
      const FlightInfo = await Promise.all(
        results.map(async (flight) => {
          // Extract fares and legs
          const fares = this.forceObjectToArray(flight['Fares']);
          const legs = this.forceObjectToArray(flight['Legs'])[0].AlternativeLegs[0];
          AlterNaId = fares[0].FareAlternativeLegs[0].Key
          const segments = legs.Segments;
  
          // Calculate total duration and segment details
          let total_duration = 0;
          const duration_list = [];
          const segmentDetails = segments.map((seg) => {
            total_duration += Number(seg.FlightDuration);
            duration_list.push(this.convertToHoursMins(total_duration));
  
            // Destructure the required fields from the segment
            const { Code: Equipment } = seg.Equipment || {};
            const { Code: Origin } = seg.DepartureAirport;
            const { Code: Destination } = seg.ArrivalAirport;
            const { Code: Carrier } = seg.OperatingAirline;
  
            // Cache and retrieve airport and airline details
            const tempAirportOrigin = airportCache[Origin] || (airportCache[Origin] = this.airport_codes.find((t) => t.code === Origin) || {});
            const tempAirportDestination = airportCache[Destination] || (airportCache[Destination] = this.airport_codes.find((t) => t.code === Destination) || {});
            const tempAirline = airlineCache[Carrier] || (airlineCache[Carrier] = this.airline_codes.find((t) => t.code === Carrier) || {});
  
            // Retrieve additional flight details
            const OriginCityName = tempAirportOrigin.city || Origin;
            const OriginAirportName = tempAirportOrigin.name || Origin;
            const DestinationCityName = tempAirportDestination.city || Destination;
            const DestinationAirportName = tempAirportDestination.name || Destination;
            const OperatorName = tempAirline.name || Carrier;
  
            // Format the dates and times
            const DepartureDate = new Date(seg.DepartureDate);
            const ArrivalDate = new Date(seg.ArrivalDate);
            const DepartureTime = DepartureDate.toTimeString().split(" ")[0];
            const ArrivalTime = ArrivalDate.toTimeString().split(" ")[0];
  
            // Return the formatted flight detail for this segment
            return this.formatFlightDetail(
              Origin,
              OriginCityName,
              OriginAirportName,
              DepartureTime,
              "",
              Destination,
              DestinationCityName,
              DestinationAirportName,
              ArrivalTime,
              "",
              Carrier,
              Carrier,
              OperatorName,
              seg.FlightNumber,
              "",
              Carrier,
              Equipment,
              seg.Distance || "",
              seg.FlightDuration,
              "",
              "",
              0,
              seg.WaitingDuration
            );
          });
  
          // Journey structure with details
          const FlightJourney = { Details: [segmentDetails] };
  
          // Fare and tax calculations
          const { BasePrice, TaxAmount: Taxes, TotalAmount: TotalPrice, ServiceFee: Fees } = fares[0].TotalPrice;
          const PaxCount = fares[0].PassengerFares.length;
  
          // Calculate tax breakdown
          const TaxBreakupDetails = fares[0].TotalPrice.TaxList.reduce((acc, t_info) => {
            const taxAmount = this.getPrice(t_info.Amount) * PaxCount;
            acc[t_info.TaxCode] = (acc[t_info.TaxCode] || 0) + taxAmount;
            return acc;
          }, {});
  
          // Passenger fare breakup
          const PassengerBreakup = {};
          fares[0].PassengerFares.forEach((passenger) => {
            const passengerType = passenger.PassengerType === 1 ? "CHD" : passenger.PassengerType === 2 ? "INF" : "ADT";
            PassengerBreakup[passengerType] = PassengerBreakup[passengerType] || {
              BasePrice,
              Tax: Taxes + Fees,
              TotalPrice: BasePrice + Taxes + Fees,
              PassengerCount: 0,
            };
            PassengerBreakup[passengerType].PassengerCount++;
          });
  
          // Format price details
          const PriceInfo = await this.flightDbService.formatPriceDetail(
            body.UserId,
            body.UserType,
            "USD",
            TotalPrice,
            BasePrice,
            Taxes,
            0,
            0,
            "",
            this.tax_breakup(TaxBreakupDetails),
            "Regular Fare",
            PassengerBreakup,
            {},
            ""
          );
  
          // Convert price details to selected currency
          const SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(body.Currency, PriceInfo);
  
          // Return the formatted flight information
          return {
            FlightDetails: FlightJourney,
            Price: PriceInfo,
            Exchange_Price: SelectedCurrencyPriceDetails,
            Attr: {
              IsRefundable: fares[0].Refundable ? 1 : 0,
              AirlineRemark: "",
              DurationList: duration_list,
            },
            ResultToken: await this.redisServerService.insert_record(
              token,
              JSON.stringify({
                FlightData: { SearchData: body, FlightInfo: FlightJourney, Connection: "" },
                ApiData: { token: tokenCode, FlightIds: AlterNaId },
              })
            ).then((res) => res.access_key),
            booking_source: SAFARI_BOOKING_SOURCE,
          };
        })
      );
  
      // Ensure FlightDataList["JourneyList"][0] is an array before pushing
      if (!FlightDataList["JourneyList"][0]) {
        FlightDataList["JourneyList"][0] = [];
      }
      FlightDataList["JourneyList"][0].push(...FlightInfo); // Push flight info into the first element of JourneyList
    }
  
    // Final response structure
    const finalResponse = [];
    finalResponse[0] = FlightDataList["JourneyList"][0];
    finalResponse["CalenderList"] = [];
  
  
  
    return finalResponse;
  }
  
  async format_air_pricing_solution(
    air_fare_info,
    pricing_array,
    air_segment_list,
    search_data,
    seg_flight_details,
    CurrencyType,
    token,
    markupAndCommission
  ) {}
  tax_breakup(tax_details) {
    const display_tax_list = ["M6", "TR", "ZR", "YQF", "YRI", "TotalTax"];
    const return_tax_list = {};
    return_tax_list["Other_Tax"] = 0;
    for (const [key, value] of Object.entries(tax_details)) {
      if (display_tax_list.includes(key)) {
        return_tax_list[key] = value;
      } else {
        return_tax_list["Other_Tax"] += value;
      }
    }
    return return_tax_list;
  }
}
