import { Injectable } from "@nestjs/common";
import { addDayInDate, formatSearchDate, getPropValue, getDuration } from "../../../app.helper";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { SABRE_FLIGHT_BOOKING_SOURCE } from "apps/webservice/src/constants";
import moment from "moment";
import { getExceptionClassByCode } from "../../../all-exception.filter";

@Injectable()
export class SabreTransformService extends FlightApi {
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
        const blockAirlineList = await this.flightDbService.blockAirlineList(SABRE_FLIGHT_BOOKING_SOURCE);
      
        if (result['groupedItineraryResponse']['statistics']['itineraryCount'] != undefined && result['groupedItineraryResponse']['statistics']['itineraryCount'] > 0) {


            const itigroups_data = this.forceObjectToArray(result['groupedItineraryResponse']['itineraryGroups']);
            const legs_data = this.forceObjectToArray(result['groupedItineraryResponse']['legDescs']);
            const schedule_data = this.forceObjectToArray(result['groupedItineraryResponse']['scheduleDescs']);
            const baggage_data = this.forceObjectToArray(result['groupedItineraryResponse']['baggageAllowanceDescs']);
            const taxDescs = this.forceObjectToArray(result['groupedItineraryResponse']['taxDescs']);


            const leg_info = [];
            leg_info[0] = {};
            for (let i = 0; i < legs_data.length; i++) {
                leg_info[legs_data[i]['id']] = legs_data[i]['schedules'];
            }

            const schedule_info = [];
            schedule_info[0] = {};
            for (let i = 0; i < schedule_data.length; i++) {
                schedule_info[schedule_data[i]['id']] = schedule_data[i];
            }

            const baggage_info = [];
            baggage_info[0] = '';
            for (let i = 0; i < baggage_data.length; i++) {
                if (baggage_data[i]['pieceCount'] != undefined) {
                    baggage_info[baggage_data[i]['id']] = baggage_data[i]['pieceCount'] + " Pieces";
                }
                else {
                    baggage_info[baggage_data[i]['id']] = baggage_data[i]['weight'] + " " + baggage_data[i]['unit'];
                }
            }

            for (let itg_key = 0; itg_key < itigroups_data.length; itg_key++) { // itinerari start
                if (itg_key == 0) { // first index start

                    const itineraries = this.forceObjectToArray(itigroups_data[itg_key]['itineraries']);
                    for (let it_key = 0; it_key < itineraries.length; it_key++) { // segment loop
                        const FlightInfo = {};
                        const FlightJourney = { Details: [] };
                        let FlightParameters = {};

                        let total_seg = 0;
                        const details = [];
                        const itinerary_legs = this.forceObjectToArray(itineraries[it_key]['legs']);

                        const RBD_array: any = [];
                        let is_refundable: number = 0;
                        const PreferredAirlines = searchData.PreferredAirlines;
                        let PreferredCabinClass: any = '';
                        if (searchData.JourneyType == "Return" || searchData.JourneyType == "return") {
                            PreferredCabinClass = searchData.Segments[0]['CabinClassOnward'];
                        } else {
                            PreferredCabinClass = searchData.Segments[0]['CabinClass'];
                        }
                        const pax_fare_breakdown = itineraries[it_key]['pricingInformation'][0]['fare']['passengerInfoList'];
                        const fareComponents = this.forceObjectToArray(pax_fare_breakdown[0]['passengerInfo']['fareComponents']);

                        let dispay_flag: boolean = false;
                        if (typeof PreferredAirlines !== 'undefined' && PreferredAirlines.length > 0) {
                            if (PreferredAirlines.includes(itineraries[it_key]['pricingInformation'][0]['fare']['validatingCarrierCode'])) {
                                dispay_flag = true;
                            }
                        } else {
                            dispay_flag = true;
                        }


                        let cab_flag: boolean = false;
                        if (PreferredCabinClass == "Economy" || PreferredCabinClass == "economy") {
                            if (fareComponents[0]['segments'][0]['segment']['cabinCode'] == "Y") {
                                cab_flag = true;
                            }
                        } else if (PreferredCabinClass == "Business" || PreferredCabinClass == "business") {
                            if (fareComponents[0]['segments'][0]['segment']['cabinCode'] == "C") {
                                cab_flag = true;
                            }
                        }

                        if (dispay_flag == true && cab_flag == true) {

                            let cabin_class_arr: any = [];
                            let booking_class_arr: any = [];

                            fareComponents.forEach((element, i) => {
                                let cabin_class_ar: any = [];
                                element.segments.forEach((seg, si) => {
                                    cabin_class_ar[si] = {};
                                    if (seg['segment'] != undefined) {
                                        RBD_array.push(seg['segment']['bookingCode']);
                                        cabin_class_ar[si]['cabin_class'] = seg['segment']['bookingCode'];
                                        cabin_class_ar[si]['available_seats'] = seg['segment']['seatsAvailable'];
                                    } else {
                                        cabin_class_ar[si]['cabin_class'] = '';
                                        cabin_class_ar[si]['available_seats'] = '';
                                    }

                                });
                                cabin_class_arr.push(cabin_class_ar);
                            });


                            let duration_list = [];
                            for (let leg_key = 0; leg_key < itinerary_legs.length; leg_key++) {

                                details[leg_key] = [];
                                let total_duration = 0;

                                // ======================================master data start
                                const iti_group_data = itigroups_data[itg_key]['groupDescription']['legDescriptions'][leg_key];
                                let departure_date = iti_group_data['departureDate'];

                                const schedules = this.forceObjectToArray(leg_info[itinerary_legs[leg_key]['ref']]);

                                if (pax_fare_breakdown[0]['passengerInfo']['nonRefundable'] != undefined && pax_fare_breakdown[0]['passengerInfo']['nonRefundable'] == false) {
                                    is_refundable = 1;
                                }

                                const baggae_information = this.forceObjectToArray(pax_fare_breakdown[0]['passengerInfo']['baggageInformation']);

                                const baggage_arr = [];
                                for (let b_key = 0; b_key < baggae_information.length; b_key++) {
                                    for (let key = 0; key < baggae_information[b_key]['segments'].length; key++) {
                                        baggage_arr[baggae_information[b_key]['segments'][key]['id']] = [];
                                        baggage_arr[baggae_information[b_key]['segments'][key]['id']]['allowance'] = baggae_information[b_key]['allowance']['ref'];
                                        baggage_arr[baggae_information[b_key]['segments'][key]['id']]['type'] = baggae_information[b_key]['provisionType'];
                                    }
                                }
                                // ======================================master data end


                                // ======================================flight details format start

                                for (let sh_key = 0; sh_key < schedules.length; sh_key++) {

                                    let adding_days: string;
                                    let is_leg = true;

                                    if (schedules[sh_key]['departureDateAdjustment'] != undefined) {
                                        departure_date = addDayInDate(departure_date, schedules[sh_key]['departureDateAdjustment']);
                                    }

                                    const segment_data = schedule_info[schedules[sh_key]['ref']];

                                    let arrival_date: string;
                                    if (segment_data['arrival']['dateAdjustment'] != undefined) {
                                        arrival_date = addDayInDate(departure_date, segment_data['arrival']['dateAdjustment']);
                                    }
                                    else {
                                        arrival_date = departure_date;
                                    }
                                    let OriginAirportCode = segment_data['departure']['airport'];
                                    let DestinationAirportCode = segment_data['arrival']['airport'];
                                    let arrival_time = segment_data['arrival']['time'].split("+");
                                    let departure_time = segment_data['departure']['time'].split("+");
                                    let DestinationDateTime = arrival_date + " " + arrival_time[0];

                                    let OriginDateTime = departure_date + " " + departure_time[0];
                                    let Operatedby = segment_data['carrier']['marketing'];
                                    let OperatorCode = segment_data['carrier']['marketing'];
                                    let DisplayOperatorCode = segment_data['carrier']['marketing'];
                                    const tempAirline = this.airline_codes.find((t: { code: any; }) => t.code == DisplayOperatorCode) || {};

                                    const OperatorName = tempAirline['name'] || DisplayOperatorCode;
                                    let type_of = '';
                                    let AllowanceBaggage = '';
                                    if (baggage_arr[total_seg] != undefined) {
                                        AllowanceBaggage = baggage_info[baggage_arr[total_seg]['allowance']];
                                        type_of = baggage_arr[total_seg]['type'];
                                    }

                                    let FlightNumber = segment_data['carrier']['marketingFlightNumber'];
                                    let no_of_stops = 0;
                                    let CabinClass = '';

                                    let duration = segment_data['elapsedTime'];
                                    let attr = [];
                                    attr['Baggage'] = AllowanceBaggage;
                                    attr['CabinBaggage'] = '7 KG';
                                    attr['Type'] = type_of;

                                    if (cabin_class_arr[leg_key]) {
                                        if (cabin_class_arr[leg_key][sh_key] === undefined) {
                                            CabinClass = cabin_class_arr[leg_key][0]['cabin_class'];
                                            attr['AvailableSeats'] = cabin_class_arr[leg_key][0]['available_seats'];
                                        } else {
                                            CabinClass = cabin_class_arr[leg_key][sh_key]['cabin_class'];
                                            attr['AvailableSeats'] = cabin_class_arr[leg_key][sh_key]['available_seats'];
                                        }
                                    } else {
                                        CabinClass = '';
                                        attr['AvailableSeats'] = 0;
                                    }

                                    // console.log(cabin_class_arr);
                                    // return false;
                                    let stop_over = '';
                                    let OriginTerminal: any;
                                    if (segment_data['departure']['terminal'] != undefined) {
                                        OriginTerminal = segment_data['departure']['terminal'];
                                    }

                                    let DestinationTerminal: any;
                                    if (segment_data['arrival']['terminal'] != undefined) {
                                        DestinationTerminal = segment_data['arrival']['terminal'];
                                    }
                                    const tempAirportDestination = this.airport_codes.find((t: { code: any; }) => t.code === DestinationAirportCode) || {};
                                    const DestinationCityName = tempAirportDestination['city'] || DestinationAirportCode;
                                    const DestinationAirportName = tempAirportDestination['name'] || DestinationAirportCode;

                                    const tempAirportOrigin = this.airport_codes.find((t: { code: any; }) => t.code === OriginAirportCode) || {};
                                    const OriginCityName = tempAirportOrigin['city'] || OriginAirportCode;
                                    const OriginAirportName = tempAirportOrigin['name'] || OriginAirportCode;

                                    let Equipment = segment_data['carrier']['equipment']['code'] || "";
                                    if (Equipment != "") {
                                        let first_c = Equipment.substr(0, 1);
                                        if (first_c == "7") {
                                            Equipment = "BOEING - " + Equipment;
                                        } else if (first_c == "3") {
                                            Equipment = "AIRBUS - " + Equipment;
                                        }
                                    }
                                    let Distance = segment_data['totalMilesFlown'];
                                    let FlightTime = segment_data['elapsedTime'];
                                    total_duration += segment_data['elapsedTime'];
                                    let WaitingTime = 0;

                                    if (sh_key > 0) {
                                        if (details[leg_key][sh_key - 1][
                                            "Destination"
                                        ]["DateTime"] != undefined) {
                                            WaitingTime = getDuration(
                                                details[leg_key][sh_key - 1][
                                                "Destination"
                                                ]["DateTime"],
                                                OriginDateTime
                                            );
                                        }
                                    }

                                    let segment_details = await this.formatFlightDetail({ OriginAirportCode, OriginCityName, OriginAirportName, OriginDateTime, OriginTerminal, DestinationAirportCode, DestinationCityName, DestinationAirportName, DestinationDateTime, DestinationTerminal, OperatorCode, DisplayOperatorCode, OperatorName, FlightNumber, CabinClass, Operatedby, Equipment, Distance, FlightTime, AttrBaggage: attr['Baggage'], AttrCabinBaggage: attr['CabinBaggage'], AttrAvailableSeats: attr['AvailableSeats'], WaitingTime, AttrType: attr['Type'] });
                                    details[leg_key].push(segment_details);
                                    is_leg = false;
                                    total_seg++;
                                }
                                duration_list.push(this.convertToHoursMins(total_duration));
                            } //segment end
                            FlightJourney["Details"] = details;
                            if (!blockAirlineList.includes(FlightJourney["Details"][0][0]["DisplayOperatorCode"])) {  // block airline

                                // return false;
                                // ======================================flight details format end
                                // ======================================price format start
                                const PriceBreakupRBD = RBD_array.join(", ");
                                let FareType: string = "Regular Fare";

                                let pricingInformation: any = this.forceObjectToArray(itineraries[it_key]['pricingInformation']);
                                let total_price_information: any = pricingInformation[0]['fare']['totalFare'];
                                let Currency: any = total_price_information['currency'];
                                let TotalDisplayFare = total_price_information['totalPrice'];
                                let PriceBreakupBasicFare = total_price_information['equivalentAmount'];
                                let PriceBreakupTax = total_price_information['totalTaxAmount'];
                                let PriceBreakupAgentCommission = 0;
                                let PriceBreakupAgentTdsOnCommision = 0;
                                let PassengerBreakup = {};
                                let TaxBreakupDetails: any = [];
                                let PriceBreakupFareType: string = '';
                                let price_pax_fare_breakdown = this.forceObjectToArray(pricingInformation[0]['fare']['passengerInfoList']);

                                for (let p_key = 0; p_key < price_pax_fare_breakdown.length; p_key++) {
                                    let pax_price_details: any = price_pax_fare_breakdown[p_key]['passengerInfo'];
                                    let pax_type: any = pax_price_details['passengerType'];
                                    let pax_count: any = pax_price_details['passengerNumber'];
                                    let pax_base_fare: any = pax_price_details['passengerTotalFare']['equivalentAmount'];
                                    let pax_tax: any = pax_price_details['passengerTotalFare']['totalTaxAmount'];
                                    let pax_total_fare: any = pax_price_details['passengerTotalFare']['totalFare'];

                                    if (pax_type == "CNN" || pax_type.startsWith("C")) {
                                        pax_type = "CHD";
                                    }
                                    // PassengerBreakup[pax_type] = {
                                    //     BasePrice: pax_base_fare,
                                    //     Tax: pax_tax,
                                    //     TotalPrice: pax_total_fare,
                                    //     PassengerCount: pax_count
                                    // };

                                    let priceInfo = { BasePrice: pax_base_fare, Tax: 0, TotalPrice: 0, PassengerCount: 0 };
                                    switch (pax_type) {
                                        case "ADT":

                                            PassengerBreakup[pax_type] = PassengerBreakup[pax_type] || priceInfo;
                                            PassengerBreakup[pax_type].Tax = pax_tax;
                                            PassengerBreakup[pax_type].TotalPrice = pax_total_fare;
                                            PassengerBreakup[pax_type].PassengerCount =pax_count;
                                            break;
                                        case "CHD":

                                            PassengerBreakup[pax_type] = PassengerBreakup[pax_type] || priceInfo;
                                            PassengerBreakup[pax_type].Tax = pax_tax;
                                            PassengerBreakup[pax_type].TotalPrice = pax_total_fare;
                                            PassengerBreakup[pax_type].PassengerCount++;
                                            break;
                                        case "INF":

                                            PassengerBreakup[pax_type] = PassengerBreakup[pax_type] || priceInfo;
                                            PassengerBreakup[pax_type].Tax = pax_tax;
                                            PassengerBreakup[pax_type].TotalPrice = pax_total_fare;
                                            PassengerBreakup[pax_type].PassengerCount = pax_count;
                                            break;
                                    }

                                    let TaxInfo: any = this.forceObjectToArray(pax_price_details['taxes']);

                                    for (let j = 0; j < taxDescs.length; j++) {
                                        for (let i = 0; i < TaxInfo.length; i++) {
                                            if (taxDescs[j]['id'] == TaxInfo[i]['ref']) {
                                                if (TaxBreakupDetails[taxDescs[j]["code"]]) {
                                                    TaxBreakupDetails[taxDescs[j]["code"]] += taxDescs[j]["amount"] * pax_count;
                                                } else {
                                                    TaxBreakupDetails[taxDescs[j]["code"]] = taxDescs[j]["amount"] * pax_count;
                                                }

                                            }
                                        }
                                    }
                                }
                                const TaxDetails1: any = this.tax_breakup(TaxBreakupDetails);

                                //Add Commission Start
                                let airlineMarkupAndCommission = {};

                                if (markupAndCommission) {
                                    searchData["AirlineCode"] = FlightJourney["Details"][0][0]["DisplayOperatorCode"];
                                    airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(searchData, markupAndCommission);
                                }
                                const PriceInfo = await this.flightDbService.formatPriceDetail(searchData.UserId,
                                    searchData.UserType, Currency, TotalDisplayFare, PriceBreakupBasicFare, PriceBreakupTax, PriceBreakupAgentCommission, PriceBreakupAgentTdsOnCommision, PriceBreakupRBD, TaxDetails1, PriceBreakupFareType, PassengerBreakup, airlineMarkupAndCommission,
                                    FlightJourney["Details"][0][0]["DisplayOperatorCode"]);

                                // ======================================price format end

                                // ======================================final format start
                                FlightInfo["FlightDetails"] = FlightJourney;
                                let SelectedCurrencyPriceDetails = {};
                                if (body.Currency) {
                                    if (body.Currency != 'BDT') {
                                        SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(body.Currency, PriceInfo);
                                    } else {
                                        SelectedCurrencyPriceDetails = PriceInfo;
                                    }
                                }

                                FlightInfo["Price"] = PriceInfo;
                                FlightInfo["Exchange_Price"] = SelectedCurrencyPriceDetails;

                                FlightInfo["Attr"] = { IsRefundable: is_refundable, AirlineRemark: "", DurationList: duration_list };
                                FlightParameters = { FlightInfo: FlightInfo, SearchData: searchData };

                                const token = this.redisServerService.geneateResultToken(searchData);

                                const ResultToken = await this.redisServerService.insert_record(
                                    token,
                                    JSON.stringify(FlightParameters)
                                );
                                FlightInfo["ResultToken"] = ResultToken["access_key"];
                                FlightInfo["booking_source"] = SABRE_FLIGHT_BOOKING_SOURCE;
                                FlightDataList["JourneyList"].push(FlightInfo);
                                // =========================================final format  end
                            }
                        }

                    }// iti end
                    /// return FlightDataList;
                } // first index end
            } // itinerari end
            //return {};
            return FlightDataList["JourneyList"];
            //return { Search: { FlightDataList } };
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

    }

    async seatAvailabilityDataFormat(data: any) {
        const result = {};
        let dataLists = data.response.dataLists;

        for (let i = 0; i < dataLists.paxSegments.length; i++) {
            const segment = dataLists.paxSegments[i];
            result[segment.paxSegmentID] = {
                key: `${segment.operatingCarrierInfo.carrierDesignationCode},${segment.operatingCarrierInfo.operatingCarrierFlightNumberText},${segment.departure.iataLocationCode},${segment.arrival.iataLocationCode}`,
            };
        }

        let resultData = {};
        let seatMaps = data.response.seatMaps;

        await Promise.all(
            seatMaps.map(async (paxSegment: any) => {
                let output = {};
                let paxSegmentRefID = paxSegment.paxSegmentRefID;
                if (result.hasOwnProperty(paxSegmentRefID)) {
                    await Promise.all(
                        paxSegment.cabinCompartments.map(async (seatData: any) => {
                            let seatRows = seatData.seatRows;
                            for (let i = 0; i < seatRows.length; i++) {
                                const row = seatRows[i];
                                output[row.row] = {}; // initialize output row
                                let aisleCounter = 0; // counter for odd-numbered aisles
                                if (Array.isArray(row.seats)) {
                                    await Promise.all(
                                        row.seats.map(async (seat: any) => {
                                            const column = seat.column;
                                            let hasAisleChar = false;
                                            if (seat.characteristics) {
                                                for (let k = 0; k < seat.characteristics.length; k++) {
                                                    if (
                                                        seat.characteristics[k].description === "Aisle" ||
                                                        seat.characteristics[k].description === "AisleSeat"
                                                    ) {
                                                        hasAisleChar = true;
                                                        break;
                                                    }
                                                }
                                            }
                                            const token = await this.redisServerService.geneateResultToken(seat);
                                            const resultToken = await this.redisServerService.insert_record(
                                                token,
                                                JSON.stringify(seat)
                                            );
                                            output[row.row][column] = {
                                                SeatCode: `${row.row}-${column}`,
                                                type: "Seat",
                                                occupationStatusCode: seat.occupationStatusCode,
                                                Aisle: 0,
                                                ResultToken: resultToken["access_key"],
                                                seatAvailability: seat.characteristics
                                                    ? seat.characteristics.some((char: any) => {
                                                        if (
                                                            char.description === "Aisle" ||
                                                            char.description === "NoSeatAtThisLocation"
                                                        ) {
                                                            return true;
                                                        }
                                                        return false;
                                                    })
                                                        ? "NotExist"
                                                        : "Available"
                                                    : "NotExist",
                                                seat_charge: "0 BDT",
                                                Paid: 0,
                                                characteristics: seat.characteristics
                                                    ? seat.characteristics.map((char:any) => ({
                                                        code: char.code,
                                                        description: char.description,
                                                    }))
                                                    : "",
                                            };
                                            if (hasAisleChar && aisleCounter % 2 === 0) {
                                                output[row.row][`${column}2`] = {
                                                    seatAvailability: "NotExist",
                                                    type: "Seat",
                                                    Paid: 0,
                                                    Aisle: 1,
                                                    characteristics: [{ code: "A", description: "Aisle" }],
                                                };
                                                aisleCounter++;
                                            } else if (hasAisleChar) {
                                                aisleCounter++;
                                            }
                                        })
                                    );
                                }
                            }
                            if (seatData.cabinLayout.columns && seatData.cabinLayout && seatData.cabinLayout.missingSeatList) {
                                const matchingColumns = seatData.cabinLayout.columns.filter((column: any) => column.position === "A");
        
                                seatData.cabinLayout.missingSeatList.forEach((missingSeat: string) => {
                                    const missingRow = missingSeat.substring(0, missingSeat.length - 1);
                                    const missingColumn = missingSeat.substring(missingSeat.length - 1);
        
                                    if (!output[missingRow]) {
                                        output[missingRow] = {};
                                    }
        
                                    output[missingRow][missingColumn] = {
                                        SeatCode: `${missingRow}-${missingColumn}`,
                                        type: "Seat",
                                        Aisle: 0,
                                        seatAvailability: "NotExist",
                                    };
        
                                    if (matchingColumns.some((column: any, index: number) => index % 2 === 0 && column.id === missingColumn)) {
                                        const prevColId = matchingColumns.find((column: any) => column.id === missingColumn).id;
                                        output[missingRow][prevColId + "2"] = {
                                            SeatCode: `${missingRow}-${prevColId}2`,
                                            Aisle: 1,
                                            seatAvailability: "NotExist",
                                        };
                                    }
                                });
                            }
                        })
                    );
                    resultData[result[paxSegmentRefID].key] = output;
                }
            })
        );

        return { seat_map: resultData };
    }

    async reservationResponseFormat(result, body, commitBookingDataParsed) {
        try{
        const AirPrice = result.CreatePassengerNameRecordRS.AirPrice[0].PriceQuote.PricedItinerary
        const AirTotalPrice = result.CreatePassengerNameRecordRS.AirPrice[0].PriceQuote.MiscInformation.SolutionInformation[0]
        if (result) {
            const pnr = result.CreatePassengerNameRecordRS.ItineraryRef.ID
            let LastDateToTicket = new Date().getFullYear() + result.CreatePassengerNameRecordRS.AirPrice[0].PriceQuote.MiscInformation.HeaderInformation[0].LastTicketingDate
            let DateInfo = result.CreatePassengerNameRecordRS.TravelItineraryRead.TravelItinerary.ItineraryInfo.ReservationItems.Item
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
            const JourneyTemp = this.forceObjectToArray(result.CreatePassengerNameRecordRS.AirBook.OriginDestinationOption.FlightSegment);
            for (let i = 0; i < JourneyTemp.length; i++) {
                if (!this.AirportCodeList.includes(JourneyTemp[i]['OriginLocation']['LocationCode'])) {
                    this.AirportCodeList.push(JourneyTemp[i]['OriginLocation']['LocationCode']);
                }
                if (!this.AirportCodeList.includes(['DestinationLocation']['LocationCode'])) {
                    this.AirportCodeList.push(JourneyTemp[i]['DestinationLocation']['LocationCode']);
                }
                if (!this.AirlineCodeList.includes(JourneyTemp[i]['MarketingAirline']['Code'])) {
                    this.AirlineCodeList.push(JourneyTemp[i]['MarketingAirline']['Code']);
                }
            }
            this.airport_codes = await this.getAirports();
            this.airline_codes = await this.getAirlines();

            const JourneyArray = [];
            for (let i = 0; i < JourneyTemp.length; i++) {
                const Origin = JourneyTemp[i]['OriginLocation']['LocationCode'];
                const Destination = JourneyTemp[i]['DestinationLocation']['LocationCode'];
                const tempAirportOrigin = this.airport_codes.find((t) => t.code === Origin) || {};
                const OriginCityName = tempAirportOrigin['city'] || Origin;
                const OriginAirportName = tempAirportOrigin['name'] || Origin;
                const tempAirportDestination = this.airport_codes.find((t) => t.code === Destination) || {};
                const DestinationCityName = tempAirportDestination['city'] || Destination;
                const DestinationAirportName = tempAirportDestination['name'] || Destination;
                const Carrier = JourneyTemp[i]['MarketingAirline']['Code'];
                const tempAirline = this.airline_codes.find((t) => t.code == Carrier) || {};
                const OperatorName = tempAirline['name'] || Carrier;
                JourneyArray.push({
                    Origin: {
                        AirportCode: Origin,
                        CityName: OriginCityName,
                        AirportName: OriginAirportName,
                        DateTime: DateInfo[i].Product.ProductDetails.Air.DepartureDateTime,
                        FDTV: '',
                        // Terminal: getPropValue(JourneyTemp[i]['air:FlightDetails'], 'OriginTerminal'),
                    },
                    Destination: {
                        AirportCode: Destination,
                        CityName: DestinationCityName,
                        AirportName: DestinationAirportName,
                        DateTime: DateInfo[i].Product.ProductDetails.Air.ArrivalDateTime,
                        FATV: '',
                        // Terminal: getPropValue(JourneyTemp[i]['air:FlightDetails'], 'DestinationTerminal'),
                    },
                    OperatorCode: Carrier,
                    DisplayOperatorCode: Carrier,
                    OperatorName,
                    FlightNumber: getPropValue(JourneyTemp[i], 'FlightNumber'),
                    CabinClass: getPropValue(JourneyTemp[i], 'ResBookDesigCode'),
                    Attr: "",
                });
            }

            let Baggage = []
            const AirPricingInfoArray = this.forceObjectToArray(AirPrice.AirItineraryPricingInfo);

            const CurrencyType = AirPrice.CurrencyCode;
            const PassengerBreakup = {};
            for (let j = 0; j < AirPricingInfoArray.length; j++) {
                const PassengerType = this.forceObjectToArray(
                    AirPricingInfoArray[j]["PassengerTypeQuantity"]
                );
                if (AirPricingInfoArray[j]["BaggageProvisions"]) {
                    //         if(Array.isArray(AirPricingInfoArray[j]["air:FareInfo"])){
                    AirPricingInfoArray[j]["BaggageProvisions"].forEach(element => {
                        Baggage.push({
                            Origin: element["Associations"]["OriginLocation"][0]["LocationCode"],
                            Destination: element["Associations"]["DestinationLocation"][0]["LocationCode"],
                            BaggageAllowance: element["WeightLimit"]
                        })
                    });
                }
                // else{
                //             let element = AirPricingInfoArray[j]["air:FareInfo"];
                //             Baggage.push({
                //                 Origin:element["Origin"],
                //                 Destination : element["Destination"],
                //                 BaggageAllowance :element[ "air:BaggageAllowance"]
                //             })
                //         }
                // }
                const PassengerTypeCode =
                    PassengerType[0]["Code"] == "CNN" ? "CHD" : PassengerType[0]["Code"];

                PassengerBreakup[PassengerTypeCode] = {
                    BasePrice: AirPricingInfoArray[j]["ItinTotalFare"]["BaseFare"]["Amount"],
                    Tax: AirPricingInfoArray[j]["ItinTotalFare"]["Taxes"]["TotalAmount"],
                    TotalPrice: AirPricingInfoArray[j]["ItinTotalFare"]["TotalFare"]["Amount"],
                    PassengerCount: PassengerType[0].Quantity,
                };

            }
            const ReservationItems = this.forceObjectToArray(result['CreatePassengerNameRecordRS']['TravelItineraryRead']['TravelItinerary']['ItineraryInfo']['ReservationItems']['Item']);
            let airline_pnr = '';
            for (let i = 0; i < ReservationItems.length; i++) {
                let FlightSegment = ReservationItems[i]['FlightSegment'];
                for (let s = 0; s < FlightSegment.length; s++) {
                    let Code = FlightSegment[s]['OperatingAirlinePricing']['Code'];
                    let airline_pnr_details = FlightSegment[s]['SupplierRef']['ID'].split('*');
                    airline_pnr = airline_pnr_details[1];
                    const query3 = `UPDATE flight_booking_transaction_itineraries SET 
                    airline_pnr = "${airline_pnr}"
                    WHERE app_reference = "${body["AppReference"]}" and airline_code = "${Code}"`;
                    await this.manager.query(query3);
                }
            }
            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_HOLD" ,
            UniversalRecordLocatorCode = "${pnr}" ,
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
                        Baggage,
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: {
                                Details: commitBookingDataParsed['FlightInfo']['FlightDetails']['Details'],
                            },
                        },
                        Price: commitBookingDataParsed['FlightInfo']['Price'],
                        Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: SABRE_FLIGHT_BOOKING_SOURCE
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
    }catch (error) {
        const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
    }

    }

    async ticketingResponseFormat(result, body) {
        const ticketingData = result.AirTicketRS.Summary;
        let flag = 0;
        if (ticketingData) {
            for (let i = 0; i < ticketingData.length; i++) {
                const query1 = `UPDATE flight_booking_transaction_passengers SET 
            booking_status = "BOOKING_CONFIRMED" ,
			ticket_no = "${ticketingData[i]['DocumentNumber']}",
            ticket_issue_date = CURRENT_TIMESTAMP
            WHERE full_name="${ticketingData[i]["FirstName"]}" 
            and last_name="${ticketingData[i]["LastName"]}" 
            and app_reference = "${body["AppReference"]}"`;
                await this.manager.query(query1);
                flag = 1;

            }

            if (flag == 1) {
                const query1 = `UPDATE flight_bookings
                SET booking_status = 'BOOKING_CONFIRMED', 
                ticket_issue_date = CURRENT_TIMESTAMP
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
              TicketIssueDate: ticket_issue_date
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
            ticket_issue_date
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
                        TicketIssueDate:Passenger[0].ticket_issue_date,
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
