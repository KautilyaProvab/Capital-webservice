import { Injectable } from "@nestjs/common";
// import { isArray } from "class-validator";
// import * as moment from "moment";
import { elementAt } from "rxjs/operators";
import {
    getDuration,
    getPropValue,
    nl2br,
    undefinedToUndefined,
    debug,
    formatSearchDate,
    formatVoucherDate,
} from "../../../app.helper";
import {
    ADVANCE_TAX_PERCENT,
    TRAVELPORT_AIR_URL,
    TRAVELPORT_FLIGHT_BOOKING_SOURCE,
    TRAVELPORT_SCHEMA,
    TRAVELPORT_VERSION
} from "../../../constants";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";

@Injectable()
export class TravelportTransformService extends FlightApi {

    constructor(private readonly redisServerService: RedisServerService,
        private readonly flightDbService: FlightDbService
    ) {
        super();
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
    ) {
        /* if (!this.airline_codes.length) {
                await this.getAirlines();
            }
            if (!this.airport_codes.length) {
                await this.getAirports();
            } */
        const flight_journey = [];
        const air_fare_key = [];
        const air_fare_list = [];
        const journey_detail = this.forceObjectToArray(
            pricing_array["air:Journey"]
        );
        const air_pricing_info = this.forceObjectToArray(
            pricing_array["air:AirPricingInfo"]
        );
        const connection_arr = this.forceObjectToArray(
            pricing_array["air:Connection"]
        );
        const connectionTemp = [];
        connection_arr.forEach((f_stop) => {
            connectionTemp.push(f_stop["SegmentIndex"]);
        });
        const connection = connectionTemp.join(",");
        const BookingInfo = this.forceObjectToArray(
            air_pricing_info[0]["air:BookingInfo"]
        );
        const FlightInfo = {};
        const flight_key_list = [];
        const FlightJourney = { Details: [] };
        const FlightParameters = { FlightList: [] };
        const journey_detailLength = journey_detail.length;
        let duration_list = [];
        for (
            let journey_index = 0;
            journey_index < journey_detailLength;
            journey_index++
        ) {
            const j_detail = journey_detail[journey_index];

            FlightJourney["Details"][journey_index] = [];
            FlightParameters["FlightList"][journey_index] = [];
            const air_segment_ref = this.forceObjectToArray(
                j_detail["air:AirSegmentRef"]
            );
            const air_segment_refLength = air_segment_ref.length;

            let total_duration = 0;
            for (
                let segment_index = 0;
                segment_index < air_segment_refLength;
                segment_index++
            ) {
                if (!Array.isArray(air_segment_list)) {
                    air_segment_list = [air_segment_list]
                }
                const a_s_ref = air_segment_ref[segment_index];
                const Segment = air_segment_list.find((t) => {
                    if (t.Key == a_s_ref["Key"]) {
                        flight_key_list[journey_index + "-" + segment_index] = t.Key;
                        return true;
                    }
                    return false;
                });
                const {
                    Origin,
                    Destination,
                    DepartureTime,
                    ArrivalTime,
                    FlightNumber,
                    Carrier,
                    Key,
                    FlightTime,
                } = Segment;
                const FlightDetailsRef = Segment["air:FlightDetailsRef"];
                let Equipment = Segment["Equipment"] || "";
                if (Equipment != "") {
                    let first_c = Equipment.substr(0, 1);
                    if (first_c == "7") {
                        Equipment = "BOEING - " + Equipment;
                    } else if (first_c == "3") {
                        Equipment = "AIRBUS - " + Equipment;
                    }
                }
                const Distance = Segment["Distance"] || "";
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
                const DisplayOperatorCode = Carrier;
                const tempAirline =
                    this.airline_codes.find((t) => t.code == Carrier) || {};
                const OperatorName = tempAirline["name"] || Carrier;
                const CabinClass = "";
                const Operatedby = Carrier;
                const AttrBaggage = "";
                const AttrCabinBaggage = "";
                const AttrAvailableSeats = 0;
                const Terminal =
                    seg_flight_details.find((t) => t.Key === FlightDetailsRef.Key) || {};
                const OriginTerminal = Terminal["OriginTerminal"] || "";
                const DestinationTerminal = Terminal["DestinationTerminal"] || "";
                FlightParameters["FlightList"][journey_index].push(Segment);
                let WaitingTime = 0;

                if (segment_index > 0) {
                    WaitingTime = getDuration(
                        FlightJourney["Details"][journey_index][segment_index - 1][
                        "Destination"
                        ]["SupplierDateTime"],
                        DepartureTime
                    );
                }
                total_duration += parseInt(FlightTime);
                const details = this.formatFlightDetail(
                    Origin,
                    OriginCityName,
                    OriginAirportName,
                    DepartureTime,
                    OriginTerminal,
                    Destination,
                    DestinationCityName,
                    DestinationAirportName,
                    ArrivalTime,
                    DestinationTerminal,
                    Carrier,
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
                );
                FlightJourney["Details"][journey_index].push(details);
            }
            duration_list.push(this.convertToHoursMins(total_duration));
        }
        FlightParameters["SearchData"] = search_data;
        const PassengerBreakup = {};
        const Refundable = air_pricing_info[0]["Refundable"] ? 1 : 0;

        const TaxBreakupDetails = {};
        const CancelPenalty = "";
        const air_pricing_infoLength = air_pricing_info.length;
        for (let i = 0; i < air_pricing_infoLength; i++) {
            const p_info = air_pricing_info[i];
            const PassengerType = this.forceObjectToArray(
                p_info["air:PassengerType"]
            );
            let BasePrice = 0;
            let Taxes = 0;
            let TotalPrice = 0;
            let Fees = 0;
            const PaxCount = PassengerType.length;
            const TaxInfo = this.forceObjectToArray(p_info["air:TaxInfo"]);
            const TaxInfoLength = TaxInfo.length;
            for (let k = 0; k < TaxInfoLength; k++) {
                const t_info = TaxInfo[k];
                if (TaxBreakupDetails[t_info["Category"]]) {
                    TaxBreakupDetails[t_info["Category"]] +=
                        this.getPrice(t_info["Amount"]) * PaxCount;
                } else {
                    TaxBreakupDetails[t_info["Category"]] =
                        this.getPrice(t_info["Amount"]) * PaxCount;
                }
            }
            if (p_info["EquivalentBasePrice"]) {
                BasePrice = this.getPrice(p_info["EquivalentBasePrice"]);
            } else if (p_info["ApproximateBasePrice"]) {
                BasePrice = this.getPrice(p_info["ApproximateBasePrice"]);
            } else {
                BasePrice = this.getPrice(p_info["BasePrice"]);
            }

            if (p_info["ApproximateTaxes"]) {
                Taxes = this.getPrice(p_info["ApproximateTaxes"]);
            } else {
                if (p_info["Taxes"]) {
                    Taxes = this.getPrice(p_info["Taxes"]);
                }
            }
            if (p_info["ApproximateFees"]) {
                Fees = this.getPrice(p_info["ApproximateFees"]);
            } else {
                if (p_info["Fees"]) {
                    Fees = this.getPrice(p_info["Fees"]);
                }
            }
            // const PassengerTypeCode =
            //     PassengerType[0]["Code"] == "CNN" ? "CHD" : PassengerType[0]["Code"];
            // PassengerBreakup[PassengerTypeCode] = {
            //     BasePrice: BasePrice,
            //     Tax: Taxes + Fees,
            //     TotalPrice: BasePrice + Taxes + Fees,
            //     PassengerCount: PaxCount,
            // };

            for (const passenger of PassengerType) {
                let passengerCode = passenger["Code"];
                passengerCode = passengerCode == "CNN" ? "CHD" : passengerCode;
                let priceInfo = { BasePrice: BasePrice, Tax: 0, TotalPrice: 0, PassengerCount: 0 };
                switch (passengerCode) {
                    case "ADT":

                        PassengerBreakup[passengerCode] = PassengerBreakup[passengerCode] || priceInfo;
                        PassengerBreakup[passengerCode].Tax = Taxes + Fees;
                        PassengerBreakup[passengerCode].TotalPrice = BasePrice + Taxes + Fees;
                        PassengerBreakup[passengerCode].PassengerCount++;
                        break;
                    case "CHD":

                        PassengerBreakup[passengerCode] = PassengerBreakup[passengerCode] || priceInfo;
                        PassengerBreakup[passengerCode].Tax = Taxes + Fees;
                        PassengerBreakup[passengerCode].TotalPrice = BasePrice + Taxes + Fees;
                        PassengerBreakup[passengerCode].PassengerCount++;
                        break;
                    case "INF":

                        PassengerBreakup[passengerCode] = PassengerBreakup[passengerCode] || priceInfo;
                        PassengerBreakup[passengerCode].Tax = Taxes + Fees;
                        PassengerBreakup[passengerCode].TotalPrice = BasePrice + Taxes + Fees;
                        PassengerBreakup[passengerCode].PassengerCount++;
                        break;
                }
            }
        }

        const TaxDetails = this.tax_breakup(TaxBreakupDetails);
        const RBD_array = [];
        const BookingInfoLength = BookingInfo.length;
        let FareType = "Regular Fare";
        for (let j = 0; j < BookingInfoLength; j++) {
            const b_info = BookingInfo[j];
            const KeyByValue = this.getKeyByValue(
                flight_key_list,
                b_info["SegmentRef"]
            );
            const FlightSegmentNumber = KeyByValue.split("-");
            FlightJourney["Details"][FlightSegmentNumber[0]][FlightSegmentNumber[1]][
                "CabinClass"
            ] = b_info["CabinClass"];
            FlightJourney["Details"][FlightSegmentNumber[0]][FlightSegmentNumber[1]][
                "Attr"
            ]["AvailableSeats"] = b_info["BookingCount"];
            Object.assign(
                FlightParameters["FlightList"][FlightSegmentNumber[0]][
                FlightSegmentNumber[1]
                ],
                b_info
            );

            const BaggageInfo = air_fare_info.find((t) => {
                if (t.Key === b_info["FareInfoRef"]) {
                    Object.assign(
                        FlightParameters["FlightList"][FlightSegmentNumber[0]][
                        FlightSegmentNumber[1]
                        ],
                        { FareInfo: t }
                    );
                    let baggage_value:any = 0;
                    let baggage_unit = "";
                    if (t["air:BaggageAllowance"]["air:MaxWeight"]["Value"]) {
                        baggage_value = t["air:BaggageAllowance"]["air:MaxWeight"]["Value"];
                        baggage_unit = t["air:BaggageAllowance"]["air:MaxWeight"]["Unit"];
                    } else if (t["air:BaggageAllowance"]["air:NumberOfPieces"]) {
                        baggage_unit = "Piece";
                        baggage_value = t["air:BaggageAllowance"]["air:NumberOfPieces"];
                        if (baggage_value > 1) {
                            baggage_unit = "Pieces";
                        }
                    }
                    if (typeof baggage_value == 'object') {
                       if(baggage_value['$t']){
                        baggage_value = baggage_value['$t'];
                       }
                    }

                    FareType = t["FareFamily"] ? t["FareFamily"] : "Regular Fare";
                    const AirlinCode =
                        FlightJourney["Details"][FlightSegmentNumber[0]][
                        FlightSegmentNumber[1]
                        ]["OperatorCode"];
                    const AirlineDetail =
                        this.airline_codes.find((t) => t.code === AirlinCode) || {};

                    let cabin_static_bag = '9 Kilograms';
                    if (search_data['Segments'][0]['CabinClass'] != undefined && (search_data['Segments'][0]['CabinClass'] == "Economy" || search_data['Segments'][0]['CabinClass'] == "economy")) {
                        cabin_static_bag = '7 Kilograms';
                    }

                    if (search_data['Segments'][0]['CabinClassOnward'] != undefined && (search_data['Segments'][0]['CabinClassOnward'] == "Economy" || search_data['Segments'][0]['CabinClassOnward'] == "economy")) {
                        cabin_static_bag = '7 Kilograms';
                    }

                    FlightJourney["Details"][FlightSegmentNumber[0]][
                        FlightSegmentNumber[1]
                    ]["Attr"]["CabinBaggage"] = cabin_static_bag;
                    FlightJourney["Details"][FlightSegmentNumber[0]][
                        FlightSegmentNumber[1]
                    ]["Attr"]["Baggage"] = baggage_value + " " + baggage_unit;

                    return true;
                }
                return false;
            });
            RBD_array.push(b_info["BookingCode"]);
        }
        const RBD = RBD_array.join(", ");
        const provider_code =
            air_segment_list[0]["air:AirAvailInfo"]["ProviderCode"];
        let display_price = this.getPrice(pricing_array["ApproximateTotalPrice"]);
        const total_tax =
            this.getPrice(pricing_array["ApproximateTaxes"]) +
            this.getPrice(pricing_array["ApproximateFees"]);
        let approx_base_price = this.getPrice(
            pricing_array["ApproximateBasePrice"]
        );

        //Add Commission Start
        let airlineMarkupAndCommission = {};


        if (markupAndCommission) {
            search_data["AirlineCode"] = FlightJourney["Details"][0][0]["DisplayOperatorCode"];
            airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(search_data, markupAndCommission);
        }

        if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AgentMarkup"]) {

            if (airlineMarkupAndCommission['markupDetails']["AgentMarkup"]["markup_currency"] != 'GBP') {

                if (airlineMarkupAndCommission['markupDetails']["AgentMarkup"]['value_type'] == "plus") {
                    
                    const currencyDetails = await this.getGraphData(`
                            query {
                                cmsCurrencyConversions(where: {
                                    currency: {
                                        eq:"${airlineMarkupAndCommission['markupDetails']["AgentMarkup"]["markup_currency"]}"
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
                    if (currencyDetails.length <= 0) {
                        const errorClass: any = getExceptionClassByCode(`400 Selected currency is not available.`);
                        throw new errorClass(`Selected currency is not available.`);
                    }

                    const ExchangeRate = currencyDetails[0].value;

                    airlineMarkupAndCommission['markupDetails']["AgentMarkup"]['value'] = Number((airlineMarkupAndCommission['markupDetails']["AgentMarkup"]['value']/ExchangeRate).toFixed(2))
                }
            }
        }

        //Add Commission End
        const PriceInfo = await this.flightDbService.formatPriceDetail(
            search_data.UserId,
            search_data.UserType,
            CurrencyType,
            display_price,
            approx_base_price,
            total_tax,
            0,
            0,
            RBD,
            TaxDetails,
            FareType,
            PassengerBreakup,
            airlineMarkupAndCommission,
            pricing_array['air:AirPricingInfo']['PlatingCarrier']
        );
        let SelectedCurrencyPriceDetails = {};
        if (search_data.Currency) {
            if (search_data.Currency != 'GBP') {
                SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(search_data.Currency, PriceInfo);
            } else {
                SelectedCurrencyPriceDetails = PriceInfo;
            }
        }

        FlightInfo["FlightDetails"] = FlightJourney;
        FlightInfo["Price"] = PriceInfo;
        FlightInfo["Exchange_Price"] = SelectedCurrencyPriceDetails;
        FlightInfo["Attr"] = { IsRefundable: Refundable, AirlineRemark: "", DurationList: duration_list };
        FlightParameters["Connection"] = connection;
        FlightParameters["FlightInfo"] = FlightInfo;
        const ResultToken = await this.redisServerService.insert_record(
            token,
            JSON.stringify(FlightParameters)
        );
        // console.log("Result Token" , ResultToken)
        FlightInfo["ResultToken"] = ResultToken["access_key"];
        FlightInfo["booking_source"] = TRAVELPORT_FLIGHT_BOOKING_SOURCE;
        return FlightInfo;
    }

    tax_breakup(tax_details) {
        const display_tax_list = ["YQ", "YR", "K3"];
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
            },
        };
    }

    async finalData(json: any, searchData: any, BookingTravelerRefObj: any): Promise<any> {
        const LowFareSearchRsp =
            json["SOAP:Envelope"]["SOAP:Body"]["air:LowFareSearchRsp"];
        const CurrencyType = LowFareSearchRsp["CurrencyType"];
        const FlightDetailsList =
            LowFareSearchRsp["air:FlightDetailsList"]["air:FlightDetails"];
        const AirPricingSolution = LowFareSearchRsp["air:AirPricingSolution"];

        const AirSegmentList =
            LowFareSearchRsp["air:AirSegmentList"]["air:AirSegment"];
        const AirSegmentListArray = this.forceObjectToArray(AirSegmentList);
        const AirSegmentListArrayLength = AirSegmentListArray.length;
        this.AirportCodeList = [];
        this.AirlineCodeList = [];
        for (let i = 0; i < AirSegmentListArrayLength; i++) {
            if (!this.AirportCodeList.includes(AirSegmentListArray[i]["Origin"])) {
                this.AirportCodeList.push(AirSegmentListArray[i]["Origin"]);
            }
            if (
                !this.AirportCodeList.includes(AirSegmentListArray[i]["Destination"])
            ) {
                this.AirportCodeList.push(AirSegmentListArray[i]["Destination"]);
            }
            if (!this.AirlineCodeList.includes(AirSegmentListArray[i]["Carrier"])) {
                this.AirlineCodeList.push(AirSegmentListArray[i]["Carrier"]);
            }
        }
        this.airport_codes = await this.getAirports();
        this.airline_codes = await this.getAirlines();
        const FareInfoList = this.forceObjectToArray(LowFareSearchRsp["air:FareInfoList"]["air:FareInfo"]);
        const NewFlightDetails = this.forceObjectToArray(FlightDetailsList);
        const FlightDataList = { JourneyList: [] };
        FlightDataList["JourneyList"][0] = [];
        let NewAirPricingSolution = this.forceObjectToArray(AirPricingSolution);
        const token = this.redisServerService.geneateResultToken(searchData);
        await this.redisServerService.insert_record(token, JSON.stringify(BookingTravelerRefObj));

        // Markup and Commission Start
        const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(searchData);
        const blockAirlineList = await this.flightDbService.blockAirlineList(TRAVELPORT_FLIGHT_BOOKING_SOURCE);

        for (const [idx, p_detail] of NewAirPricingSolution.entries()) {
           
            const AirPricingInfo = this.forceObjectToArray(
                p_detail["air:AirPricingInfo"]
            );
            const RBD_List = [];
            let rbdBlock = false;
            const AirPricingInfoLength = AirPricingInfo.length;
            for (let i = 0; i < AirPricingInfoLength; i++) {
                const air_p_info = AirPricingInfo[i];
                const BookingInfo = this.forceObjectToArray(
                    air_p_info["air:BookingInfo"]
                );
                const BookingInfoLength = BookingInfo.length;
                for (let j = 0; j < BookingInfoLength; j++) {
                    const b_info = BookingInfo[j];
                    RBD_List.push(b_info["BookingCode"]);
                }
                if (!i) {
                    rbdBlock = this.airlineWiseBlockRBD(
                        air_p_info["PlatingCarrier"],
                        RBD_List
                    );
                }
            }
            // console.log(AirPricingInfo[0]['PlatingCarrier']);
            // return false;
            if (rbdBlock && !blockAirlineList.includes(AirPricingInfo[0]['PlatingCarrier'])) {
                let singleFlightDetails: any = [];
                singleFlightDetails = await this.format_air_pricing_solution(
                    FareInfoList,
                    p_detail,
                    AirSegmentList,
                    searchData,
                    NewFlightDetails,
                    CurrencyType,
                    token,
                    markupAndCommission
                );
                FlightDataList["JourneyList"][0].push(singleFlightDetails);
            }
        }
        let PlusMinus3Calender:any=[];
        let finalResponse = [];
        let finalCalender: any=[];
        let finalFlightList:any={ JourneyList: [] };
        finalFlightList["JourneyList"][0]=[];
        if(searchData.PlusMinus3Days){
        //Fare calender +-3 days
        if(searchData.JourneyType=='Return'){
           
            
            FlightDataList["JourneyList"][0].forEach((element,FlightKey) => {
                let onwardFlight=element.FlightDetails.Details[0][0];
                let returnFlight=element.FlightDetails.Details[1][0];
                let flightPrice = element.Price;
                let departureDatetime =onwardFlight.Origin.DateTime;
                let returnDatetime =returnFlight.Origin.DateTime;
                let departureDatetimeArray = departureDatetime.split(" ");
                let returnDatetimeArray = returnDatetime.split(" ");
                if(PlusMinus3Calender[departureDatetimeArray[0]]==undefined){
                    PlusMinus3Calender[departureDatetimeArray[0]]=[];
                }
                if( PlusMinus3Calender[departureDatetimeArray[0]][returnDatetimeArray[0]]==undefined){
                    PlusMinus3Calender[departureDatetimeArray[0]][returnDatetimeArray[0]]=[];
                    PlusMinus3Calender[departureDatetimeArray[0]][returnDatetimeArray[0]]={'OperatorName':onwardFlight.OperatorName,
                    'OperatorCode':onwardFlight.OperatorCode,
                     'FlightNumber':onwardFlight.FlightNumber,
                     "TotalDisplayFare":Number(flightPrice.TotalDisplayFare),
                     "Currency":flightPrice.Currency,
                     "OnwardFlightDate":departureDatetimeArray[0],
                     "ReturnFlightDate":returnDatetimeArray[0],
                     "SearchData":{
                       "AdultCount": searchData.AdultCount,
                       "ChildCount": searchData.ChildCount,
                       "InfantCount": searchData.InfantCount,
                       "JourneyType": searchData.JourneyType,
                       "PreferredAirlineName": searchData.PreferredAirlineName,
                       "PreferredAirlines": searchData.PreferredAirlines,
                       "NonStopFlights": searchData.NonStopFlights,
                       "PlusMinus3Days":searchData.PlusMinus3Days,
                       "Segments": [
                           {
                               "CabinClassOnward": searchData.Segments[0].CabinClassOnward,
                               "CabinClassReturn": searchData.Segments[0].CabinClassReturn,
                               "DepartureDate": departureDatetimeArray[0]+'T00:00:00',
                               "ReturnDate": returnDatetimeArray[0]+'T00:00:00',
                               "Destination": searchData.Segments[0].Destination,
                               "Origin": searchData.Segments[0].Origin
                           }
                       ],
                       "UserType": searchData.UserType,
                       "UserId":searchData.UserId,
                       "booking_source": TRAVELPORT_FLIGHT_BOOKING_SOURCE,
                       "Currency": searchData.Currency,
                       
                   }
                };
            }else if(PlusMinus3Calender[departureDatetimeArray[0]][returnDatetimeArray[0]].TotalDisplayFare>Number(flightPrice.TotalDisplayFare)){
                PlusMinus3Calender[departureDatetimeArray[0]][returnDatetimeArray[0]]=[];
                PlusMinus3Calender[departureDatetimeArray[0]][returnDatetimeArray[0]]={'OperatorName':onwardFlight.OperatorName,
                    'OperatorCode':onwardFlight.OperatorCode,
                     'FlightNumber':onwardFlight.FlightNumber,
                     "TotalDisplayFare":Number(flightPrice.TotalDisplayFare),
                     "Currency":flightPrice.Currency,
                     "OnwardFlightDate":departureDatetimeArray[0],
                     "ReturnFlightDate":returnDatetimeArray[0],
                     "SearchData":{
                       "AdultCount": searchData.AdultCount,
                       "ChildCount": searchData.ChildCount,
                       "InfantCount": searchData.InfantCount,
                       "JourneyType": searchData.JourneyType,
                       "PreferredAirlineName": searchData.PreferredAirlineName,
                       "PreferredAirlines": searchData.PreferredAirlines,
                       "NonStopFlights": searchData.NonStopFlights,
                       "PlusMinus3Days":searchData.PlusMinus3Days,
                       "Segments": [
                           {
                               "CabinClassOnward": searchData.Segments[0].CabinClassOnward,
                               "CabinClassReturn": searchData.Segments[0].CabinClassReturn,
                               "DepartureDate": departureDatetimeArray[0]+'T00:00:00',
                               "ReturnDate": returnDatetimeArray[0]+'T00:00:00',
                               "Destination": searchData.Segments[0].Destination,
                               "Origin": searchData.Segments[0].Origin
                           }
                       ],
                       "UserType": searchData.UserType,
                       "UserId":searchData.UserId,
                       "booking_source": TRAVELPORT_FLIGHT_BOOKING_SOURCE,
                       "Currency": searchData.Currency,
                       
                   }
                };
            }

            let fromDate =departureDatetimeArray[0]+'T00:00:00';
            let toDate = returnDatetimeArray[0]+'T00:00:00';
            
            if(searchData.Segments[0].DepartureDate == fromDate && searchData.Segments[0].ReturnDate == toDate){
                finalFlightList["JourneyList"][0].push(element);
              
            }
            });
            PlusMinus3Calender= Object.values(PlusMinus3Calender);
            PlusMinus3Calender.forEach((particularDayFlight, particularDayFlightKey) => {
                finalCalender[particularDayFlightKey] = Object.values(particularDayFlight);
            });
            
        }else{
            FlightDataList["JourneyList"][0].forEach(element => {
                let onwardFlight=element.FlightDetails.Details[0][0];
                
                let flightPrice = element.Price;
                let departureDatetime =onwardFlight.Origin.DateTime;
                
                let departureDatetimeArray = departureDatetime.split(" ");
           
                if( PlusMinus3Calender[departureDatetimeArray[0]]==undefined){
                    PlusMinus3Calender[departureDatetimeArray[0]]=[];
                    PlusMinus3Calender[departureDatetimeArray[0]]={'OperatorName':onwardFlight.OperatorName,
                    'OperatorCode':onwardFlight.OperatorCode,
                     'FlightNumber':onwardFlight.FlightNumber,
                     "TotalDisplayFare":Number(flightPrice.TotalDisplayFare),
                     "Currency":flightPrice.Currency,
                     "FlightDate":departureDatetimeArray[0],
                     "SearchData":{
                       "AdultCount": searchData.AdultCount,
                       "ChildCount": searchData.ChildCount,
                       "InfantCount": searchData.InfantCount,
                       "JourneyType": searchData.JourneyType,
                       "PreferredAirlineName": searchData.PreferredAirlineName,
                       "PreferredAirlines": searchData.PreferredAirlines,
                       "NonStopFlights": searchData.NonStopFlights,
                       "PlusMinus3Days":searchData.PlusMinus3Days,
                       "Segments": [
                           {
                               "CabinClass": searchData.Segments[0].CabinClass,
                               "DepartureDate": departureDatetimeArray[0]+'T00:00:00',
                               "Destination": searchData.Segments[0].Destination,
                               "Origin": searchData.Segments[0].Origin
                           }
                       ],
                       "UserType": searchData.UserType,
                       "UserId":searchData.UserId,
                       "booking_source": TRAVELPORT_FLIGHT_BOOKING_SOURCE,
                       "Currency": searchData.Currency,
                       
                   }
                };
            }else if(PlusMinus3Calender[departureDatetimeArray[0]].TotalDisplayFare>Number(flightPrice.TotalDisplayFare)){
                PlusMinus3Calender[departureDatetimeArray[0]]=[];
                PlusMinus3Calender[departureDatetimeArray[0]]={'OperatorName':onwardFlight.OperatorName,
                    'OperatorCode':onwardFlight.OperatorCode,
                     'FlightNumber':onwardFlight.FlightNumber,
                     "TotalDisplayFare":Number(flightPrice.TotalDisplayFare),
                     "Currency":flightPrice.Currency,
                     "FlightDate":departureDatetimeArray[0],
                     "SearchData":{
                       "AdultCount": searchData.AdultCount,
                       "ChildCount": searchData.ChildCount,
                       "InfantCount": searchData.InfantCount,
                       "JourneyType": searchData.JourneyType,
                       "PreferredAirlineName": searchData.PreferredAirlineName,
                       "PreferredAirlines": searchData.PreferredAirlines,
                       "NonStopFlights": searchData.NonStopFlights,
                       "PlusMinus3Days":searchData.PlusMinus3Days,
                       "Segments": [
                           {
                               "CabinClass": searchData.Segments[0].CabinClass,
                               "DepartureDate": departureDatetimeArray[0]+'T00:00:00',
                               "Destination": searchData.Segments[0].Destination,
                               "Origin": searchData.Segments[0].Origin
                           }
                       ],
                       "UserType": searchData.UserType,
                       "UserId":searchData.UserId,
                       "booking_source": TRAVELPORT_FLIGHT_BOOKING_SOURCE,
                       "Currency": searchData.Currency,
                       
                   }
                };
              
            }
            let fromDate =departureDatetimeArray[0]+'T00:00:00';
               
            if(searchData.Segments[0].DepartureDate == fromDate ){
                
                finalFlightList["JourneyList"][0].push(element);
              
            }
            });
            finalCalender= Object.values(PlusMinus3Calender);
        }
        finalResponse[0]=finalFlightList["JourneyList"][0];
       
       
        finalResponse['CalenderList']=finalCalender;
    }else{
        finalResponse[0]=FlightDataList["JourneyList"][0];
        finalResponse['CalenderList']=[];
    }
         
        // return { Search: { FlightDataList, NearByAirports: [] } };
        return finalResponse;
    }

    pax_xml_for_fare_quote(pax_count, pax_code, paxId, Age) {
        let pax_xml = "";
        if (pax_count != 0) {
            for (let i = 0; i < pax_count; i++) {
                let calculatedAge = "";

                if (pax_code == "INF" || pax_code == "CNN") {
                    calculatedAge = ('' + this.getPassengeTypeByDOB(Age[i]).age).padStart(2, '0');
                    calculatedAge = 'Age="' + calculatedAge + '"';
                }
                pax_xml += `<SearchPassenger BookingTravelerRef="${paxId}" Code="${pax_code}" ${calculatedAge} xmlns="${TRAVELPORT_SCHEMA}"></SearchPassenger>`;
                paxId++;
            }
        }
        return { pax_xml, paxId };
    }



    async fareQuoteDataFormat(json: any, searchData: any, previousData: any, xmlResponse:any ): Promise<any> {
        const AirPriceRsp = json["SOAP:Envelope"]["SOAP:Body"]["air:AirPriceRsp"];
        const AirItinerary = AirPriceRsp["air:AirItinerary"];
        const AirSegment = this.forceObjectToArray(
            AirPriceRsp["air:AirItinerary"]["air:AirSegment"]
        );
        const AirPricingSolution = this.forceObjectToArray(
            AirPriceRsp["air:AirPriceResult"]["air:AirPricingSolution"]
        );
        // const AirPricingSolutionLength = AirPricingSolution.length;
        const AirPriceResult = AirPricingSolution[0];
        const AirPricingInfoTemp = this.forceObjectToArray(
            AirPriceResult["air:AirPricingInfo"]
        );
        const AirPricingInfoTemp2 = AirPricingInfoTemp.map(p => ({ ...p, PaxTypeSort: p['air:PassengerType']['Code'] == 'CNN' ? 3 : p['air:PassengerType'] == 'INF' ? 2 : 1 }));
        const AirPricingInfo = AirPricingInfoTemp2.sort((a, b) => a.PaxTypeSort - b.PaxTypeSort);

        const AirPricingInfoLength = AirPricingInfo.length;
        const CurrencyType = this.getCurrencyCode(AirPriceResult["TotalPrice"]);
        const TaxBreakupDetails = {};
        const PassengerBreakup = {};

        const air_pricing_sol = {
            AirPricingSolution: {
                xmlns: TRAVELPORT_AIR_URL,
                Key: AirPriceResult["Key"],
                TotalPrice: AirPriceResult["TotalPrice"],
                BasePrice: AirPriceResult["BasePrice"],
                ApproximateTotalPrice: AirPriceResult["ApproximateTotalPrice"],
                ApproximateBasePrice: AirPriceResult["ApproximateBasePrice"],
                EquivalentBasePrice: AirPriceResult["EquivalentBasePrice"],
                Taxes: AirPriceResult["Taxes"],
                ApproximateTaxes: AirPriceResult["ApproximateTaxes"],
                QuoteDate: AirPriceResult["QuoteDate"]
            },
        };

        const air_pricing_info_booking_arr = { AirSegment: [], AirPricingInfo: [] };

        const flight_air_seg_key_array = [];

        const air_seg_key = [];
        const air_seg_ref = this.forceObjectToArray(AirItinerary["air:AirSegment"]);
        const air_seg_refLength = air_seg_ref.length;

        const segment_list = {};
        let provider_code = "";
        for (let i = 0; i < air_seg_refLength; i++) {
            const seg_key = air_seg_ref[i];
            provider_code = seg_key["ProviderCode"];
            air_seg_key.push(seg_key["Key"]);
            segment_list[seg_key["Key"]] = {
                Origin: seg_key["Origin"],
                Destination: seg_key["Destination"],
            };
        }
        if (air_seg_refLength) {
            const AirSegmentLength = AirSegment.length;
            const AirSegmentTempArray = [];
            for (let i = 0; i < AirSegmentLength; i++) {
                const air_segment = AirSegment[i];
                flight_air_seg_key_array.push(air_segment["Key"]);
                if (air_seg_key.includes(air_segment["Key"])) {
                    const AirSegmentTemp = {
                        Key: air_segment["Key"],
                        Group: air_segment["Group"],
                        Carrier: air_segment["Carrier"],
                        FlightNumber: air_segment["FlightNumber"],
                        ProviderCode: air_segment["ProviderCode"],
                        Origin: air_segment["Origin"],
                        Destination: air_segment["Destination"],
                        DepartureTime: air_segment["DepartureTime"],
                        ArrivalTime: air_segment["ArrivalTime"],
                        FlightTime: air_segment["FlightTime"],
                        TravelTime: air_segment["TravelTime"],
                        Distance: undefinedToUndefined(air_segment, "Distance"),
                        ClassOfService: air_segment["ClassOfService"],
                        Equipment: undefinedToUndefined(air_segment, "Equipment"),
                        ChangeOfPlane: air_segment["ChangeOfPlane"],
                        OptionalServicesIndicator: air_segment["OptionalServicesIndicator"],
                        AvailabilitySource: undefinedToUndefined(
                            air_segment,
                            "AvailabilitySource"
                        ),
                        ParticipantLevel: undefinedToUndefined(
                            air_segment,
                            "ParticipantLevel"
                        ),
                        LinkAvailability: undefinedToUndefined(
                            air_segment,
                            "LinkAvailability"
                        ),
                        PolledAvailabilityOption: undefinedToUndefined(
                            air_segment,
                            "PolledAvailabilityOption"
                        ),
                        AvailabilityDisplayType: undefinedToUndefined(
                            air_segment,
                            "AvailabilityDisplayType"
                        ),
                    };

                    if (air_segment["air:CodeshareInfo"]) {
                        if (air_segment["air:CodeshareInfo"]) {
                            Object.assign(AirSegmentTemp, {
                                CodeshareInfo: {
                                    OperatingCarrier: air_segment["air:CodeshareInfo"][
                                        "OperatingCarrier"
                                    ]
                                        ? air_segment["air:CodeshareInfo"][
                                            "OperatingCarrier"
                                        ].replace('"', "")
                                        : undefined,
                                    OperatingFlightNumber: air_segment["air:CodeshareInfo"][
                                        "OperatingFlightNumber"
                                    ]
                                        ? air_segment["air:CodeshareInfo"][
                                            "OperatingFlightNumber"
                                        ].replace('"', "")
                                        : undefined,
                                },
                            });
                        } else {
                            Object.assign(AirSegmentTemp, {
                                CodeshareInfo: {
                                    OperatingCarrier: air_segment["air:CodeshareInfo"][
                                        "OperatingCarrier"
                                    ]
                                        ? air_segment["air:CodeshareInfo"][
                                            "OperatingCarrier"
                                        ].replace('"', "")
                                        : undefined,
                                },
                            });
                        }
                    }
                    if (air_segment["air:AirAvailInfo"]) {
                        Object.assign(AirSegmentTemp, {
                            AirAvailInfo: {
                                ProviderCode: air_segment["air:AirAvailInfo"]["ProviderCode"]
                                    ? air_segment["air:AirAvailInfo"]["ProviderCode"]
                                    : undefined,
                                BookingCodeInfo: {
                                    BookingCounts: air_segment["air:AirAvailInfo"][
                                        "air:BookingCodeInfo"
                                    ]["BookingCounts"]
                                        ? air_segment["air:AirAvailInfo"]["air:BookingCodeInfo"][
                                        "BookingCounts"
                                        ]
                                        : undefined,
                                },
                            },
                        });
                    }
                    if (air_segment["air:FlightDetails"]) {
                        Object.assign(AirSegmentTemp, {
                            FlightDetails: {
                                Key: air_segment["air:FlightDetails"]["Key"],
                                Origin: air_segment["air:FlightDetails"]["Origin"],
                                Destination: air_segment["air:FlightDetails"]["Destination"],
                                DepartureTime:
                                    air_segment["air:FlightDetails"]["DepartureTime"],
                                ArrivalTime: air_segment["air:FlightDetails"]["ArrivalTime"],
                                FlightTime: air_segment["air:FlightDetails"]["FlightTime"],
                                TravelTime: air_segment["air:FlightDetails"]["TravelTime"],
                                Distance: air_segment["air:FlightDetails"]["Distance"],
                            },
                        });
                    }

                    if (getPropValue(air_segment, 'air:Connection')) {
                        Object.assign(AirSegmentTemp, { Connection: air_segment['air:Connection'] });
                    }
                    // AirSegmentTempArray.push(AirSegmentTemp);
                    air_pricing_info_booking_arr['AirSegment'].push(AirSegmentTemp);
                }
            }
            // Object.assign(air_pricing_info_booking_arr, { AirSegment: AirSegmentTempArray });
        }

        const booking_traveller_key = [];
        for (let i = 0; i < AirPricingInfoLength; i++) {
            const p_info = AirPricingInfo[i];
            const PassengerType = this.forceObjectToArray(p_info["air:PassengerType"]);
            let BasePrice = 0;
            let Taxes = 0;
            let TotalPrice = 0;
            let Fees = 0;
            const PaxCount = PassengerType.length;

            for (let i = 0; i < PaxCount; i++) {
                const pass_type = PassengerType[i];
                booking_traveller_key.push({
                    Code: pass_type["Code"],
                    Key: pass_type["BookingTravelerRef"] || "",
                });
            }
            const TaxInfo = this.forceObjectToArray(p_info["air:TaxInfo"]);
            const TaxInfoLength = TaxInfo.length;
            for (let k = 0; k < TaxInfoLength; k++) {
                const t_info = TaxInfo[k];
                if (TaxBreakupDetails[t_info["Category"]]) {
                    TaxBreakupDetails[t_info["Category"]] +=
                        this.getPrice(t_info["Amount"]) * PaxCount;
                } else {
                    TaxBreakupDetails[t_info["Category"]] =
                        this.getPrice(t_info["Amount"]) * PaxCount;
                }
            }
            if (p_info["EquivalentBasePrice"]) {
                BasePrice = this.getPrice(p_info["EquivalentBasePrice"]);
            } else if (p_info["ApproximateBasePrice"]) {
                BasePrice = this.getPrice(p_info["ApproximateBasePrice"]);
            } else {
                BasePrice = this.getPrice(p_info["BasePrice"]);
            }

            if (p_info["ApproximateTaxes"]) {
                Taxes = this.getPrice(p_info["ApproximateTaxes"]);
            } else {
                if (p_info["Taxes"]) {
                    Taxes = this.getPrice(p_info["Taxes"]);
                }
            }
            if (p_info["ApproximateFees"]) {
                Fees = this.getPrice(p_info["ApproximateFees"]);
            } else {
                if (p_info["Fees"]) {
                    Fees = this.getPrice(p_info["Fees"]);
                }
            }
            // const PassengerTypeCode =
            //     PassengerType[0]["Code"] == "CNN" ? "CHD" : PassengerType[0]["Code"];
            // PassengerBreakup[PassengerTypeCode] = {
            //     BasePrice: BasePrice,
            //     Tax: Taxes + Fees,
            //     TotalPrice: BasePrice + Taxes + Fees,
            //     PassengerCount: PaxCount,
            // };

            for (const passenger of PassengerType) {
                let passengerCode = passenger["Code"];
                passengerCode = passengerCode == "CNN" ? "CHD" : passengerCode;
                let priceInfo = { BasePrice: BasePrice, Tax: 0, TotalPrice: 0, PassengerCount: 0 };
                switch (passengerCode) {
                    case "ADT":

                        PassengerBreakup[passengerCode] = PassengerBreakup[passengerCode] || priceInfo;
                        PassengerBreakup[passengerCode].Tax = Taxes + Fees;
                        PassengerBreakup[passengerCode].TotalPrice = BasePrice + Taxes + Fees;
                        PassengerBreakup[passengerCode].PassengerCount++;
                        break;
                    case "CHD":

                        PassengerBreakup[passengerCode] = PassengerBreakup[passengerCode] || priceInfo;
                        PassengerBreakup[passengerCode].Tax = Taxes + Fees;
                        PassengerBreakup[passengerCode].TotalPrice = BasePrice + Taxes + Fees;
                        PassengerBreakup[passengerCode].PassengerCount++;
                        break;
                    case "INF":

                        PassengerBreakup[passengerCode] = PassengerBreakup[passengerCode] || priceInfo;
                        PassengerBreakup[passengerCode].Tax = Taxes + Fees;
                        PassengerBreakup[passengerCode].TotalPrice = BasePrice + Taxes + Fees;
                        PassengerBreakup[passengerCode].PassengerCount++;
                        break;
                }
            }

            const fare_info_response = this.forceObjectToArray(
                p_info["air:FareInfo"]
            );
            const FareInfo = { FareInfo: [] };
            if (fare_info_response.length) {
                const fare_info_responseLength = fare_info_response.length;

                for (let i = 0; i < fare_info_responseLength; i++) {
                    const fare_infor = fare_info_response[i];
                    const FareInfoTemp = {
                        Key: fare_infor["Key"],
                        FareBasis: fare_infor["FareBasis"],
                        PassengerTypeCode: fare_infor["PassengerTypeCode"],
                        Origin: fare_infor["Origin"],
                        Destination: fare_infor["Destination"],
                        EffectiveDate: fare_infor["EffectiveDate"],
                        DepartureDate: fare_infor["DepartureDate"],
                        Amount: fare_infor["Amount"],
                    };
                    if (
                        fare_infor["NotValidBefore"] &&
                        fare_infor["NotValidBefore"] != ""
                    ) {
                        FareInfoTemp["NotValidBefore"] = fare_infor["NotValidBefore"];
                    }
                    if (
                        fare_infor["NotValidAfter"] &&
                        fare_infor["NotValidAfter"] != ""
                    ) {
                        FareInfoTemp["NotValidAfter"] = fare_infor["NotValidAfter"];
                    }
                    if (fare_infor["air:FareRuleKey"]) {
                        FareInfoTemp["FareRuleKey"] = {
                            FareInfoRef: fare_infor["air:FareRuleKey"]["FareInfoRef"],
                            ProviderCode: fare_infor["air:FareRuleKey"]["ProviderCode"],
                            $t: fare_infor["air:FareRuleKey"]["$t"],
                        };
                    }
                    if (fare_infor["air:FareTicketDesignator"]) {
                        FareInfoTemp["FareTicketDesignator"] = {
                            Value: fare_infor["air:FareTicketDesignator"]["Value"]

                        };
                    }
             
                    FareInfo["FareInfo"].push(FareInfoTemp);
                }
            }
            const fare_booking_info_Res = this.forceObjectToArray(p_info["air:BookingInfo"]);
            const fare_booking_info_ResLength = fare_booking_info_Res.length;
            const BookingInfo = { BookingInfo: [] };
            if (fare_booking_info_ResLength) {
                for (let i = 0; i < fare_booking_info_ResLength; i++) {
                    const booking_info_d = fare_booking_info_Res[i];
                    const BookingInfoTemp = {
                        BookingCode: booking_info_d["BookingCode"],
                        CabinClass: booking_info_d["CabinClass"],
                        FareInfoRef: booking_info_d["FareInfoRef"],
                        SegmentRef: booking_info_d["SegmentRef"],
                        HostTokenRef: booking_info_d["HostTokenRef"]
                    };
                    BookingInfo["BookingInfo"].push(BookingInfoTemp);
                }
            }
            const fare_air_pass_info = this.forceObjectToArray(p_info["air:PassengerType"]);
            const fare_air_pass_infoLength = fare_air_pass_info.length;
            let PassengerTypeTemp: any = undefined;
            if (fare_air_pass_infoLength) {
                PassengerTypeTemp = [];
                for (let i = 0; i < fare_air_pass_infoLength; i++) {
                    if (fare_air_pass_info[i]["Code"]) {
                        PassengerTypeTemp.push({
                            Code: fare_air_pass_info[i]["Code"],
                            BookingTravelerRef: i,
                        });
                    }
                }
            }


            let ChangePenaltyTemp = undefined;
            if (p_info["air:ChangePenalty"]) {
                const ChangePenalty = this.forceObjectToArray(p_info["air:ChangePenalty"]);
                if (ChangePenalty[0]["air:Amount"]) {
                    ChangePenaltyTemp = { Amount: { $t: ChangePenalty[0]["air:Amount"] } };
                }
                if (ChangePenalty[0]["air:Percentage"]) {
                    ChangePenaltyTemp = { Percentage: { $t: ChangePenalty[0]["air:Percentage"] } };
                }
            }
            let CancelPenaltyTemp = undefined;
            if (p_info["air:CancelPenalty"]) {
                const CancelPenalty = this.forceObjectToArray(p_info["air:CancelPenalty"]);
                if (CancelPenalty[0]["air:Amount"]) {
                    CancelPenaltyTemp = { Amount: { $t: CancelPenalty[0]["air:Amount"] } };
                }
                if (CancelPenalty[0]["air:Percentage"]) {
                    CancelPenaltyTemp = { Percentage: { $t: CancelPenalty[0]["air:Percentage"] } };
                }
            }

            let BaggageAllowancesTemp = undefined;
            if (p_info["air:BaggageAllowances"]) {
                BaggageAllowancesTemp = {};
                const BaggageAllowanceInfo = this.forceObjectToArray(p_info["air:BaggageAllowances"]["air:BaggageAllowanceInfo"]);
                const BaggageAllowanceInfoArray = [];
                for (let i = 0; i < BaggageAllowanceInfo.length; i++) {
                    const TextInfoText = this.forceObjectToArray(BaggageAllowanceInfo[i]["air:TextInfo"]["air:Text"]);
                    const TextInfoTextArray = [];
                    for (let j = 0; j < TextInfoText.length; j++) {
                        TextInfoTextArray.push({
                            Text: { $t: TextInfoText[j] },
                        });
                    }
                    const BagDetails = this.forceObjectToArray(BaggageAllowanceInfo[i]["air:BagDetails"]);
                    const BagDetailsArray = [];
                    for (let k = 0; k < BagDetails.length; k++) {
                        BagDetailsArray.push({
                            ApplicableBags: BagDetails[k]["ApplicableBags"],
                            BaggageRestriction: {
                                TextInfo: {
                                    Text: {
                                        $t: BagDetails[k]["air:BaggageRestriction"]["air:TextInfo"]["air:Text"]
                                    }
                                }
                            }
                        });
                    }
                    let URLInfo = undefined;
                    if (BaggageAllowanceInfo[i]["air:URLInfo"]) {
                        URLInfo = {};
                        URLInfo["URL"] = { $t: BaggageAllowanceInfo[i]["air:URLInfo"]["air:URL"] };
                    }
                    const BaggageAllowanceInfoFinal = {
                        TravelerType: BaggageAllowanceInfo[i]["TravelerType"],
                        Origin: BaggageAllowanceInfo[i]["Origin"],
                        Destination: BaggageAllowanceInfo[i]["Destination"],
                        Carrier: BaggageAllowanceInfo[i]["Carrier"],
                        URLInfo: URLInfo,
                        TextInfo: TextInfoTextArray,
                        BagDetails: BagDetailsArray,
                    };
                    BaggageAllowanceInfoArray.push(BaggageAllowanceInfoFinal);
                }

                BaggageAllowancesTemp["BaggageAllowanceInfo"] = BaggageAllowanceInfoArray;

                if (p_info["air:BaggageAllowances"]["air:CarryOnAllowanceInfo"]) {
                    const CarryOnAllowanceInfo = this.forceObjectToArray(p_info["air:BaggageAllowances"]["air:CarryOnAllowanceInfo"]);
                    const CarryOnAllowanceInfoArray = [];
                    for (let i = 0; i < CarryOnAllowanceInfo.length; i++) {
                        const TextInfoText = this.forceObjectToArray(CarryOnAllowanceInfo[i]["air:TextInfo"]["air:Text"]);
                        const TextInfoTextArray = [];
                        for (let j = 0; j < TextInfoText.length; j++) {
                            TextInfoTextArray.push({
                                Text: { $t: TextInfoText[j] },
                            });
                        }
                        const CarryOnDetails = this.forceObjectToArray(CarryOnAllowanceInfo[i]["air:CarryOnDetails"]);
                        const CarryOnDetailsArray = [];
                        for (let k = 0; k < CarryOnDetails.length; k++) {
                            CarryOnDetailsArray.push({
                                ApplicableCarryOnBags:
                                    CarryOnDetails[k]["ApplicableCarryOnBags"],
                                BaggageRestriction: {
                                    TextInfo: {
                                        Text: { $t: CarryOnDetails[k]["air:BaggageRestriction"]["air:TextInfo"]["air:Text"] }
                                    }
                                }
                            });
                        }
                        const CarryOnAllowanceInfoFinal = {
                            Origin: CarryOnAllowanceInfo[i]["Origin"],
                            Destination: CarryOnAllowanceInfo[i]["Destination"],
                            Carrier: CarryOnAllowanceInfo[i]["Carrier"],
                            TextInfo: TextInfoTextArray,
                            CarryOnDetails: CarryOnDetailsArray,
                        };
                        CarryOnAllowanceInfoArray.push(CarryOnAllowanceInfoFinal);
                    }
                    BaggageAllowancesTemp["CarryOnAllowanceInfo"] = CarryOnAllowanceInfoArray;
                }
            }

            air_pricing_info_booking_arr["AirPricingInfo"].push({
                Key: p_info["Key"],
                TotalPrice: p_info["TotalPrice"],
                BasePrice: p_info["BasePrice"],
                ApproximateTotalPrice: p_info["ApproximateTotalPrice"],
                ApproximateBasePrice: p_info["ApproximateBasePrice"],
                EquivalentBasePrice: p_info["EquivalentBasePrice"],
                ApproximateTaxes: p_info["ApproximateTaxes"],
                Taxes: p_info["Taxes"],
                LatestTicketingTime: p_info["LatestTicketingTime"],
                PricingMethod: p_info["PricingMethod"],
                IncludesVAT: p_info["IncludesVAT"],
                ETicketability: p_info["ETicketability"],
                PlatingCarrier: p_info["PlatingCarrier"],
                ProviderCode: p_info["ProviderCode"],
                FareInfo: FareInfo["FareInfo"],
                BookingInfo: BookingInfo["BookingInfo"],
                TaxInfo: getPropValue(p_info, 'air:TaxInfo'),
                FareCalc: getPropValue(p_info, 'air:FareCalc'),
                PassengerType: PassengerTypeTemp,
                ChangePenalty: ChangePenaltyTemp,
                CancelPenalty: CancelPenaltyTemp,
                BaggageAllowances: BaggageAllowancesTemp
            });
        }

        Object.assign(air_pricing_sol["AirPricingSolution"], air_pricing_info_booking_arr);
        /* const FareNote = this.forceObjectToArray(AirPriceResult["air:FareNote"]);
        Object.assign(air_pricing_sol["AirPricingSolution"], {FareNote: FareNote}); */

        const HostToken = this.forceObjectToArray(AirPriceResult["common_" + TRAVELPORT_VERSION + ":HostToken"]);
        const HostTokenArray = [];
        const HostTokenKeyArray = [];
        for (let i = 0; i < HostToken.length; i++) {
            if (!HostTokenKeyArray.includes(HostToken[i]['Key'])) {
                HostTokenKeyArray.push(HostToken[i]['Key'])
                HostTokenArray.push({
                    xmlns: TRAVELPORT_SCHEMA,
                    Key: HostToken[i]['Key'],
                    '$t': HostToken[i]['$t']
                });
            }
        }
        Object.assign(air_pricing_sol["AirPricingSolution"], { HostToken: HostTokenArray });

        let display_price = this.getPrice(AirPriceResult["ApproximateTotalPrice"]);
        const total_tax = this.getPrice(AirPriceResult["ApproximateTaxes"]) + this.getPrice(AirPriceResult["ApproximateFees"]);
        const approx_base_price = this.getPrice(AirPriceResult["ApproximateBasePrice"]);
        const RBD_array = [];
        const BookingInfo = this.forceObjectToArray(AirPricingInfo[0]["air:BookingInfo"]);
        const BookingInfoLength = BookingInfo.length;
        let FareType = AirPricingInfo[0]["air:FareInfo"]["FareFamily"]
            ? AirPricingInfo[0]["air:FareInfo"]["FareFamily"]
            : "Regular Fare";
        for (let j = 0; j < BookingInfoLength; j++) {
            const b_info = BookingInfo[j];
            RBD_array.push(b_info["BookingCode"]);
        }
        const RBD = RBD_array.join(", ");
        const TaxDetails = this.tax_breakup(TaxBreakupDetails);


        //Add Commission Start
        let airlineMarkupAndCommission = {};
        let search_data = previousData['SearchData'];

        if (searchData.UserType == "B2B") {
            if (AirPriceResult['air:AirPricingInfo']['PlatingCarrier']) {
                search_data["AirlineCode"] = AirPriceResult['air:AirPricingInfo']['PlatingCarrier'];
            } else {
                search_data["AirlineCode"] = AirPriceResult['air:AirPricingInfo'][0]['PlatingCarrier'];
            }
        }
        
        const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(search_data);
        airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(search_data, markupAndCommission);
 
        const is_domestic = await this.flightDbService.flightType(previousData['SearchData'])
        //Add Commission End
        const PriceInfo = await this.flightDbService.formatPriceDetail(
            searchData.UserId,
            searchData.UserType,
            CurrencyType,
            display_price,
            approx_base_price,
            total_tax,
            0,
            0,
            RBD,
            TaxDetails,
            FareType,
            PassengerBreakup,
            airlineMarkupAndCommission,
            AirPriceResult['air:AirPricingInfo']['PlatingCarrier'],
            is_domestic,
            'farequote'
        );
        const FlightInfo = {};

        // const parser = require("xml2json");
        // const xml = parser.toXml(JSON.stringify(air_pricing_sol));
         const xml = this.jsonToXml(JSON.stringify(air_pricing_sol));
        
        const key_data = {
            key: {
                price_xml: xml,
                Air_segment_key_list: flight_air_seg_key_array,
                Booking_traveller_list: booking_traveller_key,
            },
        };

        let SelectedCurrencyPriceDetails = {};
        if (previousData["SearchData"]["Currency"]) {
            if (previousData["SearchData"]["Currency"] != 'GBP') {
                SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(previousData["SearchData"]["Currency"], PriceInfo);
            } else {
                SelectedCurrencyPriceDetails = PriceInfo;
            }
        }

        delete previousData["FlightList"];
        previousData["KeyData"] = key_data;
        previousData["JourneyList"] = {};
        previousData["JourneyList"][0] = {};
        previousData["JourneyList"][0][0] = {};
        previousData["JourneyList"][0][0]["FlightDetails"] =
            previousData["FlightInfo"]["FlightDetails"];
        previousData["JourneyList"][0][0]["Price"] = PriceInfo;
        previousData["JourneyList"][0][0]["Exchange_Price"] = SelectedCurrencyPriceDetails;
        FlightInfo["FlightDetails"] = previousData["FlightInfo"]["FlightDetails"];
        FlightInfo["Price"] = PriceInfo;
        FlightInfo["Exchange_Price"] = SelectedCurrencyPriceDetails;

        // const Refundable = air_pricing_info[0]["Refundable"] ? 1 : 0;
        FlightInfo["Attr"] = { IsRefundable: 0, AirlineRemark: "", is_usa: false };
        const CabinClass = getPropValue(previousData["SearchData"]["Segments"][0], 'CabinClass') || getPropValue(previousData["SearchData"]["Segments"][0], 'CabinClassOnward');
        FlightInfo["JourneyType"] = previousData["SearchData"]["JourneyType"];
        FlightInfo["CabinClass"] = CabinClass;
        previousData['xml']=xmlResponse;
        const token = this.redisServerService.geneateResultToken(searchData);
        const ResultToken = await this.redisServerService.insert_record(
            token,
            JSON.stringify(previousData)
        );
        FlightInfo["ResultToken"] = ResultToken["access_key"];
        FlightInfo["booking_source"] = TRAVELPORT_FLIGHT_BOOKING_SOURCE;

        /* const FlightDataList = { JourneyList: [] };
        FlightDataList["JourneyList"][0] = [];
        FlightDataList["JourneyList"][0][0] = FlightInfo; */
        return { UpdateFareQuote: { FareQuoteDetails: { JourneyList: FlightInfo, SearchData: previousData.SearchData } } };
    }

    async seatAvailabilityDataFormat(data: any) {
        const parsedSeatMaps: any = {};

        await Promise.all(
            data.map(async (seatMap: any) => {
                console.log(seatMap);
                const seatMapRsp = seatMap["SOAP:Envelope"]["SOAP:Body"]["air:SeatMapRsp"];
                const rowsData = seatMapRsp?.["air:Rows"]?.["air:Row"];
                const airSegmentData = seatMapRsp?.["air:AirSegment"];

                if (!rowsData || !airSegmentData) {
                    return;
                }

                const seatCodesAndAvailabilityPromises = rowsData.map(async (row: any) => {
                    const seatFacilities = row['air:Facility']?.filter((facility: any) =>
                        facility.Type === 'Seat' || facility.Type === 'Aisle'
                    );
                    let previousRowNumber: any;
                    let previousSeatLetter: any
                    const seatData: any = {};

                    for (const [index, facility] of seatFacilities.entries()) {
                       
                        if (facility.Type === 'Seat') {
                            const [rowNumber, seatLetter] = facility.SeatCode.split('-');
                            previousRowNumber = rowNumber;
                            previousSeatLetter = seatLetter;
                            const token = await this.redisServerService.geneateResultToken(seatFacilities);
                            const resultToken = await this.redisServerService.insert_record(
                                token,
                                JSON.stringify(facility)
                            );

                            if (!seatData[rowNumber]) {
                                seatData[rowNumber] = {};
                            }
                            seatData[rowNumber][seatLetter] = {
                                type: facility.Type,
                                SeatCode: facility.SeatCode,
                                seatAvailability:
                                    facility.Availability === 'Blocked'
                                        ? 'Blocked'
                                        : facility.Availability === 'Occupied'
                                            ? 'Occupied'
                                            : facility.Availability === 'Available'
                                                ? 'Available'
                                                : facility.Availability === 'NoSeat'
                                                    ? 'NoSeat'
                                                    : 'NotExist',
                                Paid: facility.Paid === 'true' ? 1 : 0,
                                seat_charge: facility.SeatCharge ?? '0 GBP',
                                Aisle: 0,
                                ResultToken: resultToken['access_key'],
                                characteristics: Array.isArray(facility['air:Characteristic'])
                                    ? facility['air:Characteristic'].map((characteristic: any) => ({
                                        code: characteristic.PADISCode,
                                        description: characteristic.Value
                                    }))
                                    : []
                            };
                        } else if (facility.Type === 'Aisle') {
                            const seatLetter = `${previousSeatLetter}2`;
                            if (!seatData[previousRowNumber]) {
                                seatData[previousRowNumber] = {};
                            }
                            seatData[previousRowNumber][seatLetter] = {
                                seatAvailability: 'NotExist',
                                Aisle: 1,
                                characteristics: [{ code: 'A', description: "Aisle" }]
                            };
                        }
                    }
                    return seatData;
                });

                const seatCodesAndAvailability = await Promise.all(seatCodesAndAvailabilityPromises);

                const { Carrier, FlightNumber, Origin, Destination } = airSegmentData;
                const key = `${Carrier},${FlightNumber},${Origin},${Destination}`;
                parsedSeatMaps[key] = Object.assign({}, ...seatCodesAndAvailability);
            })
        );
        return { seat_map: parsedSeatMaps };
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
        return result;
    }
    async formatReservationResponse(soapEnvelope: any, searchData: any, commitBookingDataParsed: any): Promise<any> {
        const AirReservation = soapEnvelope["SOAP:Body"]["universal:AirCreateReservationRsp"]["universal:UniversalRecord"]["air:AirReservation"];
        if (
            getPropValue(AirReservation, "LocatorCode")
        ) {
            const pnr = soapEnvelope["SOAP:Body"]["universal:AirCreateReservationRsp"]["universal:UniversalRecord"]["LocatorCode"];
            let airline_pnr = '';
            if (AirReservation["common_" + TRAVELPORT_VERSION + ":SupplierLocator"] != undefined) {
                airline_pnr = AirReservation["common_" + TRAVELPORT_VERSION + ":SupplierLocator"]["SupplierLocatorCode"] ? AirReservation["common_" + TRAVELPORT_VERSION + ":SupplierLocator"]["SupplierLocatorCode"] : '';
            }
            const gds_pnr = soapEnvelope["SOAP:Body"]["universal:AirCreateReservationRsp"]["universal:UniversalRecord"]["universal:ProviderReservationInfo"]["LocatorCode"];
            const booking_status = "BOOKING_HOLD";
            const graphQuery = `{
        flightBookingTransactionPassengers(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
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
        	flightBookings(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
		email
        phone
        phone_code

        }
      }`;
            const Passenger = await this.getGraphData(
                graphQuery2,
                "flightBookings"
            );
            if (PassengerDetails.length) {
                for (let i = 0; i < PassengerDetails.length; i++) {
                    PassengerDetails[i]['Email'] = Passenger[0]['email'];
                    const query1 = `SELECT from_airport_code as FromAirportCode, to_airport_code as ToAirportCode, airline_code as AirlineCode, flight_number as FlightNumber, price as Price, code as Code from flight_booking_seats fbs where flight_booking_passenger_id = ${PassengerDetails[i].PassengerId}`;
                    let seatData = await this.manager.query(query1);
                    PassengerDetails[i]['SeatInfo'] = seatData ? seatData : [];
                }
            }

            let Baggage = []

            let last_date = '';
            if (soapEnvelope['SOAP:Body']['universal:AirCreateReservationRsp']['universal:UniversalRecord']['air:AirReservation']['air:AirPricingInfo'] != undefined) {
                const AirPricingInfoArray = this.forceObjectToArray(soapEnvelope['SOAP:Body']['universal:AirCreateReservationRsp']['universal:UniversalRecord']['air:AirReservation']['air:AirPricingInfo']);
                const Date_FareInfo = this.forceObjectToArray(AirPricingInfoArray[0]["air:FareInfo"]);
                if (Date_FareInfo[0]['EffectiveDate'] != undefined) {
                    last_date = formatVoucherDate(Date_FareInfo[0]['EffectiveDate']);
                } else {
                    last_date = formatVoucherDate(AirPricingInfoArray[0]["TrueLastDateToTicket"]);
                }
            }

            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_HOLD" ,
			AirReservationLocatorCode = "${AirReservation['LocatorCode']}" ,
			UniversalRecordLocatorCode = "${pnr}" ,
            LastDateToTicket = "${last_date}"
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_HOLD" ,
			pnr = "${pnr}",
			gds_pnr = "${gds_pnr}" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_HOLD" ,
			airline_pnr = "${airline_pnr}"
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);
            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_HOLD",
                        BookingAppReference: searchData["AppReference"],
                        BookingId: searchData["AppReference"],
                        PNR: airline_pnr,
                        GDSPNR: gds_pnr,
                        AirReservationLocatorCode: AirReservation['LocatorCode'],
                        UniversalRecordLocatorCode: pnr,
                        LastDateToTicket: last_date,
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code

                        },
                        Baggage,
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: {
                                Details: commitBookingDataParsed['FlightInfo']['FlightDetails']['Details'],
                            },
                        },
                        Price: commitBookingDataParsed['JourneyList'][0][0]['Exchange_Price'],
                        Attr: "",
                        booking_source: TRAVELPORT_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
        } else {
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBooking",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransaction",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransactionItinerary",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransactionPassenger",
                { booking_status: "BOOKING_FAILED" }
            );
            return false;
        }
    }

    async formatCancelBookingResponse(
        soapEnvelope: any,
        searchData: any
    ): Promise<any> {
        return true;
    }

    async formatTicketingRequestResponse(soapEnvelope: any, searchData: any): Promise<any> {
        let ticker_res = this.forceObjectToArray(soapEnvelope['air:ETR']);
        let flag = 0;
        for (let i = 0; i < ticker_res.length; i++) {
            let f_name = ticker_res[i]['common_v51_0:BookingTraveler']['common_v51_0:BookingTravelerName']['First'];
            const query1 = `UPDATE flight_booking_transaction_passengers SET 
            booking_status = "BOOKING_CONFIRMED" ,
         
            ticket_no = "${ticker_res[i]['air:Ticket']['TicketNumber']}" 
            WHERE full_name="${f_name}" 
            and last_name="${ticker_res[i]['common_v51_0:BookingTraveler']['common_v51_0:BookingTravelerName']['Last']}" 
            and app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            flag = 1;
        }
        // ticket_issue_date = CURRENT_TIMESTAMP, 
        if (flag == 1) {
            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_CONFIRMED",
           
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_CONFIRMED" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_CONFIRMED" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);
        }
        // ticket_issue_date = CURRENT_TIMESTAMP 
        return soapEnvelope;
    }

    async formatPnrRetrieveResponse(soapEnvelope: any, searchData: any, is_ticketed: any): Promise<any> {

        const AirReservation = soapEnvelope["SOAP:Body"]["universal:UniversalRecordRetrieveRsp"]["universal:UniversalRecord"]["air:AirReservation"];

        if (
            getPropValue(AirReservation, "LocatorCode")
        ) {
            const pnr = soapEnvelope["SOAP:Body"]["universal:UniversalRecordRetrieveRsp"]["universal:UniversalRecord"]["LocatorCode"];
            let airline_pnr = '';
            if (AirReservation["common_" + TRAVELPORT_VERSION + ":SupplierLocator"] != undefined) {
                airline_pnr = AirReservation["common_" + TRAVELPORT_VERSION + ":SupplierLocator"]["SupplierLocatorCode"] ? AirReservation["common_" + TRAVELPORT_VERSION + ":SupplierLocator"]["SupplierLocatorCode"] : '';
            }
            const gds_pnr = soapEnvelope["SOAP:Body"]["universal:UniversalRecordRetrieveRsp"]["universal:UniversalRecord"]["universal:ProviderReservationInfo"]["LocatorCode"];

            const graphQuery = `{
        flightBookingTransactionPassengers(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
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
    //   TicketIssueDate: ticket_issue_date

            const transactionDetails = await this.getGraphData(`{
        flightBookingTransactions( where:{
          app_reference:{
            eq:"${searchData["AppReference"]}"
          }
        }){
          attributes
        }
      }`, `flightBookingTransactions`)
            let transactionDetailsParsed = JSON.parse(transactionDetails[0].attributes.replace(/'/g, '"'))
            //   console.log("###Transaction Check Data",transactionDetailsParsed)

            const PassengerDetails = await this.getGraphData(
                graphQuery,
                "flightBookingTransactionPassengers"
            );

            const graphQuery2 = `{
        	flightBookings(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
		email
        phone
        phone_code
        booking_status
        
        }
      }`;
    //   ticket_issue_date
            const Passenger = await this.getGraphData(
                graphQuery2,
                "flightBookings"
            );
            if (PassengerDetails.length) {
                for (let i = 0; i < PassengerDetails.length; i++) {
                    PassengerDetails[i]['Email'] = Passenger[0]['email'];
                }
            }
            const JourneyTemp = this.forceObjectToArray(soapEnvelope['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['air:AirReservation']['air:AirSegment']);

            this.AirportCodeList = [];
            this.AirlineCodeList = [];
            for (let i = 0; i < JourneyTemp.length; i++) {
                if (!this.AirportCodeList.includes(JourneyTemp[i]['Origin'])) {
                    this.AirportCodeList.push(JourneyTemp[i]['Origin']);
                }
                if (!this.AirportCodeList.includes(JourneyTemp[i]['Destination'])) {
                    this.AirportCodeList.push(JourneyTemp[i]['Destination']);
                }
                if (!this.AirlineCodeList.includes(JourneyTemp[i]['Carrier'])) {
                    this.AirlineCodeList.push(JourneyTemp[i]['Carrier']);
                }
            }
            this.airport_codes = await this.getAirports();
            this.airline_codes = await this.getAirlines();

            const JourneyArray = [];
            for (let i = 0; i < JourneyTemp.length; i++) {
                let Equipment = JourneyTemp[i]["Equipment"] || "";
                if (Equipment != "") {
                    let first_c = Equipment.substr(0, 1);
                    if (first_c == "7") {
                        Equipment = "BOEING - " + Equipment;
                    } else if (first_c == "3") {
                        Equipment = "AIRBUS - " + Equipment;
                    }
                }
                const Origin = JourneyTemp[i]['Origin'];
                const Destination = JourneyTemp[i]['Destination'];
                const tempAirportOrigin = this.airport_codes.find((t) => t.code === Origin) || {};
                const OriginCityName = tempAirportOrigin['city'] || Origin;
                const OriginAirportName = tempAirportOrigin['name'] || Origin;
                const tempAirportDestination = this.airport_codes.find((t) => t.code === Destination) || {};
                const DestinationCityName = tempAirportDestination['city'] || Destination;
                const DestinationAirportName = tempAirportDestination['name'] || Destination;
                const Carrier = JourneyTemp[i]['Carrier'];
                const tempAirline = this.airline_codes.find((t) => t.code == Carrier) || {};
                const OperatorName = tempAirline['name'] || Carrier;
                JourneyArray.push({
                    Origin: {
                        AirportCode: Origin,
                        CityName: OriginCityName,
                        AirportName: OriginAirportName,
                        DateTime: formatSearchDate(JourneyTemp[i]['DepartureTime']),
                        FDTV: '',
                        Terminal: getPropValue(JourneyTemp[i]['air:FlightDetails'], 'OriginTerminal'),
                    },
                    Destination: {
                        AirportCode: Destination,
                        CityName: DestinationCityName,
                        AirportName: DestinationAirportName,
                        DateTime: formatSearchDate(JourneyTemp[i]['ArrivalTime']),
                        FATV: '',
                        Terminal: getPropValue(JourneyTemp[i]['air:FlightDetails'], 'DestinationTerminal'),
                    },
                    AirlinePNR: airline_pnr,
                    OperatorCode: Carrier,
                    DisplayOperatorCode: Carrier,
                    OperatorName,
                    Equipment,
                    FlightNumber: getPropValue(JourneyTemp[i], 'FlightNumber'),
                    CabinClass: getPropValue(JourneyTemp[i], 'CabinClass'),
                    Attr: "",
                    booking_source: TRAVELPORT_FLIGHT_BOOKING_SOURCE
                });
            }

            let LastDateToTicket = '';
            if (soapEnvelope['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['air:AirReservation']['air:AirPricingInfo'] != undefined) {
                const AirPricingInfoArray = this.forceObjectToArray(soapEnvelope['SOAP:Body']['universal:UniversalRecordRetrieveRsp']['universal:UniversalRecord']['air:AirReservation']['air:AirPricingInfo']);
                const CurrencyType = this.getCurrencyCode(AirPricingInfoArray[0]["TotalPrice"]);
                const Date_FareInfo = this.forceObjectToArray(AirPricingInfoArray[0]["air:FareInfo"]);

                if (Date_FareInfo[0]['EffectiveDate'] != undefined) {
                    LastDateToTicket = Date_FareInfo[0]['EffectiveDate'];
                } else {
                    LastDateToTicket = AirPricingInfoArray[0]["TrueLastDateToTicket"];
                }
            }


            let booking_status = Passenger[0].booking_status;
            if (is_ticketed == true) {
                booking_status = "BOOKING_CONFIRMED";
            }
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            airline_pnr = "${airline_pnr}"
            WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);

            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: booking_status,
                        BookingAppReference: searchData["AppReference"],
                        BookingId: searchData["AppReference"],
                        PNR: airline_pnr,
                        GDSPNR: gds_pnr,
                        LastDateToTicket,
                        
                        AirReservationLocatorCode: AirReservation['LocatorCode'],
                        UniversalRecordLocatorCode: pnr,
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code

                        },
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: {
                                Details: [JourneyArray],
                            },
                        },
                        Price: transactionDetailsParsed,

                        Attr: "",
                        booking_source: TRAVELPORT_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
            // TicketIssueDate: Passenger[0].ticket_issue_date,
        } else {

            return false;
        }
    }

    async formatFareRuleResponse(arrfare_result: any, redisData: any): Promise<any> {
        /* const seg_info = [];
        for(const segment_data of redisData['FlightList']){
            for(const segment of segment_data['flight_detail']){
                seg_info.push(segment);
            }
        }
        const arrFareRule = this.forceObjectToArray(arrfare_result['air:AirFareRulesRsp']['air:FareRule']);
        const arrFareData = [];
        const fareResp1 = [];
        let FareRules = 'TP';
        let FareRuleDetail = '';
        for (let fr = 0; fr < arrFareRule.length; fr++) {
            const freRule = this.forceObjectToArray(arrFareRule[fr]['air:FareRuleLong']);
            const seg_count = redisData['FlightList'][fr]['flight_detail'].length;
            fareResp1[fr] = {
                Origin: seg_info[fr]['origin'],
                Destination: seg_info[fr]['destination'],
                Airline: seg_info[fr]['carrier']
            };
            for (let ff = 0; ff < freRule.length; ff++) {
                const { Category, Type } = freRule[ff];
                FareRules += freRule[ff]['$t'] + "<br/>";
                arrFareData[fr][ff] = { fare_category: Category, fare_type: Type };
            }
            fareResp1[fr]['FareRules'] = FareRules;
            FareRuleDetail = '$this->format_fare_rule_response($fareResp1)';
        } */
        let FareRuleResponse = this.forceObjectToArray(arrfare_result['air:AirFareRulesRsp']['air:FareRule'])
        const FareRuleDetail = [];
        for (const FareRules of FareRuleResponse) {
            for (const fr of FareRules['air:FareRuleLong']) {
                FareRuleDetail.push({
                    Category: fr['Category'],
                    Type: fr['Type'],
                    // Description: fr['$t'].replace(/\n/g, '<br/>')
                    Description: nl2br(fr['$t'])
                });
            }
        }
        return FareRuleDetail;
    }

    async removePrefix(obj: any) {
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                if (typeof obj[prop] === "object") {
                    this.removePrefix(obj[prop]);
                }
                if (prop.startsWith("common_v51_0:")) {
                    obj[prop.substring("common_v51_0:".length)] = obj[prop];
                    delete obj[prop];
                } else if (prop.startsWith("universal:")) {
                    obj[prop.substring("universal:".length)] = obj[prop];
                    delete obj[prop];
                } else if (prop.startsWith("air:")) {
                    obj[prop.substring("air:".length)] = obj[prop];
                    delete obj[prop];
                }
            }
        }
        return obj;
    }

    async formatImportPnrResponse(obj: any, body: any): Promise<any> {
      try {
        let result = await this.removePrefix(obj);

        let Address: any = {};
        let PassengerContactDetails: any = {};
        let flightDetails = result['SOAP:Envelope']['SOAP:Body'].UniversalRecordRetrieveRsp.UniversalRecord.AirReservation.AirSegment;
        let price = result['SOAP:Envelope']['SOAP:Body'].UniversalRecordRetrieveRsp.UniversalRecord.AirReservation.AirPricingInfo;
        let passengerData: any = result['SOAP:Envelope']['SOAP:Body'].UniversalRecordRetrieveRsp.UniversalRecord.BookingTraveler;

        passengerData = passengerData.length === undefined? [passengerData] : passengerData;
        const passengersArray = passengerData.map((passenger:any) => {
            const GenderType = ['Mr', 'Mstr'].includes(passenger.BookingTravelerName.Prefix) ? 'Male' : 'Female';

            if (!['Mr', 'Ms', 'Mrs', 'Mstr', 'Miss'].includes(passenger.BookingTravelerName.Prefix)) {
                throw new Error('Prefix is invalid');
            }

            const full_name = passenger.BookingTravelerName?.Middle === ''
                ? `${passenger.BookingTravelerName.First} ${passenger.BookingTravelerName.Middle} ${passenger.BookingTravelerName.Last}`
                : `${passenger.BookingTravelerName.First} ${passenger.BookingTravelerName.Last}`;

            const passengerObject = {
                app_reference: body['AppReference'],
                attributes: "",
                passenger_type: passenger.TravelerType === 'ADT' ? 'Adult' : passenger.TravelerType === 'CNN' ? 'Child' : 'Infant',
                date_of_birth: passenger.DOB,
                title: passenger.BookingTravelerName.Prefix,
                first_name: passenger.BookingTravelerName.First,
                middle_name: passenger.BookingTravelerName.Middle ?? "",
                last_name: passenger.BookingTravelerName.Last,
                gender: GenderType,
                full_name: full_name,
                is_lead: passenger.Address ? 1 : 0,
                passenger_nationality: passenger["CountryCode"] || "",
                passport_number: passenger["PassportNumber"] || "",
                passport_issuing_country: passenger["PassportIssuingCountry"] || "",
                passport_expiry_date: passenger["PassportExpiryDate"] || "",
                booking_status: flightDetails?.Status === "HK" ? "BOOKING_CONFIRMED" : flightDetails[0]?.Status === "HK" ? "BOOKING_CONFIRMED" : "BOOKING_HOLD",
            };

            if (passenger.PhoneNumber) {
                PassengerContactDetails = {
                    Number: passenger?.PhoneNumber?.Number ?? null,
                    Email: passenger?.Email?.EmailID ?? null,
                    PhoneExtension: "+880"
                }
            }

            if (passenger.Address) {
                Address = {
                    Location: passenger.Address.City ? passenger.Address.City["$t"] : null,
                    Street: passenger.Address.Street ? passenger.Address.Street["$t"] : null,
                    City: passenger.Address.City ? passenger.Address.City["$t"] : null,
                    State: passenger.Address.State ? passenger.Address.State["$t"] : null,
                    PostalCode: passenger.Address.PostalCode ? passenger.Address.PostalCode["$t"] : null,
                    Country: passenger.Address.Country ? passenger.Address.Country["$t"] : null,
                };
            }
            return passengerObject;
        });

            let flightDetailsResult:any;
            let data = flightDetails;
        
            const firstSegment = data[0];
            const lastSegment = data[data.length - 1];
        
           if(firstSegment.Origin !== lastSegment.Destination){
             flightDetailsResult = {
                departureTime: firstSegment.DepartureTime,
                startPlace: firstSegment.Origin,
                arrivalTime: lastSegment.ArrivalTime,
                endPlace: lastSegment.Destination,
                journeyType: "Oneway",
              };
           }
           else if(firstSegment.Origin === lastSegment.Destination){
                   
                    if (data.length % 2 === 0) {
                        flightDetailsResult = {
                            departureTime: firstSegment.DepartureTime,
                            startPlace: firstSegment.Origin,
                            arrivalTime: data[(data.length/2)-1].ArrivalTime,
                            endPlace: data[(data.length/2)-1].Destination,
                            journeyType: "Return",
                          };
                    }
                    else if(data.length % 2 === 1){
        
                        flightDetailsResult = {
                            departureTime: firstSegment.DepartureTime,
                            startPlace: firstSegment.Origin,
                            arrivalTime: data[((data.length-1)/2)-1].ArrivalTime,
                            endPlace: data[((data.length-1)/2)-1].Destination,
                            journeyType: "Return",
                          };
                    }
           }
           else{
            flightDetailsResult = {
                departureTime: firstSegment.DepartureTime,
                startPlace: firstSegment.Origin,
                arrivalTime: lastSegment.ArrivalTime,
                endPlace: lastSegment.endPlace,
                journeyType: "multicity",
              };
           }
    
        
        
        const TraceId = result?.['SOAP:Envelope']?.['SOAP:Body']?.UniversalRecordRetrieveRsp;
        let flightDetail = {
            domain_origin: "travelport",
            booking_from: body["BookingFrom"] ?? "",
            app_reference: body['AppReference'],
            booking_source: body["BookingFrom"] ?? "",
            api_code: body["booking_source"] ?? "",
            subagent_id: body["AgentId"] ?? "",
            trip_type: flightDetails.Origin ? "Oneway" : flightDetails[0].Origin !== flightDetails[flightDetails.length - 1].Destination ? "OneWay" : "Return",
            phone_code: PassengerContactDetails.PhoneExtension,
            phone: PassengerContactDetails.Number,
            alternate_number: PassengerContactDetails.Number,
            email: PassengerContactDetails.Email,
            journey_start: flightDetailsResult?.departureTime ,
            journey_end:flightDetailsResult?.arrivalTime ,
            journey_from: flightDetailsResult?.startPlace ,
            journey_to: flightDetailsResult?.endPlace,
            from_loc: "",
            to_loc: "",
            cabin_class: price?.BookingInfo?.CabinClass ?? price[0]?.BookingInfo[0]?.CabinClass ?? price?.BookingInfo[0]?.CabinClass,
            is_lcc: 0,
            payment_mode: result['SOAP:Envelope']?.['SOAP:Body']?.UniversalRecordRetrieveRsp?.UniversalRecord?.FormOfPayment[0]?.Type ?? result['SOAP:Envelope']?.['SOAP:Body']?.UniversalRecordRetrieveRsp?.UniversalRecord?.FormOfPayment?.Type ?? "",
            convinence_value: 0,
            convinence_value_type: "plus",
            convinence_per_pax: 0,
            convinence_amount: 0,
            discount: 0,
            promo_code: "",
            currency: "GBP",
            currency_conversion_rate: 1,
            version: 1,
            attributes: "",
            gst_details: "",
            UniversalRecordLocatorCode:body['PNR'],
            created_by_id: body["UserId"] || "",
            booking_status: flightDetails?.Status === "HK" ? "BOOKING_CONFIRMED" : flightDetails[0]?.Status === "HK" ? "BOOKING_CONFIRMED" : "BOOKING_HOLD",
            BookingTravelerRefObj: JSON.stringify({ TraceId }),
        };
        flightDetails = flightDetails.length == 1|| flightDetails.length === undefined? [flightDetails] : flightDetails;
        const itineraries = await Promise.all(flightDetails.map(async (data:any, index:any) => {
            let checkInBag:any;
            if (price?.FareInfo?.[index]?.BaggageAllowance?.MaxWeight) {
                let checkInBaggage = price.FareInfo?.[index]?.BaggageAllowance?.MaxWeight;
                checkInBag = `${checkInBaggage?.Value} ${checkInBaggage?.Unit}`
            }
            else {
                let baggage_unit = "Piece";
                let baggage_value = price.FareInfo[index]?.BaggageAllowance?.NumberOfPieces?.$t ?? price.FareInfo?.BaggageAllowance?.NumberOfPieces?.$t;
                if (baggage_value > 1) {
                    baggage_unit = "Pieces";
                }
                checkInBag = baggage_value + " " + baggage_unit
            }
            let cabin_static_bag = '9 Kilograms';
            if (data.CabinClass != undefined && (data.CabinClass == "Economy" || data.CabinClass == "economy")) {
                cabin_static_bag = '7 Kilograms';
            }
            const originAirportQuery = `SELECT name FROM flight_airports WHERE code = "${data.Origin}"`;
            const destinationAirportQuery = `SELECT name FROM flight_airports WHERE code = "${data.Destination}"`;
            const airlinrNameQuery = `SELECT name FROM flight_airlines WHERE code = "${data.Carrier}"`;

            const [originAirportResult, destinationAirportResult, airlinrNameResult] = await Promise.all([
                this.manager.query(originAirportQuery),
                this.manager.query(destinationAirportQuery),
                this.manager.query(airlinrNameQuery),
            ]);

            const airline_pnr = body["PNR"].replace(/["']/g, '');
            return {
                app_reference: body['AppReference'],
                airline_pnr: airline_pnr,
                segment_indicator: index,
                airline_code: data.Carrier,
                airline_name: airlinrNameResult[0]?.name || '',
                flight_number: data.FlightNumber,
                fare_class: data.ClassOfService,
                from_airport_code: data.Origin,
                from_airport_name: originAirportResult[0]?.name || '',
                to_airport_code: data.Destination,
                to_airport_name: destinationAirportResult[0]?.name || '',
                departure_datetime: data.DepartureTime,
                arrival_datetime: data.ArrivalTime,
                cabin_baggage: cabin_static_bag,
                checkin_baggage: checkInBag,
                is_refundable: '0',
                equipment: data.Equipment,
                status: data.Status === "HK" ? 1 : 0,
                operating_carrier: data.Carrier,
                FareRestriction: 0,
                FareBasisCode: 0,
                FareRuleDetail: 0,
                attributes: '',
                booking_status: flightDetails?.Status === "HK" ? "BOOKING_CONFIRMED" : flightDetails[0]?.Status === "HK" ? "BOOKING_CONFIRMED" : "BOOKING_HOLD",
                departure_terminal: data?.FlightDetails?.OriginTerminal ?? data.FlightDetails.OriginTerminal ?? "",
                arrival_terminal: data?.FlightDetails?.DestinationTerminal ?? data.FlightDetails.DestinationTerminal ?? "",
            };
        }));

        const total_fare = (price?.TotalPrice ?? result['SOAP:Envelope']['SOAP:Body'].UniversalRecordRetrieveRsp.UniversalRecord?.AirReservation?.Payment?.Amount) || '';
        const cleaned_total_fare = parseFloat(total_fare.replace('GBP', ''));
        const flight_booking_transaction_data = {
            app_reference: body['AppReference'],
            pnr: body.PNR,
            status: flightDetails?.Status === "HK" ? 1 : flightDetails[0]?.Status === "HK" ? 1 : 0,
            status_description: '',
            gds_pnr: '',
            source: '',
            ref_id: '',
            total_fare: cleaned_total_fare,
            admin_commission: 0,
            agent_commission: 0,
            admin_tds: 0,
            agent_tds: 0,
            admin_markup: 0,
            agent_markup: 0,
            currency: "GBP",
            getbooking_StatusCode: '',
            getbooking_Description: '',
            getbooking_Category: '',
            attributes: JSON.stringify(price).replace(/'/g, '"') ?? "",
            sequence_number: "0",
            hold_ticket_req_status: "0",
            created_by_id: body['UserId'] ? body['UserId'] : 0,
        };

        let booking:any = {
            ...flightDetail,
            flightBookingTransactions: [
                {
                    ...flight_booking_transaction_data,
                    flightBookingTransactionItineraries: itineraries,
                    flightBookingTransactionPassengers: passengersArray,
                },
            ],
        };

        let ticketData = TraceId?.UniversalRecord?.AirReservation?.DocumentInfo?.TicketInfo

        let TicketIssueDate:any;
        let ticketNumber:any =[];
        if(ticketData.length >= 1){
        ticketData.map((info:any)=>{
            ticketNumber.push({ Number: info.Number ?? "", Name: info.Name ?? "" });
            TicketIssueDate = info.TicketIssueDate ?? "";
        })
    }


        let CreatedDatetime:any = TraceId?.UniversalRecord?.AirReservation?.SupplierLocator?.CreateDateTime ?? "";
        let BasePrice:any = parseFloat(price?.EquivalentBasePrice.replace('GBP', '')) ?? ""
        let Tax:any = parseFloat(price?.Taxes.replace('GBP', '')) ?? ""
        let TotalPrice:any = parseFloat(price?.TotalPrice.replace('GBP', ''))?? "";
        let advanceTax:any = parseFloat((ADVANCE_TAX_PERCENT * TotalPrice).toFixed(2))?? "";
        let TotalDisplayFare:any = parseFloat(TotalPrice + advanceTax) ?? "";
        let LastDateToTicket:any = price.TrueLastDateToTicket?? "";

        booking = {booking,TicketIssueDate ,ticketNumber,CreatedDatetime,BasePrice,Tax,TotalPrice,advanceTax,TotalDisplayFare,LastDateToTicket}

        const token = this.redisServerService.geneateResultToken(body);
        const ResultToken = await this.redisServerService.insert_record(token,
                        JSON.stringify(booking));

        booking['ResultToken'] = ResultToken.access_key;

        if (booking.booking.domain_origin === 'travelport') {
            return booking;
        } else {
            throw new Error("Data is not formatted!!");
        }
    }
    catch(err){
        throw new Error(`"400 Universal Record has been archived."`)
    }
    }
}
