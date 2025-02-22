import { Injectable } from "@nestjs/common";
import { addDayInDate, formatSearchDate, getPropValue, getDuration } from "../../../app.helper";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { SABRE_FLIGHT_BOOKING_SOURCE, TRAVELPORT_FLIGHT_BOOKING_SOURCE, FARE_FLIGHT_BOOKING_SOURCE } from "apps/webservice/src/constants";
import moment from "moment";

@Injectable()
export class FareTransformService extends FlightApi {
    constructor(private readonly redisServerService: RedisServerService,
        private readonly flightDbService: FlightDbService
    ) {
        super();
    }

    async finalData(result: any, body: any): Promise<any> {

        this.airport_codes = await this.getSearchAirports();
        this.airline_codes = await this.getSearchAirlines();
        // this.airport_timezone = await this.getAirportTimezone();
        const FlightDataList = { JourneyList: [] };
        // FlightDataList["JourneyList"][0] = [];
        const searchData: any = body;
        // Markup and Commission Start
        const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(searchData);

        if (result['data']['solutions'] != undefined && result['data']['solutions'].length > 0) {
            const solutions = this.forceObjectToArray(result['data']['solutions']);
            const flights = this.forceObjectToArray(result['data']['flights']);
            const segments = this.forceObjectToArray(result['data']['segments']);
            for (let p_key = 0; p_key < solutions.length; p_key++) { // price start
                let pricingInformation: any = this.forceObjectToArray(solutions[p_key]);
                let total_price_information: any = pricingInformation[0];
                //========================= segment
                let journeys = total_price_information['journeys'];
                let total_duration = 0;
                const details = [];
                const journey_list = [];
                const FlightInfo = {};
                const FlightJourney = { Details: [] };
                let FlightParameters = {};

                if (journeys['journey_0'] != undefined) {
                    journey_list.push(journeys['journey_0'][0]);
                }

                if (journeys['journey_1'] != undefined) {
                    journey_list.push(journeys['journey_1'][0]);
                }

                if (journey_list.length > 0) {
                    for (let j_key = 0; j_key < journey_list.length; j_key++) { // journey start
                        let journeys_details = flights.find((t) => t.flightId === journey_list[j_key]) || {};
                        details[j_key] = [];

                        let segment_list = this.forceObjectToArray(journeys_details['segmengtIds']);
                        for (let s_key = 0; s_key < segment_list.length; s_key++) { // segment start

                            let segment_data = segments.find((t) => t.segmentId === segment_list[s_key]) || {};

                            let departure_date = segment_data['strDepartureDate'];
                            let arrival_date = segment_data['strArrivalDate'];

                            let OriginAirportCode = segment_data['departure'];
                            let DestinationAirportCode = segment_data['arrival'];
                            let arrival_time = segment_data['strArrivalTime'];
                            let departure_time = segment_data['strDepartureTime'];
                            let DestinationDateTime = arrival_date + " " + arrival_time;
                            let OriginDateTime = departure_date + " " + departure_time;

                            let OriginTerminal: any;
                            let DestinationTerminal: any;
                            if (segment_data['departureTerminal'] != undefined) {
                                OriginTerminal = segment_data['departureTerminal'];
                            }

                            if (segment_data['arrivalTerminal'] != undefined) {
                                DestinationTerminal = segment_data['arrivalTerminal'];
                            }

                            let Operatedby = segment_data['airline'];
                            let OperatorCode = segment_data['airline'];
                            let DisplayOperatorCode = segment_data['airline'];
                            const tempAirline = this.airline_codes.find((t: { code: any; }) => t.code == DisplayOperatorCode) || {};
                            const OperatorName = tempAirline['name'] || DisplayOperatorCode;

                            const tempAirportDestination = this.airport_codes.find((t: { code: any; }) => t.code === DestinationAirportCode) || {};
                            const DestinationCityName = tempAirportDestination['city'] || DestinationAirportCode;
                            const DestinationAirportName = tempAirportDestination['name'] || DestinationAirportCode;

                            const tempAirportOrigin = this.airport_codes.find((t: { code: any; }) => t.code === OriginAirportCode) || {};
                            const OriginCityName = tempAirportOrigin['city'] || OriginAirportCode;
                            const OriginAirportName = tempAirportOrigin['name'] || OriginAirportCode;

                            let Equipment = segment_data['equipment'] || "";
                            if (Equipment != "") {
                                let first_c = Equipment.substr(0, 1);
                                if (first_c == "7") {
                                    Equipment = "BOEING - " + Equipment;
                                } else if (first_c == "3") {
                                    Equipment = "AIRBUS - " + Equipment;
                                }
                            }
                            let AllowanceBaggage = '';
                            if (total_price_information['baggageMap']) {
                                let baggageMap = this.forceObjectToArray(total_price_information['baggageMap']['ADT']);
                                if (baggageMap[0]) {
                                    if (baggageMap[0]['baggageAmount'] != null) {
                                        AllowanceBaggage = baggageMap[0]['baggageAmount'];
                                    } else if (baggageMap[0]['baggageWeight'] != null) {
                                        AllowanceBaggage = baggageMap[0]['baggageWeight'];
                                    }
                                }
                            }

                            let FlightNumber = segment_data['flightNum'];
                            let no_of_stops = 0;
                            let CabinClass = '';

                            let duration = segment_data['flightTime'];
                            let attr = [];
                            CabinClass = segment_data['bookingCode'];
                            attr['AvailableSeats'] = segment_data['availabilityCount'];
                            attr['Baggage'] = AllowanceBaggage;
                            attr['CabinBaggage'] = '7 KG';

                            let Distance = 0;
                            let FlightTime = segment_data['flightTime'];

                            let WaitingTime = 0;
                            WaitingTime = journeys_details['journeyTime'];

                            let segment_details = await this.formatFlightDetail({ OriginAirportCode, OriginCityName, OriginAirportName, OriginDateTime, OriginTerminal, DestinationAirportCode, DestinationCityName, DestinationAirportName, DestinationDateTime, DestinationTerminal, OperatorCode, DisplayOperatorCode, OperatorName, FlightNumber, CabinClass, Operatedby, Equipment, Distance, FlightTime, AttrBaggage: attr['Baggage'], AttrCabinBaggage: attr['CabinBaggage'], AttrAvailableSeats: attr['AvailableSeats'], WaitingTime, AttrType: attr['Type'] });
                            details[j_key].push(segment_details);
                        }
                    }

                }
                FlightJourney["Details"] = details;
                FlightInfo["FlightDetails"] = FlightJourney;
                //========================= price
                let Currency: any = total_price_information['currency'];
                let adtFare = total_price_information['adtFare'];
                let adtTax = total_price_information['adtTax'];
                let adtTotal = total_price_information['adtFare'] + total_price_information['adtTax'];
                let chdFare = total_price_information['chdFare'];
                let chdTax = total_price_information['chdTax'];
                let chdTotal = total_price_information['chdFare'] + total_price_information['chdTax'];
                let infFare = total_price_information['infFare'];
                let infTax = total_price_information['infTax'];
                let infTotal = total_price_information['infFare'] + total_price_information['infTax'];

                let TotalDisplayFare = adtTotal + chdTotal + infTotal;
                let PriceBreakupBasicFare = adtFare + chdFare + infFare;
                let PriceBreakupTax = adtTax + chdTax + infTax;
                let PriceBreakupAgentCommission = 0;
                let PriceBreakupAgentTdsOnCommision = 0;
                let PassengerBreakup = {};
                let TaxBreakupDetails: any = [];
                let PriceBreakupFareType: string = total_price_information['fareType'];
                PassengerBreakup['ADT'] = {
                    BasePrice: adtFare,
                    Tax: adtTax,
                    TotalPrice: adtTotal,
                    PassengerCount: searchData.AdultCount
                };
                if (searchData.ChildCount > 0) {
                    PassengerBreakup['CHD'] = {
                        BasePrice: chdFare,
                        Tax: chdTax,
                        TotalPrice: chdTotal,
                        PassengerCount: searchData.ChildCount
                    };
                }
                if (searchData.InfantCount > 0) {
                    PassengerBreakup['INF'] = {
                        BasePrice: infFare,
                        Tax: infTax,
                        TotalPrice: infTotal,
                        PassengerCount: searchData.InfantCount
                    };
                }

                //Add Commission Start
                let airlineMarkupAndCommission = {};

                if (markupAndCommission) {
                    searchData["AirlineCode"] = FlightJourney["Details"][0][0]["DisplayOperatorCode"];
                    airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(searchData, markupAndCommission);
                }
                const PriceInfo = await this.flightDbService.formatPriceDetail(searchData.UserId,
                    searchData.UserType, Currency, TotalDisplayFare, PriceBreakupBasicFare, PriceBreakupTax, PriceBreakupAgentCommission, PriceBreakupAgentTdsOnCommision, '', TaxBreakupDetails, PriceBreakupFareType, PassengerBreakup, airlineMarkupAndCommission,
                    FlightJourney["Details"][0][0]["DisplayOperatorCode"]);

                // ======================================price format end
                FlightInfo["Price"] = PriceInfo;

                FlightInfo["Attr"] = { IsRefundable: 0, AirlineRemark: "", DurationList: '' };

                FlightParameters = { FlightInfo: FlightInfo, SearchData: searchData, SolutionKey: total_price_information['solutionKey'] };

                const token = this.redisServerService.geneateResultToken(searchData);

                const ResultToken = await this.redisServerService.insert_record(
                    token,
                    JSON.stringify(FlightParameters)
                );
                FlightInfo["ResultToken"] = ResultToken["access_key"];
                FlightInfo["booking_source"] = FARE_FLIGHT_BOOKING_SOURCE;
                FlightDataList["JourneyList"].push(FlightInfo);
            }
            return FlightDataList["JourneyList"];
        }
    }

    // need to add in common file 
    async formatFlightDetail({ OriginAirportCode, OriginCityName, OriginAirportName, OriginDateTime, OriginTerminal, DestinationAirportCode, DestinationCityName, DestinationAirportName, DestinationDateTime, DestinationTerminal, OperatorCode, DisplayOperatorCode, OperatorName, FlightNumber, CabinClass, Operatedby, Equipment, Distance, FlightTime, AttrBaggage, AttrCabinBaggage, AttrAvailableSeats, WaitingTime, AttrType }: { OriginAirportCode: any; OriginCityName: any; OriginAirportName: any; OriginDateTime: string; OriginTerminal: any; DestinationAirportCode: any; DestinationCityName: any; DestinationAirportName: any; DestinationDateTime: string; DestinationTerminal: any; OperatorCode: any; DisplayOperatorCode: any; OperatorName: any; FlightNumber: any; CabinClass: any; Operatedby: any; Equipment: string; Distance: number; FlightTime: number; AttrBaggage: any; AttrCabinBaggage: any; AttrAvailableSeats: any; WaitingTime: number; AttrType: any; }) {
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
                SupplierDateTime: OriginDateTime
            },
            Destination: {
                AirportCode: DestinationAirportCode,
                CityName: DestinationCityName,
                AirportName: DestinationAirportName,
                DateTime: formatSearchDate(DestinationDateTime),
                Terminal: DestinationTerminal,
                SupplierDateTime: DestinationDateTime

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
                Type: AttrType
            },
        };
    }
    async formatPriceDetail(
        { Currency, TotalDisplayFare, PriceBreakupBasicFare, PriceBreakupTax, PriceBreakupAgentCommission, PriceBreakupAgentTdsOnCommision, PriceBreakupRBD, TaxDetails1, PriceBreakupFareType, PassengerBreakup }: { Currency: any; TotalDisplayFare: any; PriceBreakupBasicFare: any; PriceBreakupTax: any; PriceBreakupAgentCommission: number; PriceBreakupAgentTdsOnCommision: number; PriceBreakupRBD: any[]; TaxDetails1: any[]; PriceBreakupFareType: string; PassengerBreakup: any; }) {
        return {
            Currency: Currency,
            TotalDisplayFare: TotalDisplayFare,
            PriceBreakup: {
                BasicFare: PriceBreakupBasicFare,
                Tax: PriceBreakupTax,
                AgentCommission: PriceBreakupAgentCommission,
                AgentTdsOnCommision: PriceBreakupAgentTdsOnCommision,
                RBD: PriceBreakupRBD,
                TaxDetails: TaxDetails1,
                FareType: PriceBreakupFareType,
            },
            PassengerBreakup: PassengerBreakup
        };
    }

    tax_breakup(tax_details: any) {
        const display_tax_list = ["YQF", "YRF", "K3B"];
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

    async fareQuoteDataFormat(
        result: any,
        searchData: any,
        previousData: any
    ): Promise<any> {

        this.airport_codes = await this.getSearchAirports();
        this.airline_codes = await this.getSearchAirlines();
        // this.airport_timezone = await this.getAirportTimezone();
        const FlightDataList = { JourneyList: [] };
        // FlightDataList["JourneyList"][0] = [];
        // Markup and Commission Start
        const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(searchData);
        // console.log(result); return false;
        if (result['data']['solution'] != undefined) {
            const solutions = this.forceObjectToArray(result['data']['solution']);
            const flights = this.forceObjectToArray(result['data']['flights']);
            const segments = this.forceObjectToArray(result['data']['segments']);

            for (let p_key = 0; p_key < solutions.length; p_key++) { // price start
                let pricingInformation: any = this.forceObjectToArray(solutions[p_key]);


                let total_price_information: any = pricingInformation[0];
                // console.log(total_price_information);
                // return false;
                //========================= segment

                let journeys = total_price_information['journeys'];
                let total_duration = 0;
                const details = [];
                const journey_list = [];
                const FlightInfo = {};
                const FlightJourney = { Details: [] };
                let FlightParameters = {};

                if (journeys['journey_0'] != undefined) {
                    journey_list.push(journeys['journey_0'][0]);
                }

                if (journeys['journey_1'] != undefined) {
                    journey_list.push(journeys['journey_1'][0]);
                }

                if (journey_list.length > 0) {
                    for (let j_key = 0; j_key < journey_list.length; j_key++) { // journey start
                        let journeys_details = flights.find((t) => t.flightId === journey_list[j_key]) || {};
                        details[j_key] = [];
                        let segment_list = this.forceObjectToArray(journeys_details['segmentIds']);

                        for (let s_key = 0; s_key < segment_list.length; s_key++) { // segment start

                            let segment_data = segments.find((t) => t.segmentId === segment_list[s_key]) || {};


                            let departure_date = segment_data['strDepartureDate'];
                            let arrival_date = segment_data['strArrivalDate'];

                            let OriginAirportCode = segment_data['departure'];
                            let DestinationAirportCode = segment_data['arrival'];
                            let arrival_time = segment_data['strArrivalTime'];
                            let departure_time = segment_data['strDepartureTime'];
                            let DestinationDateTime = arrival_date + " " + arrival_time;
                            let OriginDateTime = departure_date + " " + departure_time;

                            let OriginTerminal: any;
                            let DestinationTerminal: any;
                            if (segment_data['departureTerminal'] != undefined) {
                                OriginTerminal = segment_data['departureTerminal'];
                            }

                            if (segment_data['arrivalTerminal'] != undefined) {
                                DestinationTerminal = segment_data['arrivalTerminal'];
                            }

                            let Operatedby = segment_data['airline'];
                            let OperatorCode = segment_data['airline'];
                            let DisplayOperatorCode = segment_data['airline'];
                            const tempAirline = this.airline_codes.find((t: { code: any; }) => t.code == DisplayOperatorCode) || {};
                            const OperatorName = tempAirline['name'] || DisplayOperatorCode;

                            const tempAirportDestination = this.airport_codes.find((t: { code: any; }) => t.code === DestinationAirportCode) || {};
                            const DestinationCityName = tempAirportDestination['city'] || DestinationAirportCode;
                            const DestinationAirportName = tempAirportDestination['name'] || DestinationAirportCode;

                            const tempAirportOrigin = this.airport_codes.find((t: { code: any; }) => t.code === OriginAirportCode) || {};
                            const OriginCityName = tempAirportOrigin['city'] || OriginAirportCode;
                            const OriginAirportName = tempAirportOrigin['name'] || OriginAirportCode;

                            let Equipment = segment_data['equipment'] || "";
                            if (Equipment != "") {
                                let first_c = Equipment.substr(0, 1);
                                if (first_c == "7") {
                                    Equipment = "BOEING - " + Equipment;
                                } else if (first_c == "3") {
                                    Equipment = "AIRBUS - " + Equipment;
                                }
                            }
                            let AllowanceBaggage = '';
                            if (total_price_information['baggageMap']) {
                                let baggageMap = this.forceObjectToArray(total_price_information['baggageMap']['ADT']);
                                if (baggageMap[0]) {
                                    if (baggageMap[0]['baggageAmount'] != null) {
                                        AllowanceBaggage = baggageMap[0]['baggageAmount'];
                                    } else if (baggageMap[0]['baggageWeight'] != null) {
                                        AllowanceBaggage = baggageMap[0]['baggageWeight'];
                                    }
                                }
                            }

                            let FlightNumber = segment_data['flightNum'];
                            let no_of_stops = 0;
                            let CabinClass = '';

                            let duration = segment_data['flightTime'];
                            let attr = [];
                            CabinClass = segment_data['bookingCode'];
                            attr['AvailableSeats'] = segment_data['availabilityCount'];
                            attr['Baggage'] = AllowanceBaggage;
                            attr['CabinBaggage'] = '7 KG';

                            let Distance = 0;
                            let FlightTime = segment_data['flightTime'];

                            let WaitingTime = 0;
                            WaitingTime = journeys_details['journeyTime'];

                            let segment_details = await this.formatFlightDetail({ OriginAirportCode, OriginCityName, OriginAirportName, OriginDateTime, OriginTerminal, DestinationAirportCode, DestinationCityName, DestinationAirportName, DestinationDateTime, DestinationTerminal, OperatorCode, DisplayOperatorCode, OperatorName, FlightNumber, CabinClass, Operatedby, Equipment, Distance, FlightTime, AttrBaggage: attr['Baggage'], AttrCabinBaggage: attr['CabinBaggage'], AttrAvailableSeats: attr['AvailableSeats'], WaitingTime, AttrType: attr['Type'] });
                            details[j_key].push(segment_details);
                        }
                    }

                }
                FlightJourney["Details"] = details;
                FlightInfo["FlightDetails"] = FlightJourney;

                //========================= price
                let Currency: any = total_price_information['currency'];
                let adtFare = total_price_information['adtFare'];
                let adtTax = total_price_information['adtTax'];
                let adtTotal = total_price_information['adtFare'] + total_price_information['adtTax'];
                let chdFare = total_price_information['chdFare'];
                let chdTax = total_price_information['chdTax'];
                let chdTotal = total_price_information['chdFare'] + total_price_information['chdTax'];
                let infFare = 0;
                let infTax = 0;
                let infTotal = 0;

                // let infFare = total_price_information['infFare'];
                // let infTax = total_price_information['infTax'];
                // let infTotal = total_price_information['infFare'] + total_price_information['infTax'];

                let TotalDisplayFare = adtTotal + chdTotal + infTotal;
                let PriceBreakupBasicFare = adtFare + chdFare + infFare;
                let PriceBreakupTax = adtTax + chdTax + infTax;
                let PriceBreakupAgentCommission = 0;
                let PriceBreakupAgentTdsOnCommision = 0;
                let PassengerBreakup = {};
                let TaxBreakupDetails: any = [];
                let PriceBreakupFareType: string = total_price_information['fareType'];
                PassengerBreakup['ADT'] = {
                    BasePrice: adtFare,
                    Tax: adtTax,
                    TotalPrice: adtTotal,
                    PassengerCount: searchData.AdultCount
                };
                if (searchData.ChildCount > 0) {
                    PassengerBreakup['CHD'] = {
                        BasePrice: chdFare,
                        Tax: chdTax,
                        TotalPrice: chdTotal,
                        PassengerCount: searchData.ChildCount
                    };
                }
                if (searchData.InfantCount > 0) {
                    PassengerBreakup['INF'] = {
                        BasePrice: infFare,
                        Tax: infTax,
                        TotalPrice: infTotal,
                        PassengerCount: searchData.InfantCount
                    };
                }

                //Add Commission Start
                let airlineMarkupAndCommission = {};

                if (markupAndCommission) {
                    searchData["AirlineCode"] = FlightJourney["Details"][0][0]["DisplayOperatorCode"];
                    airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(searchData, markupAndCommission);
                }
                const PriceInfo = await this.flightDbService.formatPriceDetail(searchData.UserId,
                    searchData.UserType, Currency, TotalDisplayFare, PriceBreakupBasicFare, PriceBreakupTax, PriceBreakupAgentCommission, PriceBreakupAgentTdsOnCommision, '', TaxBreakupDetails, PriceBreakupFareType, PassengerBreakup, airlineMarkupAndCommission,
                    FlightJourney["Details"][0][0]["DisplayOperatorCode"]);

                // ======================================price format end
                FlightInfo["Price"] = PriceInfo;

                FlightInfo["Attr"] = { IsRefundable: 0, AirlineRemark: "", DurationList: '' };

                FlightParameters = { FlightInfo: FlightInfo, SearchData: searchData, SolutionKey: total_price_information['solutionKey'] };

                const token = this.redisServerService.geneateResultToken(searchData);

                const ResultToken = await this.redisServerService.insert_record(
                    token,
                    JSON.stringify(FlightParameters)
                );
                FlightInfo["ResultToken"] = ResultToken["access_key"];
                FlightInfo["booking_source"] = FARE_FLIGHT_BOOKING_SOURCE;
                FlightDataList["JourneyList"].push(FlightInfo);
            }
            return FlightDataList["JourneyList"];
        }
    }

    async reservationResponseFormat(result, body, commitBookingDataParsed) {

        if (result['errorCode'] == 0) {

            const pnr = result.data.pnr;
            const orderNum = result.data.orderNum;
            let LastDateToTicket = '';
            if (result.data.flights[0].lastTktTime) {
                LastDateToTicket = result.data.flights[0].lastTktTime;
            }

            const graphQuery = `{
            flightBookingTransactionPassengers(where:{app_reference:{eq:"${body["AppReference"]}"}}){
              PassengerId:id
              PassengerType:passenger_type
              Title:title
              FirstName:first_name
              MiddleName:middle_name
              LastName:last_name
              PassportNumber:passport_number
              TicketNumber:ticket_no
            }
          }`;
            const PassengerDetails = await this.getGraphData(
                graphQuery,
                "flightBookingTransactionPassengers"
            );

            const graphQuery2 = `{
                flightBookings(where:{app_reference:{eq:"${body["AppReference"]}"}}){
            email
            phone
            phone_code
            journey_start 
            journey_end
    
            }
          }`;
            const Passenger = await this.getGraphData(
                graphQuery2,
                "flightBookings"
            );
            if (PassengerDetails.length) {
                for (let i = 0; i < PassengerDetails.length; i++) {
                    PassengerDetails[i]['Email'] = Passenger[0]['email'];
                }
            }

            let airline_pnr = pnr;

            const query6 = `UPDATE flight_booking_transaction_itineraries SET 
            airline_pnr = "${pnr}"
            WHERE app_reference = "${body["AppReference"]}"`;
            await this.manager.query(query6);


            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_HOLD" ,
            UniversalRecordLocatorCode = "${pnr}" ,
            AirReservationLocatorCode = "${orderNum}" ,
            LastDateToTicket = "${LastDateToTicket}"
            WHERE app_reference = "${body["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_HOLD" ,
            pnr = "${pnr}",
            gds_pnr = "${pnr}" 
            WHERE app_reference = "${body["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_HOLD" 
            WHERE app_reference = "${body["AppReference"]}"`;
            await this.manager.query(query3);

            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_HOLD",
                        BookingAppReference: body["AppReference"],
                        BookingId: body["AppReference"],
                        PNR: airline_pnr,
                        GDSPNR: pnr,
                        AirReservationLocatorCode: pnr,
                        UniversalRecordLocatorCode: pnr,
                        LastDateToTicket: LastDateToTicket ? LastDateToTicket : "N/A",
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code
                        },
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: {
                                Details: commitBookingDataParsed['FlightInfo']['FlightDetails']['Details'],
                            },
                        },
                        Price: commitBookingDataParsed['FlightInfo']['Price'],
                        Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: FARE_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
        } else {
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBooking",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBookingTransaction",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBookingTransactionItinerary",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBookingTransactionPassenger",
                { booking_status: "BOOKING_FAILED" }
            );
            return false;
        }

    }

    async ticketingResponseFormat(result, body, stage) {
        if (result['errorCode'] == 0 && stage == 'ticketing') {
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

            const graphQuery = `{
            flightBookingTransactionPassengers(where:{app_reference:{eq:"${body["AppReference"]}"}}){
              PassengerId:id
              PassengerType:passenger_type
              Title:title
              FirstName:first_name
              MiddleName:middle_name
              LastName:last_name
              PassportNumber:passport_number
              TicketNumber:ticket_no
            }
          }`;
            const PassengerDetails = await this.getGraphData(
                graphQuery,
                "flightBookingTransactionPassengers"
            );
            const graphQuery2 = `{
                flightBookings(where:{app_reference:{eq:"${body["AppReference"]}"}}){
            email
            phone
            phone_code
            LastDateToTicket
            UniversalRecordLocatorCode
            }
          }`;
            const Passenger = await this.getGraphData(graphQuery2, "flightBookings");
            const LastDateToTicket = Passenger[0].LastDateToTicket
            const gds_pnr = Passenger[0].UniversalRecordLocatorCode;
            if (PassengerDetails.length) {
                for (let i = 0; i < PassengerDetails.length; i++) {
                    PassengerDetails[i]["Email"] = Passenger[0]["email"];
                }
            }
            const transactionDetails = await this.getGraphData(
                `{
                    flightBookingTransactions( where:{
                      app_reference:{
                        eq:"${body["AppReference"]}"
                      }
                    }){
                      attributes
                    }
                  }`,
                `flightBookingTransactions`
            );
            const transactionItineraryDetails = await this.getGraphData(
                `{
                    flightBookingTransactions( where:{
                      app_reference:{
                        eq:"${body["AppReference"]}"
                      }
                    }){
                        flightBookingTransactionItineraries{
                            from_airport_code
                            to_airport_code
                            operating_carrier
                            departure_datetime
                        arrival_datetime
                        arrival_terminal
                        departure_terminal
                        flight_number
                        airline_pnr
                        airline_code
                        fare_class
                  checkin_baggage
                    }
                    }
                  }`,
                `flightBookingTransactions`
            );
            const JourneyTempData = transactionItineraryDetails[0].flightBookingTransactionItineraries;
            await JourneyTempData.forEach(element => {
                {
                    if (!this.AirportCodeList.includes(element.from_airport_code)) {
                        this.AirportCodeList.push(element.from_airport_code);
                    }
                    if (!this.AirportCodeList.includes(element.to_airport_code)) {
                        this.AirportCodeList.push(element.to_airport_code);
                    }
                }
            }

            )
            this.airport_codes = await this.getAirports();
            this.airline_codes = await this.getAirlines();
            let transactionDetailsParsed = JSON.parse(
                transactionDetails[0].attributes.replace(/'/g, '"')
            );
            const JourneyArray = [];
            const pnr = transactionItineraryDetails[0].flightBookingTransactionItineraries[0].airline_pnr
            transactionItineraryDetails[0].flightBookingTransactionItineraries.forEach((element, index) => {
                const Origin = element["from_airport_code"];
                const Destination = element["to_airport_code"];
                const tempAirportOrigin =
                    this.airport_codes.find((t) => t.code === Origin) || {};
                const OriginCityName = tempAirportOrigin["city"] || Origin;
                const OriginAirportName = tempAirportOrigin["name"] || Origin;
                const tempAirportDestination =
                    this.airport_codes.find((t) => t.code === Destination) || {};
                const DestinationCityName =
                    tempAirportDestination["city"] || Destination;
                const DestinationAirportName =
                    tempAirportDestination["name"] || Destination;
                const Carrier = element["operating_carrier"];
                JourneyArray.push({
                    Origin: {
                        AirportCode: Origin,
                        CityName: OriginCityName,
                        AirportName: OriginAirportName,
                        DateTime: element["departure_datetime"],
                        FDTV: "",
                        Terminal: element["departure_terminal"],
                    },
                    Destination: {
                        AirportCode: Destination,
                        CityName: DestinationCityName,
                        AirportName: DestinationAirportName,
                        DateTime: element["arrival_datetime"],
                        FATV: "",
                        Terminal: element["arrival_terminal"],
                    },
                    AirlinePNR: element.airline_pnr,
                    OperatorCode: Carrier,
                    DisplayOperatorCode: Carrier,
                    OperatorName: "US Bangla",
                    FlightNumber: element["flight_number"],
                    CabinClass: element["fare_class"],
                    Equipment: "N/A",
                    Duration: "",
                    Attr: {
                        Baggage: element["checkin_baggage"],
                        CabinBaggage: "7 KG",
                    },
                    booking_source: SABRE_FLIGHT_BOOKING_SOURCE,
                });
            });

            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_CONFIRMED",
                        BookingAppReference: body["AppReference"],
                        BookingId: body["AppReference"],
                        PNR: pnr,
                        GDSPNR: gds_pnr,
                        LastDateToTicket,
                        AirReservationLocatorCode: pnr,
                        UniversalRecordLocatorCode: pnr,
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code,
                        },
                        PassengerDetails,
                        Price: transactionDetailsParsed,
                        JourneyList: {
                            FlightDetails: {
                                Details: [JourneyArray],
                            },
                        },
                        // Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: SABRE_FLIGHT_BOOKING_SOURCE,
                    },
                },
            };
        } else {
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBooking",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBookingTransaction",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBookingTransactionItinerary",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: body["AppReference"] },
                "FlightBookingTransactionPassenger",
                { booking_status: "BOOKING_FAILED" }
            );
            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_FAILED",
                        BookingAppReference: body["AppReference"],
                        BookingId: body["AppReference"],
                    },
                },
            };
        }
    }

    async updateReservationVoid(app_reference, jsonResponse) {

        const query = `UPDATE flight_bookings SET 
        booking_status = "BOOKING_VOIDED" 
        WHERE app_reference = "${app_reference}"`;
        await this.manager.query(query);
        const query2 = `UPDATE flight_booking_transactions SET 
        booking_status = "BOOKING_VOIDED" 
        WHERE app_reference = "${app_reference}"`;
        await this.manager.query(query2);
        const query3 = `UPDATE flight_booking_transaction_itineraries SET 
        booking_status = "BOOKING_VOIDED" 
        WHERE app_reference = "${app_reference}"`;
        await this.manager.query(query3);
        const flightBookings = await this.getGraphData(`query {
            flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
              booking_status
              UniversalRecordLocatorCode
              AirReservationLocatorCode
            }
          }`, 'flightBookings');
        if (!flightBookings[0]['UniversalRecordLocatorCode']) {
            console.log('need to throw error');
        }
        const result = {
            PNR: flightBookings[0]['UniversalRecordLocatorCode'],
            BookingStatus: flightBookings[0].booking_status
        }
        return result
    }

    async updateReservationCancellation(app_reference, jsonResponse) {
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
              UniversalRecordLocatorCode
              AirReservationLocatorCode
            }
          }`, 'flightBookings');
        if (!flightBookings[0]['UniversalRecordLocatorCode']) {
            console.log('need to throw error');
        }
        const result = {
            PNR: flightBookings[0]['UniversalRecordLocatorCode'],
            BookingStatus: flightBookings[0].booking_status
        }
        return result;
    }



}