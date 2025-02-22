import { MailerService } from "@nestjs-modules/mailer";
import { Body, HttpService, Injectable, UploadedFiles, HttpException } from "@nestjs/common";
import * as moment from "moment";
import { InjectPdf, PDF } from "nestjs-pdf";
import { elementAt } from "rxjs/operators";
import { getExceptionClassByCode } from "../../all-exception.filter";
import { formatDateTime, duration, formatStringtDate, formatSearchDate, formatVoucherDate, debug } from "../../app.helper";
import { CommonService } from "../../common/common/common.service";
import { ADVANCE_TAX_PERCENT, CANCEL_EMAIL, FAILURE_STATUS, SMS_FROM, SMS_PASSWORD, SMS_USERNAME, SUCCESS_STATUS, SUPPORT_EMAIL, BOOKING247_HELPLINE_NUMBER } from "../../constants";
import { Custom_Db } from "../../custom.db";
import { RedisServerService } from "../../shared/redis-server.service";
import { FlightApi } from "../flight.api";
import { Flight_Model } from "./flight.model";
import { ListFlightTopDestinationsDto } from "./swagger/flight-top-destinations.dto";
const fetch = require("node-fetch");
var btoa = require('btoa');


@Injectable()
export class FlightDbService extends FlightApi {
    private flightModel = new Flight_Model();
    private customDb = new Custom_Db();
    constructor(
        private readonly redisServerService: RedisServerService,
        private readonly mailerService: MailerService,
        private httpService: HttpService,
        private commonService: CommonService,
        @InjectPdf() private readonly pdf: PDF
    ) {
        super();
    }

    async autocomplete(body: any): Promise<any> {
        const raw_search_chars = body["text"];
        const r_search_chars = body["text"] + "%";
        const search_chars = "%" + body["text"] + "%";
        let query = '';
        if (body["text"].length == 3) {
            query = `
            SELECT id, name, code, city, country, priority, sub_priority
            FROM flight_airports 
            WHERE code LIKE '${search_chars}' ORDER BY priority ASC
            LIMIT 0, 20`;
        } else {
            query = `
            SELECT id, name, code, city, country, priority, sub_priority
            FROM flight_airports 
            WHERE city LIKE '${search_chars}'
            OR code LIKE '${search_chars}' OR country LIKE '${search_chars}'
            ORDER BY priority ASC,
            CASE
            WHEN	code	LIKE	'${raw_search_chars}'	THEN 1
            WHEN	city	LIKE	'${raw_search_chars}'	THEN 2
            WHEN	country	LIKE	'${raw_search_chars}'	THEN 3

            WHEN	code	LIKE	'${r_search_chars}'	THEN 4
            WHEN	city	LIKE	'${r_search_chars}'	THEN 5
            WHEN	country	LIKE	'${r_search_chars}'	THEN 6

            WHEN	code	LIKE	'${search_chars}'	THEN 7
            WHEN	city	LIKE	'${search_chars}'	THEN 8
            WHEN	country	LIKE	'${search_chars}'	THEN 9
            ELSE 10 END
            LIMIT 0, 20`;
        }

        const result = await this.manager.query(query);
        if (result.length) {
            const airports = [];
            for (const [key, value] of Object.entries(result)) {
                airports.push({
                    /*id: value['id'],
                              label: value['city'] + ', ' + value['country'] + '(' + value['code'] + ')',
                              value: value['city'] + ' (' + value['code'] + ')',
                              category: 'Search Results',
                              type: 'Search Results',*/
                    AirportCode: value["code"],
                    AirportName: value["name"],
                    AirportCity: value["city"],
                    CountryName: value["country"],
                    CountryCode: "",
                    Priority: value["priority"],
                    SubPriority: value["sub_priority"],
                });
            }
            return { result: airports, message: "" };
        }
        return { result: [], message: "No available!" };
    }
    async getSubagentParentID(created_by_id: any) {
        const query = `SELECT id,auth_role_id,created_by_id FROM auth_users WHERE id = ${created_by_id}`;
        const userWalletRes = await this.manager.query(query);
        if (userWalletRes.length === 0 || userWalletRes.length === undefined) {
            const errorClass: any = getExceptionClassByCode(`400 Not a valid user.`);
            throw new errorClass(`Not a valid user.`);
        }
        return userWalletRes;
    }
    async preferredAirlines(@Body() body: any): Promise<any> {
        return await this.getGraphData(
            `query {
            flightAirlines(take:1000,orWhere:{
              name:{startsWith:"${body.name}"}
            }) {
                id
                name
                code
            }   
        }`,
            "flightAirlines"
        );
    }
    async flightType(SearchData: any): Promise<any> {

        let flightTypeCode: any = [];
        if (SearchData['Segments'].length > 0) {
            for (let s = 0; s < SearchData['Segments'].length; s++) {
                flightTypeCode.push(SearchData['Segments'][s]['Origin']);
                flightTypeCode.push(SearchData['Segments'][s]['Destination']);
            }
        }
        const codes = flightTypeCode.join(",");
        let countries = await this.getGraphData(
            `query {
            flightAirports(where:{
              code:{in:"${codes}"}
            }) {
                country
            }   
        }`,
            "flightAirports"
        );
        var values = countries.map((a) => a.country);
        countries = new Set(values);
        if (countries.size === 1) {
            return "Domestic";
        } else if (countries.size > 1) {
            return "International";
        }
    }

    async cabinClassList(@Body() body: any): Promise<any> {
        return await this.getGraphData(
            `{
            flightCabinClasses(where:{
              status:{
                eq:${1}
              }
            }){
              id
              name
            }}`,
            "flightCabinClasses"
        );
    }

    async CurrencyConversionRate(body: any) {
        const query = `SELECT country, ROUND(currency_value, 2) currency_value FROM tlntrip_currency_converter`;
        const result = await this.manager.query(query);
        const currencies = {};
        for (const [key, value] of Object.entries(result)) {
            const USDTO = `USD${value["country"]}`;
            currencies[USDTO] = value["currency_value"];
        }
        return { result: { CurrencyConversionRate: currencies }, message: "" };
    }

    getCity(body: any): any {
        return {
            city_name: body.city_name,
            source: body.source,
        };
    }

    getSearch(body: any): any {
        return {};
    }

    getDetails(body: any): any {
        return {};
    }

    submitBook(body: any): any {
        return {};
    }

    async redirectedReservationResponse(body) {
        const ReservationDetails = await this.redisServerService.read_list(
            body["ReservationResultIndex"]
        );
        console.log("redirectedReservationResponse", ReservationDetails);
        return JSON.parse(ReservationDetails[0]);
    }

    async voucher(body: any) {
        const result = await this.getGraphData(
            `
    query {
        flightBookings(where:{
          app_reference:{
            eq:"${body.AppReference}"
          }
        })           {
            id
            domain_origin
            status
            app_reference
            booking_source
            api_code
            trip_type
            phone_code
            phone
            alternate_number
            email
            journey_start
            journey_end
            journey_from
            journey_to
            from_loc
            to_loc
            cabin_class
            is_lcc
            payment_mode
            convinence_value
            convinence_value_type
            convinence_per_pax
            convinence_amount
            discount
            promo_code
            currency
            currency_conversion_rate
            version
            attributes
            gst_details
            created_by_id
            created_at
            booking_status
            UniversalRecordLocatorCode
            LastDateToTicket
            flightBaggageInsurances{
                id
                created_at
                app_reference
                service_number
                service_status
                amount
                product_code
                promo_code
                created_by_id
                currency
              }
            flightBookingTransactions {
                id
                gds_pnr
                pnr
                status
                total_fare
                agent_commission
                admin_tds
                agent_tds
                admin_markup
                agent_markup
                currency
                booking_status
                attributes
                flightBookingTransactionPassengers{
                    id
                    passenger_type
                    title
                    first_name
                    middle_name
                    last_name
                    is_lead
                    date_of_birth
                    ticket_no
                  }
                  flightBookingTransactionItineraries{
                    airline_name
                    airline_pnr
                    flight_number
                    from_airport_name
                    to_airport_name
                    fare_class
                    to_airport_code
                    from_airport_code
                    airline_code
                    attributes
                    departure_datetime
                    arrival_datetime
                    flight_number
                    cabin_baggage
                    checkin_baggage
                    arrival_terminal
                    departure_terminal
                    equipment
              }
            }
        }


    }`,
            "flightBookings"
        );
        if (result[0] == undefined) {
            const errorClass: any = getExceptionClassByCode(
                "403 please give the proper appreference!"
            );
            throw new errorClass("403 Given Appreference not exist!");
        }
        // return result;
        return result.map((t) => {
            const tempData = {
                ...t,
            };
            return this.getFlightVoucherUniversal(tempData);
        });
    }
    getFlightVoucherUniversal(reportData) {
        let TotalFarePriceBreakUp = "";
        if (reportData.flightBookingTransactions[0].attributes) {
            TotalFarePriceBreakUp = JSON.parse(
                reportData.flightBookingTransactions[0].attributes.replace(/'/g, '"')
            );
            // console.log("***", reportData.flightBookingTransactions[0].attributes);
            // console.log("&&&", TotalFarePriceBreakUp);
        }

        for (let i = 0; i < reportData.flightBookingTransactions[0]
            .flightBookingTransactionItineraries.length; i++) {

            if (reportData.flightBookingTransactions[0]
                .flightBookingTransactionItineraries[i].departure_datetime.includes(' ')) {
                reportData.flightBookingTransactions[0]
                    .flightBookingTransactionItineraries[i].departure_datetime_ios = reportData.flightBookingTransactions[0]
                        .flightBookingTransactionItineraries[i].departure_datetime.replace(' ', 'T')
            } else {
                reportData.flightBookingTransactions[0]
                    .flightBookingTransactionItineraries[i].departure_datetime_ios = reportData.flightBookingTransactions[0]
                        .flightBookingTransactionItineraries[i].departure_datetime;

            }

            if (reportData.flightBookingTransactions[0]
                .flightBookingTransactionItineraries[i].arrival_datetime.includes(' ')) {
                reportData.flightBookingTransactions[0]
                    .flightBookingTransactionItineraries[i].arrival_datetime_ios = reportData.flightBookingTransactions[0]
                        .flightBookingTransactionItineraries[i].arrival_datetime.replace(' ', 'T')
            } else {
                reportData.flightBookingTransactions[0]
                    .flightBookingTransactionItineraries[i].arrival_datetime_ios = reportData.flightBookingTransactions[0]
                        .flightBookingTransactionItineraries[i].arrival_datetime;

            }
        }
        // return false;
        return {
            Id: reportData.id,
            DomainOrigin: reportData.domain_origin,
            BookingStatus: reportData.booking_status,
            AppReference: reportData.app_reference,
            BookingSource: reportData.booking_source,
            ApiCode: reportData.api_code,
            TripType: reportData.trip_type,
            PhoneCode: reportData.phone_code,
            Phone: reportData.phone,
            AlternateNumber: reportData.alternate_number,
            Email: reportData.email,
            JourneyStart: reportData.journey_start,
            JourneyEnd: reportData.journey_end,
            JourneyFrom: reportData.journey_from,
            JourneyTo: reportData.journey_to,
            FromLocation: reportData.from_loc,
            ToLocation: reportData.to_loc,
            CabinClass: reportData.cabin_class,
            IsLcc: reportData.is_lcc,
            PaymentMode: reportData.payment_mode,
            ConvinenceValue: reportData.convinence_value,
            ConvinenceValueType: reportData.convinence_value_type,
            ConvinencePerPax: reportData.convinence_per_pax,
            ConvinenceAmount: reportData.convinence_amount,
            Discount: reportData.discount,
            PromoCode: reportData.promo_code,
            Currency: reportData.currency,
            CurrencyConversionRate: reportData.currency_conversion_rate,
            Version: reportData.version,
            GstDetails: reportData.gst_details,
            LastDateToTicket: reportData.LastDateToTicket,
            CreatedById: reportData.created_by_id,
            CreatedDatetime: reportData.created_at,
            InvoiceNumber: "Inv0002",
            GDS_PNR: reportData.flightBookingTransactions[0].gds_pnr,
            TotalFare: reportData.flightBookingTransactions[0].total_fare,
            AgentCommission: reportData.flightBookingTransactions[0].agent_commission,
            AdminTds: reportData.flightBookingTransactions[0].admin_tds,
            AgentTds: reportData.flightBookingTransactions[0].agent_tds,
            AdminMarkup: reportData.flightBookingTransactions[0].admin_markup,
            AgentMarkup: reportData.flightBookingTransactions[0].agent_markup,
            TotalFarePriceBreakUp: TotalFarePriceBreakUp,
            Pnr:
                reportData.UniversalRecordLocatorCode != "undefined"
                    ? reportData.UniversalRecordLocatorCode
                    : "",
            BaggageInsurancesDetails: reportData.flightBaggageInsurances,
            Passengers:
                reportData.flightBookingTransactions[0]
                    .flightBookingTransactionPassengers,
            FlightItineraries:
                reportData.flightBookingTransactions[0]
                    .flightBookingTransactionItineraries,
        };
    }

    // async voucher(body: any) {
    //     const flightBookingQuery = `SELECT * FROM flight_bookings WHERE app_reference='${body.AppReference}'`;
    //     const flightBooking = await this.manager.query(flightBookingQuery);
    //     const flightItinerariesQuery = `SELECT * FROM flight_booking_transaction_itineraries WHERE app_reference='${body.AppReference}'`;
    //     const flightItineraries = await this.manager.query(flightItinerariesQuery);
    //     const flightPassengersQuery = `SELECT * FROM flight_booking_transaction_passengers WHERE app_reference='${body.AppReference}'`;
    //     const flightPassengers = await this.manager.query(flightPassengersQuery);
    //     const flightTransactionsQuery = `SELECT * FROM flight_booking_transactions WHERE app_reference='${body.AppReference}'`;
    //     const flightTransactions = await this.manager.query(flightTransactionsQuery);
    //     if (flightPassengers.length > 0) {
    //         const flightBaggagesQuery = `SELECT * FROM flight_booking_baggages WHERE flight_booking_passenger_id='${flightPassengers[0].id}'`;
    //         const flightBaggages = await this.manager.query(flightBaggagesQuery);
    //         const flightMealsQuery = `SELECT * FROM flight_booking_meals WHERE flight_booking_passenger_id='${flightPassengers[0].id}'`;
    //         const flightMeals = await this.manager.query(flightMealsQuery);
    //         const flightSeatsQuery = `SELECT * FROM flight_booking_seats WHERE flight_booking_passenger_id='${flightPassengers[0].id}'`;
    //         const flightSeats = await this.manager.query(flightSeatsQuery);
    //         return {
    //             flightBooking,
    //             flightItineraries,
    //             flightPassengers,
    //             flightTransactions,
    //             flightSeats,
    //             flightMeals,
    //             flightBaggages
    //         }
    //     } else {
    //         return {
    //             flightBooking,
    //             flightItineraries,
    //             flightPassengers,
    //             flightTransactions
    //         }
    //     }
    // }

    async elgible_for_ticket_cancellation(
        app_reference: any,
        sequence_number: any,
        ticket_ids: any,
        is_full_booking_cancel: any,
        booking_source: any
    ) {
        const response = [];
        response["status"] = FAILURE_STATUS;
        response["data"] = [];
        response["message"] = "";
        let booking_details = this.flightModel.get_flight_booking_transaction_details(
            app_reference,
            sequence_number,
            booking_source
        );
        if (booking_details["status"] == SUCCESS_STATUS) {
            booking_details = booking_details["data"];
            const booking_transaction_details =
                booking_details["booking_transaction_details"][0];
            const booking_itinerary_details =
                booking_details["booking_itinerary_details"][0];
            const booking_customer_details =
                booking_details["booking_customer_details"];

            const flight_booking_transaction_id = booking_transaction_details["id"];
            //Checking Travel Date
            const travel_date = moment(
                booking_itinerary_details["departure_datetime"]
            ).unix();

            // is_full_booking_cancel = false;//remove later

            if (travel_date >= moment().unix()) {
                if (is_full_booking_cancel == true) {
                    const temp_pax_data = this.customDb.single_table_records(
                        "flight_booking_transaction_passengers",
                        "id, booking_status",
                        {
                            flight_booking_transaction_id: flight_booking_transaction_id,
                            booking_status: "BOOKING_CANCELLED",
                        }
                    );
                    if (temp_pax_data["booking_status"] == FAILURE_STATUS) {
                        response["booking_status"] = SUCCESS_STATUS;
                    } else {
                        response["message"] = "Cancellation Failed";
                    }
                } else {
                    const index_passenger_orign = [];
                    for (const [pax_k, pax_v] of booking_customer_details) {
                        index_passenger_orign[pax_v["id"]] = pax_v["booking_status"];
                    }
                    let ticket_status = SUCCESS_STATUS;
                    for (const [k, v] of ticket_ids) {
                        if (
                            index_passenger_orign[v] &&
                            index_passenger_orign[v] == "BOOKING_CONFIRMED"
                        ) {
                            ticket_status = SUCCESS_STATUS;
                        } else {
                            ticket_status = FAILURE_STATUS;
                            break;
                        }
                    }
                    if (ticket_status == SUCCESS_STATUS) {
                        response["booking_status"] = SUCCESS_STATUS;
                    } else {
                        response["message"] = "Cancellation Failed";
                    }
                }
            } else {
                response["message"] = "Cancellation Failed !! Journey Date is over";
            }
        } else {
            response["message"] = "AppReference is Not Valid";
        }
        return response;
    }

    async sendItinerary(body: any): Promise<any> {
        try {
            let ResultToken = this.forceObjectToArray(body['ResultToken']);

            const FlightDetail = await this.redisServerService.read_list(ResultToken[0]);
            let agency_data = {};
            if (body.UserId) {
                let query = `SELECT email,domain_logo,business_name,business_phone,address FROM auth_users where id=${body.UserId} LIMIT 1;`
                const result = await this.manager.query(query);
                if (result[0]) {
                    agency_data = result[0];
                }
            }

            let FlightDetailParsed = JSON.parse(FlightDetail);
            if (FlightDetailParsed[0]) {
                FlightDetailParsed = FlightDetailParsed[0];
            }
            let FlightInfo: any;

            if (FlightDetailParsed.SearchData.booking_source == "ZBAPINO00010") {
                FlightInfo = FlightDetailParsed.FlightList[0];

            } else {
                FlightInfo = FlightDetailParsed.FlightInfo;
            }

            var isRefundable = "Non Refundable";
            if (FlightInfo.Attr != undefined) {
                if (FlightInfo.Attr.IsRefundable) {
                    isRefundable = "Refundable"
                }
            }
            const totalFare = FlightInfo.Price.TotalDisplayFare;
            const basicFare = FlightInfo.Price.PriceBreakup.BasicFare;
            const tax = FlightInfo.Price.PriceBreakup.Tax;
            const advancetax = FlightInfo.Price.PriceBreakup.AdvanceTax;
            var markupValue
            // if(FlightInfo.Price.PriceBreakup.MarkUpDetails){
            //    markupValue = FlightInfo.Price.PriceBreakup.MarkUpDetails.AgentMarkup;
            // }
            const agentCommission = FlightInfo.Price.PriceBreakup.AgentCommission;
            const agentTdsOnCommision =
                FlightInfo.Price.PriceBreakup.AgentTdsOnCommision;
            markupValue = body["markup_value"];
            // console.log("**TotalDisFare", totalFare);
            var mvalue = body["markup_value"];
            // console.log("**body**mvalue", FlightInfo.FlightDetails.Details[0].length - 1);
            var flightData = FlightInfo.FlightDetails.Details[0][0];

            for (let i_key = 0; i_key < FlightInfo.FlightDetails.Details.length; i_key++) {
                for (let c_key = 0; c_key < FlightInfo.FlightDetails.Details[i_key].length; c_key++) {
                    FlightInfo.FlightDetails.Details[i_key][c_key]['Origin']['DateTime'] = moment(FlightInfo.FlightDetails.Details[i_key][c_key]['Origin']['DateTime']).format('DD MMM YYYY HH:mm');
                    FlightInfo.FlightDetails.Details[i_key][c_key]['Destination']['DateTime'] = moment(FlightInfo.FlightDetails.Details[i_key][c_key]['Destination']['DateTime']).format('DD MMM YYYY HH:mm');
                }
            }

            var flightInfo = FlightInfo.FlightDetails.Details;
            var origin = FlightInfo.FlightDetails.Details[0][0].Origin;
            var destination = FlightInfo.FlightDetails.Details[0][0].Destination;
            var BaggageDetails = FlightInfo.FlightDetails.Details[0][0].Attr;
            var timestamp = new Date().getTime().toString();
            var stops = FlightInfo.FlightDetails.Details[0].length - 1
            var filename = "flightReport" + timestamp;
            var searchData = FlightDetailParsed.SearchData;
            // console.log(JSON.stringify(searchData));
            // return false;

            if (markupValue === "") {
                markupValue = 0;
            }

            // if totaldisplayfare doesn't include the markup then explicitly add the markup value
            const grandTotalFare = totalFare + parseFloat(markupValue);
            let pd = [];
            if (FlightInfo.Price.PassengerBreakup.ADT) {
                FlightInfo.Price.PassengerBreakup.ADT.PassengerCount = 'Adult * ' + FlightInfo.Price.PassengerBreakup.ADT.PassengerCount;
                FlightInfo.Price.PassengerBreakup.ADT.Tax = parseFloat(FlightInfo.Price.PassengerBreakup.ADT.Tax) + parseFloat(markupValue);
                FlightInfo.Price.PassengerBreakup.ADT.TotalPrice = parseFloat(FlightInfo.Price.PassengerBreakup.ADT.TotalPrice) + parseFloat(markupValue);
                pd.push(FlightInfo.Price.PassengerBreakup.ADT);
            }

            if (FlightInfo.Price.PassengerBreakup.CHD) {
                FlightInfo.Price.PassengerBreakup.CHD.PassengerCount = 'Child * ' + FlightInfo.Price.PassengerBreakup.CHD.PassengerCount;
                pd.push(FlightInfo.Price.PassengerBreakup.CHD);
            }

            if (FlightInfo.Price.PassengerBreakup.INF) {
                FlightInfo.Price.PassengerBreakup.INF.PassengerCount = 'Infant * ' + FlightInfo.Price.PassengerBreakup.INF.PassengerCount;
                pd.push(FlightInfo.Price.PassengerBreakup.INF);
            }
            const Price = pd;

            await this.pdf({
                filename: "./voucher/flightSendItinerary/" + filename + ".pdf",
                template: "flightSendItinerary",
                viewportSize: {
                    width: 1500
                },
                locals: {
                    flightInfo: flightInfo,
                    price: Price,
                    searchData: searchData,
                    cabinClass: searchData.Segments[0]['CabinClassOnward'],
                    operatorName: flightData["OperatorName"],
                    operatorCode: flightData["OperatorCode"],
                    duration: flightData["Duration"],
                    flightNumber: flightData["FlightNumber"],
                    airFare: basicFare,
                    tax: parseInt(tax) + parseInt(markupValue),
                    advancetax: advancetax,
                    markup: markupValue,
                    agentCommission: agentCommission,
                    agentTdsOnCommision: agentTdsOnCommision,
                    grandTotal: grandTotalFare,
                    baggage: BaggageDetails["Baggage"],
                    checkinBaggage: BaggageDetails["CabinBaggage"],
                    isRefundable: isRefundable,
                    AgencyDetails: agency_data,
                    stops: stops
                },
            });

            const { cc } = await this.getEmailConfig()
            this.mailerService.sendMail({
                to: body.email,
                cc,
                from: "Booking247 info@booking247.com",
                subject: "Flight Itinerary Details",
                html: "<b>Flight Itinerary Details!</b>",
                attachments: [
                    {
                        filename: "flightReport.pdf",
                        contentType: "application/pdf",
                        path:
                            process.cwd() +
                            "/voucher/flightSendItinerary/" +
                            filename +
                            ".pdf",
                    },
                ],
            });
            return {
                FlightDetails: FlightInfo,
                MarkupValue: markupValue,
                GrandTotalFare: grandTotalFare,
            };
            //}
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async selectMarkupList(body: any) {
        console.log("**body", body);
        let query = "";
        //front end user id
        //query = query + `auth_user_id:{ eq: "${body.user.id}"}`;
        query = query + `auth_user_id:{ eq: "${body.auth_user_id}"}`;
        if (body.module_type) {
            query = query + `module_type:{eq: "${body.module_type}"}`;
        }
        if (body.type) {
            query = query + `type:{eq: "generic"}`;
        }

        try {
            const result = await this.getGraphData(
                `
                query {
                    coreMarkups (
                        where: {${query}}
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
                        flightAirline{
                            name
                            code
                        }
                    }
                }
            `,
                "coreMarkups"
            );
            
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getFlightMarkupDetails(
        searchData: any,
        module_type: any,
        markup_level: any
    ): Promise<any> {
        let airline_filter = '';
        if (searchData["booking_source"] == "ZBAPINO00008") {
            airline_filter = `flight_airline_id:{
                in: "0,901"
            }`;
        } else if (searchData["booking_source"] == "ZBAPINO00009") {
            airline_filter = `flight_airline_id:{
                in: "0,814"
            }`;
        }
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
                            ${airline_filter}
                        }
                    ) {
                        id 
                        markup_level
                        type
                        fare_type
                        module_type 
                        flight_airline_id
                        auth_user_id
                        value
                        value_type
                        domain_list_fk
                        markup_currency
                        segment_list
                        flightAirline{
                            code
                        }
                    }
                }
            `,
            "coreMarkups"
        );
        return result;
    }

    async getFlightCommissionDetails(searchData: any): Promise<any> {
        if (searchData["UserType"] == "B2B" && searchData["UserId"]) {
            let flight_airline_id: any = '';
            if (searchData["FlightId"]) {
                flight_airline_id = `flight_airline_id:{ in: "${searchData["FlightId"]},0"}`;
            }
            const result = await this.getGraphData(
                `
            query {
                coreCommissions (
                     where: { 
                         status:{ eq: 1 } 
                         auth_user_id:{ in: "${searchData["UserId"]},0"}
                         module_type:{eq:"b2b_flight"}
                         ${flight_airline_id}
                     }
                  ) {
                    id
                    value
                    api_value
                    value_type
                    module_type
                    domain_list_fk
                    commission_currency
                    auth_user_id
                    segment_list
                    flight_airline_id
                    flightAirline{
                        code
                        name
                    }
                  }
              }
            `,
                "coreCommissions"
            );
            return result;
        }
    }
    async getGdsFlightCommissionDetails(searchData: any): Promise<any> {
        if (searchData["UserType"] == "B2B" && searchData["UserId"]) {
            let flight_airline_id: any = '';
            if (searchData["FlightId"]) {
                flight_airline_id = `where:{flight_airline_id:{ in: "${searchData["FlightId"]},0"}}`;
            }
            const result = await this.getGraphData(`
            query {
              flightGdsCommissions (take:1000,${flight_airline_id}
                  ) {
                  id
                  value
                  value_type
                  segment_list
                  flight_airline_id
                  flightAirline{
                      code
                      name
                  }
              }
            }
        `,
                'flightGdsCommissions');
            return result;
        }
    }

    async listFlightTopDestination(@Body() body: ListFlightTopDestinationsDto): Promise<any> {
        try {
            const result = await this.getGraphData(
                `query {
                      flightTopDestinations(where:{
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
                        from_airport_code
    					from_airport_name
    					to_airport_code
    					to_airport_name
    					image
    					airlines
    					trip_type
    					travel_date
    					return_date
    					class
    					widget_title
    					created_by_id
                        status
                        source
    					created_at    
                    }
                }
            `,
                "flightTopDestinations"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async update_flight_booking_status(
        flight_booking_status,
        app_reference,
        sequence_number,
        booking_source
    ) {
        let createdDate = moment.utc(Date.now()).format("YYYY-MM-DD HH:mm:ss");
        await this.manager.query(`
            START TRANSACTION;
                UPDATE flight_booking_transactions SET booking_status = "${flight_booking_status}" WHERE app_reference = "${app_reference}";
                UPDATE flight_booking_transaction_passengers SET booking_status = "${flight_booking_status}" WHERE app_reference = "${app_reference}";
                UPDATE flight_bookings SET booking_status = "${flight_booking_status}", created_datetime = "${createdDate}" WHERE app_reference = "${app_reference}";
            COMMIT;
        `);
    }

    async addRecentSearch(req: any, body: any) {
        const segments = [];
        body.segments.forEach((element) => {
            segments.push(JSON.parse(element.replace(/\\/, "")));
        });
        var tempSegments = JSON.stringify(segments);
        tempSegments = tempSegments.replace(/"/g, "'");
        const patch_value = body.patch_value.replace(/"/g, "'").replace(/\\/g, "");
        try {
            const result = await this.getGraphData(
                `mutation{
                createFlightRecentSearch(flightRecentSearch:{
                  created_by_id:${req.user.id}
                  status:${1}
                  booking_source:"b2c"
                  adult:${body.adult}
                  child:${body.child}
                  infant:${body.infant}
                  preferred_airlines:"${body.preferred_airlines}"
                  journey_type:"${body.journey_type}"
                  segments:"${tempSegments}"
                  flight_image:"${body.flight_image}"
                  patch_value:"${patch_value}"
                  
                }){
                   id
                  created_at
                  created_by_id
                  status
                  booking_source
                  adult
                  child
                  infant
                  preferred_airlines
                  journey_type
                  segments
                  flight_image
                  patch_value
                }
              }`,
                `createFlightRecentSearch`
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
                `
                query {
                    flightRecentSearches (
                        take:4
                        order: {
                            created_at: DESC
                        }
                        where: {
                            created_by_id: {
                                eq:${req.user.id}
                            }
                            status: {
                                eq:${1}
                            }
                            booking_source: {
                                eq:"b2c"
                            }
                        }
                    ) {
                        id
                        created_at
                        created_by_id
                        status
                        booking_source
                        adult
                        child
                        infant
                        preferred_airlines
                        journey_type
                        segments
                        flight_image
                        patch_value
                    }
                }
            `,
                `flightRecentSearches`
            );
            return result.map((t) => {
                const tempData = {
                    ...t,
                    source: "db",
                };
                return this.getUniversalRecentSearch(tempData);
            });
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async deleteRecentSearch(req, body) {
        try {
            const result = await this.getGraphData(
                `mutation{
                    deleteFlightRecentSearch(id:${body.id})
                  }`,
                `deleteFlightRecentSearch`
            );

            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
    async markupAndCommissionDetails(body) {
        let admin_markup: any = [], agent_markup: any = [], commission: any = [], commissionDetails: any = {}, markupDetails: any = {};
        if (body['UserType']) {
            if (body['UserType'] == "B2B") {
                if (body["AirlineCode"]) {
                    const flight_id = await this.manager.query(
                        `Select id from flight_airlines WHERE code = "${body["AirlineCode"]}";`
                    );
                    body['FlightId'] = flight_id[0].id;
                }

                agent_markup = await this.getFlightMarkupDetails(body, "b2b_flight", "b2b_own");
                markupDetails.agentMarkup = agent_markup.length > 0 ? agent_markup : [];

                commission = await this.getFlightCommissionDetails(body);
                commissionDetails.commission = commission.length > 0 ? commission : [];

                let gdscommission = await this.getGdsFlightCommissionDetails(body);
                commissionDetails.gdscommission = gdscommission.length > 0 ? gdscommission : [];

                if (body["booking_source"] == "ZBAPINO00002") {
                    const newBody = {
                        ...body,
                        "UserId": body["GroupId"] ?? body["UserId"]
                    }

                    admin_markup = await this.getFlightMarkupDetails(newBody, "b2b_flight", "b2b_admin");
                    markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
                } else {
                    admin_markup = await this.getFlightMarkupDetails(body, "b2b_flight", "b2b_admin");
                    markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
                }

            } else {
                commissionDetails.commission = [];
                commissionDetails.gdscommission = [];
                body["UserId"] = 0;
                admin_markup = await this.getFlightMarkupDetails(body, "b2c_flight", "b2c_admin");
                markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
            }
        } else {
            commissionDetails.commission = [];
            commissionDetails.gdscommission = [];
            body["UserId"] = 0;
            admin_markup = await this.getFlightMarkupDetails(body, "b2c_flight", "b2c_admin");
            markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
        }
        return {
            markupDetails,
            commissionDetails
        }
    }
    async specificMarkupAndCommissionDetails(search_data, markupAndCommission) {
        let markup: any = [];
        const AirlineCode = search_data["AirlineCode"];
        let AirlineCommission: any = '';
        let GdsCommission: any = '';
        let AdminMarkup: any = '';
        let AgentMarkup: any = '';
        let commissionDetails: any = {};
        // Commission
        if (search_data.UserType == "B2B") {
            let commission: any = markupAndCommission.commissionDetails.commission;
            if (commission.length > 0) {
                AirlineCommission = commission.find(element => element.flightAirline.code === AirlineCode);
                if (!AirlineCommission) {
                    AirlineCommission = commission.find(element => element.flightAirline.code === 'ALL');
                } else {
                    if (AirlineCommission["segment_list"]) {
                        const segment_list = JSON.parse(AirlineCommission["segment_list"].replace(/'/g, '"'));
                        const search_seg = search_data["Segments"][0]["Origin"] + "-" + search_data["Segments"][0]["Destination"];
                        if (search_seg in segment_list) {
                            let seg_com = segment_list[search_seg];
                            AirlineCommission["value"] = seg_com;
                        }
                    }
                }
            }
            let gdscommission: any = markupAndCommission.commissionDetails.gdscommission;
            if (gdscommission.length > 0) {
                GdsCommission = gdscommission.find(element => element.flightAirline.code === AirlineCode);
                if (!GdsCommission) {
                    GdsCommission = gdscommission.find(element => element.flightAirline.code === 'ALL');
                } else {
                    if (GdsCommission["segment_list"]) {
                        const segment_list = JSON.parse(GdsCommission["segment_list"].replace(/'/g, '"'));
                        const search_seg = search_data["Segments"][0]["Origin"] + "-" + search_data["Segments"][0]["Destination"];
                        if (search_seg in segment_list) {
                            let seg_com = segment_list[search_seg];
                            GdsCommission["value"] = seg_com;
                        }
                    }
                }
            }

            let admin_markup: any = markupAndCommission.markupDetails.adminMarkup;
            if (admin_markup.length > 0) {
                AdminMarkup = admin_markup.find(element => element.type === 'supplier');
                // AdminMarkup = admin_markup.find(element => element.flightAirline.code === AirlineCode);
                // if (!AdminMarkup) {
                //     AdminMarkup = admin_markup.find(element => (element.flightAirline.code === 'ALL' && element.type !== 'supplier'));
                //     if (!AdminMarkup) {
                //     }
                // } else {
                //     if (AdminMarkup["segment_list"]) {
                //         const segment_list = JSON.parse(AdminMarkup["segment_list"].replace(/'/g, '"'));
                //         const search_seg = search_data["Segments"][0]["Origin"] + "-" + search_data["Segments"][0]["Destination"];
                //         if (search_seg in segment_list) {
                //             let seg_com = segment_list[search_seg];
                //             AdminMarkup["value"] = seg_com;
                //         }
                //     }
                // }
            }

            let agent_markup: any = markupAndCommission.markupDetails.agentMarkup;
            if (agent_markup.length > 0) {
                AgentMarkup = agent_markup.find(element => element.flightAirline.code === AirlineCode);
                if (!AgentMarkup) {
                    AgentMarkup = agent_markup.find(element => element.flightAirline.code === 'ALL');
                } else {
                    if (AgentMarkup["segment_list"]) {
                        const segment_list = JSON.parse(AgentMarkup["segment_list"].replace(/'/g, '"'));
                        const search_seg = search_data["Segments"][0]["Origin"] + "-" + search_data["Segments"][0]["Destination"];
                        if (search_seg in segment_list) {
                            let seg_com = segment_list[search_seg];
                            AgentMarkup["value"] = seg_com;
                        }
                    }
                }
            }

        } else {
            let admin_markup: any = markupAndCommission.markupDetails.adminMarkup;
            if (admin_markup.length > 0) {
                AdminMarkup = admin_markup.find(element => element.flightAirline.code === AirlineCode);
                if (!AdminMarkup) {
                    AdminMarkup = admin_markup.find(element => (element.flightAirline.code === 'ALL' && element.type !== 'supplier'));
                    if (!AdminMarkup) {
                        AdminMarkup = admin_markup.find(element => element.type === 'supplier');
                    }
                } else {
                    if (AdminMarkup["segment_list"]) {
                        const segment_list = JSON.parse(AdminMarkup["segment_list"].replace(/'/g, '"'));
                        const search_seg = search_data["Segments"][0]["Origin"] + "-" + search_data["Segments"][0]["Destination"];
                        if (search_seg in segment_list) {
                            let seg_com = segment_list[search_seg];
                            AdminMarkup["value"] = seg_com;
                        }
                    }
                }
            }
        }
        return {
            markupDetails: {
                AdminMarkup,
                AgentMarkup
            },
            commissionDetails: {
                AirlineCommission,
                GdsCommission
            }

        }
    }

    // async formatPriceDetail(
    //     UserId,
    //     UserType,
    //     Currency,
    //     TotalDisplayFare,
    //     PriceBreakupBasicFare,
    //     PriceBreakupTax,
    //     PriceBreakupAgentCommission,
    //     PriceBreakupAgentTdsOnCommision,
    //     PriceBreakupRBD,
    //     TaxDetails1,
    //     PriceBreakupFareType,
    //     PassengerBreakup,
    //     airlineMarkupAndCommission,
    //     AirlineCode,
    //     is_domestic = 'International',
    //     request_type = 'search'
    // ) {
    //     let markUpData: any = {};
    //     let agentCommission: any = PriceBreakupAgentCommission;
    //     let gdsCommission: any = 0;
    //     let admin_markup: any = 0.0;
    //     let agent_markup: any = 0.0;
    //     let AgentNetFare: any = 0.0;
    //     let advanceTax: any = 0.0;

    //     if (PassengerBreakup) {
    //         if (PassengerBreakup.ADT) {
    //             PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice);
    //             PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice);
    //             PassengerBreakup.ADT.Tax = Number(PassengerBreakup.ADT.Tax);
    //         }
    //         if (PassengerBreakup.CHD) {
    //             PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice);
    //             PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice);
    //             PassengerBreakup.CHD.Tax = Number(PassengerBreakup.CHD.Tax);
    //         }
    //         if (PassengerBreakup.INF) {
    //             PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice);
    //             PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice);
    //             PassengerBreakup.INF.Tax = Number(PassengerBreakup.INF.Tax);
    //         }
    //     }
    //     if (UserType == "B2B") {
    //         let gds_commission: any = 0;
    //         let airline_commission: any = 0;
    //         if (airlineMarkupAndCommission['commissionDetails'] && airlineMarkupAndCommission['commissionDetails']["GdsCommission"]) {
    //             let GdsCommission = airlineMarkupAndCommission['commissionDetails']["GdsCommission"];
    //             gdsCommission = (PriceBreakupBasicFare * GdsCommission['value']) / 100;
    //             gds_commission = GdsCommission['value'];
    //         }

    //         if (airlineMarkupAndCommission['commissionDetails'] && airlineMarkupAndCommission['commissionDetails']["AirlineCommission"]) {
    //             let AirlineCommission = airlineMarkupAndCommission['commissionDetails']["AirlineCommission"];
    //             agentCommission = (gdsCommission * AirlineCommission['value']) / 100;
    //             airline_commission = AirlineCommission['value'];
    //         }
    //         // Admin Markup
    //         if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AdminMarkup"]) {

    //             let AdminMarkup = airlineMarkupAndCommission['markupDetails']["AdminMarkup"];
    //             let value: any = 0.0;
    //             let value_type: any = '';
    //             let ad_m = AdminMarkup['value'] + "";
    //             if (ad_m.includes('--')) {
    //                 let price_value = AdminMarkup['value'].split('--');
    //                 value = -parseFloat(price_value[1]).toFixed(2);
    //                 value_type = price_value[0];
    //             } else if (ad_m.includes('p')) {
    //                 let price_value = AdminMarkup['value'].split('-');
    //                 value = parseFloat(price_value[1]).toFixed(2);
    //                 value_type = price_value[0];
    //             } else {
    //                 value = parseFloat(AdminMarkup['value']).toFixed(2);
    //                 value_type = AdminMarkup['value_type'];
    //             }

    //             let pax_count: number = 0;
    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.ADT) {
    //                     if (value_type == "percentage") {
    //                         if (gds_commission && airline_commission) {
    //                             let ad_c = (PassengerBreakup.ADT.BasePrice * gds_commission) / 100;
    //                             let ag_c = (ad_c * airline_commission) / 100;
    //                             PassengerBreakup.ADT.BasePrice += ((PassengerBreakup.ADT.BasePrice - ag_c) * value) / 100;
    //                         } else {
    //                             let ad_c = ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
    //                             PassengerBreakup.ADT.BasePrice += ad_c;
    //                         }
    //                     } else if (value_type == "plus") {
    //                         PassengerBreakup.ADT.BasePrice += (value * PassengerBreakup.ADT.PassengerCount);
    //                     }
    //                     PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax);
    //                     pax_count += PassengerBreakup.ADT.PassengerCount;
    //                     PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice.toFixed(2));
    //                     PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice.toFixed(2));

    //                 }
    //             }

    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.CHD) {
    //                     if (value_type == "percentage") {
    //                         if (gds_commission && airline_commission) {
    //                             let ad_c = (PassengerBreakup.CHD.BasePrice * gds_commission) / 100;
    //                             let ag_c = (ad_c * airline_commission) / 100;
    //                             PassengerBreakup.CHD.BasePrice += ((PassengerBreakup.CHD.BasePrice - ag_c) * value) / 100;
    //                         } else {
    //                             let ad_c = ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
    //                             PassengerBreakup.CHD.BasePrice += ad_c;
    //                         }
    //                     } else if (value_type == "plus") {
    //                         PassengerBreakup.CHD.BasePrice += (value * PassengerBreakup.CHD.PassengerCount);
    //                     }
    //                     PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax);
    //                     pax_count += PassengerBreakup.CHD.PassengerCount;
    //                     PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice.toFixed(2));
    //                     PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice.toFixed(2));
    //                 }
    //             }

    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.INF) {
    //                     if (value_type == "percentage") {
    //                         if (gds_commission && airline_commission) {
    //                             let ad_c = (PassengerBreakup.INF.BasePrice * gds_commission) / 100;
    //                             let ag_c = (ad_c * airline_commission) / 100;
    //                             PassengerBreakup.INF.BasePrice += ((PassengerBreakup.INF.BasePrice - ag_c) * value) / 100;
    //                         } else {
    //                             let ad_c = ((PassengerBreakup.INF.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
    //                             PassengerBreakup.INF.BasePrice += ad_c;
    //                         }
    //                     } else if (value_type == "plus") {
    //                         PassengerBreakup.INF.BasePrice += (value * PassengerBreakup.INF.PassengerCount);
    //                     }
    //                     PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax);
    //                     pax_count += PassengerBreakup.INF.PassengerCount;
    //                     PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice.toFixed(2));
    //                     PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice.toFixed(2));
    //                 }
    //             }
    //             if (value_type == "percentage") {
    //                 admin_markup = ((parseFloat(PriceBreakupBasicFare) - parseFloat(agentCommission)) * parseFloat(value)) / 100;
    //             } else if (value_type == "plus") {
    //                 admin_markup = value * pax_count;
    //             }
    //         }

    //         // Admin Markup
    //         if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AgentMarkup"]) {
    //             let AgentMarkup = airlineMarkupAndCommission['markupDetails']["AgentMarkup"];

    //             let value: any = 0.0;
    //             let value_type: any = '';
    //             let ag_m = AgentMarkup['value'] + "";

    //             if (ag_m.includes('--')) {
    //                 let price_value = AgentMarkup['value'].split('--');
    //                 value = -parseFloat(price_value[1]).toFixed(2);
    //                 value_type = price_value[0];
    //             } else if (ag_m.includes('p')) {
    //                 let price_value = AgentMarkup['value'].split('-');
    //                 value = parseFloat(price_value[1]).toFixed(2);
    //                 value_type = price_value[0];
    //             } else {
    //                 value = parseFloat(AgentMarkup['value']).toFixed(2);
    //                 value_type = AgentMarkup['value_type'];
    //             }
    //             let pax_count: number = 0;
    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.ADT) {
    //                     pax_count += PassengerBreakup.ADT.PassengerCount;
    //                 }
    //                 if (PassengerBreakup.CHD) {
    //                     pax_count += PassengerBreakup.CHD.PassengerCount;
    //                 }
    //                 if (PassengerBreakup.INF) {
    //                     pax_count += PassengerBreakup.INF.PassengerCount;
    //                 }
    //             }
    //             if (value_type == "percentage") {
    //                 agent_markup = ((parseFloat(PriceBreakupBasicFare) - parseFloat(agentCommission) + (admin_markup)) * value) / 100;
    //             } else if (value_type == "plus") {
    //                 agent_markup = value * pax_count;
    //             }
    //         }
    //         TotalDisplayFare = Number((TotalDisplayFare + agent_markup + admin_markup).toFixed(2));
    //         AgentNetFare = Number((TotalDisplayFare - agent_markup - agentCommission).toFixed(2));
    //         PriceBreakupBasicFare = Number((PriceBreakupBasicFare + admin_markup).toFixed(2));
    //     } else {
    //         // Admin Markup
    //         if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AdminMarkup"]) {

    //             let AdminMarkup = airlineMarkupAndCommission['markupDetails']["AdminMarkup"];
    //             let value: any = 0.0;
    //             let value_type: any = '';
    //             let ad_m = AdminMarkup['value'] + "";
    //             if (ad_m.includes('--')) {
    //                 let price_value = AdminMarkup['value'].split('--');
    //                 value = -parseFloat(price_value[1]).toFixed(2);
    //                 value_type = price_value[0];
    //             } else if (ad_m.includes('p')) {
    //                 let price_value = AdminMarkup['value'].split('-');
    //                 value = parseFloat(price_value[1]).toFixed(2);
    //                 value_type = price_value[0];
    //             } else {
    //                 value = parseFloat(AdminMarkup['value']).toFixed(2);
    //                 value_type = AdminMarkup['value_type'];
    //             }

    //             let pax_count: number = 0;
    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.ADT) {
    //                     if (value_type == "percentage") {
    //                         let ad_c = ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
    //                         PassengerBreakup.ADT.BasePrice += ad_c;
    //                     } else if (value_type == "plus") {
    //                         PassengerBreakup.ADT.BasePrice += (value * PassengerBreakup.ADT.PassengerCount);
    //                     }
    //                     PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax);
    //                     pax_count += PassengerBreakup.ADT.PassengerCount;
    //                     PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice.toFixed(2));
    //                     PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice.toFixed(2));

    //                 }
    //             }

    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.CHD) {
    //                     if (value_type == "percentage") {
    //                         let ad_c = ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
    //                         PassengerBreakup.CHD.BasePrice += ad_c;
    //                     } else if (value_type == "plus") {
    //                         PassengerBreakup.CHD.BasePrice += (value * PassengerBreakup.CHD.PassengerCount);
    //                     }
    //                     PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax);
    //                     pax_count += PassengerBreakup.CHD.PassengerCount;
    //                     PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice.toFixed(2));
    //                     PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice.toFixed(2));
    //                 }
    //             }

    //             if (PassengerBreakup) {
    //                 if (PassengerBreakup.INF) {
    //                     if (value_type == "percentage") {
    //                         let ad_c = ((PassengerBreakup.INF.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
    //                         PassengerBreakup.INF.BasePrice += ad_c;
    //                     } else if (value_type == "plus") {
    //                         PassengerBreakup.INF.BasePrice += (value * PassengerBreakup.INF.PassengerCount);
    //                     }
    //                     PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax);
    //                     pax_count += PassengerBreakup.INF.PassengerCount;
    //                     PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice.toFixed(2));
    //                     PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice.toFixed(2));
    //                 }
    //             }
    //             if (value_type == "percentage") {
    //                 admin_markup = (parseFloat(PriceBreakupBasicFare) * parseFloat(value)) / 100;
    //             } else if (value_type == "plus") {
    //                 admin_markup = value * pax_count;
    //             }

    //             TotalDisplayFare = Number((TotalDisplayFare + admin_markup).toFixed(2));
    //             AgentNetFare = Number((TotalDisplayFare).toFixed(2));
    //             PriceBreakupBasicFare = Number((PriceBreakupBasicFare + admin_markup).toFixed(2));

    //         }
    //     }


    //     //if (request_type == 'farequote') {
    //     //if (is_domestic === "International") {
    //     advanceTax = (ADVANCE_TAX_PERCENT * parseFloat(TotalDisplayFare)).toFixed(2);
    //     TotalDisplayFare = parseFloat(advanceTax) + parseFloat(TotalDisplayFare)
    //     if (AgentNetFare) {
    //         AgentNetFare = parseFloat(advanceTax) + parseFloat(AgentNetFare)
    //     }
    //     advanceTax = parseFloat(advanceTax);


    //     //}
    //     //}
    //     return {
    //         Currency: Currency,
    //         TotalDisplayFare: Number(TotalDisplayFare.toFixed(2)),
    //         AgentNetFare: Number(AgentNetFare.toFixed(2)),
    //         PriceBreakup: {
    //             BasicFare: PriceBreakupBasicFare,
    //             Tax: PriceBreakupTax,
    //             AdvanceTax: Number(advanceTax.toFixed(2)),
    //             MarkUpDetails: {
    //                 AgentMarkup: Number(agent_markup.toFixed(2)),
    //                 AdminMarkup: Number(admin_markup.toFixed(2))
    //             },
    //             CommissionDetails: {
    //                 GdsCommission: Number(gdsCommission.toFixed(2)),
    //                 AdminCommission: Number((gdsCommission - agentCommission).toFixed(2)),
    //                 AgentCommission: Number(agentCommission.toFixed(2)) ? Number(agentCommission.toFixed(2)) : 0,
    //                 AgentTdsOnCommision: PriceBreakupAgentTdsOnCommision
    //             },

    //             RBD: PriceBreakupRBD,
    //             TaxDetails: TaxDetails1,
    //             FareType: PriceBreakupFareType,
    //         },
    //         PassengerBreakup: PassengerBreakup,
    //     };
    // }
    
    async formatPriceDetail(
        UserId,
        UserType,
        Currency,
        TotalDisplayFare,
        PriceBreakupBasicFare,
        PriceBreakupTax,
        PriceBreakupAgentCommission,
        PriceBreakupAgentTdsOnCommision,
        PriceBreakupRBD,
        TaxDetails1,
        PriceBreakupFareType,
        PassengerBreakup,
        airlineMarkupAndCommission,
        AirlineCode,
        is_domestic = 'International',
        request_type = 'search'
    ) {
        let markUpData: any = {};
        let agentCommission: any = PriceBreakupAgentCommission;
        let gdsCommission: any = 0;
        let admin_markup: any = 0.0;
        let agent_markup: any = 0.0;
        let AgentNetFare: any = 0.0;
        let advanceTax: any = 0.0;

        if (PassengerBreakup) {
            if (PassengerBreakup.ADT) {
                PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice);
                PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice);
                PassengerBreakup.ADT.Tax = Number(PassengerBreakup.ADT.Tax);
            }
            if (PassengerBreakup.CHD) {
                PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice);
                PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice);
                PassengerBreakup.CHD.Tax = Number(PassengerBreakup.CHD.Tax);
            }
            if (PassengerBreakup.INF) {
                PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice);
                PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice);
                PassengerBreakup.INF.Tax = Number(PassengerBreakup.INF.Tax);
            }
        }
        if (UserType == "B2B") {
            let gds_commission: any = 0;
            let airline_commission: any = 0;
            if (airlineMarkupAndCommission['commissionDetails'] && airlineMarkupAndCommission['commissionDetails']["GdsCommission"]) {
                let GdsCommission = airlineMarkupAndCommission['commissionDetails']["GdsCommission"];
                gdsCommission = (PriceBreakupBasicFare * GdsCommission['value']) / 100;
                gds_commission = GdsCommission['value'];
            }

            if (airlineMarkupAndCommission['commissionDetails'] && airlineMarkupAndCommission['commissionDetails']["AirlineCommission"]) {
                let AirlineCommission = airlineMarkupAndCommission['commissionDetails']["AirlineCommission"];
                agentCommission = (gdsCommission * AirlineCommission['value']) / 100;
                airline_commission = AirlineCommission['value'];
            }
            // Admin Markup
            if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AdminMarkup"]) {

                let AdminMarkup = airlineMarkupAndCommission['markupDetails']["AdminMarkup"];
                let value: any = 0.0;
                let value_type: any = '';
                let ad_m = AdminMarkup['value'] + "";
                if (ad_m.includes('--')) {
                    let price_value = AdminMarkup['value'].split('--');
                    value = -parseFloat(price_value[1]).toFixed(2);
                    value_type = price_value[0];
                } else if (ad_m.includes('p')) {
                    let price_value = AdminMarkup['value'].split('-');
                    value = parseFloat(price_value[1]).toFixed(2);
                    value_type = price_value[0];
                } else {
                    value = parseFloat(AdminMarkup['value']).toFixed(2);
                    value_type = AdminMarkup['value_type'];
                }

                let pax_count: number = 0;
                if (PassengerBreakup) {
                    if (PassengerBreakup.ADT) {
                        if (value_type == "percentage") {
                            if (gds_commission && airline_commission) {
                                let ad_c = (PassengerBreakup.ADT.BasePrice * gds_commission) / 100;
                                let ag_c = (ad_c * airline_commission) / 100;
                                PassengerBreakup.ADT.BasePrice += ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
                            } else {
                                let ad_c = ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
                                PassengerBreakup.ADT.BasePrice += ad_c;
                            }
                        } else if (value_type == "plus") {
                            PassengerBreakup.ADT.BasePrice += parseFloat(value); //(value * PassengerBreakup.ADT.PassengerCount);
                        }
                        PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax);
                        pax_count += PassengerBreakup.ADT.PassengerCount;
                        PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice.toFixed(2));
                        PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice.toFixed(2));

                    }
                }

                if (PassengerBreakup) {
                    if (PassengerBreakup.CHD) {
                        if (value_type == "percentage") {
                            if (gds_commission && airline_commission) {
                                let ad_c = (PassengerBreakup.CHD.BasePrice * gds_commission) / 100;
                                let ag_c = (ad_c * airline_commission) / 100;
                                PassengerBreakup.CHD.BasePrice += ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax) * value) / 100;
                            } else {
                                let ad_c = ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax) * value) / 100;
                                PassengerBreakup.CHD.BasePrice += ad_c;
                            }
                        } else if (value_type == "plus") {
                            PassengerBreakup.CHD.BasePrice += parseFloat(value); //(value * PassengerBreakup.CHD.PassengerCount);
                        }
                        PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax);
                        pax_count += PassengerBreakup.CHD.PassengerCount;
                        PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice.toFixed(2));
                        PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice.toFixed(2));
                    }
                }

                if (PassengerBreakup) {
                    if (PassengerBreakup.INF) {
                        if (value_type == "percentage") {
                            if (gds_commission && airline_commission) {
                                let ad_c = (PassengerBreakup.INF.BasePrice * gds_commission) / 100;
                                let ag_c = (ad_c * airline_commission) / 100;
                                PassengerBreakup.INF.BasePrice += ((PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax) * value) / 100;
                            } else {
                                let ad_c = ((PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax) * value) / 100;
                                PassengerBreakup.INF.BasePrice += ad_c;
                            }
                        } else if (value_type == "plus") {
                            PassengerBreakup.INF.BasePrice += parseFloat(value); //(value * PassengerBreakup.INF.PassengerCount);
                        }
                        PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax);
                        pax_count += PassengerBreakup.INF.PassengerCount;
                        PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice.toFixed(2));
                        PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice.toFixed(2));
                    }
                }
                
                if (value_type == "percentage") {
                    // admin_markup = ((parseFloat(TotalDisplayFare) - parseFloat(agentCommission)) * parseFloat(value)) / 100;
                    admin_markup = (parseFloat(TotalDisplayFare) * parseFloat(value)) / 100;
                } else if (value_type == "plus") {
                    admin_markup = value * pax_count;
                }
            }

            // Admin Markup
            if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AgentMarkup"]) {
                let AgentMarkup = airlineMarkupAndCommission['markupDetails']["AgentMarkup"];

                let value: any = 0.0;
                let value_type: any = '';
                let ag_m = AgentMarkup['value'] + "";

                if (ag_m.includes('--')) {
                    let price_value = AgentMarkup['value'].split('--');
                    value = -parseFloat(price_value[1]).toFixed(2);
                    value_type = price_value[0];
                } else if (ag_m.includes('p')) {
                    let price_value = AgentMarkup['value'].split('-');
                    value = parseFloat(price_value[1]).toFixed(2);
                    value_type = price_value[0];
                } else {
                    value = parseFloat(AgentMarkup['value']).toFixed(2);
                    value_type = AgentMarkup['value_type'];
                }
                let pax_count: number = 0;
                if (PassengerBreakup) {
                    if (PassengerBreakup.ADT) {
                        if (value_type == "percentage") {
                            if (gds_commission && airline_commission) {
                                let ad_c = (PassengerBreakup.ADT.BasePrice * gds_commission) / 100;
                                let ag_c = (ad_c * airline_commission) / 100;
                                PassengerBreakup.ADT.BasePrice += ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;                                
                            } else {
                                let ad_c = ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
                                PassengerBreakup.ADT.BasePrice += ad_c;
                            }
                        } else if (value_type == "plus") {
                            PassengerBreakup.ADT.BasePrice += parseFloat(value); //(value * PassengerBreakup.ADT.PassengerCount);
                        }
                        PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax);
                        pax_count += PassengerBreakup.ADT.PassengerCount;
                        PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice.toFixed(2));
                        PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice.toFixed(2));

                    }
                }

                if (PassengerBreakup) {
                    if (PassengerBreakup.CHD) {
                        if (value_type == "percentage") {
                            if (gds_commission && airline_commission) {
                                let ad_c = (PassengerBreakup.CHD.BasePrice * gds_commission) / 100;
                                let ag_c = (ad_c * airline_commission) / 100;
                                PassengerBreakup.CHD.BasePrice += ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax) * value) / 100;
                            } else {
                                let ad_c = ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax) * value) / 100;
                                PassengerBreakup.CHD.BasePrice += ad_c;
                            }
                        } else if (value_type == "plus") {
                            PassengerBreakup.CHD.BasePrice += parseFloat(value); //(value * PassengerBreakup.CHD.PassengerCount);
                        }
                        PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax);
                        pax_count += PassengerBreakup.CHD.PassengerCount;
                        PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice.toFixed(2));
                        PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice.toFixed(2));
                    }
                }

                if (PassengerBreakup) {
                    if (PassengerBreakup.INF) {
                        if (value_type == "percentage") {
                            if (gds_commission && airline_commission) {
                                let ad_c = (PassengerBreakup.INF.BasePrice * gds_commission) / 100;
                                let ag_c = (ad_c * airline_commission) / 100;
                                PassengerBreakup.INF.BasePrice += ((PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax) * value) / 100;
                            } else {
                                let ad_c = ((PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax) * value) / 100;
                                PassengerBreakup.INF.BasePrice += ad_c;
                            }
                        } else if (value_type == "plus") {
                            PassengerBreakup.INF.BasePrice += parseFloat(value); //(value * PassengerBreakup.INF.PassengerCount);
                        }
                        PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax);
                        pax_count += PassengerBreakup.INF.PassengerCount;
                        PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice.toFixed(2));
                        PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice.toFixed(2));
                    }
                }
                if (value_type == "percentage") {
                    // agent_markup = ((parseFloat(TotalDisplayFare) - parseFloat(agentCommission) + (admin_markup)) * value) / 100;
                    agent_markup = ((parseFloat(TotalDisplayFare) + (admin_markup)) * value) / 100;
                } else if (value_type == "plus") {
                    agent_markup = value * pax_count;
                }
            }
            TotalDisplayFare = Number((TotalDisplayFare + agent_markup + admin_markup).toFixed(2));
            AgentNetFare = Number((TotalDisplayFare - agent_markup - agentCommission).toFixed(2));
            PriceBreakupBasicFare = Number((PriceBreakupBasicFare + admin_markup + agent_markup).toFixed(2));
        } else {
            // Admin Markup
            if (airlineMarkupAndCommission['markupDetails'] && airlineMarkupAndCommission['markupDetails']["AdminMarkup"]) {

                let AdminMarkup = airlineMarkupAndCommission['markupDetails']["AdminMarkup"];
                let value: any = 0.0;
                let value_type: any = '';
                let ad_m = AdminMarkup['value'] + "";
                if (ad_m.includes('--')) {
                    let price_value = AdminMarkup['value'].split('--');
                    value = -parseFloat(price_value[1]).toFixed(2);
                    value_type = price_value[0];
                } else if (ad_m.includes('p')) {
                    let price_value = AdminMarkup['value'].split('-');
                    value = parseFloat(price_value[1]).toFixed(2);
                    value_type = price_value[0];
                } else {
                    value = parseFloat(AdminMarkup['value']).toFixed(2);
                    value_type = AdminMarkup['value_type'];
                }

                let pax_count: number = 0;
                if (PassengerBreakup) {
                    if (PassengerBreakup.ADT) {
                        if (value_type == "percentage") {
                            let ad_c = ((PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
                            PassengerBreakup.ADT.BasePrice += ad_c;
                        } else if (value_type == "plus") {
                            PassengerBreakup.ADT.BasePrice += (value * PassengerBreakup.ADT.PassengerCount);
                        }
                        PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.BasePrice + PassengerBreakup.ADT.Tax);
                        pax_count += PassengerBreakup.ADT.PassengerCount;
                        PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice.toFixed(2));
                        PassengerBreakup.ADT.BasePrice = Number(PassengerBreakup.ADT.BasePrice.toFixed(2));

                    }
                }

                if (PassengerBreakup) {
                    if (PassengerBreakup.CHD) {
                        if (value_type == "percentage") {
                            let ad_c = ((PassengerBreakup.CHD.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
                            PassengerBreakup.CHD.BasePrice += ad_c;
                        } else if (value_type == "plus") {
                            PassengerBreakup.CHD.BasePrice += (value * PassengerBreakup.CHD.PassengerCount);
                        }
                        PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.BasePrice + PassengerBreakup.CHD.Tax);
                        pax_count += PassengerBreakup.CHD.PassengerCount;
                        PassengerBreakup.CHD.TotalPrice = Number(PassengerBreakup.CHD.TotalPrice.toFixed(2));
                        PassengerBreakup.CHD.BasePrice = Number(PassengerBreakup.CHD.BasePrice.toFixed(2));
                    }
                }

                if (PassengerBreakup) {
                    if (PassengerBreakup.INF) {
                        if (value_type == "percentage") {
                            let ad_c = ((PassengerBreakup.INF.BasePrice + PassengerBreakup.ADT.Tax) * value) / 100;
                            PassengerBreakup.INF.BasePrice += ad_c;
                        } else if (value_type == "plus") {
                            PassengerBreakup.INF.BasePrice += (value * PassengerBreakup.INF.PassengerCount);
                        }
                        PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.BasePrice + PassengerBreakup.INF.Tax);
                        pax_count += PassengerBreakup.INF.PassengerCount;
                        PassengerBreakup.INF.TotalPrice = Number(PassengerBreakup.INF.TotalPrice.toFixed(2));
                        PassengerBreakup.INF.BasePrice = Number(PassengerBreakup.INF.BasePrice.toFixed(2));
                    }
                }
                if (value_type == "percentage") {
                    admin_markup = (parseFloat(TotalDisplayFare) * parseFloat(value)) / 100;
                } else if (value_type == "plus") {
                    admin_markup = value * pax_count;
                }

                TotalDisplayFare = Number((TotalDisplayFare + admin_markup).toFixed(2));
                AgentNetFare = Number((TotalDisplayFare).toFixed(2));
                PriceBreakupBasicFare = Number((PriceBreakupBasicFare + admin_markup).toFixed(2));

            }
        }


        //if (request_type == 'farequote') {
        //if (is_domestic === "International") {
        advanceTax = (ADVANCE_TAX_PERCENT * parseFloat(TotalDisplayFare)).toFixed(2);
        TotalDisplayFare = parseFloat(advanceTax) + parseFloat(TotalDisplayFare)
        if (AgentNetFare) {
            AgentNetFare = parseFloat(advanceTax) + parseFloat(AgentNetFare)
        }
        advanceTax = parseFloat(advanceTax);

        if (PassengerBreakup) {
            if (PassengerBreakup.ADT) {
                PassengerBreakup.ADT.TotalPrice = Number(PassengerBreakup.ADT.TotalPrice) + advanceTax;
                PassengerBreakup.ADT.Tax = Number(PassengerBreakup.ADT.Tax) + advanceTax;
            }
        }

        // const query = `select * from core_payment_charges WHERE module = 'Flight';`
        // const queryResponse = await this.manager.query(query);
        
        let ConvinenceFee: any = 0;
        // if (queryResponse[0].status == 1) {

        //     if (queryResponse[0].fees_type === 'percentage') {
        //         const percentageAdvanceTax = (TotalDisplayFare * queryResponse[0].fees) / 100;
        //         ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));

        //     } else if (queryResponse[0].fees_type === 'plus') {
        //         const percentageAdvanceTax = queryResponse[0].fees;
        //         ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));
        //     }

        //     if (queryResponse[0].added_per_pax === "Yes") {
        //         let passengerCount = 0;
        //         Object.keys(PassengerBreakup).map(
        //             (key) => {
        //                 passengerCount += PassengerBreakup[key].PassengerCount
        //             }
        //         );
                
        //         ConvinenceFee = Number((ConvinenceFee * passengerCount).toFixed(2));

        //     }
        // }
        return {
            Currency: Currency,
            TotalDisplayFare: Number(TotalDisplayFare.toFixed(2)),
            AgentNetFare: Number(AgentNetFare.toFixed(2)),
            ConvinenceFee:ConvinenceFee,
            PriceBreakup: {
                BasicFare: PriceBreakupBasicFare,
                Tax: PriceBreakupTax,
                AdvanceTax: Number(advanceTax.toFixed(2)),
                MarkUpDetails: {
                    AgentMarkup: Number(agent_markup.toFixed(2)),
                    AdminMarkup: Number(admin_markup.toFixed(2))
                },
                CommissionDetails: {
                    GdsCommission: Number(gdsCommission.toFixed(2)),
                    AdminCommission: Number((gdsCommission - agentCommission).toFixed(2)),
                    AgentCommission: Number(agentCommission.toFixed(2)) ? Number(agentCommission.toFixed(2)) : 0,
                    AgentTdsOnCommision: PriceBreakupAgentTdsOnCommision
                },

                RBD: PriceBreakupRBD,
                TaxDetails: TaxDetails1,
                FareType: PriceBreakupFareType,
            },
            PassengerBreakup: PassengerBreakup,
        };
    }

    // async formatPriceDetailToSelectedCurrency(Currency, PriceDetails) {
    //     const currencyDetails = await this.getGraphData(`
	// 			query {
	// 				cmsCurrencyConversions(where: {
    //                     currency: {
    //                         eq:"${Currency}"
    //                     } 
    //                 }
    //                 ) {
	// 					id
	// 					currency
	// 					value
	// 					status
	// 				}
	// 		  	}
	// 		`, "cmsCurrencyConversions"
    //     );
    //     if (currencyDetails.length <= 0) {
    //         const errorClass: any = getExceptionClassByCode(`400 Selected currency is not available.`);
    //         throw new errorClass(`Selected currency is not available.`);
    //     }
    //     const ExchangeRate = currencyDetails[0].value;
    //     const PassengerBreakup = PriceDetails.PassengerBreakup;
    //     if (PassengerBreakup) {
    //         if (PassengerBreakup.ADT) {
    //             PassengerBreakup.ADT.BasePrice = Number((ExchangeRate * PassengerBreakup.ADT.BasePrice).toFixed(2));
    //             PassengerBreakup.ADT.TotalPrice = Number((ExchangeRate * PassengerBreakup.ADT.TotalPrice).toFixed(2));
    //             PassengerBreakup.ADT.Tax = Number((ExchangeRate * PassengerBreakup.ADT.Tax).toFixed(2));
    //             PassengerBreakup.ADT.PassengerCount = Number(PassengerBreakup.ADT.PassengerCount);
    //         }
    //         if (PassengerBreakup.CHD) {
    //             PassengerBreakup.CHD.BasePrice = Number((ExchangeRate * PassengerBreakup.CHD.BasePrice).toFixed(2));
    //             PassengerBreakup.CHD.TotalPrice = Number((ExchangeRate * PassengerBreakup.CHD.TotalPrice).toFixed(2));
    //             PassengerBreakup.CHD.Tax = Number((ExchangeRate * PassengerBreakup.CHD.Tax).toFixed(2));
    //             PassengerBreakup.CHD.PassengerCount = Number(PassengerBreakup.CHD.PassengerCount);
    //         }
    //         if (PassengerBreakup.INF) {
    //             PassengerBreakup.INF.BasePrice = Number((ExchangeRate * PassengerBreakup.INF.BasePrice).toFixed(2));
    //             PassengerBreakup.INF.TotalPrice = Number((ExchangeRate * PassengerBreakup.INF.TotalPrice).toFixed(2));
    //             PassengerBreakup.INF.Tax = Number((ExchangeRate * PassengerBreakup.INF.Tax).toFixed(2));
    //             PassengerBreakup.INF.PassengerCount = Number(PassengerBreakup.INF.PassengerCount);
    //         }
    //     }

    //     return {
    //         Currency: Currency,
    //         TotalDisplayFare: Number((ExchangeRate * PriceDetails.TotalDisplayFare).toFixed(2)),
    //         AgentNetFare: Number((ExchangeRate * PriceDetails.AgentNetFare).toFixed(2)),
    //         PriceBreakup: {
    //             BasicFare: Number((ExchangeRate * PriceDetails.PriceBreakup.BasicFare).toFixed(2)),
    //             Tax: Number((ExchangeRate * (PriceDetails.PriceBreakup.Tax+PriceDetails.PriceBreakup.AdvanceTax)).toFixed(2)),
    //             AdvanceTax: Number((ExchangeRate * PriceDetails.PriceBreakup.AdvanceTax).toFixed(2)),
    //             MarkUpDetails: {
    //                 AgentMarkup: Number((ExchangeRate * PriceDetails.PriceBreakup.MarkUpDetails.AgentMarkup).toFixed(2)),
    //                 AdminMarkup: Number((ExchangeRate * PriceDetails.PriceBreakup.MarkUpDetails.AdminMarkup).toFixed(2)),
    //             },
    //             CommissionDetails: {
    //                 GdsCommission: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.GdsCommission).toFixed(2)),
    //                 AdminCommission: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.AdminCommission).toFixed(2)),
    //                 AgentCommission: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.AgentCommission).toFixed(2)),
    //                 AgentTdsOnCommision: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.AgentTdsOnCommision).toFixed(2)),
    //             },
    //             RBD: PriceDetails.PriceBreakup.RBD,
    //             TaxDetails: PriceDetails.PriceBreakup.TaxDetails,
    //             FareType: PriceDetails.PriceBreakup.FareType
    //         },
    //         PassengerBreakup: PassengerBreakup,
    //     };

    // }

    async formatPriceDetailToSelectedCurrency(Currency, PriceDetails) {
        const currencyDetails = await this.getGraphData(`
				query {
					cmsCurrencyConversions(where: {
                        currency: {
                            eq:"${Currency}"
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
        const PassengerBreakup = PriceDetails.PassengerBreakup;
        if (PassengerBreakup) {
            if (PassengerBreakup.ADT) {
                PassengerBreakup.ADT.BasePrice = Number((ExchangeRate * PassengerBreakup.ADT.BasePrice).toFixed(2));
                PassengerBreakup.ADT.TotalPrice = Number((ExchangeRate * PassengerBreakup.ADT.TotalPrice).toFixed(2));
                PassengerBreakup.ADT.Tax = Number((ExchangeRate * PassengerBreakup.ADT.Tax).toFixed(2));
                PassengerBreakup.ADT.PassengerCount = Number(PassengerBreakup.ADT.PassengerCount);
            }
            if (PassengerBreakup.CHD) {
                PassengerBreakup.CHD.BasePrice = Number((ExchangeRate * PassengerBreakup.CHD.BasePrice).toFixed(2));
                PassengerBreakup.CHD.TotalPrice = Number((ExchangeRate * PassengerBreakup.CHD.TotalPrice).toFixed(2));
                PassengerBreakup.CHD.Tax = Number((ExchangeRate * PassengerBreakup.CHD.Tax).toFixed(2));
                PassengerBreakup.CHD.PassengerCount = Number(PassengerBreakup.CHD.PassengerCount);
            }
            if (PassengerBreakup.INF) {
                PassengerBreakup.INF.BasePrice = Number((ExchangeRate * PassengerBreakup.INF.BasePrice).toFixed(2));
                PassengerBreakup.INF.TotalPrice = Number((ExchangeRate * PassengerBreakup.INF.TotalPrice).toFixed(2));
                PassengerBreakup.INF.Tax = Number((ExchangeRate * PassengerBreakup.INF.Tax).toFixed(2));
                PassengerBreakup.INF.PassengerCount = Number(PassengerBreakup.INF.PassengerCount);
            }
        }
        // const query = `select * from core_payment_charges WHERE module = 'Flight';`
        // const queryResponse = await this.manager.query(query);
        const TotalDisplayFare = Number((ExchangeRate * PriceDetails.TotalDisplayFare).toFixed(2))
        
        let ConvinenceFee: any = 0;
        // if (queryResponse[0].status == 1) {

        //     if (queryResponse[0].fees_type === 'percentage') {
        //         const percentageAdvanceTax = (TotalDisplayFare * queryResponse[0].fees) / 100;
        //         ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));

        //     } else if (queryResponse[0].fees_type === 'plus') {
        //         const percentageAdvanceTax = queryResponse[0].fees;
        //         ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));
        //     }

        //     if (queryResponse[0].added_per_pax === "Yes") {
        //         let passengerCount = 0;
        //         Object.keys(PassengerBreakup).map(
        //             (key) => {
        //                 passengerCount += PassengerBreakup[key].PassengerCount
        //             }
        //         );
                
        //         ConvinenceFee = Number((ConvinenceFee * passengerCount).toFixed(2));

        //     }
        // }

        return {
            Currency: Currency,
            TotalDisplayFare: Number((ExchangeRate * PriceDetails.TotalDisplayFare).toFixed(2)),
            ConvinenceFee: Number((ExchangeRate * ConvinenceFee).toFixed(2)),
            AgentNetFare: Number((ExchangeRate * PriceDetails.AgentNetFare).toFixed(2)),
            PriceBreakup: {
                BasicFare: Number((ExchangeRate * PriceDetails.PriceBreakup.BasicFare).toFixed(2)),
                Tax: Number((ExchangeRate * (PriceDetails.PriceBreakup.Tax+PriceDetails.PriceBreakup.AdvanceTax)).toFixed(2)),
                AdvanceTax: Number((ExchangeRate * PriceDetails.PriceBreakup.AdvanceTax).toFixed(2)),
                MarkUpDetails: {
                    AgentMarkup: Number((ExchangeRate * PriceDetails.PriceBreakup.MarkUpDetails.AgentMarkup).toFixed(2)),
                    AdminMarkup: Number((ExchangeRate * PriceDetails.PriceBreakup.MarkUpDetails.AdminMarkup).toFixed(2)),
                },
                CommissionDetails: {
                    GdsCommission: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.GdsCommission).toFixed(2)),
                    AdminCommission: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.AdminCommission).toFixed(2)),
                    AgentCommission: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.AgentCommission).toFixed(2)),
                    AgentTdsOnCommision: Number((ExchangeRate * PriceDetails.PriceBreakup.CommissionDetails.AgentTdsOnCommision).toFixed(2)),
                },
                RBD: PriceDetails.PriceBreakup.RBD,
                TaxDetails: PriceDetails.PriceBreakup.TaxDetails,
                FareType: PriceDetails.PriceBreakup.FareType
            },
            PassengerBreakup: PassengerBreakup,
        };

    }

    async addMarKup(
        markup,
        specific_markup,
        userType,
        CurrencyType,
        display_price,
        approx_base_price,
        AirlineCode
    ) {
        let total_specific_markup: number = 0,
            total_generic_markup: number = 0,
            agent_markup: number = 0,
            admin_markup: number = 0,
            agent_specific_markup: number = 0,
            admin_specific_markup: number = 0

        if (specific_markup) {
            specific_markup.forEach(element => {
                if (element.flightAirline.code === AirlineCode) {
                    if (element.value_type == "percentage") {
                        total_specific_markup +=
                            (approx_base_price * element["value"]) / 100;
                        if (element.markup_level == "b2b_own") {
                            agent_specific_markup += (approx_base_price * element["value"]) / 100;
                        }
                        if (element.markup_level == "b2b_admin") {
                            admin_specific_markup = (approx_base_price * element["value"]) / 100;
                        }
                    } else if (element.value_type == "plus") {
                        total_specific_markup += element["value"];
                        if (element.markup_level == "b2b_own") {
                            agent_specific_markup += element["value"];
                        }
                        if (element.markup_level == "b2b_admin") {
                            admin_specific_markup = element["value"];
                        }
                    }

                }
            });
        }
        if (markup) {
            markup.forEach(element => {
                if (element.markup_currency == CurrencyType) {
                    if (element.value_type == "percentage") {
                        total_generic_markup += (approx_base_price * element["value"]) / 100;
                        display_price += total_generic_markup;
                        display_price = parseFloat(display_price.toFixed(2));
                        if (element.markup_level == "b2b_own") {
                            agent_markup += (approx_base_price * element["value"]) / 100;
                        }
                        if (element.markup_level == "b2b_admin") {
                            admin_markup = (approx_base_price * element["value"]) / 100;
                        }
                    } else if (element.value_type == "plus") {
                        total_generic_markup += element["value"];
                        display_price += element["value"];
                        if (element.markup_level == "b2b_own") {
                            agent_markup += element["value"];
                        }
                        if (element.markup_level == "b2b_admin") {
                            admin_markup = element["value"];
                        }
                        display_price = parseFloat(display_price.toFixed(2));
                    }
                }
            });
        }
        display_price = total_generic_markup + total_specific_markup + display_price;
        display_price = parseFloat(display_price.toFixed(2));
        return {
            MarkupDetails: {
                AgentMarkup: agent_markup,
                AgentSpecifiMarkup: agent_specific_markup
                    ? agent_specific_markup
                    : "",
                AdminMarkup: admin_markup,
                AdminSpecificArilinMarkup: admin_specific_markup
                    ? admin_specific_markup
                    : "",
            },
            DisplayPrice: display_price
        }
    }

    async updatePassengerDetails(body: any) {
        let passengerArray = body.passengerData;
        try {
            passengerArray.forEach(async (element) => {
                await this.manager.query(
                    `UPDATE flight_booking_transaction_passengers SET title = "${element.Title}", first_name = "${element.FirstName}", last_name = "${element.LastName}", date_of_birth = "${element.DateOfBirth}", passport_number = "${element.PassportNumber}", passport_expiry_date = "${element.PassportExpiry}", passport_issuing_country= "${element.PassportIssuingCountry}", passenger_nationality="${element.CountryName}" WHERE app_reference = "${body.AppReference}";`
                );

                await this.manager.query(
                    `UPDATE flight_bookings SET phone = "${element.ContactNo}", phone_code = "${element.PhoneAreaCode}", email = "${element.Email}" WHERE app_reference = "${body.AppReference}";`
                );
            });
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
        return body.passengerData;
    }
    async paymentConfirmation(body: any): Promise<any> {

        const payment_info = await this.getGraphData(`
            {
                paymentGatewayDetails(where : {
                  app_reference :{eq : "${body.app_reference}"}
                  order_id:{eq : "${body.order_id}"}
                }){
                  status
                }
              }
            `, 'paymentGatewayDetails');
        const flight_bookings_details = await this.getGraphData(`
                {
                  flightBookings(where:{
                    app_reference :{eq:"${body.app_reference}"}
                  }){
                      booking_status
                  }  
                }
            `, 'flightBookings');

        if (payment_info[0] && flight_bookings_details[0]) {
            if (payment_info[0].status === "completed" && flight_bookings_details[0].booking_status === "BOOKING_HOLD") {
                return true;
            } else {
                const errorClass: any = getExceptionClassByCode(`400 Boking must be hold and payment must be paid.`);
                throw new errorClass(`Boking must be hold and payment must be paid.`);
            }
        }
        const errorClass: any = getExceptionClassByCode(`400 Invalid OrederId.`);
        throw new errorClass(`Invalid OrederId`);
    }
    async checkWalletBalance(body: any): Promise<any> {

        let totalFare = 0,
            created_by_id = 0;
        if (body.app_reference.startsWith('F') || body.app_reference.startsWith("AWTF")) {
            const flightresult = await this.getGraphData(
                `
                query {
                    flightBookings (
                        where: {
                            app_reference: {
                                eq:"${body.app_reference}"
                            } 
                        }
                    ) {
                        id
                        app_reference
                        created_by_id
                        flightBookingTransactions{
                            total_fare
                            attributes
                          }
                    }
                }`,
                'flightBookings',
            );
            if (flightresult.length <= 0) {
                throw new HttpException('app_reference not exists!', 400);
            }
            let priceDetails = JSON.parse(flightresult[0].flightBookingTransactions[0].attributes.replace(/'/g, '"'));
            totalFare = priceDetails.AgentNetFare;
            created_by_id = flightresult[0].created_by_id;
        } else if (body.app_reference.startsWith('H') || body.app_reference.startsWith("TLNH")) {
            var hotel_result = await this.getGraphData(
                `{
            hotelHotelBookingDetails(where:{
                    app_reference:{
                      eq:"${body.app_reference}"
                    }
                  }){
              app_reference
              currency
              currency_conversion_rate
              created_by_id
                hotelHotelBookingItineraryDetails{
                    total_fare
                }
            }
          }`,
                `hotelHotelBookingDetails`,
            );
            totalFare =
                hotel_result[0].hotelHotelBookingItineraryDetails[0].total_fare;
            created_by_id = hotel_result[0].created_by_id;
        }


        const query = `SELECT balance,credit_limit,due_amount FROM b2b_users WHERE auth_user_id = ${created_by_id}`;
        const userWalletRes = await this.manager.query(query);
        if (userWalletRes.length === 0 || userWalletRes.length === undefined) {
            const errorClass: any = getExceptionClassByCode(`400 User wallet not exists, Please use other transaction method`);
            throw new errorClass(`User wallet not exists, Please use other transaction method`);
        }
        let walletBal: any = parseFloat(userWalletRes[0].balance) + parseFloat(userWalletRes[0].credit_limit) + parseFloat(userWalletRes[0].due_amount);
        // console.log(totalFare);
        // console.log(userWalletRes[0]);
        // return false;
        if (walletBal >= totalFare) {
            return true;
        } else {
            const errorClass: any = getExceptionClassByCode(`400 Don't have sufficient balance in wallet:${walletBal}`);
            throw new errorClass(`Don't have sufficient balance in wallet:${walletBal}`);
        }
    }
    async emailFlightDetails(body) {
        const result = await this.getGraphData(
            `
    query {
        flightBookings(where:{
            app_reference:{
                eq:"${body.AppReference}"
            }
        })           {
            domain_origin
            status
            app_reference
            trip_type
            cabin_class
            email
            booking_source
            phone
            phone_code
            journey_start
            journey_end
            journey_from
            journey_to
            from_loc
            to_loc
            created_at
            created_by_id
            LastDateToTicket
            booking_status
            flightBookingTransactions {
                gds_pnr
                pnr
                attributes
                flightBookingTransactionPassengers{
                    passenger_type
                    title
                    first_name
                    middle_name
                    last_name
                    is_lead
                    date_of_birth
                    passport_number
                    ticket_no
                  }
                  flightBookingTransactionItineraries{
                    airline_pnr
                    flight_number
                    to_airport_code
                    from_airport_code
                    airline_code
                    departure_datetime
                    arrival_datetime
                    airline_code
					airline_name
					to_airport_name
					from_airport_name
                    cabin_baggage
                    checkin_baggage
                    attributes
              }
            }
        }
    }`,
            "flightBookings"
        );
        let ticketTimeString = ""
        let subjectString = ""
        let attchment: any
        let attchmentinv: any
        let attachments = [];

        let mailObject: any
        var filename = result[0].app_reference;

        const bookedOn = formatStringtDate(result[0].created_at)
        const priceDetails = JSON.parse(result[0].flightBookingTransactions[0].attributes.replace(/'/g, '"'))
        const created_by_id = result[0].created_by_id
        const itinerary_flight = result[0].flightBookingTransactions[0].flightBookingTransactionItineraries;
        let depDate = moment(itinerary_flight[0].departure_datetime).format('DD MMM YYYY HH:mm');
        let arrDate = moment(itinerary_flight[itinerary_flight.length - 1].arrival_datetime).format('DD MMM YYYY HH:mm');
        // console.log(itinerary_flight);
        // return false;
        let agencyResult = {
            business_name: "",
            business_number: "",
            auth_role_id: 0,
            created_by_id: 0,
            email: "",
            last_name: "",
            first_name: "",
            middle_name: ""
        }
        if (created_by_id > 0) {
            agencyResult = await this.getGraphData(`
            query {
                authUser(id:${created_by_id})
                {
                    id
                    business_name
                    business_number
                    auth_role_id
                    created_by_id
                    email
                    first_name
                    last_name
                    middle_name
                }
            }
            `, `authUser`);
        }

        const booking247Logo = process.env.NODE_ENV == "LOCAL" || process.env.NODE_ENV == "UAT"
      ? "http://54.198.46.240/booking247/supervision/assets/images/login-images/l-logo.png"
      : "https://www.booking247.com/supervision/assets/images/login-images/l-logo.png";

        let PassengerDetails = result[0].flightBookingTransactions[0].flightBookingTransactionPassengers;
        let passengerDataHtml = ""
        let PassengerData = []
        PassengerDetails.forEach((element, index) => {
            passengerDataHtml = passengerDataHtml + `<tr style="border-bottom: 1px solid #eee;" *ngFor="let p of confirmedData?.Passengers; let i = index">
                                               <td style="padding:10px 15px; background: #e7f2fd; font-weight: 600;">
                                               ${index + 1}
                                               </td>
                                               <td style="padding:10px 15px; background: #e7f2fd; font-weight: 600;">
                                                 
                                                  
                                                  <span class="text-uppercase">
                                                  ${element.first_name} ${element.middle_name} ${element.middle_name} ${element.last_name}
                                                  </span>
                                               </td>
                                               <td
                                                   style="padding:10px 15px; background: #e7f2fd; font-weight: 600; text-align: center;">
                                                   ${element.ticket_no ? element.ticket_no : "N/A"}
                                               </td>
                                          
                                              
                                           </tr>`
            element.index = index + 1
            element.airline_pnr = result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0]['airline_pnr'],
                element.sector = result[0]['journey_from'] + " - " + result[0]['journey_to'],
                PassengerData.push(element)
        });
        let flightDetailTransaction = "";
        let flightInfo: any = []
        result[0].flightBookingTransactions[0].flightBookingTransactionItineraries.forEach(element => {
            let departureTime = new Date(element.departure_datetime)
            let arrivalTime = new Date(element.arrival_datetime)
            let flightDuration = '';
            if (element.attributes) {
                let duration = JSON.parse(element.attributes);
                flightDuration = duration.Duration;
                element.duration = duration.Duration;
            } else {
                flightDuration = duration(element.departure_datetime, element.arrival_datetime);
                element.duration = duration(element.departure_datetime, element.arrival_datetime);
            }
            flightDetailTransaction = flightDetailTransaction + `  <table cellspacing="0" cellpadding="5" width="100%" style="padding: 0;">
        <tbody >
           <tr>
                    <td colspan="4" style="border-radius: 5px; padding:0; border: none;">
                        <table cellspacing="0" cellpadding="5" width="100%" style="font-size:12px; padding:0;">
                            <tbody>
                                
                                    <tr>
                                        <td colspan="4" style="padding: 0px; border: none;">
                                            <table cellspacing="0" cellpadding="5" width="100%"
                                                        style="font-size:12px;padding:0px; background: #fff; border-radius: 10px; margin-bottom: 10px; border: 1px solid #ddd;">
                                                       
                                                        <tr>
                                                            <td colspan="3"
                                                                style="color:#004363; background: #f7f6f6; border: none; padding: 0px 10px; border-bottom: 1px solid #ddd;  padding-bottom: 10px; font-size: 15px; font-weight: 600;">
                                                        <img style="max-width: 45px;" src="http://54.198.46.240/booking247/assets/airline_logo/${element.airline_code}.png">
                                            
                                                        <span>
                                                            ${element.airline_name} | ${element.flight_number}  <strong style="font-size: 20px; padding-left: 10px; color: #004363;"><span>${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].from_airport_code} - ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].to_airport_code}</span></strong>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="width: 35%; padding: 10px 10px; font-size: 14px; vertical-align: top;">
                                                        <span>
                                                          <img style="vertical-align:middle; float: left; margin-top: 5px; width: 24px;"
                                                            src="https://booking247.com/assets/images/departure.png">
                                                          <strong style="font-size: 15px; padding-left: 10px;
                                                                                              vertical-align: middle;
                                                                                              ">
                                                            <span style="font-weight: 500; padding-right: 10px;">
                                                              ${element.from_airport_code}
                                                            </span>
                                                            <span></span>
                                                          </strong>
                                                          <br>
                                                          <div style="margin-left: 35px;">
                                                          ${moment(element.departure_datetime).format('DD MMM YYYY HH:mm')}
                                                           
                                                            <br>
                                                            <span>
                                                            ${element.from_airport_name}
                                                            </span>
                                                          </div>
                                                        </span>
                                                      </td>
                                                      <td style="width: 30%; vertical-align: top;">
                                                        <span style="display:block;font-size: 14px; padding-top: 10px; padding-left:0%; text-align: center;">
                                                          <span>${flightDuration}</span><br>
                                                          ${result[0].cabin_class}<br>
                                                         
                                                        </span>
                                                      </td>
                          
                                                      <td style="width: 35%;font-size: 14px;  padding: 10px 10px; padding-left: 0%; vertical-align: top;">
                                                        <span>
                                                        <img style="vertical-align:middle; float: left; margin-top: 5px; width: 24px;"
                                                            src="https://booking247.com/assets/images/arrival.png">
                                                          <strong style="font-size: 15px; padding-left: 10px;
                                                                                              vertical-align: middle;
                                                                                              ">
                          
                                                            <span style="font-weight: 500; padding-right: 10px;">
                                                             ${element.to_airport_code}
                                                            </span>
                                                          </strong>
                                                          <br>
                                                          <div style="margin-left: 35px;">
                                                          ${moment(element.arrival_datetime).format('DD MMM YYYY HH:mm')}
                                                            <br>
                                                            <span>
                                                            ${element.to_airport_name}
                                                            </span>
                                                          </div>
                                                        </span>
                                                      </td>
                                                </tr>
                                                <tr>
                                                    <td colspan="3" style="padding:6px 10px; border-top: 1px solid #ddd;">
                                                        <span style="font-size: 14px;">
                                                            <img style="vertical-align:top; width: 21px;"
                                                                src="https://booking247.com/assets/images/baggage.png">
                                                            Baggage Info -
                                                            Cabin: ${element.cabin_baggage},
                                                            Check-in: ${element.checkin_baggage}
                                                        </span>
                                                    </td>
                                                </tr>
                                              
                                            </table>
                                        </td>
                                    </tr>
                            </tbody>
                        </table>
                    </td>
                </tr> 
        </tbody>
      </table>`
            element.departure_datetime = formatVoucherDate(element.departure_datetime)
            element.arrival_datetime = formatVoucherDate(element.arrival_datetime)
            element.departureTime = `${departureTime.getHours()}:${departureTime.getMinutes() == 0 ? "00" : departureTime.getMinutes()}`
            element.arrivalTime = `${arrivalTime.getHours()}:${arrivalTime.getMinutes() == 0 ? "00" : arrivalTime.getMinutes()}`
            flightInfo.push(element)
        });

        const { cc } = await this.getEmailConfig()

        if (result[0].booking_status === "BOOKING_HOLD") {
            ticketTimeString = ` Please note that this reservation will expire at the time and date indicated below.
        <br><br>Payment should be processed prior to the expiration time ${formatVoucherDate(result[0].LastDateToTicket)}`
            subjectString = `Booking247 RESERVATION DETAILS : PNR : ${result[0].flightBookingTransactions[0].gds_pnr}`
            mailObject = {
                to: `${result[0].email}`,
                cc,
                from: `"Booking247" <${SUPPORT_EMAIL}>`,
                subject: subjectString,
            }
        }
        if (result[0].booking_status === "BOOKING_CONFIRMED") {
            let agent_pdf_data = 0;
            if (agencyResult.auth_role_id == 2) {
                agent_pdf_data = 1;
            }
            await this.pdf({
                filename: "./voucher/flight/" + filename + ".pdf",
                template: "flight",
                viewportSize: {
                    width: 1500,

                },
                locals: {
                    flightInfo: flightInfo,
                    agent_pdf_data: agent_pdf_data,
                    app_reference: result[0].app_reference,
                    airFare: priceDetails.PriceBreakup.BasicFare,
                    passengerDetails: PassengerData,
                    tax: priceDetails.PriceBreakup.Tax,
                    ait: priceDetails.PriceBreakup.AdvanceTax,
                    business_name: (agencyResult.business_name) ? agencyResult.business_name : '',
                    business_number: (agencyResult.business_number) ? agencyResult.business_number : '',
                    gds_pnr: result[0].flightBookingTransactions[0].gds_pnr,
                    airline_pnr: result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_pnr,
                    grandTotal: priceDetails.TotalDisplayFare,
                    cabin_class: result[0].cabin_class,
                    booked_on: bookedOn
                },
            });


            attchment = {
                filename: `${result[0].app_reference}.pdf`,
                contentType: "application/pdf",
                path:
                    process.cwd() +
                    "/voucher/flight/" + filename +
                    ".pdf",
            }
            attachments.push(attchment);
            if (agencyResult.auth_role_id == 2) {
                let inv_no = result[0]['app_reference'].split('-');

                await this.pdf({
                    filename: "./voucher/flight_invoice/" + filename + "_invoice.pdf",
                    template: "flight_invoice",
                    viewportSize: {
                        width: 1500
                    },
                    locals: {
                        flightinfo: flightInfo,
                        booking_details: result[0],
                        app_reference: result[0].app_reference,
                        inv_no: inv_no[1],
                        priceDetails: priceDetails,
                        passengerDetails: PassengerData,
                        agencyResult: agencyResult,
                        gds_pnr: result[0].flightBookingTransactions[0].gds_pnr,
                        airline_pnr: result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_pnr,
                        cabin_class: result[0].cabin_class,
                        booked_on: moment(result[0].created_at).format('MMM DD, YYYY')
                    },
                });
                attchmentinv = {
                    filename: `${result[0].app_reference}_invoice.pdf`,
                    contentType: "application/pdf",
                    path:
                        process.cwd() +
                        "/voucher/flight_invoice/" + filename +
                        "_invoice.pdf",
                }
                attachments.push(attchmentinv);
            }

            subjectString = `Booking247 TICKET DETAILS : PNR : ${result[0].flightBookingTransactions[0].gds_pnr}`

            mailObject = {
                to: `${result[0].email}`,
                cc,
                from: `"Booking247" <${SUPPORT_EMAIL}>`,
                subject: subjectString,
                attachments: attachments,

            }
        }
        let agency_data: any;
        if (result[0].booking_source === "B2B") {
            agency_data = `
            
            <tr>
              <td style="border:none; padding:0px 0px 15px; line-height: 25px; font-size: 15px; width: 50%;">
                   <span class="text-uppercase">Agency Name - <strong>${agencyResult.business_name}</strong></span>
               <br>
               <span>
               Agency Number - <strong>${agencyResult.business_number}</strong></span>               
              </td>

              <td style="border:none; padding:0px 0px 15px; line-height: 25px; font-size: 15px; width: 50%; text-align: right;">
               <span> Reference No - <strong >${result[0].app_reference}</strong>
               <br>
               <br>
               </span>

               <span class="label label-success p-2 rounded-lg badge-success text-capitalize" style=" font-size:15px; margin-top:7px; display:block;">Booking Status - <strong style="color: #fff;
    background-color: #73a839; text-transform: capitalize !important; padding: .5rem !important; border-radius:5px; font-size:13px;">${result[0].booking_status}</strong></span></td>
               </tr>
               `;
        } else {
            agency_data = `
          <tr>
          <td colspan="3" style="width :50% ;text-align: right; padding: 6px 0px;"><span style="font-size: 15px;"><span style="color:#007cb2; font-weight: 500;">Reference No</span> - ${result[0].app_reference}</span></td>
          <td colspan="3" style="width :50% ;text-align: right; padding: 6px 0px;"><span style="font-size: 15px;"><span style="color:#007cb2; font-weight: 500;">Booking Status</span> - ${result[0].booking_status}</span></td>
          </tr>`;
        }
        const htmlData = `<table cellpadding="0" border-collapse="" cellspacing="0" width="100%" style="font-size: 12px; font-family: 'Open Sans', sans-serif; max-width: 850px; border: 2px solid #ddd; border-radius: 5px; margin: 10px auto; background-color: #fff; padding: 20px; border-collapse: separate; color: #000;">
    <tbody style="-webkit-print-color-adjust: exact;">
      <tr >
        <td colspan="4" style="padding-bottom: 10px;  border-bottom: 1px solid #ddd;"><img src="${booking247Logo}" style="width: 200px;"></td>
  
      </tr>
  
      <tr >
        <td colspan="6" style="width :100% ;line-height: 15px; padding: 0;">&nbsp;</td>
      </tr>

      <tr >
      <td colspan="6" style="width :100%;font-size: 14px; line-height:25px;"><span style="font-weight: 600; font-size:15px;">Dear ${PassengerDetails[0].first_name} ${PassengerDetails[0].middle_name} ${PassengerDetails[0].last_name},</span><br>
      Thank you for making your booking with Booking247, below are the details of your itinerary.
     ${ticketTimeString}<span style="font-weight: 500; color:#189ad3;"></span></td>
    </tr>
  
      <tr>
      <td style="height: 15px; line-height: 0px;">&nbsp;</td>
    </tr>
                  ${agency_data}
      <tr>
      <tr >
        <td style="line-height: 15px; padding: 0;">&nbsp;</td>
      </tr>

      <tr>
                    <td colspan="3">
                        <table
                            style="width: 100%; border:none; margin: 0px 0px; display: table; background-color: #fff; padding: 5px 10px;">
                            <tr>
                                <td style="padding:5px 0; font-size: 14px;">
                                </td>
                                <td style="padding:0px 0;text-align: right;border:none; font-weight: bold;">
                                    <span style="font-size:15px;">
                                         <span style="color:#004363;padding:5px;">
                                            Airline PNR :
                                            <span style="font-size: 20px; color: #1a9ad3;">
                                            ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_pnr}
                                            </span>
                                        </span>
                                        <span style="color:#004363;padding:5px;">
                                            GDS PNR :
                                            <span style="font-size: 20px; color: #1a9ad3;">
                                            ${result[0].flightBookingTransactions[0].gds_pnr}
                                            </span>
                                        </span>
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

      
      <tr>
        <td style="line-height: 15px; padding: 0;">&nbsp;</td>
      </tr>
      <tr>
        <td colspan="4" style="border-radius: 5px; padding: 0;">
       ${flightDetailTransaction}
        </td>
      </tr>
      <tr >
        <td style="line-height: 15px; padding: 0;">&nbsp;</td>
      </tr>


      <tr>
                    <td colspan="4"
                        style="padding:0; border-radius: 5px; overflow: hidden;">
                       


                        <table width="100%" cellpadding="5" cellspacing="2"
                                       style="font-size: 13px; border-collapse: separate;  box-shadow: 0 0 2px 0 rgba(0,0,0,.08), 0 2px 8px 0 rgba(0,0,0,.16); background: #fff;">
                                       <tbody>

                                        <tr><td colspan="2" style="padding:12px 0px 0px; font-size: 18px; border: none;"><img src="https://booking247.com/assets/images/users-ic.png">&nbsp;<span style="font-weight: 500;">Guest(s) Details</span></td></tr>
                                        
                                           <tr style="white-space:nowrap; background: #092e53; color: #fff;">
                                               <td
                                                   style=" -webkit-print-color-adjust: exact;padding:10px 15px;color: #fff; width: 5%; font-weight: 700;">
                                                   Sl.No</td>
                                               <td
                                                   style="-webkit-print-color-adjust: exact; width:30%; padding:10px 15px;color: #fff; font-weight: 700;">
                                                   Travellers</td>
                                               <td
                                                   style="-webkit-print-color-adjust: exact; width:20%; padding:10px 15px;color: #fff; font-weight: 700; text-align: center;">
                                                   Ticket No.</td>
                                               
                                           </tr>
                                           
                                           ${passengerDataHtml}
                                       </tbody>
                                   </table>

                    </td>
                </tr>

  <tr>
    <td style="line-height: 20px; padding: 0;">&nbsp;</td>
  </tr>


  <tr>
                    <td colspan="4" style="padding:0;border-radius: 5px;">
                        <table cellspacing="0" cellpadding="5" width="100%" style="font-size:13px; padding:0;">
                          <tbody>
                            <tr><td colspan="2" style="padding:12px 0px 0px; font-size: 18px; border: none;"><img src="https://booking247.com/assets/images/payment-ic.png">&nbsp;<span style="font-weight: 500;">Payment Details</span></td></tr>
                            <tr>
                              <td width="100%" style="padding:0;border-radius: 5px;">


                                <table width="100%" cellpadding="5" cellspacing="2"
                                       style="font-size: 14px; border-collapse: separate;  box-shadow: 0 0 2px 0 rgba(0,0,0,.08), 0 2px 8px 0 rgba(0,0,0,.16); background: #fff;">
                                       <tbody>
                                           <tr style="white-space:nowrap; background: #f5f5f5;">
                                               <td
                                                   style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; background: #092e53; color: #fff; font-weight: 500;">
                                                   Payment Breakup</td>
                                               <td
                                                   style="-webkit-print-color-adjust: exact; width:30%; background: #092e53; color: #fff; text-align: right; padding:10px 15px; font-weight: 500;">
                                                   Amount</td>
                                               
                                           </tr>

                                           <tr style="white-space:nowrap; background: #f5f5f5;">
                                            <td
                                                style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500;">
                                                Air Fare</td>
                                            <td
                                                style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 500;">
                                                ${priceDetails.PriceBreakup.BasicFare}</td>
                                            
                                        </tr>

                                           <tr style="white-space:nowrap; background: #f5f5f5;">
                                               <td
                                                   style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500;">
                                                   Taxes &amp; Fees</td>
                                               <td
                                                   style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 500;">
                                                   ${priceDetails.PriceBreakup.Tax}</td>
                                               
                                           </tr>

                                           <tr style="white-space:nowrap; background: #f5f5f5;">
                                            <td
                                                style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500;">
                                                AIT</td>
                                            <td
                                                style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 500;">
                                                </td>
                                            
                                        </tr>


                                        <tr style="white-space:nowrap; background: #f5f5f5;">
                                            <td
                                                style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 500;">
                                                Baggage</td>
                                            <td
                                                style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 500;">
                                                </td>
                                            
                                        </tr>
                                       
                
                                           <tr style="white-space:nowrap; background: #e7f2fd;">
                                               <td
                                                   style=" -webkit-print-color-adjust: exact;padding:10px 15px; width: 25%; font-weight: 600;">
                                                   Total Amount</td>
                                               <td
                                                   style="-webkit-print-color-adjust: exact; width:30%; text-align: right; padding:10px 15px; font-weight: 600;">
                                                   ${priceDetails.TotalDisplayFare}</td>
                                               
                                           </tr>
                                           
                                       </tbody>
                                   </table>

                              </td>
                            </tr>
                            <tr>
                              <td style="line-height:15px;padding:0;">&nbsp;</td>
                            </tr>


                            <tr>
                                <td style="padding: 0px; border: none;">
                                    <table style="width: 100%;">
                                    <tr>
                                     <td style="width: 50%;
                                     background: #fff;
                                     border: none;
                                     color: #092e53;
                                     padding: 14px 0px;
                                     line-height: 22px; vertical-align: bottom;
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
                        </table>
                      </td>
                </tr>
      
    </tbody>
  </table>`
        mailObject.html = htmlData
        const mail = await this.mailerService.sendMail(mailObject);

        // let msg = ""

        // if (result[0].booking_source === "B2B") {
        //     msg = `Dear, ${PassengerDetails[0].first_name} ${PassengerDetails[0].last_name}\n` +
        //         `Thank you for Booking with Booking247.\n` +
        //         `Flight Details : ${result[0].journey_from}-${result[0].journey_to} (${result[0].trip_type})\n` +
        //         `Airline : ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_name}(${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_code})\n` +
        //         `Ref No: ${result[0].app_reference}\n` +
        //         `GDS PNR : ${result[0].flightBookingTransactions[0].gds_pnr}\n` +
        //         `Airline PNR : ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_pnr}\n` +
        //         `Departure : ${depDate}\n` +
        //         `Arrival : ${arrDate}\n` +
        //         `Help Line : ${BOOKING247_HELPLINE_NUMBER}`
        // } else if (result[0].booking_source === "B2C") {
        //     msg = `Dear, ${PassengerDetails[0].first_name} ${PassengerDetails[0].last_name}\n` +
        //         `Thank you for Booking with Booking247.\n` +
        //         `Flight Details : ${result[0].journey_from}-${result[0].journey_to} (${result[0].trip_type})\n` +
        //         `Airline : ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_name}(${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_code})\n` +
        //         `Ref No: ${result[0].app_reference}\n` +
        //         `GDS PNR : ${result[0].flightBookingTransactions[0].gds_pnr}\n` +
        //         `Airline PNR : ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_pnr}\n` +
        //         `Departure : ${depDate}\n` +
        //         `Arrival : ${arrDate}\n` +
        //         `Help Line : ${BOOKING247_HELPLINE_NUMBER}`
        // }
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
        return false;
    }
    async flightCancellationEmail(body) {
        const result = await this.getGraphData(
            `
    query {
        flightBookings(where:{
            app_reference:{
                eq:"${body.AppReference}"
            }
        })           {
            domain_origin
            status
            app_reference
            trip_type
            cabin_class
            email
            journey_start
            journey_end
            journey_from
            journey_to
            from_loc
            to_loc
            created_at
            booking_status
            created_by_id
            flightBookingTransactions {
                gds_pnr
                pnr
                attributes
                flightBookingTransactionPassengers{
                    passenger_type
                    title
                    first_name
                    middle_name
                    last_name
                    is_lead
                    date_of_birth
                    passport_number
                    ticket_no
                  }
                  flightBookingTransactionItineraries{
                    airline_pnr
                    flight_number
                    to_airport_code
                    from_airport_code
                    airline_code
                    departure_datetime
                    arrival_datetime
                    airline_code
					airline_name
					to_airport_name
					from_airport_name
              }
            }
        }
    }`,
            "flightBookings"
        );

        const booking247Logo = process.env.NODE_ENV == "LOCAL" || process.env.NODE_ENV == "UAT"
      ? "http://54.198.46.240/booking247/supervision/assets/images/login-images/l-logo.png"
      : "https://www.booking247.com/supervision/assets/images/login-images/l-logo.png";

        const bookedOn = formatStringtDate(result[0].created_at)
        const priceDetails = JSON.parse(result[0].flightBookingTransactions[0].attributes.replace(/'/g, '"'))
        const created_by_id = result[0].created_by_id
        const agencyResult = await this.getGraphData(`
    query {
        authUser(id:${created_by_id})
        {
            id
            business_name
            business_number
            auth_role_id
        }
    }
    `, `authUser`)
        const currentDate = new Date();
        const month = `${currentDate.getMonth() + 1}`
        const currenctDateString =
            [
                currentDate.getDate(),
                month.length == 1 ? `0${month}` : month,
                currentDate.getFullYear(),
            ].join("-")
        let PassengerDetails = result[0].flightBookingTransactions[0].flightBookingTransactionPassengers;
        let passengerDataHtml = ""
        PassengerDetails.forEach((element, index) => {
            passengerDataHtml = passengerDataHtml + `<tr style="border-bottom: 1px solid #eee;" *ngFor="let p of confirmedData?.Passengers; let i = index">
                                               <td style="padding:10px 15px; background: #e7f2fd; font-weight: 600;">
                                               ${index + 1}
                                               </td>
                                               <td style="padding:10px 15px; background: #e7f2fd; font-weight: 600;">
                                                 
                                                  
                                                  <span class="text-uppercase">
                                                  ${element.first_name} ${element.middle_name} ${element.middle_name} ${element.last_name}
                                                  </span>
                                               </td>
                                               <td
                                                   style="padding:10px 15px; background: #e7f2fd; font-weight: 600; text-align: center;">
                                                   ${element.ticket_no ? element.ticket_no : "N/A"}
                                               </td>
                                          
                                              
                                           </tr>`
        });
        let flightDetailTransaction = "";
        result[0].flightBookingTransactions[0].flightBookingTransactionItineraries.forEach(element => {
            let departureTime = new Date(element.departure_datetime)
            let arrivalTime = new Date(element.arrival_datetime)
            let flightDuration = duration(element.departure_datetime, element.arrival_datetime)
            flightDetailTransaction = flightDetailTransaction + ` <table cellspacing="0" cellpadding="5" width="100%" style="padding: 0;">
        <tbody >
           <tr>
                    <td colspan="4" style="border-radius: 5px; padding:0; border: none;">
                        <table cellspacing="0" cellpadding="5" width="100%" style="font-size:12px; padding:0;">
                            <tbody>
                                
                                    <tr>
                                        <td colspan="4" style="padding: 0px; border: none;">
                                            <table cellspacing="0" cellpadding="5" width="100%"
                                                        style="font-size:12px;padding:15px; background: #fff; border-radius: 10px; margin-bottom: 10px; border: 1px solid #ddd;">
                                                       
                                                        <tr>
                                                            <td colspan="3"
                                                                style="color:#004363; background: #f7f6f6; border: none; padding: 0px 10px; border-bottom: 1px solid #ddd;  padding-bottom: 10px; font-size: 15px; font-weight: 600;">
                                                        <img style="max-width: 45px;" src="http://54.198.46.240/booking247/assets/airline_logo/${element.airline_code}.png">
                                            
                                                        <span>
                                                            ${element.airline_name} | ${element.flight_number}  <strong style="font-size: 20px; padding-left: 10px; color: #004363;"><span>${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].from_airport_code} - ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].to_airport_code}</span></strong>
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="width: 35%; padding: 10px 10px; font-size: 14px; vertical-align: top;">
                                                        <span>
                                                          
                                                          <strong style="font-size: 15px; padding-left: 10px;
                                                                                              vertical-align: middle;
                                                                                              float: left; width: 88%;">
                                                            <span style="font-weight: 500; padding-right: 10px;">
                                                              ${element.from_airport_code}
                                                            </span>
                                                            <span></span>
                                                          </strong>
                                                          <br>
                                                          <div style="margin-left: 35px;">
                                                          ${formatVoucherDate(element.departure_datetime)}
                                                           
                                                            <br>
                                                            <span>
                                                            ${element.from_airport_name}
                                                            </span>
                                                          </div>
                                                        </span>
                                                      </td>
                                                      <td style="width: 30%; vertical-align: top;">
                                                        <span style="display:block;font-size: 14px; padding-top: 10px; padding-left:0%; text-align: center;">
                                                          <span>${flightDuration}</span><br>
                                                          ${result[0].cabin_class}<br>
                                                         
                                                        </span>
                                                      </td>
                          
                                                      <td style="width: 35%;font-size: 14px;  padding: 10px 10px; padding-left: 0%; vertical-align: top;">
                                                        <span>
                                                          <strong style="font-size: 15px; padding-left: 10px;
                                                                                              vertical-align: middle;
                                                                                              float: left; width: 88%;">
                          
                                                            <span style="font-weight: 500; padding-right: 10px;">
                                                            ${element.to_airport_code}
                                                            </span>
                                                          </strong>
                                                          <br>
                                                          <div style="margin-left: 35px;">
                                                          ${formatVoucherDate(element.arrival_datetime)}
                                                            <br>
                                                            <span>
                                                               ${element.to_airport_code}
                                                            </span>
                                                          </div>
                                                        </span>
                                                      </td>
                                                </tr>
                                                <tr>
                                                    <td colspan="3" style="padding:6px 10px; border-top: 1px solid #ddd;">
                                                        <span style="font-size: 14px;">
                                                            <img style="vertical-align:top; width: 21px;"
                                                                src="./assets/images/baggage.png">
                                                            Baggage Info -
                                                            Cabin: 0 KG,
                                                            Check-in: 20kg
                                                        </span>
                                                    </td>
                                                </tr>
                                              
                                            </table>
                                        </td>
                                    </tr>
                            </tbody>
                        </table>
                    </td>
                </tr> 
        </tbody>
      </table>`
        });

        const { cc } = await this.getEmailConfig()
        await this.mailerService.sendMail({
            to: `${result[0].email}`,
            from: `"Booking247" <${CANCEL_EMAIL}>`,
            cc,
            subject: `Booking247 CANCELLATION INFORMATION : ${result[0].flightBookingTransactions[0].gds_pnr}`,
            html: `<table cellpadding="0" border-collapse="" cellspacing="0" width="100%" style="font-size: 12px; font-family: 'Open Sans', sans-serif; max-width: 850px; border: 2px solid #ddd; border-radius: 5px; margin: 10px auto; background-color: #fff; padding: 20px; border-collapse: separate; color: #000;">
      <tbody style="-webkit-print-color-adjust: exact;">
        <tr >
          <td colspan="2" style="padding-bottom: 10px;  border-bottom: 1px solid #ddd;"><img src="${booking247Logo}" style="width: 100px; height: 40px;"></td>
    
        </tr>
    
        <tr >
          <td style="line-height: 15px; padding: 0;">&nbsp;</td>
        </tr>

        <tr >
        <td colspan="6" style="width :100%;font-size: 16px; line-height:25px;"><span style="font-weight: 500;">Dear ${PassengerDetails[0].first_name} ${PassengerDetails[0].middle_name} ${PassengerDetails[0].last_name},</span><br><br>Thank you for being a part of the Booking247. As you requested, we’ve canceled your PNR <span style="font-weight: 500; color:#189ad3;">${result[0].flightBookingTransactions[0].gds_pnr}</span> effective <span style="font-weight: 500; color:#189ad3;">${currenctDateString}</span>. <br><br>Your Booking247 Refernce No is ${body.AppReference}<span style="font-weight: 500; color:#189ad3;"></span></td>
      </tr>
    
        <tr>
        <td style="height: 15px; line-height: 0px;">&nbsp;</td>
      </tr>
      <tr >
      <td colspan="3" style="padding: 6px 0px;"><span style="font-size: 15px;"><span style="color:#007cb2; font-weight: 500;">Agency Name</span> - ${(agencyResult.business_name) ? agencyResult.business_name : ''}</span></td>
    </tr>
    <tr>
    <td colspan="3" style="width :50% ;padding: 6px 0px;"><span style="font-size: 15px;"><span style="color:#007cb2; font-weight: 500;">Agency Number</span> - ${agencyResult.business_number ? agencyResult.business_number : ''}</span></td>
    <td colspan="3" style="width :50% ;text-align: right; padding: 6px 0px;"><span style="font-size: 15px;"><span style="color:#007cb2; font-weight: 500;">Booking Status</span> - ${result[0].booking_status}</span></td>
    </tr>

        <tr>
        <tr >
          <td style="line-height: 15px; padding: 0;">&nbsp;</td>
        </tr>
        <tr >
          <td colspan="6">
            <table style="width: 100%;  margin: 0px 0px; display: table; background-color: #ebebeb; padding: 5px 10px;">
              <tr >
                <td style="padding: 5px 0; font-size: 14px;"><strong style="font-size: 15px; color: #004363;"> ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].from_airport_code} to ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].to_airport_code} </strong>  ${bookedOn} </td>
                <td style="padding: 0px 0; text-align: right; font-weight: bold;"><span style="font-size: 15px;"><span style="color: #004363; padding: 5px;"> Airline PNR : <span style="font-size: 15px; color: #1a9ad3;"> ${result[0].flightBookingTransactions[0].flightBookingTransactionItineraries[0].airline_pnr} </span></span>
                <span style="color: #004363; padding: 5px;"> GDS PNR : <span style="font-size: 15px; color: #1a9ad3;"> ${result[0].flightBookingTransactions[0].gds_pnr} </span></span>
                 
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr >
          <td style="line-height: 15px; padding: 0;">&nbsp;</td>
        </tr>
        <tr >
          <td colspan="4" style="border-radius: 5px; padding: 0;">
         ${flightDetailTransaction}
          </td>
        </tr>
        <tr >
          <td style="line-height: 15px; padding: 0;">&nbsp;</td>
        </tr>
        <tr>
      <td colspan="6" style="width : 100%">
        <table style="width:100%; display:table; border-collapse:collapse; border:1px solid #DDD">
            <tr>
              <th style="text-align: left; padding: 6px 8px; font-weight: 600; background-color: #189ad3; color: #fff;">S.No</th>
              <th style="text-align: left; padding: 6px 8px; font-weight: 600; background-color: #189ad3; color: #fff;">Passenger Name</th>
              <th style="text-align: left; padding: 6px 8px; font-weight: 600; background-color: #189ad3; color: #fff;">Type</th>
              <th style="text-align: left; padding: 6px 8px; font-weight: 600; background-color: #189ad3; color: #fff;">Passport No</th>
              <th style="text-align: left; padding: 6px 8px; font-weight: 600; background-color: #189ad3; color: #fff;">Ticket No</th>
            </tr>
            ${passengerDataHtml}
        </table>
        </td>
    </tr>
    
    
    <tr >
      <td style="line-height: 20px; padding: 0;">&nbsp;</td>
    </tr>


    <tr>
                <td colspan="4" style="padding:0;">
                    <table cellspacing="0" cellpadding="5" width="100%" style="font-size:12px; padding:0;">
                        <tbody>
                            <tr>
                                <td width="100%" style="padding:0;padding-right:0px;">
                                    <table cellspacing="0" cellpadding="5" width="100%"
                                        style="font-size:16px; line-height:19px; padding:0;border:1px solid #ddd;">
                                        <tbody>
                                            <tr style="background: #189AD3;">
                                                <td style="border-bottom:1px solid #ccc; padding: 10px;"><span
                                                        style="font-size:16px; font-weight: 600; color: #fff;">Payment Details</span>
                                                </td>
                                                <td style="border-bottom:1px solid #ccc; padding: 10px;"><span
                                                        style="font-size:16px; font-weight: 600; color: #fff;">Amount (BDT)</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="text-align: left; padding: 10px;"><span>Base Fare</span>
                                                </td>
                                                <td style="text-align: left; padding: 10px;"><span>${priceDetails.PriceBreakup.BasicFare}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="text-align: left; padding: 10px;"><span>Tax</span>
                                                </td>
                                                <td style="text-align: left; padding: 10px;"><span>${priceDetails.PriceBreakup.Tax}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="border-top:1px solid #ccc; padding: 10px;"><span
                                                        style="font-size:15px; font-weight: bold;">Grand Total</span>
                                                </td>
                                                <td style="border-top:1px solid #ccc; padding: 10px;"><span
                                                        style="font-size:15px; font-weight: bold;">${priceDetails.TotalDisplayFare}</span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            
                            </tr>
                            <tr>
                                <td style="line-height:15px;padding:0;">&nbsp;</td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>

    <tr >
      <td colspan="6" style="width:100%;font-size: 15px; line-height:20px;">We’d love to have you back, but we completely understand that this may not be the best option for you right now.</td>
    </tr>

    <tr >
      <td style="line-height: 10px; padding: 0;">&nbsp;</td>
    </tr>

    <tr >
      <td colspan="6" style="width:100%;font-size: 15px; line-height:20px;">If there’s anything we can do to help, please let us know. Visit our Help Center for more info or reach out to our support team.</td>
    </tr>
     <tr >
      <td style="line-height: 10px; padding: 0;">&nbsp;</td>
    </tr>
        <tr >
          <td colspan="4" align="middle" style="padding-top: 10px; border-top: 1px solid #ddd; font-size: 14px; font-weight: 500;">
            Booking247</td>
        </tr>
      </tbody>
    </table>`
        });


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

    async documentUpload(body, files) {
        try {
            const images = [];
            var result: any;
            files.forEach((file) => {
                const fileReponse = {
                    originalname: file.originalname,
                    filename: file.filename,
                };
                images.push(`http://54.198.46.240/nosafer:4005/webservice/flight/flightDocuments/${fileReponse.filename}`);
            });
            result = await this.getGraphData(
                `mutation {
                    updateFlightBookingTransactionPassenger(id:${body.id},flightBookingTransactionPassengerPartial:{
                        attributes :"${JSON.stringify(images).replace(/"/g, "'")}"
                          })
                      }`,
                "updateFlightBookingTransactionPassenger"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async blockAirlineList(source_key: any): Promise<any> {

        let query = '';
        query = `SELECT * FROM ws_apis WHERE source_key='${source_key}'`;

        const result = await this.manager.query(query);
        let res = []
        for (const [key, value] of Object.entries(result)) {
            let blockAirlineList = value["b2b_block_airline_list"];
            if (blockAirlineList != '' && blockAirlineList != null ) {
                if (blockAirlineList.length > 0) {
                let bAlirlineList = JSON.parse(blockAirlineList);
                return res = bAlirlineList.filter(word => word.isSelected == true).map(word => word.code);
            }
        }
        }
        return res;
    }

}
