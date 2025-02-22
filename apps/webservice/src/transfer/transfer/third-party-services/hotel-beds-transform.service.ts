import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT } from "apps/webservice/src/constants";
import { AnySoaRecord } from "dns";
import * as moment from "moment";
import { RedisServerService } from "../../../shared/redis-server.service";
import { TransferApi } from "../../transfer.api";
import { TransferDbService } from "../transfer-db.service";

@Injectable()
export class HotelBedsTransformService extends TransferApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: TransferDbService) {
        super();
    }

    
    async availabilityResponseFormat(data: any, body:any): Promise<any> {
        let responseFormat = {
            ProductName: data?.vehicle?.name,
            ProductCode: data?.vehicle?.code,
            ImageUrl:data?.content?.images?.[0]?.url ,
            ImageHisUrl: data?.content?.images?.[1]?.url,
            BookingEngineId: "",
            Promotion: "",
            PromotionAmount: 0,
            StarRating: 0,
            ReviewCount: 0,
            DestinationName: data?.pickupInformation?.from?.description,
            Price: {
                TotalDisplayFare: data.price.totalAmount,
                GSTPrice: 0,
                PriceBreakup: {
                    AgentCommission: 0,
                    AgentTdsOnCommision: 0
                },
                Currency: data.price.currencyId
            },
            Description: "",
            Cancellation_available: data.cancellationPolicies,
            Cat_Ids: [ ],
            Sub_Cat_Ids: [],
            Supplier_Code: "",
            Duration: "",
            ResultToken: data.rateKey,
            data        
        }
        
        return responseFormat; 
    }

    async ProductDetailsResponseFormat(data: any): Promise<any> {

        console.log(data);
        let responseFormat = {
            "ProductName": data?.vehicle?.name,
            "ReviewCount": 0,
            "product_image": data?.content?.images?.[0]?.url,
            "StarRating": 0,
            "Promotion": false,
            "Duration": "",
            "ProductCode": data?.vehicle?.code,
            "ProductPhotos": [
                {
                    "photoHiResURL": data?.content?.images?.[1]?.url,
                    "photoURL": data?.content?.images?.[2]?.url,
                    "ImageCaption": ""
                }
            ],
            "Product_Video": "",
            "Price": {
                "TotalDisplayFare": data?.price?.totalAmount,
                "GSTPrice": 0,
                "PriceBreakup": {
                    "AgentCommission": 0,
                    "AgentTdsOnCommision": 0
                },
                "Currency": data?.price?.currencyId
            },
            "Product_Reviews": [],
            "Product_Tourgrade": [],
            "Product_available_date": {},
            "Cancellation_available": true,
            "Cancellation_day": 0,
            "Cancellation_Policy": data?.cancellationPolicies,
            "BookingEngineId": "",
            "Voucher_req": "",
            "Tourgrade_available": true,
            "UserPhotos": [],
            "Product_AgeBands": [],
            "BookingQuestions": [],
            "Highlights": null,
            "SalesPoints": [],
            "TermsAndConditions": null,
            "MaxTravellerCount": data?.maxPaxCapacity,
            "Itinerary": "",
            "VoucherOption": "",
            "VoucherOption_List": "",
            "AdditionalInfo": [],
            "Inclusions": [ ],
            "DepartureTime": data?.pickupInformation?.time,
            "DeparturePoint": data?.pickupInformation?.from?.description,
            "DepartureTimeComments": "",
            "ReturnDetails": "",
            "Exclusions": [],
            "ShortDescription": "",
            "Location": "",
            "AllTravellerNamesRequired": false,
            "Country": "",
            "Region": "",
            "ResultToken": data?.rateKey,
        }
        
        return responseFormat; 
    }

    async addTransferBookingDetails(data: any, body:any): Promise<any> {
    const {direction, transferType, vehicle, category, pickupInformation,price, rateKey,cancellationPolicies,searchBody,resultToken} = data
        const result = await this.getGraphData(
            `mutation {
					createTransferBookingDetail(
                        transferBookingDetail: {
							status: "BOOKING_HOLD"
                            booking_id:"${data?.booking_from ?? 0}"
							app_reference: "${body.AppReference}"
                            booking_source: "${body.BookingSource}"
                            domain_origin: ${data?.domainOrigin ?? 0 }
							star_rating: ${data.starRating ? data.starRating : 0}
							email: "${body.AddressDetails.Email}"
                            phone_number: "${body.AddressDetails.Contact}"
                            currency: "${data?.price?.currencyId ?? " "}"
                            created_by_id: ${body.UserId}
                            booking_reference: "${data?.Remarks ?? ""}"
                            attributes: "${JSON.stringify({direction, transferType, vehicle, category, pickupInformation,price, rateKey,cancellationPolicies,searchBody,resultToken}).replace(/"/g, "'")}"
                            confirmation_reference:""
                            product_name: ""
                            product_code: ""
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
                            travel_date: "${data.pickupInformation.date}"
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

    async addTransferBookingItineraryDetails(data:any, body:any): Promise<any>{
        const {direction, transferType, vehicle, category, pickupInformation,price, rateKey,cancellationPolicies,searchBody,resultToken} = data

        const result = await this.getGraphData(
            `mutation {
                    createTransferBookingItineraryDetail(
                        transferBookingItineraryDetail: {
                            status: "BOOKING_HOLD"
                            app_reference: "${body.AppReference}"
                            currency: "${data?.price?.currencyId ?? " "}"
                            booking_reference: "${data.remarks}"
                            attributes: "${JSON.stringify({direction, transferType, vehicle, category, pickupInformation,price, rateKey,cancellationPolicies,searchBody,resultToken}).replace(/"/g, "'")}"
                            location : "${data.pickupInformation.from.description}"
                            travel_date :"${data.pickupInformation.date}"
                            grade_code : ""
                            grade_desc : ""
                            total_fare : ${data?.price?.totalAmount ?? 0 }
                            admin_markup :  ${data?.price?.admin_markup ?? 0 }
                            admin_net_markup : ${data?.price?.admin_net_markup ?? 0 }
                            agent_markup : ${data?.price?.agent_markup ?? 0 }
                            admin_commission : ${data?.price?.admin_commission ?? 0 }
                            admin_tds : ${data?.price?.admin_tds ?? 0 }
                            agent_commission : ${data?.price?.agent_commission ?? 0 }
                            agent_tds : ${data?.price?.agent_tds ?? 0 }
                            api_raw_fare : ${data?.price?.api_raw_fare ?? 0 }
                            agent_buying_price : ${data?.price?.agent_buying_price ?? 0 }
                            gst : ${data?.price?.gst ?? 0 }
                            ProductPrice : ${data?.price?.ProductPrice ?? 0 }
                            Discount : ${data?.price?.Discount ?? 0 }
                            Tax : ${data?.price?.Tax ?? 0 }
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

    async addTransferBookingPaxDetails(data:any, body:any):Promise<any>{
        const result = await this.getGraphData(
            `mutation {
                    createTransferBookingPaxDetail(
                        transferBookingPaxDetail: {
                            status: "BOOKING_HOLD"
                            app_reference: "${body.AppReference}"
                            booking_reference: "${data.remarks}"
                            attributes: "${JSON.stringify(body).replace(/"/g, "'")}"
                            title : "${body.PassengerDetails[0].Title}"
                            first_name : "${body.PassengerDetails[0].FirstName}"
                            middle_name : "${body.PassengerDetails[0].MiddleName}"
                            last_name : "${body.PassengerDetails[0].LastName}"
                            phone : ${body.AddressDetails.Contact}
                            email : "${body.AddressDetails.Email}"
                            pax_type : "${body.PassengerDetails[0].PaxType}"
                            age : ${body.PassengerDetails[0].Age}
                            date_of_birth : "${body.PassengerDetails[0].Dob}"
                            adult_count: "${data.searchBody.AdultCount}"
                            child_count: "${data.searchBody.ChildCount}"
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

        return result;
    }

    async getTransferBookingPaxDetailsUniversal(body:any,
        bookingDetails:any,
        bookingItinerary:any,
        paxDetails:any):Promise<any>{

        return {
            bookingDetails,
            bookingItinerary,
            paxDetails
        }
    }

    async transformBookingFormat(body:any){
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
        let parsedBookingData:any = JSON.parse(transferBooking?.[0]?.attributes.replace(/'/g, '"'));
        
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

       const {title, first_name, last_name, email,phone } = transferPaxDetails[0]
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