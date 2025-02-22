import { Injectable } from "@nestjs/common";
import * as moment from "moment";
import { RedisServerService } from "../../../shared/redis-server.service";
import { TransferApi } from "../../transfer.api";
import { TransferDbService } from "../transfer-db.service";

@Injectable()
export class TravelomatixTransformService extends TransferApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: TransferDbService) {
        super();
    }


    async addTransferBookingDetails(data: any, body: any): Promise<any> {
        data.DeparturePoint = data?.DeparturePoint?.replace(/'|<br \/>/g, '');
        delete data.HotelList;
        let Domain: any;

        if (body.BookingSource === "ZBAPINO00002") {
            Domain = 0//"Travelomatix";
        }
        const result = await this.getGraphData(
            `mutation {
					createTransferBookingDetail(
                        transferBookingDetail: {
							status: "BOOKING_HOLD"
                            booking_id:"${data?.booking_from ?? 0}"
							app_reference: "${body.AppReference}"
                            booking_source: "${body.UserType}"
                            domain_origin: "${Domain ?? 0}"
							star_rating: ${data.StarRating ? data.StarRating : 0}
							email: "${body.AddressDetails.Email}"
                            phone_number: "${body.AddressDetails.Contact}"
                            currency: "${data?.Price?.Currency ?? " "}"
                            created_by_id: ${body.UserId ?? 0}
                            booking_reference: "${data?.Remarks ?? ""}"
                            attributes: "${JSON.stringify(data).replace(/"/g, "'")}"
                            confirmation_reference:""
                            product_name: "${data?.ProductName}"
                            product_code: "${data?.ProductCode}"
                            grade_code : ""
                            grade_desc : ""
                            phone_code : "${body.AddressDetails.PhoneCode}"
                            alternate_number : ""
                            payment_mode : ""
                            convinence_value : 0
                            convinence_value_type : ""
                            convinence_per_pax : 0
                            convinence_amount : 0
                            promo_code : "${body.PromoCode}"
                            discount : 0
                            currency_conversion_rate : 0
                            travel_date: "${data?.BookingDate}"
			        }
					) {
						id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
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
                        
					}
			  	}
			`,
            "createTransferBookingDetail"
        );
        return result;
    }

    async convinenceFees(body: any, totalFare: any): Promise<any> {
        let ConvinenceFee: any = 0;

        const query = `select * from core_payment_charges WHERE module = 'Transfer';`
        const queryResponse = await this.manager.query(query);

        if (Array.isArray(queryResponse) && queryResponse.length > 0 && queryResponse[0].status == 1) {

            if (queryResponse[0].fees_type === 'percentage') {
                const percentageAdvanceTax = (totalFare * queryResponse[0].fees) / 100;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));

            } else if (queryResponse[0].fees_type === 'plus') {
                const percentageAdvanceTax = queryResponse[0].fees;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));
            }

            // if (queryResponse[0].added_per_pax === "Yes") {
            //     ConvinenceFee += Number((ConvinenceFee * passengerCount).toFixed(2));
            // }
        }

        return ConvinenceFee;
    }

    async addTransferBookingItineraryDetails(data: any, body: any): Promise<any> {
        delete data.HotelList;
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
        let convinenceFee: any = 0;
        if (data.body.UserType === "B2C") {
            convinenceFee = await this.convinenceFees(data, data.Price.TotalDisplayFare);
        }
        let discountAmount: any = 0;
        let firstPromo: any = "";
        if (promoCode.length > 0 && data.body.UserType === "B2C") {
            firstPromo = promoCode[0];

            if (firstPromo.discount_type === "percentage") {
                // let totalPrice: any;
                // if (data.Price.Currency != "USD") {
                //     totalPrice = parseFloat((data?.Price?.TotalDisplayFare/data.exchangeRate).toFixed(2))
                // }

                // discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

                // if (data.Price.Currency != "USD") {
                //     discountAmount = parseFloat((discountAmount *data.exchangeRate).toFixed(2))
                // }
                // data.Price.TotalDisplayFare -= discountAmount;
                let totalPrice = data.Price.Currency !== "USD"
                    ? parseFloat((data.Price.TotalDisplayFare / data.exchangeRate).toFixed(2))
                    : data.Price.TotalDisplayFare;

                discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

                if (data.Price.Currency !== "USD") {
                    discountAmount = parseFloat((discountAmount * data.exchangeRate).toFixed(2));
                }

                data.Price.TotalDisplayFare -= discountAmount;

            } else if (firstPromo.discount_type === "plus") {
                discountAmount = firstPromo.discount_value;

                if (data.Price.Currency != "USD") {
                    discountAmount = parseFloat((discountAmount * data.exchangeRate).toFixed(2))
                }
                data.Price.TotalDisplayFare -= discountAmount;
            }
        }
        if (data.body.UserType === "B2C" && convinenceFee != 0) {
            data.Price.TotalDisplayFare += convinenceFee
        }
        if (firstPromo != "" && firstPromo.use_type === "Single") {
            const query = `UPDATE core_promocodes SET status = 0 WHERE id = ${firstPromo.id}`;
            const result = await this.manager.query(query);
        }
        const result = await this.getGraphData(
            `mutation {
                    createTransferBookingItineraryDetail(
                        transferBookingItineraryDetail: {
                            status: "BOOKING_HOLD"
                            app_reference: "${body.AppReference}"
                            currency: "${data?.Price?.Currency ?? " "}"
                            booking_reference: "${data.remarks}"
                            attributes: "${JSON.stringify(data).replace(/"/g, "'")}"
                            location : "${data.Destination}"
                            travel_date :"${data.BookingDate}"
                            grade_code : "${data.GradeCode}"
                            grade_desc : "${data.GradeDescription}"
                            total_fare : ${parseFloat((data?.Price?.TotalDisplayFare).toFixed(2)) ?? 0}
                            admin_markup :  ${data?.Price?.markupDetails?.AdminMarkup ?? 0}
                            admin_net_markup : ${data?.Price?.admin_net_markup ?? 0}
                            agent_markup : ${data?.Price?.markupDetails?.AgentMarkup ?? 0}
                            admin_commission : ${data?.Price?.admin_commission ?? 0}
                            admin_tds : ${data?.Price?.admin_tds ?? 0}
                            agent_commission : ${data?.Price?.PriceBreakup?.AgentCommission ?? 0}
                            agent_tds : ${data?.Price?.PriceBreakup?.AgentTdsOnCommision ?? 0}
                            api_raw_fare : ${data?.Price?.Amount ?? 0}
                            agent_buying_price : ${data?.Price?.agent_buying_price ?? 0}
                            gst : ${data?.Price?.GSTPrice ?? 0}
                            ProductPrice : ${data?.Price?.ProductPrice ?? 0}
                            Discount : ${discountAmount ?? 0}
                            Tax : ${convinenceFee ?? 0}
                    }
                    ) {
                        id
                        app_reference
                        booking_reference
                        location
                        travel_date
                        grade_code
                        grade_desc
                        status
                        total_fare
                        admin_markup
                        admin_net_markup
                        agent_markup
                        admin_commission
                        admin_tds
                        agent_commission
                        agent_tds
                        api_raw_fare
                        agent_buying_price
                        gst
                        currency
                        attributes
                        ProductPrice
                        Discount
                        Tax
                    }
                }
            `,
            "createTransferBookingItineraryDetail"
        );
        return result;
    }

    async addTransferBookingPaxDetails(data: any, body: any): Promise<any> {

        let response: any = [];
        for (let i = 0; i < body.PassengerDetails.length; i++) {
            const result = await this.getGraphData(
                `mutation {
                        createTransferBookingPaxDetail(
                            transferBookingPaxDetail: {
                                status: "BOOKING_HOLD"
                                app_reference: "${body.AppReference}"
                                booking_reference: "${data?.remarks ?? ""}"
                                attributes: "${JSON.stringify(body).replace(/"/g, "'")}"
                                title : "${body.PassengerDetails[i].Title}"
                                first_name : "${body.PassengerDetails[i].FirstName}"
                                middle_name : "${body.PassengerDetails[i].MiddleName}"
                                last_name : "${body?.PassengerDetails?.[i]?.LastName}"
                                phone : ${body?.AddressDetails?.Contact}
                                email : "${body?.AddressDetails?.Email}"
                                pax_type : "${body?.PassengerDetails?.[i]?.PaxType}"
                                age : ${body?.PassengerDetails?.[i]?.Age ?? 0}
                                date_of_birth : "${body?.PassengerDetails?.[i]?.Dob}"
                                adult_count: "${data?.searchBody?.AdultCount ?? 0}"
                                child_count: "${data?.searchBody?.ChildCount ?? 0}"
                        }
                        ) {
                            id
                            app_reference
                            booking_reference
                            title
                            first_name
                            middle_name
                            last_name
                            phone
                            email
                            pax_type
                            age
                            date_of_birth
                            status
                            attributes
                            adult_count
                            child_count
                        }
                    }
                `,
                "createTransferBookingPaxDetail"
            );
            response.push(result);
        }

        return response;
    }

    async getTransferBookingPaxDetailsUniversal(body: any,
        bookingDetails: any,
        bookingItinerary: any,
        paxDetails: any): Promise<any> {

        return {
            BookingSource: body.BookingSource,
            BookingDetails: bookingDetails,
            BookingItineraryDetails: bookingItinerary,
            BookingPaxDetails: paxDetails
        }
    }

    async bookingRequestFormat(data: any, pax: any, body): Promise<any> {
        let parsedPaxData = JSON.parse(pax.attributes.replace(/'/g, '"'));

        let format = {
            "AppReference": body.AppReference,
            "BlockTourId": data.BlockTourId,
            "PassengerDetails": [
                {
                    "Title": pax.title === "Mr" ? 1 : 1,
                    "FirstName": pax.first_name,
                    "LastName": pax.last_name,
                    "Phoneno": pax.phone,
                    "Email": pax.email,
                    "PaxType": pax.pax_type === "Adult" || "Senior" ? 1 : pax.pax_type === "Child" || "Youth" ? 2 : 3,
                    "LeadPassenger": 1
                }
            ],
            "ProductDetails": {
                "ProductCode": data.ProductCode ?? data.productCode,
                "BookingDate": data.BookingDate ?? data.bookingDate,
                "GradeCode": data.GradeCode ?? data.gradeCode,
                "hotelId": "",
                "pickupPoint": ""
            },
            "BookingQuestions": parsedPaxData?.BookingQuestions?.map((item: any) => {
                return {
                    id: item.questionId,
                    answer: item.answer
                };
            }) || []
        }

        return format;
    }

    async bookingResponseFormat(data: any, pax: any, body: any, result: any): Promise<any> {

        if (result.Status == 1) {
            const response = result.CommitBooking.BookingDetails
            const query = `UPDATE transfer_booking_details SET 
        status = "BOOKING_CONFIRMED",
        booking_reference = "${response.BookingRefNo}",
        booking_id = "${response.BookingId}",
        confirmation_reference = "${response.ConfirmationNo}"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query);
            const query1 = `UPDATE transfer_booking_itinerary_details SET 
        status = "BOOKING_CONFIRMED",
        booking_reference = "${response.BookingRefNo}"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE transfer_booking_pax_details SET 
        status = "BOOKING_CONFIRMED",
        booking_reference = "${response.BookingRefNo}"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query2);
        }
        else {
            const query = `UPDATE transfer_booking_details SET 
        status = "BOOKING_FAILED"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query);
            const query1 = `UPDATE transfer_booking_itinerary_details SET 
        status = "BOOKING_FAILED"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE transfer_booking_pax_details SET 
        status = "BOOKING_FAILED"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query2);
        }
        const bookingDetails = await this.getGraphData(
            `query {
                    transferBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
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
                    }
                }
                `,
            "transferBookingDetails"
        );

        const query3 = `select * from transfer_booking_itinerary_details WHERE app_reference = "${body.AppReference}"`;
        const bookingItinerary = await this.manager.query(query3);

        const query4 = `select * from transfer_booking_pax_details WHERE app_reference = "${body.AppReference}"`;
        const paxDetails = await this.manager.query(query4);

        return {
            BookingDetails: bookingDetails[0],
            BookingItineraryDetails: bookingItinerary[0],
            BookingPaxDetails: paxDetails
        }
    }

    async CancellationResponseFormat(data: any, body: any, result: any): Promise<any> {
        const Cancellation = await this.getGraphData(
            `mutation {
					createTransferCancellationDetail(
                        transferCancellationDetail: {
                            app_reference: "${body.AppReference}"
                            booking_reference:"${data.booking_reference}"
                            ChangeRequestId: "${result.ChangeRequestId}"
                            ChangeRequestStatus: "${result.ChangeRequestStatus}"
                            status_description:"${result.StatusDescription}"
                            API_RefundedAmount : ${result?.APIRefundedAmount ?? null}
                            API_CancellationCharge: ${result?.APICancellationCharge ?? null}
                            cancellation_processed_on: ${result?.cancellationProcessedOn ?? null}
                            refund_amount: ${result.RefundedAmount}
                            cancellation_charge: ${result.CancellationCharge}
                            refund_status: "${result.ChangeRequestStatus}"
                            refund_payment_mode: "${result?.RefundPaymentMode ?? null}"
                            refund_comments: "${result?.RefundComments ?? null}"
                            refund_date: "${result?.RefundDate ?? null}"
                            currency : "INR"
                            currency_conversion_rate : ${data?.CurrencyConversionRate ?? 1}
                            attributes:"${JSON.stringify(result).replace(/"/g, "'")}"
                            created_by_id:${body.UserId}
			        }
					) {
						id
                        app_reference
                        booking_reference
                        ChangeRequestId
                        ChangeRequestStatus
                        status_description
                        API_RefundedAmount
                        API_CancellationCharge
                        cancellation_processed_on
                        refund_amount
                        cancellation_charge
                        refund_status
                        refund_payment_mode
                        refund_comments
                        refund_date
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id 
					}
			  	}
			`,
            "createTransferCancellationDetail"
        );

        const query = `UPDATE transfer_booking_details SET 
        status = "BOOKING_CANCELLED"
        WHERE app_reference = "${body.AppReference}"`;
        await this.manager.query(query);
        const query1 = `UPDATE transfer_booking_itinerary_details SET 
        status = "BOOKING_CANCELLED"
        WHERE app_reference = "${body.AppReference}"`;
        await this.manager.query(query1);
        const query2 = `UPDATE transfer_booking_pax_details SET 
        status = "BOOKING_CANCELLED"
        WHERE app_reference = "${body.AppReference}"`;
        await this.manager.query(query2);

        const bookingDetails = await this.getGraphData(
            `query {
                    transferBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
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
                    }
                }
                `,
            "transferBookingDetails"
        );

        const query3 = `select * from transfer_booking_itinerary_details WHERE app_reference = "${body.AppReference}"`;
        const bookingItinerary = await this.manager.query(query3);

        const query4 = `select * from transfer_booking_pax_details WHERE app_reference = "${body.AppReference}"`;
        const paxDetails = await this.manager.query(query4);

        return {
            BookingDetails: bookingDetails[0],
            BookingItineraryDetails: bookingItinerary[0],
            BookingPaxDetails: paxDetails,
            CancellationDetails: Cancellation[0]
        }
    }

    async transformBookingFormat(body: any) {
        const transferBooking = await this.getGraphData(
            `query {
                                transferBookingDetails (
                                    where: {
                                        app_reference: {
                                            eq: "${body.AppReference}"
                                        }
                                    }
                                ) {
                                    attributes
                                }
                            }
                            `,
            "transferBookingDetails"
        );
        let parsedBookingData: any = JSON.parse(transferBooking?.[0]?.attributes.replace(/'/g, '"'));

        const transferPaxDetails = await this.getGraphData(
            `query {
                    transferBookingPaxDetails(
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        age
                        date_of_birth
                        status
                        attributes
                    }
                }
                `,
            "transferBookingPaxDetails"
        );

        const { title, first_name, last_name, email, phone } = transferPaxDetails[0]
        let bookingFormat = {
            "language": "en",
            "holder": {
                title: title,
                name: first_name,
                surname: last_name,
                email: email,
                phone: phone
            },
            "transfers": [
                {
                    "rateKey": parsedBookingData.rateKey,
                    "transferDetails": [
                        {
                            "code": "IB2588",
                            "companyName": "Ibirria",
                            "direction": "ARRIVAL",
                            "type": "FLIGHT"
                        }
                    ]
                }
            ],
            "clientReference": "IntegrationAgency",
            "remark": "Booking remarks"
        }

        return bookingFormat;
    }

}