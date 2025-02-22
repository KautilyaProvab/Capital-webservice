import { BaseApi } from "../base.api";
import * as moment from "moment"
import {HOTELBEDS_ACTIVITY_BOOKING_SOURCE , BASE_CURRENCY} from '../constants'

export abstract class ActivityApi extends BaseApi {
    constructor() {
        super()
    }

    getDestinationsUniversal(body: any) {
        return {
            RecordId: body.id,
            DestinationName: body.destination_name,
            DestinationId: body.destination_id,
            DestinationType: body.destination_type,
            TimeZone: body.timeZone,
            IataCode: body.iataCode,
            Latitude: body.lat,
            Longitude: body.lng
        }
    }

    getSearchUniversal(body: any): any {
        return {
            ...body
        }
    }

    getDetailsUniversal(body: any): any {
        return {
            ...body
        }
    }

    getAvailabilityUniversal(body: any): any {
        return {
            ...body
        }
    }

    /*blockUniversal(body: any): any {
        return {
            
        }
    }

    bookUniversal(body: any): any {
        return {
            
        }
    }*/


    async formatPaxDetailsUniversal(body: any, extras: any) {
        let paxDetails = [];

        for (const pax of body) {
            let age
            if (extras.booking_source === HOTELBEDS_ACTIVITY_BOOKING_SOURCE) {
                age = moment().diff(moment(pax.Dob, 'YYYYMMDD'), 'years')
            }

            let paxes = {
                created_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
                app_reference: extras.AppReference,
                booking_reference: '',
                first_name: pax.FirstName ? pax.FirstName : "",
                last_name: pax.LastName ? pax.LastName : "",
                age,
                contact: pax?.ContactNo ?? null,
                address: pax?.AddressLine1 ?? null,
                email: pax?.Email ?? null,
                title: pax.Title ? pax.Title : "",
                pax_type: pax.PaxType ? pax.PaxType : '',
                attributes: '',
                status: "BOOKING_HOLD",
                Dob: pax?.Dob ?? null,
                gender: pax?.Gender ?? null,
                nationality: pax?.Nationality ?? null,
                city: pax?.City ?? null,
                travellerType: pax?.travellerType ?? null,
                travellerTypeCount: pax?.travellerTypeCount ?? null
            };

            let result = await this.manager.query(`insert into activities_booking_pax_details  set ?`, [paxes]);

            paxDetails.push(paxes);
        }
        return paxDetails;
    }


    async formatBookingItineraryDetailsUniversal(body: any, extras: any): Promise<any> {
        body.ProductName = body.ProductName.replace(/'/g, "-").replace(/:/g, "-");
        body.GradeDescription = body.GradeDescription.replace(/'/g, "-").replace(/:/g, "-");
        const BookingItineraryDetails = {
            id: '',
            status: "BOOKING_HOLD",
            booking_source: body?.booking_source ?? '',
            booking_reference: '',
            app_reference: body?.app_reference,
            attributes: {
                ProductName: body?.ProductName ?? '',
                ProductCode: body?.ProductCode ?? '',
                ProductImage: body?.ProductImage ?? '',
                BookingDate: "",
                StarRating: 0,
                Duration: '',
                Destination: body?.Destination ?? "" ,
                GradeCode: body?.GradeCode ?? '',
                GradeDescription: body?.GradeDescription ?? '',
                DeparturePointAddress: "",
                BookingQuestions: body?.BookingQuestions ?? [],
                NoneedAnswers : body?.NoneedAnswers ?? [],
                SupplierName: "",
                SupplierPhoneNumber: "",
                Cancellation_available: true,
                Price: body?.Price ?? {},
                TM_Cancellation_Charge: [],
                TM_LastCancellation_date: "",
                HotelPickup: "",
                hotel_pikcup_option: {},
                BlockTourId: body.BlockTourId,
                Cancellation_Policy: body?.Cancellation_Policy ?? '',
                TermsAndConditions: body?.TermsAndConditions ?? null,
                Inclusions: body?.Inclusions ?? [],
                Email: extras.AddressDetails.Email,
                body,
                AddressDetails: extras.AddressDetails

            },
            totalAmount: body.Price.TotalDisplayFare,
            activity_name: body?.ProductName ?? '',
            activity_code: body?.ProductCodes ?? '',
            activity_type: "",
            dateFrom: body?.from.from,
            dateTo: body?.from.to,
            address: "",
            city: body?.Destination ?? "" ,
            country: extras.AddressDetails.Country,
            description: body?.GradeDescription ?? '',
            contactInfo: extras.AddressDetails.Contact,
            supplier_name: extras.AddressDetails.FirstName,
            commissionPercentage: 0,
            commissionAmt: '',
            pickup: "",
            commissionVatAmt: '',
            commissionVatPercentage: ''
        };

        return BookingItineraryDetails

    }
    async convinenceFees(body: any, totalFare: any, flag = 'Activity', passengerCount?: any): Promise<any> {
        let ConvinenceFee: any = 0;

        const query = `select * from core_payment_charges WHERE module = "${flag}";`
        const queryResponse = await this.manager.query(query);

        if (Array.isArray(queryResponse) && queryResponse.length > 0 && queryResponse[0].status == 1) {
            if (queryResponse[0].fees_type === 'percentage') { 
                const percentageAdvanceTax = (totalFare * queryResponse[0].fees) / 100;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));

            } else if (queryResponse[0].fees_type === 'plus') {
                const percentageAdvanceTax = queryResponse[0].fees;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));
            }

            if (queryResponse[0].added_per_pax === "Yes") {
                ConvinenceFee += Number((ConvinenceFee * passengerCount).toFixed(2));
            }
        }

        return {
            ConvinenceFee,
            convinence_value_type: queryResponse[0].fees_type
        };
    }

    async addHotelBookingDetails(body: any, Itinerary: any, passengerCount: any): Promise<any> {
        // const rateDetails = body.parsedInfo.ActivityList[0].rateDetails
        // const Price = body.parsedInfo.ActivityList[0].rateDetails.Price
        
        const attributes = {
            questions: body.parsedInfo.BookingQuestions, 
            answers: body.parsedInfo.answers,
            NoneedAnswers :body.parsedInfo.NoneedAnswers,
            ItenaryData: Itinerary,
            body: body.parsedInfo.body
        };
    
        let totalPrice= body.parsedInfo.Price.TotalDisplayFare 
        let Conversion_Rate = 1;
        if (body.parsedInfo.Price.Currency && body.parsedInfo.Price.Currency != BASE_CURRENCY) {
            const currencyDetails = await this.getGraphData(`
                query {
                  cmsCurrencyConversions(where: {
                                currency: {
                                    eq:"${body.parsedInfo.Price.Currency}"
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
            Conversion_Rate = currencyDetails[0]['value'];
        }
        
        
        //   body.parsedInfo.PromoCode 
        let promoCode: any = [];
        
        if (body.parsedInfo.PromoCode && body.parsedInfo.PromoCode.trim() !== '') {
            // const discountResult = await this.manager.query(`SELECT discount_value FROM core_promocodes WHERE promo_code = ?`, [body.parsedInfo.PromoCode]);
            // discount = discountResult.length > 0 ? discountResult[0].discount_value : 0;
            promoCode = await this.getGraphData(
                `{
                corePromocodes(where:{
                    promo_code:{
                        eq: "${body.parsedInfo.PromoCode}"
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
        let convinence_value_type 
        // if (body.parsedInfo.UserType === "B2C") {
         const results = await this.convinenceFees(body, body.parsedInfo.Price.TotalDisplayFare, "Activity", passengerCount);    
            convinenceFee =   results.ConvinenceFee 
            convinence_value_type = results.convinence_value_type
            if(convinence_value_type == 'plus'){    
                convinenceFee = convinenceFee * Conversion_Rate
            }
        // }   

        console.log('====================================');
        console.log("from:body.parsedInfo.from:",body.parsedInfo.from);
        console.log('====================================');
        // if (body.parsedInfo.UserType === "B2C") {
        //     convinenceFee = convinenceFee * passengerCount;
        // }

        if (body.parsedInfo.UserType === "B2C" && convinenceFee != 0) {
            body.parsedInfo.Price.TotalDisplayFare += convinenceFee
        }

        let discountAmount: any = 0;
        let firstPromo: any = "";
        // let totalAmountAfterDiscount: any = data.Price.TotalDisplayFare;
        if (promoCode.length > 0 && body.parsedInfo.UserType === "B2C") {
            firstPromo = promoCode[0];
            if (firstPromo.discount_type === "percentage") {
                let totalPrice = body.parsedInfo.Price?.TotalDisplayFare;
                discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));
                body.parsedInfo.Price.TotalDisplayFare -= discountAmount;
            } else
                if (firstPromo.discount_type === "plus") {
                    discountAmount = firstPromo.discount_value;
                    discountAmount = discountAmount * Conversion_Rate
                    body.parsedInfo.Price.TotalDisplayFare -= discountAmount.toFixed(2);
                }
        }

        if (firstPromo != "" && firstPromo.use_type === "Single") {
            const query = `UPDATE core_promocodes SET status = 0 WHERE id = ${firstPromo.id}`;
            await this.manager.query(query);
        }
        
        
const cancel_Date = body.parsedInfo.from;
const orignalCancelDate = body.parsedInfo.from.from;

const queryDay = `SELECT days FROM cancellation_capping WHERE module = 'activity'`;
const responseDay = await this.manager.query(queryDay);

function adjustDatesByDays(dateStr, daysToSubtract) {
  const date = new Date(dateStr); 
  date.setDate(date.getDate() - daysToSubtract);  
  return date.toISOString().split('T')[0];  
}

const originalFromDate = cancel_Date.from;
const originalToDate = cancel_Date.to;
const adjustedFromDate = adjustDatesByDays(originalFromDate, responseDay[0].days);
const adjustedDateFrom = adjustDatesByDays(cancel_Date.cancellationPolicies[0].dateFrom,responseDay[0].days)
const adjustedPolicy = `If cancelled on or after ${adjustedDateFrom}, an amount of ${cancel_Date.cancellationPolicies[0].amount} is chargeable.`;
cancel_Date.policy = adjustedPolicy;
cancel_Date.cancellationPolicies[0].dateFrom = adjustedDateFrom
const adjustedToDate = adjustDatesByDays(originalToDate, responseDay[0].days);
cancel_Date.from = adjustedFromDate;
cancel_Date.to = adjustedToDate;
let pay_later = `false`;
if( body.parsedInfo.UserType == 'B2B' && body.parsedInfo.RateClass == 'NOR' && body.parsedInfo.Refundable == 'true'){
    pay_later = `true`;
}
        let obj: any = {
            domain_origin: "HotelbedsActivity",
            booking_source: body?.parsedInfo?.UserType ?? 'B2C',
            booking_reference: '',
            app_reference: body.parsedInfo?.app_reference ?? '',
            status: "BOOKING_HOLD",
            currency: body.parsedInfo.Price?.Currency ?? '',
            clientReference: "",
            creationDate: null,
            creationUser: "",
            paymentTypeCode: "",
            invoicingCompany_code: "",
            invoicingCompany_name: "",
            invoicingCompany_registrationNumber: '',
            pendingAmount: null,
            total:  totalPrice  ?? '',
            admin_markup: body.parsedInfo.Price.markupDetails.AdminMarkup,
            agent_markup: body.parsedInfo.Price.markupDetails.AgentMarkup,
            convinence: convinenceFee,
            convinence_value_type : convinence_value_type ? convinence_value_type : 'N/A',
            totalNet: body.parsedInfo.Price?.TotalDisplayFare.toFixed(2) ?? '',
            AgentServiceTax: '',
            service_tax: "",
            country: body.addressDetails?.Country ?? '',
            created_by_id: body.parsedInfo?.UserId ? body.parsedInfo?.UserId : 0,
            created_datetime: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
            holder_name: body.addressDetails?.FirstName ?? '',
            holder_contact: body.addressDetails?.Contact ?? '',
            holder_email: body.addressDetails?.Email ?? '',
            promo_code: body?.parsedInfo?.PromoCode ?? '',
            discount: discountAmount,
            attributes: `${JSON.stringify(attributes).replace(/"/g, "'")}`,
            cancel_attributes:`${JSON.stringify(cancel_Date).replace(/"/g, "'")}`,
            pay_later : `${pay_later}`,
            payment_status:'NOT PAID',
            cancellation_deadline:cancel_Date.from,
            API_cancellation_deadline:orignalCancelDate
        }



        let result = await this.manager.query(`insert into activity_booking_details set ? `, [obj])

        if (attributes.ItenaryData.attributes.body) {
            delete attributes.ItenaryData.attributes.body
        }
        obj.attributes = attributes


        return obj;
    }

    // async formatPriceDetailToSelectedCurrency(currency: any) {
    //     try {
    //       const currencyDetails = await this.getGraphData(`
    //   query {
    //     cmsCurrencyConversions(where: {
    //                   currency: {
    //                       eq:"${currency}"
    //                   } 
    //               }
    //               ) {
    //       id
    //       currency
    //       value
    //       status
    //     }
    //     }
    // `, "cmsCurrencyConversions"
    //       );
    //       if (currencyDetails.length < 1) {
    //         throw new Error("400 No Currency Conversion Found");
    //       }
    //       return currencyDetails[0];
    //     }
    //     catch (error) {
    //       const errorClass: any = getExceptionClassByCode(error.message);
    //       throw new errorClass(error.message);
    //     }
    //   }

}
