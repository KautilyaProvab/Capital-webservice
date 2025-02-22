import { getExceptionClassByCode } from "../../all-exception.filter";
import { BaseApi } from "../../base.api";
import { RedisServerService } from "../../shared/redis-server.service";
import { formatDepartDate } from "../../app.helper";

import { Body, Injectable } from "@nestjs/common";
import { FlightService } from "../../flight/flight/flight.service";
import { HotelService } from "../../hotel/hotel/hotel.service";
import { HotelDbService } from "../../hotel/hotel/hotel-db.service";
import { TransferService } from "../../transfer/transfer/transfer.service";
import { TransferDbService } from "../../transfer/transfer/transfer-db.service";
import { ActivityService } from "../../activity/activity/activity.service";
import { ActivityDbService } from "../../activity/activity/activity-db.service";
const fs = require("fs");

@Injectable()
export class BundleBookingService extends BaseApi {
  constructor(
    private readonly redisServerService: RedisServerService,
    private flightService: FlightService,
    private hotelService: HotelService,
    private hotelDbService: HotelDbService,
    private transferService: TransferService,
    private transferDbService: TransferDbService,
    private activityService: ActivityService,
    private activityDbService: ActivityDbService,
  ) {
    super();
  }

  async addBundleBooking(@Body() body): Promise<any> {
    try {
      const {
        ResultToken,
        module,
        ...rest
    } = body;
      const oldRecord = rest.exitingToken
        ? await this.redisServerService.read_list(rest.exitingToken)
        : null;

      const keyName = `${module}ResultToken`

      const refNumber = rest.refNumber ? rest.refNumber : this.generateAlphanumericString(10);

      if (oldRecord) {
        const redisDataParsed = JSON.parse(oldRecord[0])
        const redisData = await this.redisServerService.read_list(ResultToken);
        redisDataParsed[module] = redisData;
        redisDataParsed[keyName] = ResultToken

        const token = this.redisServerService.geneateResultToken(body);
        const resultToken = await this.redisServerService.insert_record(
            token,
            JSON.stringify(redisDataParsed)
        );

        return {
          ResultIndex: resultToken["access_key"],
          refNumber,
        };
      } else {
        const redisData = await this.redisServerService.read_list(ResultToken);
        
        const token = this.redisServerService.geneateResultToken(body);
        const resultToken = await this.redisServerService.insert_record(
            token,
            JSON.stringify({ [module]: redisData, [keyName]: ResultToken })
        );
  
        return {
          ResultIndex: resultToken["access_key"],
          refNumber,
          module,
        };
      }

    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getBundleBooking(@Body() body): Promise<any> {
    try {
      const redisData = await this.redisServerService.read_list(body.ResultToken);
      const parsedData = JSON.parse(redisData[0]);

      Object.keys(parsedData).forEach((key) => {
        if (["flightResultToken", "hotelResultToken", "transferResultToken", "activityResultToken"].indexOf(key) < 0) {
          parsedData[key] = JSON.parse(parsedData[key]);
        }
      })
      return parsedData;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async removeBundleBooking(@Body() body): Promise<any> {
    try {
      const redisData = await this.redisServerService.read_list(body.ResultToken);
      const parsedData = JSON.parse(redisData[0]);
      delete parsedData[body.module + "ResultToken"];
      delete parsedData[body.module];

      if (Object.keys(parsedData).length < 1) {
        return {
          ResultIndex: "",
          refNumber: ""
        }
      } else {
        const token = this.redisServerService.geneateResultToken(body);
        const resultToken = await this.redisServerService.insert_record(
            token,
            JSON.stringify(parsedData)
        );
  
        return {
          ResultIndex: resultToken["access_key"],
          refNumber: body.refNumber
        };
      }
      
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async addPaxDetails(@Body() body): Promise<any> {
    try {
      const alreadyExist = `SELECT refNumber FROM bundle_bookings WHERE refNumber= '${body.refNumber}'`;
      const result = await this.manager.query(alreadyExist);
      if (result.length){
          const errorClass: any = getExceptionClassByCode(`400 Booking Already Exists`);
          throw new errorClass(`400 Booking Already Exists`);
      }
      
      const redisData = await this.redisServerService.read_list(body.ResultToken);

      const parsedData = JSON.parse(redisData[0]);
      const AppReferenceObj: any = {
        flightAppReference: null,
        hotelAppReference: null,
        transferAppReference: null
      };

      const finalResponse = {
        flight: null,
        hotel: null,
        transfer: null,
        activity: null,
        grandTotal: 0,
        flightTotal: 0,
        hotelTotal: 0,
        transferTotal: 0,
        activityTotal: 0,
        AddressDetails: null,
        Passengers: null,
      }

      let grandTotal = 0

      if (parsedData.flight) {
        const flightInfo = JSON.parse(parsedData.flight);
        const AppReference = await this.createAppReference({ module: "flight" });
        AppReferenceObj.flightAppReference = AppReference;

        finalResponse.flight = await this.flightService.commitBooking({
          "AppReference": AppReference,
          "booking_source": flightInfo.SearchData.booking_source,
          "BookingSource": body.BookingSource,
          "SequenceNumber": body.SequenceNumber,
          "ResultToken": parsedData["flightResultToken"],
          "Passengers": body.Passengers,
          "UserId": body?.UserId ? body.UserId : 0,
          "Remark": body.Remark,
          "PromoCode": body.PromoCode
        })

        grandTotal += Number(finalResponse.flight.result.CommitBooking.BookingDetails.Price.TotalDisplayFare)
        finalResponse.flightTotal = Number(finalResponse.flight.result.CommitBooking.BookingDetails.Price.TotalDisplayFare)
      }

      if (parsedData.hotel) {
        const hotelInfo = JSON.parse(parsedData.hotel);
        const AppReference = await this.createAppReference({ module: "hotel" });
        AppReferenceObj.hotelAppReference = AppReference;

        // Allocate passengers to rooms
        let roomId = 1; // Start assigning RoomIds
        let adultIndex = 0; // Index for adults
        let childIndex = 0; // Index for children

        const adults = body.Passengers.filter(p => p.PaxType === 1); // Extract all adults
        const children = body.Passengers.filter(p => p.PaxType !== 1); // Extract all children

        const allocatedPassengers = await hotelInfo.searchRequest.RoomGuests.flatMap(room => {
            const allocated = []; // Temporary array for guests in the current room

            // Allocate adults to the room
            for (let i = 0; i < room.NoOfAdults; i++) {
                if (adultIndex < adults.length) {
                    allocated.push({
                        ...adults[adultIndex],
                        RoomId: roomId
                    });
                    adultIndex++; // Move to the next adult
                }
            }

            // Allocate children to the room
            for (let i = 0; i < room.NoOfChild; i++) {
                if (childIndex < children.length) {
                    allocated.push({
                        ...children[childIndex],
                        RoomId: roomId,
                        PaxType: 2
                    });
                    childIndex++; // Move to the next child
                }
            }

            roomId++; // Increment RoomId for the next room
            return allocated;
        });

        finalResponse.hotel = await this.hotelService.addPaxDetails({
          "ResultToken": parsedData["hotelResultToken"],
          "BlockRoomId": body.BlockRoomId,
          "AppReference": AppReference,
          "UserId": body?.UserId ? body.UserId : 0,
          "RoomDetails": [
              {
                  "PassengerDetails": await allocatedPassengers.map((item: any) => {
                      return {
                        "Title": item.Title,
                        "FirstName": item.FirstName,
                        "LastName": item.LastName,
                        "PassengerSelectionAdult": item.PassengerSelectionAdult,
                        "RoomId": item.RoomId,
                        "PaxType": item.PaxType,
                        "LeadPassenger": item.LeadPassenger,
                        "Email": item.Email,
                        }
                      }),
                  "AddressDetails": {
                      "Address": body.AddressDetails.Address,
                      "City": body.AddressDetails.City,
                      "State": body.AddressDetails.State,
                      "PostalCode": body.AddressDetails.PinCode,
                      "Email": body.AddressDetails.Email,
                      "PhoneCode": body.AddressDetails.PhoneCode,
                      "Contact": body.AddressDetails.Contact,
                      "Country": body.AddressDetails.Country
                  }
              }
          ],
          "remark": body.Remark,
          "booking_source": hotelInfo.searchRequest.booking_source,
          "BookingSource": body.BookingSource,
          "PromoCode": body.PromoCode
        })

        grandTotal += Number(finalResponse.hotel.BookingDetails.TotalAmount)
        finalResponse.hotelTotal = Number(finalResponse.hotel.BookingDetails.TotalAmount)
      }

      if (parsedData.transfer) {
        const transferInfo = JSON.parse(parsedData.transfer);
        const AppReference = await this.createAppReference({ module: "transfer" });
        AppReferenceObj.transferAppReference = AppReference;

        finalResponse.transfer = await this.transferService.addPax({
          "ResultToken": parsedData["transferResultToken"],
          "AppReference": AppReference,
          "UserType": body.UserType,
          "UserId": body?.UserId ? body.UserId : 0,
          "Currency": body.Currency,
          "PromoCode": body.PromoCode,
          "PassengerDetails": body.Passengers.map((item: any) => {
            return {
                  "IsLeadPax": item.IsLeadPax,
                  "Title": item.Title,
                  "FirstName": item.FirstName,
                  "LastName": item.LastName,
                  "Dob": item.DateOfBirth,
                  "PaxType": item.PaxType,
                  "LeadPassenger": item.LeadPassenger,
                  "travellerType": item.travellerType,
                  "travellerTypeCount": item.travellerTypeCount,
                  "PassengerSelection": item.PassengerSelection,
                  "Gender": item.Gender,
                  "PassportIssuingCountry": item.PassportIssuingCountry,
                  "Nationality": item.Nationality,
                  "CountryCode": item.CountryCode ?? "",
                  "CountryName": item.CountryName ?? "",
                  "Contact": item.ContactNo ?? "",
                  "PhoneAreaCode": item.PhoneAreaCode ?? "",
                  "PhoneExtensionCode": item.PhoneExtensionCode ?? "",
                  "City": item.City ?? "",
                  "PinCode": item.PinCode ?? "",
                  "AddressLine1": item.AddressLine1 ?? "",
                  "AddressLine2": item.AddressLine2 ?? "",
                  "Email": item.Email ?? "",
              }
          }),
          "AddressDetails": {
              "Title": body.AddressDetails.Title,
              "FirstName": body.AddressDetails.FirstName,
              "LastName": body.AddressDetails.LastName,
              "Address": body.AddressDetails.Address,
              "Address2": body.AddressDetails.Address2,
              "City": body.AddressDetails.City,
              "State": body.AddressDetails.State,
              "PostalCode": body.AddressDetails.PinCode,
              "Email": body.AddressDetails.Email,
              "PhoneCode": body.AddressDetails.PhoneCode,
              "Contact": body.AddressDetails.Contact,
              "Country": "IN"
          },
          "BookingQuestions": body.BookingQuestions,
          "BookingSource": transferInfo.body.BookingSource,
          "DepExtraInfo": body.DepExtraInfo,
          "DepInfo": body.DepInfo,
          "DepPoint": body.DepPoint,
          "Extras": body.Extras,
          "J1_AccommodationAddress": body.J1_AccommodationAddress,
          "J1_PropertyName": body.J1_PropertyName,
          "PropertyName": body.PropertyName,
          "AccommodationAddress": body.AccommodationAddress,
          "RetExtraInfo": body.RetExtraInfo,
          "RetInfo": body.RetInfo,
          "RetPoint": body.RetPoint,
        })

        grandTotal += Number(finalResponse.transfer.BookingItineraryDetails.total_fare)
        finalResponse.transferTotal = Number(finalResponse.transfer.BookingItineraryDetails.total_fare)
      }

      if (parsedData.activity) {
        // const activityInfo = JSON.parse(parsedData.activity);
        const AppReference = await this.createAppReference({ module: "activity" });
        AppReferenceObj.activityAppReference = AppReference;

        finalResponse.activity = await this.activityService.addPaxDetails({
          "ResultToken": parsedData["activityResultToken"],
          "AppReference": AppReference,
          "UserType": body.UserType,
          "UserId": body?.UserId ? body.UserId : 0,
          "Currency": body.Currency,
          "PromoCode": body.PromoCode,
          "PassengerDetails": body.Passengers.map((item: any) => {
            return {
                  "IsLeadPax": item.IsLeadPax,
                  "Title": item.Title,
                  "FirstName": item.FirstName,
                  "LastName": item.LastName,
                  "Dob": item.DateOfBirth,
                  "PaxType": item.PaxType,
                  "LeadPassenger": item.LeadPassenger,
                  "travellerType": item.travellerType,
                  "travellerTypeCount": item.travellerTypeCount,
                  "PassengerSelection": item.PassengerSelection,
                  "Gender": item.Gender,
                  "PassportIssuingCountry": item.PassportIssuingCountry,
                  "Nationality": item.Nationality,
                  "CountryCode": item.CountryCode ?? "",
                  "CountryName": item.CountryName ?? "",
                  "Contact": item.ContactNo ?? "",
                  "PhoneAreaCode": item.PhoneAreaCode ?? "",
                  "PhoneExtensionCode": item.PhoneExtensionCode ?? "",
                  "City": item.City ?? "",
                  "PinCode": item.PinCode ?? "",
                  "AddressLine1": item.AddressLine1 ?? "",
                  "AddressLine2": item.AddressLine2 ?? "",
                  "Email": item.Email ?? "",
              }
          }),
          "AddressDetails": {
              "Title": body.AddressDetails.Title,
              "FirstName": body.AddressDetails.FirstName,
              "LastName": body.AddressDetails.LastName,
              "Address": body.AddressDetails.Address,
              "Address2": body.AddressDetails.Address2,
              "City": body.AddressDetails.City,
              "State": body.AddressDetails.State,
              "PostalCode": body.AddressDetails.PinCode,
              "Email": body.AddressDetails.Email,
              "PhoneCode": body.AddressDetails.PhoneCode,
              "Contact": body.AddressDetails.Contact,
              "Country": body.AddressDetails.Country
          },
          "BookingQuestions": body.activityBookingQuestions ?? [],
          "BookingSource": "ZBAPINO00003",
        })

        grandTotal += Number(finalResponse.activity.BookingDetails.totalNet)
        finalResponse.activityTotal = Number(finalResponse.activity.BookingDetails.totalNet)
      }

      finalResponse.grandTotal = grandTotal
      finalResponse.Passengers = body.Passengers
      finalResponse.AddressDetails = body.AddressDetails

      const query = `
                    INSERT INTO 
                    bundle_bookings
                      (
                        refNumber, 
                        flightAppReference, 
                        flightTotal, 
                        flightBookingStatus, 
                        hotelAppReference, 
                        hotelTotal, 
                        hotelBookingStatus, 
                        transferAppReference, 
                        transferTotal, 
                        transferBookingStatus,
                        activityAppReference, 
                        activityTotal, 
                        activityBookingStatus,
                        updatedAt, 
                        createdBy, 
                        grandTotal,
                        currency
                      ) VALUES (
                        '${body.refNumber}',
                        '${AppReferenceObj.flightAppReference ?? ""}',
                        '${finalResponse.flightTotal ?? 0}',
                        'BOOKING_INPROGRESS',
                        '${AppReferenceObj.hotelAppReference ?? ""}',
                        '${finalResponse.hotelTotal ?? 0}',
                        'BOOKING_INPROGRESS',
                        '${AppReferenceObj.transferAppReference ?? ""}',
                        '${finalResponse.transferTotal ?? 0}',
                        'BOOKING_INPROGRESS',
                        '${AppReferenceObj.activityAppReference ?? ""}',
                        '${finalResponse.activityTotal ?? 0}',
                        'BOOKING_INPROGRESS',
                        NOW(),
                        '${body.UserId}',
                        '${grandTotal}',
                        '${body.Currency}'
                      );
                `
      await this.manager.query(query);

      return {
        ...finalResponse, 
        ResultIndex: "",
        refNumber: ""
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async reservation(@Body() body): Promise<any> {
    try {
      let isConfirmed = true
      const finalResponse = {
        flight: null,
        hotel: null,
        transfer: null,
        activity: null
      }

      if (body.flightResultToken) {
        isConfirmed = false
        finalResponse.flight = await this.flightService.reservation(
          {
            "ResultToken": body.flightResultToken,
            "booking_source": "ZBAPINO00002",
            "AppReference": body.flightAppReference,
            "UserType": body.UserType,
          }
        )

        if ([null, undefined, ""].indexOf(finalResponse.flight.result.ReservationResultIndex) < 0) {
          const query = `
            UPDATE 
              bundle_bookings
            SET
              flightBookingStatus = 'BOOKING_HOLD'
            WHERE refNumber = '${body.refNumber}';
          `
          await this.manager.query(query);

          isConfirmed = true
        } else {
          const errorClass: any = getExceptionClassByCode(`400 Booking Got Faild`);
          throw new errorClass(`400 Booking Got Faild`);
        }
      }

      if (body.hotelAppReference && isConfirmed) {
        isConfirmed = false
        const reqBody = {
          "booking_source": body.hotelBookingSource,
          "AppReference": body.hotelAppReference
        }
        const data = await this.hotelService.hotelsReservation(reqBody);
        finalResponse.hotel = data
        if (data) {
          const query = `
            UPDATE 
              bundle_bookings
            SET
              hotelBookingStatus = 'BOOKING_CONFIRMED'
            WHERE refNumber = '${body.refNumber}';
          `
          await this.manager.query(query);

          isConfirmed = true
          await this.hotelDbService.emailHotelDetails(reqBody)
        } else {
          const errorClass: any = getExceptionClassByCode(`400 Booking Got Faild`);
          throw new errorClass(`400 Booking Got Faild`);
        }
      }

      if (body.transferAppReference && isConfirmed) {
        isConfirmed = false
        const reqBody = {
          "BookingSource": body.transferBookingSource,
          "AppReference": body.transferAppReference,
          "UserType": body.UserType,
          "UserId": body.UserId,
        }
        
        const data = await this.transferService.ConfirmBooking(reqBody);
        finalResponse.transfer = data
        if (data) {
            const query = `
              UPDATE 
                bundle_bookings
              SET
                transferBookingStatus = 'BOOKING_CONFIRMED'
              WHERE refNumber = '${body.refNumber}';
            `
            await this.manager.query(query);

            isConfirmed = true
            this.transferDbService.emailTransferDetails(reqBody)
        } else {
          const errorClass: any = getExceptionClassByCode(`400 Booking Got Faild`);
          throw new errorClass(`400 Booking Got Faild`);
        }
      }

      if (body.activityAppReference && isConfirmed) {
        isConfirmed = false
        const reqBody = {
          "BookingSource": body.activityBookingSource,
          "AppReference": body.activityAppReference,
          "UserType": body.UserType,
          "UserId": body.UserId,
        }

        const data = await this.activityService.BookingConfrimSer(reqBody);
        finalResponse.activity = data
        if (data) {
            const query = `
              UPDATE 
                bundle_bookings
              SET
                activityBookingStatus = 'BOOKING_CONFIRMED'
              WHERE refNumber = '${body.refNumber}';
            `
            await this.manager.query(query);

            isConfirmed = true
            this.activityDbService.emailActivityDetails(reqBody)
        } else {
          const errorClass: any = getExceptionClassByCode(`400 Booking Got Faild`);
          throw new errorClass(`400 Booking Got Faild`);
        }
      }
      
      return finalResponse
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async bundleReport(@Body() body): Promise<any> {
    try {
      let whereQuery = ``;
      let whereArr = [];

      delete body?.booking_source

      Object.keys(body).forEach((key) => {
        whereArr.push(`${key} = '${body[key]}'`);
      })

      if (whereArr.length > 0) {
        whereQuery += `WHERE ${whereArr.join(" AND ")}` 
      }

      const query = `
              SELECT 
                *
              FROM
                bundle_bookings
              ${whereQuery}
        `
      return await this.manager.query(query);
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message); 
    }
  }

  generateAlphanumericString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `BUNDLE-${result}`;
  }
  
  async createAppReference(body: any) {
    try {
      let query = "";
      if (body.module == "flight") {
        query = `SELECT app_reference FROM flight_bookings ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "hotel") {
        query = `SELECT app_reference FROM hotel_hotel_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "bus") {
        query = `SELECT app_reference FROM bus_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "transfer") {
        query = `SELECT app_reference FROM transfer_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "activity") {
        query = `SELECT app_reference FROM activity_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "tour") {
        query = `SELECT app_reference FROM tour_booking_details ORDER BY ID DESC LIMIT 1`;
      }
      const result = await this.manager.query(query);
      let last_app_reference: any;
      if (result[0]) {
        last_app_reference = result[0].app_reference;
      }
      if (last_app_reference && (last_app_reference.startsWith("AWT") || last_app_reference.startsWith("BG"))) {
        const number = parseInt(last_app_reference.split("-")[1]) + 1;
        const number_length = JSON.stringify(number).length;
        var serialNumber = JSON.stringify(number);
        if (number_length == 1) {
          serialNumber = "00" + number;
        } else if (number_length == 2) {
          serialNumber = "0" + number;
        }
        const app_reference =
          last_app_reference.substring(0, 4) +
          formatDepartDate(new Date()) +
          "-" +
          serialNumber;
        return app_reference;
      } else {
        var app_reference = "";
        if (body.module == "hotel") {
          app_reference = "AWTH" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "flight") {
          app_reference = "AWTF" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "bus") {
          app_reference = "AWTB" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module === "tour") {
          app_reference = "AWTT" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "activity") {
          app_reference = "AWTA" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "transfer") {
          app_reference = "BGTR" + formatDepartDate(new Date()) + "-" + "001";
        }
        return app_reference;
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async bundleVoucher(@Body() body): Promise<any> {
    try {
      const query = `SELECT * FROM bundle_bookings WHERE refNumber = '${body.refNumber}'`;
      const result = await this.manager.query(query);

      if (!result.length) {
        const errorClass: any = getExceptionClassByCode(`400 Vocuher not found`);
        throw new errorClass(`400 Vocuher not found`);
      }

      const finalResponse = {
        flight: null,
        hotel: null,
        transfer: null,
        activity: null
      }

      if (result[0].flightAppReference) {
        finalResponse.flight = await this.flightService.voucher({
          AppReference: result[0].flightAppReference
        })
      }

      if (result[0].hotelAppReference) {
        finalResponse.hotel = await this.hotelService.bookingConfirmed({
          AppReference: result[0].hotelAppReference
        })
      }

      if (result[0].transferAppReference) {
        finalResponse.transfer = await this.transferService.Voucher({
          AppReference: result[0].transferAppReference
        })
      }

      if (result[0].activityAppReference) {
        finalResponse.activity = await this.activityService.bookingConfirmed({
          AppReference: result[0].activityAppReference
        })
      }

      return finalResponse
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
}
