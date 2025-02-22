import { Body, HttpService, Injectable } from "@nestjs/common";
import * as moment from 'moment';
import { getExceptionClassByCode } from "../../all-exception.filter";
import { RedisServerService } from "../../shared/redis-server.service";
import { CommonService } from "../../common/common/common.service";
import { BusApi } from "../bus.api";


@Injectable()
export class BusDbService extends BusApi {

    constructor(private redisServerService: RedisServerService,
        private readonly httpService: HttpService,
        private readonly commonService: CommonService,
    ) {
        super();
    }

    async formatPaxDetails(body: any, busData: any) {
        const passengersInfo = Array.from({ length: body.PassengerDetails.length }, (_, i) => {
            const passenger = body.PassengerDetails[i];
            const seatData = busData.seatsData[i];
            return {
                app_reference: body.AppReference,
                title: passenger.Title,
                name: passenger.Name,
                age: passenger.Age,
                gender: passenger.Gender,
                seat_no: seatData.SeatIndex,
                seat_type: seatData.SeatType,
                status: 'BOOKING_HOLD',
                is_ac_seat: seatData.is_ac_seat ? seatData.is_ac_seat : "false",
                fare: seatData.SeatFare,
                admin_commission: seatData.Price.AdminCommission ? seatData.Price.AdminCommission : 0,
                agent_commission: seatData.Price.AgentCommission ? seatData.Price.AgentCommission : 0,
                admin_tds: seatData.Price.AgentTds ? seatData.Price.AgentTds : 0,
                agent_tds: seatData.Price.AgentTds ? seatData.Price.AgentTds : 0,
                admin_markup: seatData.Price.AdminMarkup ? seatData.Price.AdminMarkup : 0,
                agent_markup: seatData.Price.AgentMarkup ? seatData.Price.AgentMarkup : 0,
                currency: seatData.Price.CurrencyCode,
                updated_by_id: passenger.userId ? passenger.userId : 0,
            };
        });
        return passengersInfo;
    }

    async addBusBookingDetails(body: any, busData: any) {
        try {
            body.userId = body.userId ? body.userId : 0;
            let cancellation_policy = "";
            if (busData.CancPolicy) {
                cancellation_policy = busData.CancPolicy.replace(/"/g, "'")
            }
            const sum = busData.seatsData.reduce((acc:any, curr:any) => acc + curr.Price.PublishedPriceRoundedOff, 0);
            const result = await this.getGraphData(
                `mutation {
					createBusBusBookingDetails(
				  		busBusBookingDetails: {
							status: "BOOKING_HOLD"
							app_reference: "${body.AppReference}"
                            booking_source: "${body.booking_source}"
                            user_type:"${body.BookingSource ? body.BookingSource : "B2C"}"
                            domain_origin: "${busData.domainOrigin ? busData.domain_origin : 0}"
							pnr: "${busData.pnr ? busData.pnr : "null"}"
							ticket: "${busData.ticket ? busData.ticket : "null"}"
                            transaction: "${busData.transaction ? busData.transaction : "null"}"
                            phone_code: "${body.ContactInfo.Phone_Code ? body.ContactInfo.Phone_Code : "null"}"
                            phone_number: "${body.ContactInfo.Phone ? body.ContactInfo.Phone : 0}"
							email: "${body.ContactInfo.Email ? body.ContactInfo.Email : "null"}"
                            alternate_number: "${body.ContactInfo.Mobile ? body.ContactInfo.Mobile : "null"}"
							payment_mode: "${busData.payment_mode ? busData.payment_mode : "null"}"
                            convinence_value: "${busData.convinence_value ? busData.convinence_value : 0}"
                            convinence_value_type: "${busData.convinence_value_type ? busData.convinence_value_type : "plus"}"
                            created_by_id: "${body.UserId ? body.UserId : 0}"
                            convinence_per_pax: "${busData.convinence_per_pax ? busData.convinence_per_pax : 0}"
                            cancel_policy:"${busData.cancel_policy ? busData.cancel_policy : "null"}"
                            convinence_amount:"${busData.convinence_amount ? busData.convinence_amount : 0}"
                            gst:"${busData.gst ? busData.gst : 0}"
                            promo_code:"${busData.promo_code ? busData.promo_code : "null"}"
                            discount:"${busData.discount ? busData.discount : 0}"
                            currency:"${busData.currency ? busData.currency : "INR"}"
                            currency_conversion_rate:"${busData.currency_conversion_rate ? busData.currency_conversion_rate : 0}",
                            total_fare:${sum},
			            }
					) {
						id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        pnr
                        ticket
                        transaction
                        phone_code
                        phone_number
                        alternate_number
                        email
                        payment_mode
                        convinence_value
                        convinence_value_type
                        convinence_per_pax
                        convinence_amount
                        gst
                        promo_code
                        discount
                        currency
                        currency_conversion_rate
                        created_by_id
                        cancel_policy
                        created_at
                        total_fare
                        user_type
					}
			  	}
			`,
                "createBusBusBookingDetails"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async addBusBookingItineraryDetails(body: any, busData: any) {
        try {
            const result = await this.getGraphData(
                `mutation {
					createBusBusBookingItineraryDetails(
                        busBusBookingItineraryDetails: {
							app_reference: "${body.AppReference}"
                            journey_datetime:"${busData.busData.journeyDate}"
                            departure_datetime:"${busData.pickup.PickupTime}"
                            arrival_datetime:"${busData.dropoff.PickupTime}"
                            departure_from:"${busData.busData.From}"
                            arrival_to:"${busData.busData.To}"
                            bus_type:"${busData.busData.BusTypeName}"
                            boarding_from:"${busData.pickup.PickupName}"
                            dropping_at:"${busData.dropoff.PickupName}"
                            operator:"${busData.busData.CompanyName ? busData.busData.CompanyName : "null"}"
                            attributes:"${JSON.stringify(busData).replace(/"/g, "'")}"
			            }
					) {
						id
                        app_reference
                        journey_datetime
                        departure_datetime
                        arrival_datetime
                        departure_from
                        arrival_to
                        boarding_from
                        dropping_at
                        bus_type
                        operator
					}
			  	}
			`,
                "createBusBusBookingItineraryDetails"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async addBusBookingCustomerDetails(formatPaxDetails: any, busData: any) {
        try {
            const combinedObj = { ...busData, paxDetails: formatPaxDetails };
            formatPaxDetails[0].attr = `${JSON.stringify(combinedObj).replace(/"/g, "'")}`;
            const result = await this.getGraphData(
                `mutation {
                    createBusBusBookingPaxDetails(
                        busBusBookingPaxDetails: ${JSON.stringify(formatPaxDetails).replace(/"(\w+)"\s*:/g, "$1:")}
                    ) {
                        id
                        app_reference
                        title
                        name
                        age
                        gender
                        seat_no
                        status
                        seat_type
                        is_ac_seat
                        fare
                        admin_commission
                        agent_commission
                        admin_tds
                        agent_tds
                        admin_markup
                        agent_markup
                        currency
                        updated_by_id
                    }
                }`,
                "createBusBusBookingPaxDetails"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    async getBusBookingPaxDetailsUniversal(body: any, bookingDetailsResp: any, bookingItineraryResp: any, bookingPaxDetailsResp: any) {
        return {
            BookingDetails: bookingDetailsResp[0],
            BookingPaxDetails: bookingPaxDetailsResp,
            BookingItineraryDetails: bookingItineraryResp[0],
        };
    }

    async getBusBookingDetails(body: any) {
        const result = await this.getGraphData(
            `query {
                busBusBookingDetails(
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
                    pnr
                    ticket
                    transaction
                    phone_code
                    phone_number
                    alternate_number
                    email
                    payment_mode
                    convinence_value
                    convinence_value_type
                    convinence_per_pax
                    convinence_amount
                    gst
                    promo_code
                    discount
                    currency
                    currency_conversion_rate
                    created_by_id
                    cancel_policy
                    created_at
                    total_fare
                    user_type
                }
              }
        `,
            "busBusBookingDetails"
        );
        return result;
    }

    async getBusBookingPaxDetails(body: any) {
        const result = await this.getGraphData(
            `query {
                busBusBookingPaxDetails(
                    where: {
                        app_reference: {
                          eq: "${body.AppReference}"
                        }
                      }           
            ) {
                id
                app_reference
                title
                name
                age
                gender
                seat_no
                status
                seat_type
                is_ac_seat
                fare
                admin_commission
                agent_commission
                admin_tds
                agent_tds
                admin_markup
                agent_markup
                currency
                attr
                updated_by_id
            }
          }
        `, "busBusBookingPaxDetails"
        );
        return result;
    }

    async getBusBookingItineraryDetails(body: any) {
        const result = await this.getGraphData(
            `query {
                busBusBookingItineraryDetails(
                    where: {
                        app_reference: {
                          eq: "${body.AppReference}"
                        }
                      }
                ) {
                    id
                    app_reference
                    journey_datetime
                    departure_datetime
                    arrival_datetime
                    departure_from
                    arrival_to
                    boarding_from
                    dropping_at
                    bus_type
                    operator
                    attributes
                }
              }
        `,
            "busBusBookingItineraryDetails"
        );
        return result;
    }

    async formatHoldeSeatsRequest(bookingDetails: any, paxDetails: any, busDetails: any, body: any) {
        const formattedJson = paxDetails[0].attr.replace(/'/g, '"');
        paxDetails = JSON.parse(formattedJson)
        const formattedRequest = {
            fromCityId: Number(paxDetails.busData.fromCityId),
            toCityId: Number(paxDetails.busData.toCityId),
            JourneyDate: paxDetails.busData.journeyDate,
            ChartCode: String(paxDetails.busData.RouteCode),
            BusId: String(paxDetails.busData.CompanyId),
            PickUpID: String(paxDetails.pickup.PickupCode),
            DropOffID: String(paxDetails.dropoff.PickupCode),
            ContactInfo: {
                CustomerName: paxDetails.paxDetails[0].name,
                Email: bookingDetails[0].email,
                Phone: bookingDetails[0].phone_number,
                Mobile: bookingDetails[0].alternate_number
            },
            Passengers: paxDetails.paxDetails.map((pax) => {
                const [firstName, ...lastNameArray] = pax.name.split(" ");
                const lastName = lastNameArray.join(" ") || ".";
                return {
                    LeadPassenger: true,
                    PassengerId: 0,
                    Title: pax.title,
                    Address: null,
                    Age: pax.age,
                    Email: bookingDetails[0].email,
                    FirstName: firstName,
                    LastName: lastName,
                    SeatNo: pax.seat_no,
                    Gender: pax.gender === "Male" ? 1 : 2,
                    IdNumber: null,
                    IdType: null,
                    Phoneno: bookingDetails[0].phone_number,
                    Fare: pax.fare
                };
            }),
            ResultToken: paxDetails.seatsData[0].ResultToken
        }
        return formattedRequest;
    }


    async updateBusBookingCustomerDetails(holdSeats: any, paxDetails: any) {
        try {
            const holdSeatdata = JSON.stringify(holdSeats.HoldSeatsForSchedule).replace(/\"/g, "'")
            const newAttr = holdSeats.HoldSeatsForSchedule;
            const existingAttr = JSON.parse(paxDetails[0].attr.replace(/'/g, '"'));

            const updateAttrData = { ...existingAttr, ...newAttr };
            const promises = paxDetails.map(async (paxDetail) => {


                const result = await this.getGraphData(`
                  mutation {
                    updateBusBusBookingPaxDetail(
                      id: ${paxDetail.id},
                      busBusBookingPaxDetailPartial: {
                        status: "BOOKING_HOLD",
                        attr: "${JSON.stringify(updateAttrData).replace(/"/g, "'")}"
                      }
                    )
                  }`, "updateBusBusBookingPaxDetail");

                return result;
            });

            const results = await Promise.all(promises);
            return results;


        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async formatBookSeatsRequest(bookingDetails: any, paxDetails: any, busDetails: any, body: any) {
        const formattedJson = paxDetails[0].attr.replace(/'/g, '"');
        paxDetails = JSON.parse(formattedJson)
        const formattedRequest = {
            HoldId: paxDetails.HoldKey,
            RouteScheduleId: String(paxDetails.busData.RouteScheduleId),
            boarding_from: paxDetails.pickup.PickupName,
            ChartCode: String(paxDetails.busData.RouteCode),
            booking_source: paxDetails.busData.booking_source,
            BoardingPointId: paxDetails.pickup.PickupCode,
            DropingPointId: paxDetails.dropoff.PickupCode,
            app_reference: body.AppReference,
            passenger_email: bookingDetails[0].email,
            passenger_contact: bookingDetails[0].phone_number,
            Passenger: paxDetails.Passenger,
            ResultToken: paxDetails.busData.ResultToken
        }
        return formattedRequest;
    }

    async confirmBusBusBookingDetails(bookSeats: any, bookingDetails: any) {
        try {
            const result = await this.getGraphData(
                `mutation {
                updateBusBusBookingDetail(
                    id: ${bookingDetails[0].id},
                    busBusBookingDetailPartial: {
                        status: "BOOKING_CONFIRMED"
                        pnr: "${bookSeats.BookSeats.PNRNo}"
                        ticket: "${bookSeats.BookSeats.TicketNo}"   
                    }
                )
              }
        `,
                "updateBusBusBookingDetail"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async confirmBusBookingCustomerDetails(bookSeats: any, paxDetails: any) {
        try {
            const promises = paxDetails.map(async (paxDetail: any) => {
                const result = await this.getGraphData(`
                  mutation {
                    updateBusBusBookingPaxDetail(
                      id: ${paxDetail.id},
                      busBusBookingPaxDetailPartial: {
                        status: "BOOKING_CONFIRMED",
                      }
                    )
                  }`, "updateBusBusBookingPaxDetail");

                return result;
            });

            const results = await Promise.all(promises);
            return results;

        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async convertTimestampToISOString(timestampString: any) {
        const date = moment(parseInt(timestampString));
        const isoString = date.format('YYYY-MM-DDTHH:mm:ss');
        return isoString;
    }


}