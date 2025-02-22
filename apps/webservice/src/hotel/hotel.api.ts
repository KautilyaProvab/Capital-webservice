import * as moment from "moment";
import { formatDate } from "../app.helper";
import { BaseApi } from "../base.api";
import { RedisServerService } from "../shared/redis-server.service";
import {
  HUMMING_BIRD_BOOKING_SOURCE,
  CRS_HOTEL_BOOKING_SOURCE,
  STUBA_HOTEL_BOOKING_SOURCE,
} from "../constants";
import { AddPaxDetailsHotelCRS } from "./hotel/hotel-types/hotel.types";
import { BlockRoom } from "./hotel/third-party-services/hote-crs.types";
export abstract class HotelApi extends BaseApi {
  constructor() {
    super();
  }

  getCityUniversal(body: any): any {
    return {
      cityId: body.bdc_city_code
        ? body.bdc_city_code
        : body.destination_id
        ? body.destination_id
        : body.city_id,
      cityName: body.city_name
        ? body.city_name
        : body.destination_name
        ? body.destination_name
        : body.city,
      countryCode: body.hotel_master_country_id
        ? body.hotel_master_country_id
        : body.country_code,
      countryName: body.hotelMasterCountry
        ? body.hotelMasterCountry["name"]
        : body.country_name,
      status: body.status ? body.status : "",
      Source: body.source,
      searchId:body.searchId ? body.searchId : "",
      booking_source: body.booking_source ? body.booking_source : "",
    };
  }

  getCountriesUniversal(body: any) {
    return {
      Id: body.id,
      CountryName: body.name,
      CountryCode: body.code,
      FlagUrl: body.flag_url,
      PhoneCode: body.phone_code,
      Status: body.status,
    };
  }

  getHotelSearchRequestUniversal(body: any, guestRooms): any {
    body = {
      checkin: body.CheckIn,
      checkout: body.CheckOut,
      guest_country: body.GuestCountry,
      city_ids: body.CityIds,
    };
    let bodyData = Object.assign({}, body, guestRooms);
    return bodyData;
  }

  getSearchUniversal(body: any): any {
    return {
      ResultIndex: "",
      HotelCode: body.hotel_id,
      HotelName: body.hotel_name,
      HotelCategory: "",
      StarRating: body.stars ? body.stars : 0,
      HotelDescription: "",
      HotelPromotion: "",
      HotelPolicy: "",
      Price: body.price,
      HotelPicture: body.photo,
      HotelAddress: body.address,
      HotelContactNo: "",
      HotelMap: null,
      Latitude: body.location ? body.location["latitude"] : "",
      Longitude: body.location ? body.location["longitude"] : "",
      Breakfast: body.breakfast,
      HotelLocation: null,
      SupplierPrice: null,
      RoomDetails: body.rooms,
      OrginalHotelCode: body.hotel_id,
      HotelPromotionContent: "",
      PhoneNumber: "",
      HotelAmenities: body.hotel_amenities,
      Free_cancel_date: "",
      trip_adv_url: "",
      trip_rating: "",
      NoOfRoomsAvailableAtThisPrice: body.rooms[0]
        ? body.rooms[0]["num_rooms_available_at_this_price"]
        : null,
      Refundable: body.rooms[0] ? body.rooms[0]["refundable"] : null,
      HotelCurrencyCode: body.hotel_currency_code,
      NoOfReviews: body.review_nr ? body.review_nr : "",
      ReviewScore: body.review_score ? body.review_score : "",
      ReviewScoreWord: body.review_score_word ? body.review_score_word : "",
      Source: body.source,
      DealTagging: body.deal_tagging,
      ResultToken: "",
    };
  }

  getFiveStarHotelsUniversal(body: any) {
    return {
      HotelId: body.hotel_id,
      HotelName: body.hotel_name,
      Address: body.address,
      Stars: body.stars,
      CheckinTime: body.checkin_time,
      HotelCurrencyCode: body.hotel_currency_code,
      Country: body.country,
      PostCode: body.postcode,
      Photo: body.photo,
      Price: body.price,
      DefaultLanguage: body.default_language,
      Source: body.source,
    };
  }

  getHotelDealsUniversal(body: any) {
    return {
      HotelName: body.hotel_name,
      Stars: body.star,
      HotelCurrencyCode: body.hotel_currency_code,
      Country: body.country,
      PostCode: body.postcode,
      Photo: body.photo,
      Address: body.address,
      HotelId: body.hotel_id,
      Price: body.price,
      DefaultLanguage: body.default_language,
      Source: body.source,
    };
  }

  getHotelDetailsRequestUniversal(body: any) {
    return {
      hotel_ids: body.HotelIds,
    };
  }

  getFacilityBiIdUniversal(body: any) {
    return {
      parent: body.hotelMasterFacilityType["name"],
      icon: body.hotelMasterFacilityType["icon"],
      child: body.name,
    };
  }

  getHotelDetailsUniversal(body: any): any {
    return {
      HotelDetails: {
        HotelCode: body.hotel_id,
        HotelName: body.hotel_data["name"],
        StarRating: body.hotel_data["exact_class"],
        HotelURL: body.hotel_data["url"],
        Description: body.hotel_data["hotel_description"],
        Attractions: [],
        HotelFacilities: body.hotel_facilities,
        HotelPolicy: body.hotel_policies,
        SpecialInstructions: body.hotel_data["hotel_important_information"],
        HotelPicture: body.main_photo,
        Images: body.hotel_photos,
        Address: body.hotel_data["address"],
        CountryName: body.country ? body.country : "",
        City: body.city_name ? body.city_name : "",
        PinCode: body.hotel_data["zip"],
        HotelContactNo: "",
        FaxNumber: "",
        Email: null,
        // FullAddress: body.hotel_data["address"] + "," + body.hotel_data["zip"] + " " + body.city + "," + body.country,
        Latitude: body.hotel_data["location"]["latitude"],
        Longitude: body.hotel_data["location"]["longitude"],
        CheckinCheckoutTimes: body.hotel_data["checkin_checkout_times"],
        Source: body.source,
      },
    };
  }

  getHotelRoomsRequestUniversal(body, guestRooms) {
    body = {
      checkin: body.CheckIn,
      checkout: body.CheckOut,
      guest_cc: body.GuestCountry,
      hotel_ids: body.HotelIds,
    };
    let bodyData = Object.assign({}, body, guestRooms);
    return bodyData;
  }

  getRoomUniversal(body: any): any {
    return {
      HotelCode: body.hotel_id,
      Checkout: body.checkout,
      CanPayNow: body.can_pay_now,
      Checkin: body.checkin,
      MaxRoomsInReservation: body.max_rooms_in_reservation,
      GroupRecommendations: body.group_recommendations
        ? body.group_recommendations
        : null,
      RoomData: body.room_data,
    };
  }

  getBlockRoomsRequestUniversal(body, guestRooms) {
    body = {
      checkin: body.CheckIn,
      checkout: body.CheckOut,
      guest_cc: body.GuestCountry,
      hotel_ids: body.HotelIds,
      BlockRoomDetails: body.BlockRoomDetails,
    };
    let bodyData = Object.assign({}, body, guestRooms);
    return bodyData;
  }

  getBlockAvailabilityUniversal(body: any): any {
    return {
      HotelData: body.hotel_data,
      RoomData: body.room_data,
    };
  }

  getHotelRoomDetailsUniversal(body: any, reqData) {
    let RoomData = [];
    body["RoomData"].forEach((room) => {
      let rooms = {};
      rooms = {
        roomId: room.RoomId,
        roomName: room.RoomName,
        checkin: reqData["checkin"],
        checkout: reqData["checkout"],
        currency: room.IncreamentalPrice["currency"],
        price: room.IncreamentalPrice["price"],
        tax: room.Tax,
        discount: room.DealTagging
          ? room.DealTagging["discount_percentage"]
          : 0,
        blockId: room.BlockId,
        maxOccupancy: room.BlockQuantity,
        maxChildFree: room.MaxChildFree,
        maxChildFreeAge: room.MaxChildFreeAge,
        cancellationInfo: room.CancellationInfo,
      };
      RoomData.push(rooms);
    });
    return {
      HotelData: {
        hotelName: body["HotelData"].HotelName,
        hotelId: body["HotelData"].HotelCode,
        starRating: body["HotelData"].StarRating,
        address: body["HotelData"].Address,
        countryCode: body["HotelData"].CountryName,
        pincode: body["HotelData"].PinCode,
        hotelContactNo: body["HotelData"].HotelContactNo,
        email: body["HotelData"].Email,
        latitude: body["HotelData"].Latitude,
        longitude: body["HotelData"].Longitude,
        checkin: reqData["checkin"],
        checkout: reqData["checkout"],
        hotelPhoto: body["HotelData"].HotelPicture,
      },
      RoomData,
    };
  }

  formatPaxDetailsUniversal(body: any, extras: any) {
    let paxDetails = [];

    body[0].forEach((data) => {
      let attribute = {};

      data.travellers.forEach((pax)=>{
      let paxes = {
        app_reference: extras.AppReference,
        title: pax.Title ? pax.Title : "",
        first_name: pax.FirstName ? pax.FirstName : "",
        last_name: pax.LastName ? pax.LastName : "",
        date_of_birth: pax.Dob ? pax.Dob : null,
        age: pax.Age ? pax.Age : null,
        pax_type: pax.PaxType == 0 ? "Child" : "Adult",
        address: pax.Address ? pax.Address : "",
        address2: pax.RoomId ? pax.RoomId.toString() : "",
        city: pax.City ? pax.City : "",
        state: pax.State ? pax.State : "",
        postal_code: pax.PostalCode ? pax.PostalCode : "",
        email: pax.Email ? pax.Email : "",
        phone_code: pax.PhoneCode ? pax.PhoneCode : "",
        phone: pax.MobileNo ? pax.MobileNo : null,
        country: pax.Country ? pax.Country : "",
        status: "BOOKING_HOLD",
        created_by_id: extras.UserId ? extras.UserId : null,
        attributes:
          Object.keys(attribute).length > 0
            ? `${JSON.stringify(attribute).replace(/"/g, "'")}`
            : `${data['RoomId']}`,
      };
      paxDetails.push(paxes);
    });
  });

    return paxDetails;
  }

  formatPaxDetailsUniversalCRS(
    body: AddPaxDetailsHotelCRS,
    hotelData: BlockRoom
  ) {
    let paxDetails = [];
    body.RoomDetails.forEach((room) => {
      room.PassengerDetails.forEach((pax) => {
        let paxes = {
          app_reference: body.AppReference,
          title: pax?.Title || "",
          first_name: pax?.FirstName || "",
          last_name: pax?.LastName || "",
          date_of_birth: pax.Dob ? pax.Dob : null,
          age: pax.Age ? pax.Age : null,
          pax_type: +pax.PaxType == 0 ? "Child" : "Adult",
          address: room.AddressDetails.Address,
          RoomId: pax.RoomId,
          city: room.AddressDetails.City,
          state: room.AddressDetails.State,
          postal_code: room.AddressDetails.PostalCode,
          email: room.AddressDetails.Email,
          phone_code: room.AddressDetails.PhoneCode,
          phone: room.AddressDetails.Contact,
          country: room.AddressDetails.Country,
          status: "BOOKING_HOLD",
          created_by_id: body.UserId,
          attributes: JSON.stringify(pax).replace(/"/g, "'"),
          supplier_id: hotelData.CreatedById,
        };
        paxDetails.push(paxes);
      });
    });
    return paxDetails;
  }

  formatBookingItineraryDetailsUniversal(body) {
    let itineararyDetails = [];
    const hotelData = body["HotelData"];

    body["RoomData"].forEach((itinerary) => {
      let itineraries = {
        app_reference: body.appRef,
        location: hotelData.latitude + "," + hotelData.longitude,
        room_type_name: itinerary.roomName,
        bed_type_code: itinerary.mealPlanCode,
        room_id: itinerary.blockId,
        room_count: itinerary.room_count
          ? itinerary.room_count
          : 1,
        check_in: hotelData.checkin,
        check_out: hotelData.checkout,
        status: "BOOKING_HOLD",
        cancellation_policy: JSON.stringify(itinerary.cancellationInfo).replace(
          /"/g,
          "'"
        ),
        total_fare: parseFloat(itinerary.price)
          ? parseFloat(itinerary.price)
          : null,
        currency: itinerary.currency ? itinerary.currency : "",
        room_price: parseFloat(itinerary.price)
          ? parseFloat(itinerary.price)
          : null,
        tax: itinerary.tax ? itinerary.tax : "",
        discount: itinerary.discount ? itinerary.discount : null,
        max_occupancy: itinerary.maxOccupancy ? itinerary.maxOccupancy : null,
        adult_count: itinerary.AdultCount ? itinerary.AdultCount : null,
        child_count: itinerary.ChildrenCount ? itinerary.ChildrenCount : 0,
        created_by_id: body.userId ? body.userId : 0,
        agent_markup: body.agent_markup ? body.agent_markup : null,
        attributes: itinerary.paxCount,
      };
      itineararyDetails.push(itineraries);
    });
    return itineararyDetails;
  }

  formatBookingItineraryDetailsUniversalCRS(
    body: AddPaxDetailsHotelCRS,
    hotelData: BlockRoom
  ) {
    let itineararyDetails = [];
    // const hotelData = body["HotelData"];

    hotelData.RoomDetails.forEach((itinerary) => {
      const attributes = Buffer.from(JSON.stringify(itinerary)).toString(
        "base64"
      );
      let itineraries = {
        app_reference: body.AppReference,
        location: hotelData.Latitude + "," + hotelData.Longitude,
        room_type_name: itinerary.RoomType,
        bed_type_code: itinerary.Description,
        meal_plan_code: itinerary.MealPlanCode,
        room_name: itinerary.RoomName,
        room_id: itinerary.Id,
        check_in: hotelData.CheckIn,
        check_out: hotelData.CheckOut,
        status: "BOOKING_HOLD",
        cancellation_policy: JSON.stringify(
          itinerary.cancellationPolicies
        ).replace(/"/g, "'"),
        total_fare: parseFloat(itinerary.Price.Amount) || 0,
        currency: itinerary?.Price?.Currency || "",
        room_price: parseFloat(itinerary.Price.Amount) || 0,
        tax: "",
        discount: itinerary.Price.EligibleDiscount || 0,
        max_occupancy: itinerary.Occupancy || 0,
        adult_count: itinerary.AdultCount || 0,
        child_count: itinerary.ChildrenCount || 0,
        created_by_id: body.UserId || 0,
        attributes: attributes,
        supplier_id: hotelData.CreatedById,
      };
      itineararyDetails.push(itineraries);
    });
    return itineararyDetails;
  }

  getNearByHotelUniversal(body) {
    return {
      HotelCode: body.hotelData["hotel_id"],
      HotelName: body.hotelData["hotel_name"],
      HotelDescription: body.hotelData["hotel_description"],
      StarRating: body.hotelData["stars"],
      Price: body.hotelData["price"],
      HotelPicture: body.hotelData["photo"],
      HotelAddress: body.hotelData["address"],
      HotelCurrencyCode: body.hotelData["hotel_currency_code"],
      Source: body.source,
    };
  }

  getHotelBookingPaxDetailsUniversal(
    body,
    bookingPaxDetails: any,
    bookingDetails,
    bookingItineraryDetails
  ) {

    let paxDetails = [];
    let itineraryDetails = [];
    bookingPaxDetails.forEach((paxEle) => {
     
      
      let pax = {
        Id: paxEle.id,
        AppReference: paxEle.app_reference,
        Title: paxEle.title,
        FirstName: paxEle.first_name,
        MiddleName: paxEle.middle_name,
        LastName: paxEle.last_name,
        Phone: paxEle.phone,
        Email: paxEle.email,
        PaxType: paxEle.pax_type,
        DateOfBirth: paxEle.date_of_birth,
        Address: paxEle.address,
        Address2: paxEle.address2,
        City: paxEle.city,
        State: paxEle.state,
        Country: paxEle.country,
        PostalCode: paxEle.postal_code,
        PhoneCode: paxEle.phone_code,
        Status: paxEle.status,
        Attributes: paxEle.attributes,
      };
      paxDetails.push(pax);
    });

    let formattedJson: any = {};
    let totalFare: any;
    if (bookingDetails.Api_id === CRS_HOTEL_BOOKING_SOURCE) {
      //base 64 decode then parse the json
      const buff = Buffer.from(bookingDetails.attributes, "base64");
      const text = buff.toString("utf-8");
      formattedJson = JSON.parse(text)
      if (formattedJson.hotelBody && formattedJson.hotelBody.RoomDetails && formattedJson.hotelBody.RoomDetails[0].Price) {
        formattedJson.hotelBody.RoomDetails[0].Price.Amount = Number(formattedJson.hotelBody.RoomDetails[0].Price.Amount) + Number(bookingDetails.convinence_amount);
        totalFare = formattedJson.hotelBody.RoomDetails[0].Price;
      }
    } else {
      formattedJson = bookingDetails.attributes.replace(/'/g, '"');
      formattedJson = JSON.parse(formattedJson);
      console.log("formattedJson:", formattedJson.RoomDetails);
      // formattedJson.RoomDetails[0].Price.Amount += Number(bookingDetails.convinence_value)
      formattedJson.RoomDetails[0].price += Number(bookingDetails.convinence_value)
      
      totalFare = formattedJson.RoomDetails[0].price;
    }
    
    console.log('formattedJson: ', formattedJson);

    bookingItineraryDetails.forEach((itineraryEle) => {
      let policy;
      if (
        itineraryEle.cancellation_policy &&
        itineraryEle.cancellation_policy != ""
      ) {
        policy = itineraryEle.cancellation_policy.replace(/'/g, '"');
        policy = JSON.parse(policy);
      } else {
        policy = [];
      }
      let itinerary = {
        Id: itineraryEle.id,
        AppReference: itineraryEle.app_reference,
        Location: itineraryEle.location,
        CheckIn: itineraryEle.checkin,
        CheckOut: itineraryEle.checkout,
        RoomId: itineraryEle.room_id,
        RoomCount: itineraryEle.room_count,
        RoomTypeName: itineraryEle.room_type_name,
        Status: itineraryEle.status,
        MaxChildFree: itineraryEle.adult_count,
        MaxChildFreeAge: itineraryEle.child_count,
        SmokingPreference: itineraryEle.smoking_preference,
        // TotalFare: itineraryEle.total_fare ,
        TotalFare: totalFare,
        AdminMarkup: itineraryEle.admin_markup,
        AgentMarkup: itineraryEle.agent_markup,
        Currency: itineraryEle.currency,
        Attributes: itineraryEle.attributes,
        RoomPrice: itineraryEle.room_price,
        Tax: itineraryEle.tax,
        BlockQuantity: itineraryEle.max_occupancy,
        ExtraGuestCharge: itineraryEle.extra_guest_charge,
        ChildCharge: itineraryEle.child_charge,
        OtherCharges: itineraryEle.other_charges,
        Discount: itineraryEle.discount,
        ServiceTax: itineraryEle.service_tax,
        AgentCommission: itineraryEle.agent_commission,
        CancellationPolicy: policy,
        TDS: itineraryEle.tds,
        GST: itineraryEle.gst,
        Description: itineraryEle.bed_type_code? itineraryEle.bed_type_code: '',
        MealPlanCode: itineraryEle.meal_plan_code ? itineraryEle.meal_plan_code: '',
        RoomName: itineraryEle.room_name ? itineraryEle.room_name: ''
      };
      itineraryDetails.push(itinerary);
    });
    let checkin = "";
    let checkout = "";
    // if(bookingDetails.booking_source === CRS_HOTEL_BOOKING_SOURCE){
    //     checkin = moment(bookingDetails.hotel_check_in).format('YYYY-MM-DD');
    //     checkout = moment(bookingDetails.hotel_check_out).format('YYYY-MM-DD');
    // }
    // else{

    let dateCheckin = new Date(
      Number(bookingDetails.hotel_check_in)
    ).toDateString();
    let dateCheckout = new Date(
      Number(bookingDetails.hotel_check_out)
    ).toDateString();
    checkin = formatDate(dateCheckin);
    checkout = formatDate(dateCheckout);
    // }
    // let bookedDate = bookingDetails.created_datetime;
    // let createdDatetime = moment(bookedDate).format('YYYY-MM-DD HH:mm:ss');
    let dateCancelled = bookingDetails.cancelled_datetime;
    let cancelledDatetime = moment(+dateCancelled).format(
      "DD-MM-YYYY HH:mm:ss"
    );
    let CancelDeadline = moment(+bookingDetails.cancel_deadline).format(
      "DD-MM-YYYY HH:mm:ss"
    );
    // console.log("BookingDetails-", bookingDetails.attributes);
    // let formattedJson = JSON.parse(bookingDetails.attributes.replace(/'/g, '"'));
    // let formattedJson = JSON.parse(bookingDetails.attributes.replace(/'/g, '"'));

    if (bookingDetails && bookingDetails.attributes !== undefined) {
      try {
        if (bookingDetails.Api_id === CRS_HOTEL_BOOKING_SOURCE) {
          //base 64 decode then parse the json
          const buff = Buffer.from(bookingDetails.attributes, "base64");
          const text = buff.toString("utf-8");
          formattedJson = JSON.parse(text);
        } else {
          // formattedJson = JSON.parse(
          //   bookingDetails.attributes.replace(/'/g, '"')
          // );
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    } else {
      console.log("bookingDetails or bookingDetails.attributes is undefined");
    }

    let cancellation_policy;

    if (
      bookingDetails.cancellation_policy &&
      Array.isArray(bookingDetails.cancellation_policy)
    ) {
      cancellation_policy = JSON.parse(
        bookingDetails.cancellation_policy.replace(/'/g, '"')
      );
    } else {
      cancellation_policy = bookingDetails.cancellation_policy;
    }
    if (bookingDetails.Api_id === CRS_HOTEL_BOOKING_SOURCE) {
      console.log('CRS_HOTEL_BOOKING_SOURCE:', CRS_HOTEL_BOOKING_SOURCE);
      // convert base64 to utf-8
      const buff = Buffer.from(bookingDetails.cancellation_policy, "base64");
      cancellation_policy = buff
        .toString("utf-8")
        .split("\t\t\t");
      console.log('cancellation_policy', cancellation_policy);

      //   .map((item) => JSON.parse(JSON.parse(item.replace(/'/g, '"'))["$t"]));
      // cancellation_policy = this.formatCancellationPolicy(
      //   cancellation_policy,
      //   checkin
      // ).join("\n");
      // cancellation_policy
      cancellation_policy = Array.isArray(cancellation_policy) ? JSON.parse(cancellation_policy[0]) : JSON.parse(cancellation_policy);
    }
    if (bookingDetails.confirmation_reference) {
      bookingDetails.booking_id = bookingDetails.confirmation_reference;
    }

        if (bookingDetails.confirmation_reference) {
            bookingDetails.booking_id = bookingDetails.confirmation_reference;
        }       
        if(body.Booking_code == HUMMING_BIRD_BOOKING_SOURCE){
            bookingDetails.cancellation_policy = JSON.parse(bookingDetails.cancellation_policy.replace(/'/g, '"'))
        }

  return {
      BookingPaxDetails: paxDetails,
      BookingDetails: {
        Id: bookingDetails.id,
        booking_source: body.booking_source ? body.booking_source : "",
        DomainOrigin: bookingDetails.domain_origin,
        Status: bookingDetails.status,
        AppReference: bookingDetails.app_reference,
        ConfirmationReference: bookingDetails.booking_id ? bookingDetails.booking_id : "",
        HotelName: bookingDetails.hotel_name,
        StarRating: bookingDetails.star_rating,
        HotelCode: bookingDetails.hotel_code,
        HotelPhoto: bookingDetails.hotel_photo,
        HotelAddress: bookingDetails.hotel_address,
        PhoneNumber: bookingDetails.phone_number,
        AlternateNumber: bookingDetails.alternate_number,
        Email: bookingDetails.email,
        HotelCheckIn:
          checkin === "NaN-NaN-NaN" ? bookingDetails.hotel_check_in : checkin,
        HotelCheckOut:
          checkout === "NaN-NaN-NaN"
            ? bookingDetails.hotel_check_out
            : checkout,
        PaymentMode: bookingDetails.payment_mode,
        PaymentStatus: bookingDetails.payment_status,
        Refundable: bookingDetails.refundable,
        ConvinenceValue: bookingDetails.convinence_value,
        ConvinenceValueType: bookingDetails.convinence_value_type,
        ConvinencePerPax: bookingDetails.convinence_per_pax,
        ConvinenceAmount: bookingDetails.convinence_amount,
        PromoCode: bookingDetails.promo_code,
        Discount: bookingDetails.discount,
        Currency: bookingDetails.currency,
        CurrencyConversionRate: bookingDetails.currency_conversion_rate,
        CancellationReason: formattedJson,
        CreatedById: bookingDetails.created_by_id,
        CreatedDatetime: bookingDetails.created_datetime,
        CancelledDatetime: cancelledDatetime,
        CancelDeadline:CancelDeadline,
        CancellationPolicy: cancellation_policy,
        Remarks: bookingDetails.booking_reference,
        NoOfRooms: itineraryDetails.length,
        TotalAmount: bookingDetails.TotalAmount,
        Supplements: [],
        // TotalFare: formattedJson.totalPrice
        // TotalFare: totalFare,
        TotalFare: bookingItineraryDetails.reduce((sum, itinerary) => sum + (itinerary.total_fare || 0), 0)
      },
      BookingItineraryDetails: itineraryDetails,
    };
  }

  formatCancellationPolicy(
    cancellationPolicy: any[],
    checkInDate: string
  ): string[] {
    const flattenArray = (arr) => {
      return arr.reduce((acc, val) => acc.concat(val), []);
    };
    // Ensure we're working with an array
    const policies = flattenArray(cancellationPolicy);

    // Sort policies based on date_from in descending order
    policies.sort((a, b) => parseInt(b.date_from) - parseInt(a.date_from));

    const sentences: string[] = [];
    let lastDateFrom = Infinity;
    const get_current_date = (date_from, check_in) => {
      return moment(check_in)
        .subtract(date_from, "days")
        .format("YYYY-MM-DD");
    };
    // Add free cancellation period if applicable
    // if (policies[0].cancellation_type === "Free") {
    sentences.push(
      `Before ${get_current_date(policies[0].date_from, checkInDate)} Free`
    );
    // }

    // Process each policy
    policies.forEach((policy, index) => {
      // const dateFrom = parseInt(policy.date_from);
      // const nextDateFrom =
      //   index < policies.length - 1
      //     ? parseInt(policies[index + 1].date_from)
      //     : 0;

      // if (policy.cancellation_type !== "Free") {
      sentences.push(
        `After ${get_current_date(policy.date_from, checkInDate)} charge ${
          policy.charge
        } ${policy.currency}`
      );
      // }

      // // Fill gaps between policies
      // if (nextDateFrom < dateFrom - 1) {
      //   sentences.push(
      //     `${checkInDate}-${nextDateFrom + 1} to ${checkInDate}-${dateFrom -
      //       1} Free`
      //   );
      // }

      // lastDateFrom = dateFrom;
    });

    return sentences;
  }
  submitBookUniversal(body: any): any {
    return {};
  }

  countryListUniversal(body: any): any {
    return {
      countryId: body.id,
      countryName: body.name,
      countryCode: body.code.toLowerCase(),
    };
  }

  stateListUniversal(body: any): any {
    return {
      stateId: body.id,
      stateName: body.name,
    };
  }

  cityListUniversal(body: any): any {
    return {
      cityId: body.id,
      cityName: body.name,
    };
  }

  titleListUniversal(body: any): any {
    return {
      titleId: body.id,
      titleName: body.title,
    };
  }

  facilityListUniversal(body: any) {
    return {
      FacilityName: body.name,
    };
  }

  getProcessBookingRequestUniversal(
    bookingDetails,
    bookingPaxDetails,
    bookingItineraryDetails
  ) {
    let dateCheckin = new Date(
      Number(bookingDetails.hotel_check_in)
    ).toDateString();
    let dateCheckout = new Date(
      Number(bookingDetails.hotel_check_out)
    ).toDateString();
    let checkin = formatDate(dateCheckin);
    let checkout = formatDate(dateCheckout);
    return {
      // test_mode: 1,
      affiliate_id: "1836073",
      checkin: checkin,
      checkout: checkout,
      hotel_id: bookingDetails.hotel_code,
      block_ids: bookingItineraryDetails.block_ids,
      block_quantities: bookingItineraryDetails.block_quantities,
      incremental_prices: bookingItineraryDetails.room_price,
      booker_firstname: bookingPaxDetails.first_name,
      booker_lastname: bookingPaxDetails.last_name,
      booker_email: bookingPaxDetails.email,
      currency: bookingDetails.currency,
      booker_country: bookingPaxDetails.country,
      booker_language: "en",
      booker_address: bookingPaxDetails.address,
      booker_city: bookingPaxDetails.city,
      booker_zip: bookingPaxDetails.postal_code,
      booker_telephone: bookingPaxDetails.phone,
      cc_cvc: "123",
      cc_type: "2",
      cc_expiration_date: "2022-12-05",
      cc_number: "4111111111111111",
      cc_cardholder: "Mastro Card",
      extras: "hotel_contact_info",
    };
  }

  getCancelBookingRequestUniversal(bookingDetails, requestData) {
    return {
      test_mode: 0,
      pincode: bookingDetails[0].pincode,
      reason: requestData.Reason,
      reservation_id: bookingDetails[0].booking_id,
    };
  }

  getCityListResponseUniversal(body: any) {
    return {
      city_name: body.name,
      hotel_master_country_id: body.country,
      bdc_city_code: body.city_id,
      status: true,
    };
  }

  getHotelListResponseUniversal(body: any) {
    // console.log(body['hotel_data'].hotel_photos);
    return {
      hotel_id: body.hotel_id,
      hotel_name: body["hotel_data"].name,
      hotel_type_id: body["hotel_data"].hotel_type_id,
      number_of_rooms: body["hotel_data"].number_of_rooms,
      city_id: body["hotel_data"].city_id,
      theme_ids: String(body["hotel_data"].theme_ids),
      ranking: body["hotel_data"].ranking,
      rating: body["hotel_data"].class,
      hotel_important_information:
        body["hotel_data"].hotel_important_information,
      checkin_checkout_times: JSON.stringify(
        body["hotel_data"].checkin_checkout_times
      ),
      address: body["hotel_data"].address,
      creditcard_required: body["hotel_data"].creditcard_required,
      book_domestic_without_cc_details:
        body["hotel_data"].book_domestic_without_cc_details,
      spoken_languages: String(body["hotel_data"].spoken_languages),
      url: body["hotel_data"].url,
      hotel_photos: JSON.stringify(body["hotel_data"].hotel_photos),
      hotel_policies: JSON.stringify(body["hotel_data"].hotel_policies),
      hotel_facilities: JSON.stringify(body["hotel_data"].hotel_facilities),
      hotel_description: body["hotel_data"].hotel_description,
      zip: body["hotel_data"].zip,
      city_name: body["hotel_data"].city,
      location: body["hotel_data"].location.toString(),
      created_by_id: 0,
      status: true,
    };
  }

  //Smyrooms.com

  formatRequestBody(body: any, source: any) {
    // console.log(body);
    let response: any;
    if (source == "smyroomsDotCom") {
      response = {
        DestinationId: body.CityIds[0],
        StartDate: body.CheckIn + "T00:00:00Z",
        EndDate: body.CheckOut + "T00:00:00Z",
        Currency: body.Currency,
        RoomCandidates: body.RoomGuests,
        Market: body.Market,
        CancellationPolicies: body.CancellationPolicy,
      };
    } else {
      response = body;
    }
    return response;
  }

  getApiCredentialsUniversal(body: any): any {
    return body.config;
  }

  getSearchResultUniversal(result: any, markup: any) {
    if (markup && markup.markup_currency == result["price"]["Currency"]) {
      if (markup.value_type == "percentage") {
        let percentVal = (result["price"]["Amount"] * markup["value"]) / 100;
        result["price"]["Amount"] += percentVal;
        result["price"]["Amount"] = parseFloat(
          result["price"]["Amount"].toFixed(2)
        );
        result.roomDetails.forEach((room) => {
          room["Rooms"].forEach((element) => {
            let perVal = (element["Price"]["Amount"] * markup["value"]) / 100;
            element["Price"]["Amount"] += perVal;
            element["Price"]["Amount"] = parseFloat(
              element["Price"]["Amount"].toFixed(2)
            );
          });
          let perVal = (room["Price"]["Amount"] * markup["value"]) / 100;
          room["Price"]["Amount"] += perVal;
          room["Price"]["Amount"] = parseFloat(
            room["Price"]["Amount"].toFixed(2)
          );
        });
      } else if (markup.value_type == "plus") {
        result["price"]["Amount"] += markup["value"];
        result.roomDetails.forEach((room) => {
          room["Rooms"].forEach((element) => {
            element["Price"]["Amount"] += markup["value"];
          });
          room["Price"]["Amount"] += markup["value"];
        });
      }
    }
    return {
      ResultIndex: "",
      HotelCode: result.Code,
      HotelName: result.hotelName,
      HotelCategory: result.hotelCategory ? result.hotelCategory : "",
      StarRating: result.stars ? result.stars : 0,
      HotelDescription: result.description,
      HotelPromotion: result.hotelPromotion ? result.hotelPromotion : "",
      HotelPolicy: result.hotelPolicy,
      Price: result.price,
      HotelPicture: result.images,
      HotelAddress: result.hotelAddress,
      HotelContactNo: result.contactNo,
      HotelMap: result.hotelMap,
      Latitude: result.latitude,
      Longitude: result.longitude,
      Breakfast: "",
      HotelLocation: result.hotelLocation,
      SupplierPrice: result.supplierPrice,
      RoomDetails: result.roomDetails,
      OrginalHotelCode: result.originalHotelCode,
      HotelPromotionContent: "",
      PhoneNumber: "",
      HotelAmenities: result.amenities,
      Free_cancel_date: result.Free_cancel_date,
      trip_adv_url: result.trip_adv_url,
      trip_rating: result.trip_rating,
      NoOfRoomsAvailableAtThisPrice: "",
      Refundable: "",
      HotelCurrencyCode: "",
      NoOfReviews: "",
      ReviewScore: "",
      ReviewScoreWord: "",
      CheckIn: result.checkIn,
      CheckOut: result.checkOut,
      Source: "Travelomatix",
    };
  }

  getHotelDetailsResultUniversal(hotelData: any, roomData: any) {
    return {
      ResultIndex: "",
      HotelCode: hotelData.Code,
      HotelName: hotelData.hotelName,
      HotelCategory: "",
      StarRating: "",
      HotelDescription: "",
      HotelPromotion: "",
      HotelPolicy: hotelData.hotelPolicy,
      Price: hotelData.price,
      HotelPicture: "",
      HotelAddress: hotelData.hotelAddress,
      HotelContactNo: hotelData.contactNo,
      HotelMap: null,
      Latitude: hotelData.latitude,
      Longitude: hotelData.longitude,
      Breakfast: "",
      HotelLocation: null,
      SupplierPrice: null,
      RoomDetails: hotelData.roomDetails,
      OrginalHotelCode: "",
      HotelPromotionContent: "",
      PhoneNumber: "",
      HotelAmenities: "",
      Free_cancel_date: "",
      trip_adv_url: "",
      trip_rating: "",
      NoOfRoomsAvailableAtThisPrice: "",
      Refundable: "",
      HotelCurrencyCode: "",
      NoOfReviews: "",
      ReviewScore: "",
      ReviewScoreWord: "",
      Source: "smyrooms.com",
    };
  }

  sortByProperty(property: any) {
    return function(a, b) {
      if (a[property] > b[property]) {
        return 1;
      } else if (a[property] < b[property]) {
        return -1;
      }
      return 0;
    };
  }
}
