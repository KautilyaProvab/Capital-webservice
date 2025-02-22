import { Injectable } from '@nestjs/common';
import { getManager } from 'typeorm';
import { formatDate } from '../../app.helper';
import { getExceptionClassByCode } from "../../all-exception.filter";
import { BaseApi } from '../../base.api';

@Injectable()
export class BookingsDbService extends BaseApi {
    constructor() {
        super();
    }
    async getHotelBookings(status: any, body: any, currentDate: any) {
        const result = await this.getGraphData(`
            query {
                hotelHotelBookingDetails(
                    where: {
                        status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        hotel_check_in: {
                            gte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    domain_origin
                    status
                    app_reference
                    booking_source
                    Api_id
                    booking_id
                    booking_reference
                    confirmation_reference
                    hotel_name
                    star_rating
                    hotel_code
                    hotel_address
                    hotel_photo
                    phone_number
                    alternate_number
                    email
                    hotel_check_in
                    hotel_check_out
                    payment_mode
                    promo_code
                    discount
                    currency
                    currency_conversion_rate
                    attributes
                    created_by_id
                    created_datetime
                    cancelled_datetime
                    cancel_deadline
                    TotalAmount
                    hotelHotelBookingItineraryDetails {
                        app_reference
                        location
                        check_in
                        check_out
                        room_id
                        room_type_name
                        bed_type_code
                        status
                        adult_count
                        child_count
                        smoking_preference
                        total_fare
                        admin_markup
                        agent_markup
                        currency
                        attributes
                        room_price
                        tax
                        max_occupancy
                        extra_guest_charge
                        child_charge
                        other_charges
                        discount
                        service_tax
                        agent_commission
                        cancellation_policy
                        tds
                        gst
                    }
                    hotelHotelBookingPaxDetails {
                        app_reference
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        date_of_birth
                        age
                        passenger_nationality
                        passport_number
                        passport_issuing_country
                        passport_expiry_date
                        address
                        address2
                        city
                        state
                        postal_code
                        phone_code
                        country
                        status
                        attributes
                    }
                }
            }
        `, 'hotelHotelBookingDetails');
        return result;
    }

    async getHotelbedsActivityBooking(status: any, body: any, currentDate: any) {
        const query1 = `
            SELECT
                *
            FROM
                activity_booking_details
            WHERE
                status = "${status}"
                AND DATE(created_datetime) >= "${currentDate}"
                AND created_by_id = "${body}"
                AND booking_source = 'B2C'`
        
        const bookingDetails = await this.manager.query(query1);
        const result = [];

        for (const refrence of bookingDetails) {
            const appReference = refrence.app_reference;
    
            const query2 = `
                SELECT
                    *
                FROM
                    activities_booking_pax_details
                WHERE app_reference = "${appReference}"`;
    
            const bookingPaxDetails = await this.manager.query(query2);
            const attribute = refrence.attributes.replace(/'/g, '"');
            let Bookattrribute = JSON.parse(attribute);
            let ItenaryData = Bookattrribute.ItenaryData;
    
            if (ItenaryData['attributes']['body']) {
                delete ItenaryData['attributes']['body'];
            }
    
            refrence.attributes = ItenaryData;
            result.push({
                actvityBookingDetails: refrence,
                actvityItenaryDetails: [ItenaryData],
                activityPaxDetails: bookingPaxDetails,
            });
        }
        return result;
    }
    


    // async getTourBooking(status: any, body: any, currentDate: any): Promise<any> {
    //     try {
    //         const query1 = `SELECT 
    //                         pax_title,
    //                         pax_first_name,
    //                         pax_middle_name,
    //                         pax_last_name,
    //                         pax_type,
    //                         pax_dob,
    //                         pax_age,
    //                         created_at
    //                         from tour_pax_details 
    //                         where UserId ='${body.UserId}'`
    //         const query2 = `SELECT 
    //                         app_reference,
    //                         tours_id,
    //                         tour_module_type,
    //                         basic_fare,
    //                         child_fare,
    //                         TotalFare,
    //                         currency_code,
    //                         mobile_number,
    //                         email,
    //                         departure_date,
    //                         end_date,
    //                         AdultCount,
    //                         ChildCount,
    //                         remarks,
    //                         markup,
    //                         gst_value,
    //                         Booking_Id,
    //                         status,
    //                         start_city,
    //                         end_city,
    //                         package_name
    //                         from tour_booking_details 
    //                         where UserId = '${body.UserId}'`

    //         const query3 = `SELECT 
    //                         t.id,
    //                         t.banner_image,
    //                         t.terms,
    //                         t.canc_policy,
    //                         tc.name AS tours_country 
    //                         from tours t 
    //                         JOIN tour_booking_details 
    //                         ON t.id = tour_booking_details.tours_id 
    //                         LEFT JOIN tours_country tc ON t.tours_country = tc.id
    //                         where UserId = '${body.UserId}'`;

    //         const VoucherDetails1 = await this.manager.query(query1);
    //         const VoucherDetails2 = await this.manager.query(query2);
    //         const VoucherDetails3 = await this.manager.query(query3);

    //         if (VoucherDetails1.length < 0 && VoucherDetails2.length < 0 && VoucherDetails3.length < 0) {
    //             const errorClass: any = getExceptionClassByCode("403 please provide the valid app_reference!");
    //             throw new errorClass("403 Given Appreference not exist!");
    //         }
    //         const passangerDetails = [];
    //         for (const row of VoucherDetails1) {
    //             const passanger = {
    //                 Title: row.pax_title,
    //                 FirstName: row.pax_first_name,
    //                 MiddleName: row.pax_middle_name,
    //                 LastName: row.pax_last_name,
    //                 PaxType: row.pax_type,
    //                 DateofBirth: row.pax_dob.toISOString().slice(0, 10),
    //                 Age: row.pax_age,
    //                 Created: row.created_at
    //             }
    //             passangerDetails.push(passanger);
    //         }
    //         if (Array.isArray(passangerDetails) && passangerDetails.length > 0) {
    //             !passangerDetails.some(passenger => 'LeadPassenger' in passenger) ? passangerDetails[0].LeadPassenger = true : false;
    //         }
    //         const bookingDetails = [];
    //         const maxLength = Math.max(VoucherDetails2.length, VoucherDetails3.length);
    //         for (let i = 0; i < maxLength; i++) {
    //             const row1 = VoucherDetails2[i];
    //             const row2 = VoucherDetails3[i];
    //             const booking = {
    //                         AppReference: row1.app_reference,
    //                         id: row1.tours_id,
    //                         from_date: row1.departure_date,
    //                         to_date: row1.end_date,
    //                         TourType: row1.tour_module_type,
    //                         Basicfare: row1.basic_fare,
    //                         Childfare: row1.child_fare,
    //                         TotalFare: row1.TotalFare,
    //                         CurrencyCode: row1.currency_code,
    //                         Mobile_Number: row1.mobile_number,
    //                         Email: row1.email,
    //                         AdultCount: row1.AdultCount,
    //                         ChildCount: row1.ChildCount,
    //                         Remarks: row1.remarks,
    //                         Markup: row1.markup,
    //                         Gst_Value: row1.gst_value,
    //                         Booking_Id: row1.Booking_Id,
    //                         Booking_Status: row1.status,
    //                         Start_City: row1.start_city,
    //                         End_City: row1.end_city,
    //                         Package_Name: row1.package_name,
    //                         banner_image: row2.banner_image,
    //                         terms: row2.terms,
    //                         canc_policy: row2.canc_policy,
    //                         tours_country: row2.tours_country
    //             };
    //             bookingDetails.push(booking);
    //         }
    //         const response = {
    //             PassangerDetails: passangerDetails,
    //             BookingDeatils: bookingDetails
    //         }
    //         return response;
    //     } catch (error) {
    //         const errorClass: any = getExceptionClassByCode(error.message);
    //         throw new errorClass(error.message);
    //     }
    // }
    async getFlightBookings(status: any, body: any, currentDate: any) {
        const result = await this.getGraphData(`
            query {
                flightBookings(
                    where: {
                        booking_status: {
                            in: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        journey_start: {
                            gte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                    order: {journey_start: ASC}
                ) {
                    id
                    domain_origin
                    status
                    app_reference
                    api_code
                    booking_source
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
                    flightBookingTransactionItineraries {
                        id
                        airline_name
                        airline_pnr
                        airline_code
                        departure_datetime
                        arrival_datetime
                        from_airport_name
                        to_airport_name
                        flight_number
                    }
                }
            }
        }
        `, 'flightBookings');
        return result;
    }


    async getHotelBookingDetails(status: any, body: any, currentDate: any) {
        const result = await this.getGraphData(`
            query {
                hotelHotelBookingDetails(
                    where: {
                        status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        hotel_check_out: {
                            lte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    domain_origin
                    status
                    app_reference
                    booking_source
                    Api_id
                    booking_id
                    booking_reference
                    confirmation_reference
                    hotel_name
                    star_rating
                    hotel_code
                    hotel_address
                    hotel_photo
                    phone_number
                    alternate_number
                    email
                    hotel_check_in
                    hotel_check_out
                    payment_mode
                    promo_code
                    discount
                    currency
                    currency_conversion_rate
                    attributes
                    created_by_id
                    created_datetime
                    TotalAmount
                    hotelHotelBookingItineraryDetails {
                        app_reference
                        location
                        check_in
                        check_out
                        room_id
                        room_type_name
                        bed_type_code
                        status
                        adult_count
                        child_count
                        smoking_preference
                        total_fare
                        admin_markup
                        agent_markup
                        currency
                        attributes
                        room_price
                        tax
                        max_occupancy
                        extra_guest_charge
                        child_charge
                        other_charges
                        discount
                        service_tax
                        agent_commission
                        cancellation_policy
                        tds
                        gst
                    }
                    hotelHotelBookingPaxDetails {
                        app_reference
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        date_of_birth
                        age
                        passenger_nationality
                        passport_number
                        passport_issuing_country
                        passport_expiry_date
                        address
                        address2
                        city
                        state
                        postal_code
                        phone_code
                        country
                        status
                        attributes
                    }
                }
            }
        `, 'hotelHotelBookingDetails');
        return result;
    }

    async getFlightBookingDetails(status: any, body: any, currentDate: any) {
        const result = await this.getGraphData(`
            query {
                flightBookings(
                    where: {
                        booking_status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        journey_end: {
                            lte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    id
                    domain_origin
                    status
                    app_reference
                    api_code
                    booking_source
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
                    flightBookingTransactionItineraries {
                        id
                        airline_name
                        airline_pnr
                        airline_code
                        departure_datetime
                        arrival_datetime
                        from_airport_name
                        to_airport_name
                        flight_number
                    }
                }
            }
        }
        `, 'flightBookings');
        return result;
    }

    async getFlightBookingCancelledDetails(status: any, body: any) {
        const result = await this.getGraphData(`
            query {
                flightBookings(
                    where: {
                        booking_status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    id
                    domain_origin
                    status
                    app_reference
                    api_code
                    booking_source
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
                    flightBookingTransactionItineraries {
                        id
                        airline_name
                        airline_pnr
                        airline_code
                        departure_datetime
                        arrival_datetime
                        from_airport_name
                        to_airport_name
                        flight_number
                    }
                }
            }
        }
        `, 'flightBookings');
        return result;
    }

    async getHotelBookingCancelledDetails(status: any, body: any) {
        const result = await this.getGraphData(`
            query {
                hotelHotelBookingDetails(
                    where: {
                        status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    domain_origin
                    status
                    app_reference
                    booking_source
                    booking_id
                    Api_id
                    booking_reference
                    confirmation_reference
                    hotel_name
                    star_rating
                    hotel_code
                    hotel_address
                    hotel_photo
                    phone_number
                    alternate_number
                    email
                    hotel_check_in
                    hotel_check_out
                    payment_mode
                    promo_code
                    discount
                    currency
                    currency_conversion_rate
                    attributes
                    created_by_id
                    created_datetime
                    cancelled_datetime
                    cancel_deadline
                    hotelHotelBookingItineraryDetails {
                        app_reference
                        location
                        check_in
                        check_out
                        room_id
                        room_type_name
                        bed_type_code
                        status
                        adult_count
                        child_count
                        smoking_preference
                        total_fare
                        admin_markup
                        agent_markup
                        currency
                        attributes
                        room_price
                        tax
                        max_occupancy
                        extra_guest_charge
                        child_charge
                        other_charges
                        discount
                        service_tax
                        agent_commission
                        cancellation_policy
                        tds
                        gst
                    }
                    hotelHotelBookingPaxDetails {
                        app_reference
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        date_of_birth
                        age
                        passenger_nationality
                        passport_number
                        passport_issuing_country
                        passport_expiry_date
                        address
                        address2
                        city
                        state
                        postal_code
                        phone_code
                        country
                        status
                        attributes
                    }
                }
            }
        `, 'hotelHotelBookingDetails');
        return result;
    }


    async getHotelConfirmedCancelledBookings(body: any, currentDate: any) {
        try {
            const result = await this.getGraphData(
                `
            query {
                hotelHotelBookingDetails(
                  where: {
                        status: {
                            in: "BOOKING_CONFIRMED,BOOKING_CANCELLED,BOOKING_INCOMPLETE"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        hotel_check_out: {
                            lte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
            order:{
                created_at:DESC
              }take:1000) {
                    domain_origin
                    status
                    app_reference
                    booking_source
                    booking_id
                    booking_reference
                    confirmation_reference
                    hotel_name
                    star_rating
                    hotel_code
                    hotel_address
                    hotel_photo
                    phone_number
                    alternate_number
                    email
                    hotel_check_in
                    hotel_check_out
                    payment_mode
                    promo_code
                    discount
                    currency
                    currency_conversion_rate
                    convinence_amount
                    attributes
                    created_by_id
                    created_at
                    cancellation_policy
                    cancelled_datetime
                    cancel_deadline
                    hotelHotelBookingItineraryDetails {
                        app_reference
                        location
                        check_in
                        check_out
                        room_id
                        room_type_name
                        bed_type_code
                        status
                        adult_count
                        child_count
                        smoking_preference
                        total_fare
                        admin_markup
                        agent_markup
                        currency
                        attributes
                        room_price
                        tax
                        max_occupancy
                        extra_guest_charge
                        child_charge
                        other_charges
                        discount
                        service_tax
                        agent_commission
                        cancellation_policy
                        tds
                        gst
                    }
                    hotelHotelBookingPaxDetails {
                        app_reference
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        date_of_birth
                        age
                        passenger_nationality
                        passport_number
                        passport_issuing_country
                        passport_expiry_date
                        address
                        address2
                        city
                        state
                        postal_code
                        phone_code
                        country
                        status
                        attributes
                    }
                }
            }
        `,
                "hotelHotelBookingDetails"
            );
            return result;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getFlightConfirmedCancelledBookings(body: any, currentDate: any) {
        const result = await this.getGraphData(`
            query {
                flightBookings(
                    where: {
                        booking_status: {
                            in: "BOOKING_CONFIRMED,BOOKING_CANCELLED,BOOKING_HOLD,BOOKING_INCOMPLETE"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        journey_end: {
                            lte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                    order: { 
                        created_at:DESC 
                    }
                    take:1000
                ) {
                    id
                    domain_origin
                    status
                    app_reference
                    api_code
                    booking_source
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
                        flightBookingTransactionItineraries {
                            id
                            airline_name
                            airline_pnr
                            airline_code
                            departure_datetime
                            arrival_datetime
                            from_airport_name
                            to_airport_name
                            flight_number
                        }
                    }
                }
            }
        `, 'flightBookings');
        return result;
    }
    async getToursBookings(status: any, body: any, currentDate: any) {
        const query1 = `
        SELECT
            *
        FROM
            tour_booking_details
        WHERE
            status = "${status}"
            AND departure_date >= "${currentDate}"
            AND created_by_id = "${body}"
            AND Booking_Source = 'B2C'`;
    
    const bookingItinerary = await this.manager.query(query1);
    
    const result = [];
    
    for (const itinerary of bookingItinerary) {
        const appReference = itinerary.app_reference;
        
        const query2 = `
            SELECT
                *
            FROM
                tour_booking_details
            WHERE
                status = "${status}"
                AND app_reference = "${appReference}"`;
        
        const bookingDetails = await this.manager.query(query2);
        
        const query3 = `
            SELECT
                *
            FROM
                tour_pax_details
            WHERE
                status = "${status}"
                AND app_reference = "${appReference}"`;
        
        const paxDetails = await this.manager.query(query3);
    
        result.push({
            itineraryDetails: [itinerary],
            bookingDetails: bookingDetails[0],
            paxDetails: paxDetails,
        });
        
    }
    
    return result;
}
async getTourCompleteBookings(status: any, body: any, currentDate: any) {
    const query1 = `
    SELECT
        *
    FROM
    tour_booking_details
    WHERE
        status = "${status}"
        AND departure_date < "${currentDate}"
        AND created_by_id = "${body}"
        AND Booking_Source = 'B2C'`;

const bookingItinerary = await this.manager.query(query1);

const result = [];

for (const itinerary of bookingItinerary) {
    const appReference = itinerary.app_reference;
    
    const query2 = `
        SELECT
            *
        FROM
            tour_booking_details
        WHERE
            status = "${status}"
            AND app_reference = "${appReference}"`;
    
    const bookingDetails = await this.manager.query(query2);
    
    const query3 = `
        SELECT
            *
        FROM
            tour_pax_details
        WHERE
            status = "${status}"
            AND app_reference = "${appReference}"`;
    
    const paxDetails = await this.manager.query(query3);

    result.push({
        itineraryDetails: [itinerary],
        bookingDetails: bookingDetails[0],
        paxDetails: paxDetails,
    });
    
}

return result;
}
async getTourCancellationBookings(status:any, body:any){
    const query1 = `
    SELECT
        *
    FROM
    tour_booking_details
    WHERE
        status = "${status}"
        AND created_by_id = "${body}"
        AND Booking_Source = 'B2C'`;

const bookingItinerary = await this.manager.query(query1);

const result = [];

for (const itinerary of bookingItinerary) {
    const appReference = itinerary.app_reference;
    
    const query2 = `
        SELECT
            *
        FROM
            tour_booking_details
        WHERE
            status = "${status}"
            AND app_reference = "${appReference}"`;
    
    const bookingDetails = await this.manager.query(query2);
    
    const query3 = `
        SELECT
            *
        FROM
            tours_booking_pax_details
        WHERE
            status = "${status}"
            AND app_reference = "${appReference}"`;
    
    const paxDetails = await this.manager.query(query3);

    result.push({
        itineraryDetails: [itinerary],
        bookingDetails: bookingDetails[0],
        paxDetails: paxDetails,
    });
    
}

return result;
}


async getTransferBookings(status: any, body: any, currentDate: any) {

    const bookingDetails = await this.getGraphData(
        `query {
                transferBookingDetails (
                    where: {
                        status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        travel_date: {
                            gte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    domain_origin
                    status
                    app_reference
                    booking_source
                    Api_id
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

    const query3 = `SELECT * FROM transfer_booking_itinerary_details 
    WHERE 
        status = "${status}"
        AND travel_date >= "${currentDate}"`;
    const bookingItinerary = await this.manager.query(query3);
    

    const query4 = `SELECT * FROM transfer_booking_pax_details 
    WHERE 
        status = "${status}"`;
    const paxDetails = await this.manager.query(query4);
    
    const mergedData = {};

    for (const booking of bookingDetails) {
        const appReference = booking.app_reference;
        mergedData[appReference] = { booking, itinerary: [], pax: [] };
    }
    
    for (const itinerary of bookingItinerary) {
        const appReference = itinerary.app_reference;
        if (mergedData[appReference]) {
            mergedData[appReference].itinerary.push(itinerary);
        }
    }
    
    for (const pax of paxDetails) {
        const appReference = pax.app_reference;
        if (mergedData[appReference]) {
            mergedData[appReference].pax.push(pax);
        }
    }
    
    const filteredResult = Object.values(mergedData).filter(
        (mergedItem:any) => mergedItem.itinerary.length > 0 && mergedItem.pax.length > 0
    );
    
    return filteredResult;
}

async getCompletedTransferBookings(status: any, body: any, currentDate: any) {

    const bookingDetails = await this.getGraphData(
        `query {
                transferBookingDetails (
                    where: {
                        status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        travel_date: {
                            lte: "${currentDate}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
                    domain_origin
                    status
                    app_reference
                    booking_source
                    Api_id
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

    const query3 = `SELECT * FROM transfer_booking_itinerary_details 
    WHERE 
        status = "${status}"
        AND travel_date >= "${currentDate}"`;
    const bookingItinerary = await this.manager.query(query3);
    

    const query4 = `SELECT * FROM transfer_booking_pax_details 
    WHERE 
        status = "${status}"`;
    const paxDetails = await this.manager.query(query4);
    
    const mergedData = {};

    for (const booking of bookingDetails) {
        const appReference = booking.app_reference;
        mergedData[appReference] = { booking, itinerary: [], pax: [] };
    }
    
    for (const itinerary of bookingItinerary) {
        const appReference = itinerary.app_reference;
        if (mergedData[appReference]) {
            mergedData[appReference].itinerary.push(itinerary);
        }
    }
    
    for (const pax of paxDetails) {
        const appReference = pax.app_reference;
        if (mergedData[appReference]) {
            mergedData[appReference].pax.push(pax);
        }
    }
    
    const filteredResult = Object.values(mergedData).filter(
        (mergedItem:any) => mergedItem.itinerary.length > 0 && mergedItem.pax.length > 0
    );
    
    return filteredResult;
}



async getTransferCancellationBookings(status: any, body: any) {

    const bookingDetails = await this.getGraphData(
        `query {
                transferBookingDetails (
                    where: {
                        status: {
                            eq: "${status}"
                        }
                        created_by_id: {
                            eq: "${body}"
                        }
                        booking_source: {
                            eq: "B2C"
                        }
                    }
                ) {
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

    const query3 = `SELECT * FROM transfer_booking_itinerary_details 
    WHERE 
        status = "${status}"`;
    const bookingItinerary = await this.manager.query(query3);
    

    const query4 = `SELECT * FROM transfer_booking_pax_details 
    WHERE 
        status = "${status}"`;
    const paxDetails = await this.manager.query(query4);
    
    const mergedData = {};

    for (const booking of bookingDetails) {
        const appReference = booking.app_reference;
        mergedData[appReference] = { booking, itinerary: [], pax: [] };
    }
    
    for (const itinerary of bookingItinerary) {
        const appReference = itinerary.app_reference;
        if (mergedData[appReference]) {
            mergedData[appReference].itinerary.push(itinerary);
        }
    }
    
    for (const pax of paxDetails) {
        const appReference = pax.app_reference;
        if (mergedData[appReference]) {
            mergedData[appReference].pax.push(pax);
        }
    }
    
    const filteredResult = Object.values(mergedData).filter(
        (mergedItem:any) => mergedItem.itinerary.length > 0 && mergedItem.pax.length > 0
    );
    
    return filteredResult;
}

async getHotelbedsActivityCancel(status: any, body: any) {
    const query1 = `
        SELECT
            *
        FROM
            activity_booking_details
        WHERE
            status = "${status}"
            AND created_by_id = "${body}"
            AND booking_source = 'B2C'`
    
    const bookingDetails = await this.manager.query(query1);
    const result = [];

    for (const refrence of bookingDetails) {
        const appReference = refrence.app_reference;

        const query2 = `
            SELECT
                *
            FROM
                activities_booking_pax_details
            WHERE app_reference = "${appReference}"`;

        const bookingPaxDetails = await this.manager.query(query2);
        const attribute = refrence.attributes.replace(/'/g, '"');
        let Bookattrribute = JSON.parse(attribute);
        let ItenaryData = Bookattrribute.ItenaryData;

        if (ItenaryData['attributes']['body']) {
            delete ItenaryData['attributes']['body'];
        }

        refrence.attributes = ItenaryData;
        result.push({
            actvityBookingDetails: refrence,
            actvityItenaryDetails: [ItenaryData],
            activityPaxDetails: bookingPaxDetails,
        });
    }
    return result;
}

    

}

