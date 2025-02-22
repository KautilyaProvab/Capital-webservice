import { Injectable } from '@nestjs/common';
import { table } from 'console';
import { formatDate } from '../../app.helper';
import { BaseApi } from '../../base.api';
import { BookingsDbService } from './bookings-db.service';

@Injectable()
export class BookingsService extends BaseApi {

  constructor(private bookingsDbService: BookingsDbService) {
    super();
  }
  async getBookingCounts(body: any) {
    const hotelQuery = `
                        SELECT COUNT(*) as 'count'
                        FROM hotel_hotel_booking_details 
                        WHERE status = 'BOOKING_CONFIRMED' 
                        AND booking_source = 'B2C' AND created_by_id = '${body.user.id}'`;
    const flightQuery = `
                        SELECT COUNT(*) as 'count'
                        FROM flight_bookings 
                        WHERE booking_status = 'BOOKING_CONFIRMED' 
                        AND booking_source = 'B2C' AND created_by_id = '${body.user.id}'`;
  const tourQuery = `
                      SELECT COUNT(*) as 'count'
                      FROM tour_booking_details
                      WHERE status = 'BOOKING_CONFIRMED'
                      AND Booking_Source = 'B2C' AND created_by_id = '${body.user.id}'`;

  const transferQuery = `
                      SELECT COUNT(*) as 'count'
                      FROM transfer_booking_details 
                      WHERE status = 'BOOKING_CONFIRMED' 
                      AND booking_source = 'B2C' AND created_by_id = '${body.user_id}'`;                    

  const hotelbedsActvityQuery = `
                      SELECT COUNT(*) as 'count'
                      FROM activity_booking_details 
                      WHERE status = 'BOOKING_CONFIRMED'
                      AND booking_source = 'B2C' AND created_by_id = '${body.user.id}'`;

    const hotelBookingCount = await this.manager.query(hotelQuery);
    const flightBookingCount = await this.manager.query(flightQuery);
    const tourBookingCount = await this.manager.query(tourQuery);
    const transferBookingCount = await this.manager.query(transferQuery);
    const hotelbedsActivityBookingCount = await this.manager.query(hotelbedsActvityQuery);
    
    return {
      hotelBookingCount,
      flightBookingCount,
      tourBookingCount,
      transferBookingCount,
      hotelbedsActivityBookingCount
    }
  }

  async getUpcomingBookings(body: any) {
    let today = new Date();
    let currentDate = formatDate(today);
    // const hotelQuery = `
    //                     SELECT *
    //                     FROM hotel_hotel_booking_details 
    //                     WHERE status = 'BOOKING_CONFIRMED' 
    //                     AND created_by_id = '${body.user.id}'
    //                     AND hotel_check_in >= '${currentDate}'`;
    /* const flightQuery = `
                             SELECT fb.*,fbt.total_fare,fbt.pnr,fbti.airline_pnr,fbti.from_airport_name,fbti.to_airport_name
                             FROM flight_bookings fb 
                             left join zb_new.flight_booking_transactions fbt on fbt.app_reference=fb.app_reference 
                             left join zb_new.flight_booking_transaction_itineraries fbti on fbti.app_reference=fb.app_reference
                             WHERE fb.booking_status = 'BOOKING_CONFIRMED' 
                             AND fb.created_by_id = '${body.user.id}'
                             AND fb.journey_start >= '${currentDate}'`;*/
    const hotelBooking = await this.bookingsDbService.getHotelBookings('BOOKING_CONFIRMED', body.user.id, currentDate);// await this.manager.query(hotelQuery);
    const flightBooking = await this.bookingsDbService.getFlightBookings('BOOKING_CONFIRMED,BOOKING_HOLD', body.user.id, currentDate);
    const tourBooking = await this.bookingsDbService.getToursBookings('BOOKING_CONFIRMED', body.user.id, currentDate);
    const transferBooking = await this.bookingsDbService.getTransferBookings('BOOKING_CONFIRMED', body.user.id, currentDate);
    const hotelbedsActivityBooking = await this.bookingsDbService.getHotelbedsActivityBooking('BOOKING_CONFIRMED', body.user.id, currentDate)
    //const flightBooking = await this.manager.query(flightQuery);
    return {
      hotelBooking,
      flightBooking,
      tourBooking,
      transferBooking,
      hotelbedsActivityBooking
    }
  }

  async getCompletedCancelledBookings(body: any) {
    let today = new Date();
    let currentDate = formatDate(today);
    // const hotelCompletedQuery = `
    //                     SELECT *
    //                     FROM hotel_hotel_booking_details 
    //                     WHERE status = 'BOOKING_CONFIRMED' 
    //                     AND created_by_id = '${body.user.id}'
    //                     AND hotel_check_out <= '${currentDate}'`;
    /*const flightCompletedQuery = `
                            SELECT fb.*,fbt.total_fare,fbt.pnr,fbti.airline_pnr,fbti.from_airport_code,fbti.from_airport_name,fbti.to_airport_name
                            FROM flight_bookings fb 
                            left join zb_new.flight_booking_transactions fbt on fbt.app_reference=fb.app_reference 
                            left join zb_new.flight_booking_transaction_itineraries fbti on fbti.app_reference=fb.app_reference
                            WHERE fb.booking_status = 'BOOKING_CONFIRMED' 
                            AND fb.created_by_id = '${body.user.id}'
                            AND fb.journey_end <= '${currentDate}'`; */
    // const hotelCancelledQuery = `
    //                     SELECT *
    //                     FROM hotel_hotel_booking_details 
    //                     WHERE status = 'BOOKING_CANCELLED' 
    //                     AND created_by_id = '${body.user.id}'`;
    /* const flightCancelledQuery = `
                             SELECT fb.*,fbt.total_fare,fbt.pnr,fbti.airline_pnr,fbti.from_airport_name,fbti.to_airport_name
                             FROM flight_bookings fb 
                             left join zb_new.flight_booking_transactions fbt on fbt.app_reference=fb.app_reference 
                             left join zb_new.flight_booking_transaction_itineraries fbti on fbti.app_reference=fb.app_reference
                             WHERE fb.booking_status = 'BOOKING_CANCELLED' 
                             AND fb.created_by_id = '${body.user.id}'`; */
    const hotelCompleted = await this.bookingsDbService.getHotelBookingDetails('BOOKING_CONFIRMED', body.user.id, currentDate);
    const flightCompleted = await this.bookingsDbService.getFlightBookingDetails('BOOKING_CONFIRMED', body.user.id, currentDate);
    /*----*/
    const hotelCancelled = await this.bookingsDbService.getHotelBookingCancelledDetails('BOOKING_CANCELLED', body.user.id);
    //const flightCancelled = await this.manager.query(flightCancelledQuery);
    const flightCancelled = await this.bookingsDbService.getFlightBookingCancelledDetails('BOOKING_CANCELLED', body.user.id);
    const activityBooking = await this.bookingsDbService.getTourCompleteBookings('BOOKING_CONFIRMED', body.user.id, currentDate);
    const activityCancelled = await this.bookingsDbService.getTourCancellationBookings('BOOKING_CANCELLED', body.user.id);
    const transferBooking = await this.bookingsDbService.getCompletedTransferBookings('BOOKING_CONFIRMED', body.user.id, currentDate);
    const transferCancelled = await this.bookingsDbService.getTransferCancellationBookings('BOOKING_CANCELLED', body.user.id);
    const  hotelbedsActivityBooking = await this.bookingsDbService.getHotelbedsActivityBooking('BOOKING_CONFIRMED', body.user.id , currentDate);
    const hotelbedsActivityCancel = await this.bookingsDbService.getHotelbedsActivityCancel('BOOKING_CANCELLED', body.user.id);

    return {
      hotelCompleted,
      flightCompleted,
      hotelCancelled,
      flightCancelled,
      activityBooking,
      activityCancelled,
      transferBooking,
      transferCancelled,
      hotelbedsActivityBooking,
      hotelbedsActivityCancel
    }
  }

  async getHotelBookingDetails(body: any) {
    let today = new Date();
    let currentDate = formatDate(today);
    const hotel = await this.bookingsDbService.getHotelConfirmedCancelledBookings(body.user.id, currentDate);

    return hotel
  }

  async getFlightBookingDetails(body: any) {
    let today = new Date();
    let currentDate = formatDate(today);
    const flight = await this.bookingsDbService.getFlightConfirmedCancelledBookings(body.user.id, currentDate);

    return flight
  }

  async searchByBookingId(req: any, body: any) {
    let today = new Date();
    let currentDate = formatDate(today);
    const app_reference = body.app_reference;
    let tableName = ""
    if (app_reference.startsWith('H') || app_reference.startsWith("TLNH")) {
      tableName = 'hotelBookings'
    }
    if (app_reference.startsWith('F') || app_reference.startsWith("TLNF")) {
      tableName = 'flightBookings'
    }
    if (app_reference.startsWith('C') || app_reference.startsWith("TLNC")) {
      tableName = 'carBookings'
    }
    if (tableName === 'flightBookings') {
      let result = await this.getGraphData(`{flightBookings(where:{
            app_reference:{eq:"${app_reference}"}
            status:{eq:1}
            created_by_id:{eq:"${req.user.id}"}
            booking_source:{
                eq : "b2c"
              }
          }){
            id
            created_at
            domain_origin
            app_reference
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
            status
            created_datetime
            booking_status
            flightBookingTransactions{
              flightBookingTransactionItineraries{
                id
                created_at
                flight_booking_transaction_id
                app_reference
                airline_pnr
                segment_indicator
                airline_code
                airline_name
                flight_number
                fare_class
                from_airport_code
                from_airport_name
                to_airport_code
                to_airport_name
                departure_datetime
                arrival_datetime
                cabin_baggage
                checkin_baggage
                is_refundable
                operating_carrier 
              }
              flightBookingTransactionPassengers{
                id
                created_at
                created_by_id
                status
                app_reference
                flight_booking_transaction_id
                passenger_type
                is_lead
                title
                first_name
                middle_name
                last_name
                date_of_birth
                gender
                passenger_nationality
                passport_number
                passport_issuing_country
                passport_expiry_date
                attributes
                booking_status
              }
            }
          }
        }`, `flightBookings`)
      result = result[0];
      result.moduleName = "Flight"
      if (result.journey_start) {
        if (result.journey_start >= currentDate) {
          result.booking_type = "UpComing"
        }
        if (result.journey_start <= currentDate) {
          result.booking_type = "Completed"
        }
        if (result.booking_status == "BOOKING_CANCELLED") {
          result.booking_type = "Cancelled"
        }
      }
      return result
    }
    if (tableName === "carBookings") {
      let result = await this.getGraphData(`{
                carBookings(where:{
                  app_reference :{
                    eq:"${app_reference}"
                  }
                  booking_source:{
                    eq : "b2c"
                  }
                  created_by_id:{
                    eq:${req.user.id}
                  }
                }){
                    domain_origin
                    booking_status
                    app_reference
                    booking_source
                    api_supplier_name
                    total_fare
                    domain_markup
                    domain_gst
                    level_one_markup
                    currency
                    currency_conversion_rate
                    car_name
                    car_supplier_name
                    supplier_identifier
                    car_model
                    phone_number
                    alternate_number
                    email
                    car_from_date
                    pickup_time
                    drop_time
                    car_to_date
                    car_pickup_lcation
                    car_drop_location
                    car_pickup_address
                    car_drop_address
                    value_type
                    transfer_type
                    final_cancel_date
                    payment_mode
                    version
                    attributes
                    pay_on_pickup
                    account_info
                    FuelType
                    FuelInformation
                    FuelInformationDescription
                    TripType
                    PickUpOpeningHours
                    DropOpeningHours
                    driverDetails
                    AdditionalDriverDetail
                    FlightInfo
                    TotalCharge
                    booked_date
                }
              }`, `carBookings`)
      result = result[0]

      result.moduleName = "Car";
      if (result.car_from_date) {
        if (result.car_from_date >= currentDate) {
          result.booking_type = "UpComing"
        }
        if (result.car_from_date <= currentDate) {
          result.booking_type = "Completed"
        }
        if (result.booking_status == "BOOKING_CANCELLED") {
          result.booking_type = "Cancelled"
        }
      }
      return result;
    }
    if (tableName === "hotelBookings") {
      let result = await this.getGraphData(`{
                hotelHotelBookingDetails(where:{
                  app_reference :{
                    eq:"${app_reference}"
                  }
                  booking_source:{
                    eq : "b2c"
                  }
                  created_by_id:{
                    eq:${req.user.id}
                  }
                }){
                  id
                  created_at
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
                  attributes
                  created_by_id
                  created_datetime
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
      `, `hotelHotelBookingDetails`)
      result = result[0]
      result.moduleName = "Hotel";
      if (result.car_from_date) {
        if (result.hotel_check_in >= currentDate) {
          result.booking_type = "UpComing"
        }
        if (result.hotel_check_in <= currentDate) {
          result.booking_type = "Completed"
        }
        if (result.booking_status == "BOOKING_CANCELLED") {
          result.booking_type = "Cancelled"
        }
      }
      return result;
    }
  }
}
