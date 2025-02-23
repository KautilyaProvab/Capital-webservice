import { HttpException, HttpService, Injectable } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import {
  logStoragePath,
  META_TL_HOTEL_COURSE,
  IRIX_TOKEN_URL,
  IRIX_AUTH_URL,
  BASE_CURRENCY,
  IXRIX_URL,
  IRIX_CLIENT_ID,
  IRIX_CLIENT_SECRET,
  price,
} from "../../../constants";
import { goGlobalRequestTypes } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { IRIXTransformService } from "./irix-transform.service";
import { isRequiredInputField } from "graphql";
import * as qs from "qs";
import { Promise } from "mongoose";
const crypto = require("crypto");
const fs = require("fs");
import * as xml2js from 'xml2js';
import { map } from "rxjs/operators";
import path from 'path';
import e from "express";

@Injectable()
export class IRIXService extends HotelApi {
  constructor(
    private readonly httpService: HttpService,
    private hotelDbService: HotelDbService,
    private IRIXTransformService: IRIXTransformService,
    private redisServerService: RedisServerService
  ) {
    super();
  }
  throwSoapError(jsonResponse: any) {
    if (getPropValue(jsonResponse, "Header.OperationType") == "Error") {
      throw new HttpException(
        getPropValue(jsonResponse, "Main.Error.Message"),
        400
      );
    }
  }
  async authenticate(scopes: any, grantType: any) {
    let token_url = IRIX_TOKEN_URL;
    let auth_url = IRIX_AUTH_URL;
    let clientId = IRIX_CLIENT_ID;
    let clientSecret = IRIX_CLIENT_SECRET;

    let base64Code = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );
    let header = {
      Authorization: `Basic ${base64Code}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    let searchRequest = {
      grant_type: grantType,
      scope: scopes,
    };

    const result: any = await this.httpService
      .post(token_url, qs.stringify(searchRequest), {
        headers: header,
      })
      .toPromise();

    return {
      token_type: result.token_type,
      access_token: result.access_token,
    };
  }

  async getHeader(type: any, requestType: any, userType: any) {
    let AuthData: any;
    let Header: any;
    if (type === "HOTEL_SEARCH_REQUEST") {
      AuthData = await this.authenticate(
        "read:hotels-search",
        "client_credentials"
      );
    } else if (type === "HOTEL_BOOK_REQUEST") {
      AuthData = await this.authenticate(
        "write:hotels-book",
        "client_credentials"
      );
    }
    Header = {
      Authorization: `${AuthData["token_type"]} ${AuthData["access_token"]}`,
      "Content-Type": "application/hal+json",
    };

    return Header;
  }

  async search(body: any): Promise<any> {
    const fs = require("fs");

    try {
      const headerss = await this.getHeader(
        "HOTEL_SEARCH_REQUEST",
        "Request",
        body["UserType"]
      );

      const givenUrl = `${IXRIX_URL}search/sync`;

      //             const start1: any = new Date();
      const searchRequest: any = await this.searchRequest(body);

      //             const end1: any = new Date();
      //             console.log("For Third party request Format time:", (end1 - start1));

      let markup: any;
      // if (body['UserType'] ) {
      //     if(body['UserId']==undefined){
      //             body['UserId']=0;
      //     }

      //     markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);
      //     markup = await this.hotelDbService.getMarkup(body);
      // }

      let newHeader = {
        ...headerss,
        "Content-Type": "application/json",
      };

      //         const start2: any = new Date();
      let searchResult: any = await this.httpService
        .post(givenUrl, JSON.stringify(searchRequest), {
          headers: newHeader,
          // headers: headerss
        })
        .toPromise();

      const fs = require("fs");
      if (this.isLogXml) {
        const fs = require("fs");
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/AvailabilityRQ_${body["searchId"]}.json`,
          JSON.stringify(searchRequest)
        );
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/AvailabilityRS_${body["searchId"]}.json`,
          JSON.stringify(searchResult)
        );
      }
      let srk = searchResult.srk;
      let token = searchResult.tokens.results;

      // //             const end2: any = new Date();
      // //          console.log("Third party response time:", (end2 - start2));

      //             if (this.isLogXml) {
      //                 fs.writeFileSync(`${logStoragePath}/hotels/irix/AvailabilityRQ_${body['searchId']}.json`, JSON.stringify(searchRequest));
      //                 fs.writeFileSync(`${logStoragePath}/hotels/irix/AvailabilityRS_${body['searchId']}.json`, JSON.stringify(result));
      //             }

      if (searchResult.hotels && searchResult.hotels.length > 0) {
        var DeDuToken = body.DeDuToken;
        delete body.DeDuToken;

        const formattedResult = await this.IRIXTransformService.getHotelSearchUniversalFormat(
          body,
          markup,
          searchResult.hotels,
          srk,
          token
        );
        const duplicatHotelListData = await this.redisServerService.read_list(
          DeDuToken
        );

        //                 const duplicatHotelList= JSON.parse(duplicatHotelListData);
        //                 let finalHotelList:any = [];
        //                 for (let index = 0; index < formattedResult.length; index++) {
        //                     // console.log("ten-",formattedResult[index].GiataCode);return;
        //                     if(formattedResult[index] != undefined){

        //                     formattedResult[index]['uniqueHotelId']=duplicatHotelList.uniqueHotelId++;
        //                     duplicatHotelList[formattedResult[index]['GiataCode']].price = formattedResult[index]['Price']['Amount'];
        //                     duplicatHotelList[formattedResult[index]['GiataCode']].uniqueHotelId = formattedResult[index]['uniqueHotelId'];
        //                     finalHotelList.push(formattedResult[index]);
        //                 }
        //                    }

        //                    const DeToken = this.redisServerService.geneateResultToken(body.searchId);

        // const duplicatHotelListNew = await this.redisServerService.insert_record(DeToken, JSON.stringify(duplicatHotelList));

        // finalHotelList['DeDuToken'] = duplicatHotelListNew["access_key"];
        // return finalHotelList;
        return formattedResult;
      } else {
        // const errorClass: any = getExceptionClassByCode(`400 ${result.Message}`);
        // throw new errorClass(`400 ${result.Message}`);
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async searchRequest(body: any): Promise<any> {
    const {
      CheckIn,
      CheckOut,
      UserType,
      NoOfNights,
      HotelIds,
      RoomGuests,
    } = body;

    const guests = RoomGuests.map((room) => {
      const adults = room.NoOfAdults;
      const children = room.NoOfChild;
      const childAges = room.ChildAge;
      return {
        adults: adults,
        childrenAges: childAges,
      };
    });

    let occup = {
      leaderNationality: 44,
      rooms: guests,
    };

    let request = {
      accommodation: [48749],
      checkIn: CheckIn,
      checkOut: CheckOut,
      occupancy: occup,
      language: "en_GB",
      timeout: 60,
      providers: [],
      sellingChannel: UserType,
      source: "seller",
    };

    return request;
  }

  async getHotelDetails(body) {
    try {
      let BackData = await this.redisServerService.read_list(body.ResultToken);
      BackData = JSON.parse(BackData);
      let token = BackData.data["ResultToken"];
      let data = BackData.data;
      let paxCount = Object.values(data.searchRequest.RoomGuests);

      let room1 = data.searchRequest.RoomGuests[0];
      let room1_pax = room1.NoOfAdults + "_" + room1.NoOfChild;
      let currencyDetails: any;
      let conversionRate = 1;
      const headers = await this.getHeader(
        "HOTEL_SEARCH_REQUEST",
        "Request",
        body["UserType"]
      );

      const givenUrl = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/details?token=${BackData.api_token}`;

      const response: any = await this.httpService
        .get(givenUrl, { headers })
        .toPromise();

      const fs = require("fs");

      if (this.isLogXml) {
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/HotelDetailsRES_${data.searchRequest.searchId}.json`,
          JSON.stringify(response)
        );
      }

      const offersUrl = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers?token=${BackData.api_token}`;
      const offersResponse: any = await this.httpService
        .get(offersUrl, { headers })
        .toPromise();

      const offers: any = Object.values(offersResponse.offers);

      let roomDetails: any[] = [];
      let Rooms: any;
      let UID: any;
      let roomsResponse:any

      for (let i = 0; i < data.searchRequest.NoOfRooms; i++) {
        let paxDetails = paxCount[i]
        // Initialize RoomPush for each room index
        let RoomPush = [];

        // Loop through all the offers
        for (let j = 0; j < offers.length; j++) {
          const offer = offers[j];
          let offerId = offer.id;

          // Loop through all packages in the current offer
          for (let index = 0; index < offer.packages.length; index++) {
            let packages = offer.packages[index];
            let packageCode = packages.packageCode;
            let packageToken = packages.packageToken;
            let packageRoom = packages.packageRooms[i]; // Get room data for the specific room index

            // Loop through all room references in the package
            for (const packRoom of packageRoom.roomReferences) {
              let room = packRoom;

              if (room?.selected === true) {
                // Generate unique UID for each room (moved here to ensure unique UID for each room)
                let UID = await this.redisServerService.uniqueId(
                  packageCode,
                  packageCode
                );

                // Generate room-specific data
                let roomCode = room.roomCode;
                let roomtoken = room.roomToken;
                let RoomData = offers[j].rooms[room.roomCode];
                let price = RoomData?.price;
                let NonRefundable = RoomData?.nonRefundable
                  ? "NonRefundable"
                  : "Refundable";

                  const roomsUrl = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${offerId}/rooms/${RoomData.index}?token=${BackData.api_token}`;
                  roomsResponse = await this.httpService
                    .get(roomsUrl, { headers })
                    .toPromise();


                // Generate unique result token for this specific room's reference
                let rkey = await this.redisServerService.geneateResultToken(
                  body
                );
                let rRedis = {
                  roomCode: roomCode,
                  roomToken: roomtoken,
                };

                let rkeyResponse = await this.redisServerService.insert_record(
                  rkey,
                  JSON.stringify(rRedis)
                );
                

                // Define room data for this specific room
                let roomsData = {
                  Index: rkeyResponse["access_key"] ?? "",
                  Price: {
                    FromDate: data.searchRequest.CheckIn,
                    ToDate: data.searchRequest.CheckOut,
                    Amount: price?.selling?.value,
                    hotelTaxCharge: 0,
                    Currency: price?.selling?.currency,
                    EligibleDiscount: 0,
                    Markup: 0,
                  },
                  Id: offerId,
                  Description: RoomData?.name ?? "",
                  RoomType: RoomData?.board ?? "",
                  RoomName: RoomData?.name ?? "",
                  NonRefundable: NonRefundable ?? "",
                  NonRefundStatus: RoomData?.nonRefundable ?? "",
                  MealPlanCode: RoomData?.boardBasis ?? "",
                  Occupancy: "",
                  CancellationPolicies: {},
                  AdultCount: paxDetails['NoOfAdults'] ?? "",
                  ChildrenCount: paxDetails['NoOfChild'] ?? "",
                  PaxCount: paxDetails['NoOfAdults'] + paxDetails['NoOfChild'] ?? "",
                  Rooms: "",
                  Supplements: [],
                  Message: "",
                  AvailableRooms: "",
                  mealsAmount: "",
                  basePrice: price?.selling?.value ?? "",
                  hotelTaxPlusValue: 0,
                  roomImages:roomsResponse?.images ??  [],
                  hotelTax: [],
                  hotelAmenities:[roomsResponse?.facilitiesDescription] ?? []
                };

                // Save result for this specific room and package
                let resultIndRedis = {
                  offerId: offerId,
                  packCode: packageCode,
                  packToken: packageToken,
                  RoomData: [roomsData],
                };

                // Generate unique result index token for this specific package and offer
                let resultInd = await this.redisServerService.geneateResultToken(
                  body
                );

                let resultResponse = await this.redisServerService.insert_record(
                  resultInd,
                  JSON.stringify(resultIndRedis)
                );

                // Structure for storing room details
                let Rooms = {
                  AgencyToken: "",
                  ResultIndex: resultResponse["access_key"],
                  RoomUniqueId: UID, // Each room gets its own unique UID
                  Rooms: [roomsData],
                };

                // Push this room data into RoomPush array for the specific room index (i)
                RoomPush.push(Rooms);
              }
            }
          }
        }

        // Store the collected RoomPush data into roomDetails[i] after finishing the nested loops for each room index
        roomDetails[i] = RoomPush;
      }

      if (this.isLogXml) {
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/Offers_RS_${data.searchRequest.searchId}.json`,
          JSON.stringify(offersResponse)
        );
      }
      if (this.isLogXml) {
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/Rooms_RS_${data.searchRequest.searchId}.json`,
          JSON.stringify(roomsResponse)
        );
      }

      let Data = {
        HotelName: response.name,
        HotelCategoty: response.stars,
        StarRating: response.stars,
        HotelAddress: response.address,
        MainImage: response?.mainImage?.url ?? "",
        HotelImage: [response?.mainImage?.url] ?? [],
        HotelDescription: response?.shortDescription ?? "",
        HotelPromotion: "",
        HotelPolicy: [],
        RoomDetails: roomDetails,
        HotelContactNo: response?.telephone ?? "N/A",
        Latitude: response?.geolocation?.latitude ?? "",
        Longitude: response?.geolocation?.longitude ?? "",
        Breakfast: "",
        HotelLocation: response?.city?.name ?? "",
        SuppliersPrice: "",
      };

      token = this.redisServerService.geneateResultToken(body);
      let saveData = {};
      saveData["HotelData"] = Data;
      saveData["BackData"] = BackData;
      let resp = await this.redisServerService.insert_record(
        token,
        JSON.stringify(saveData)
      );

      return {
        ...Data,
        ResultIndex: resp["access_key"],
      };
    } catch (error) {
      throw new Error("An error occurred while retrieving hotel details.");
    }
  }

  async hotelsValuation(body: any) {
    try {
      let hotelDetail = await this.redisServerService.read_list(
        body.ResultToken
      );
      let HotelRedisData = JSON.parse(hotelDetail);

      let HotelData = HotelRedisData["HotelData"];
      let BackData = HotelRedisData["BackData"];
      let roomDetails = Object.values(HotelData.RoomDetails);
      const headers = await this.getHeader(
        "HOTEL_SEARCH_REQUEST",
        "Request",
        body["UserType"]
      );
      let RoomData;
      //Selected Rooms data
      let roomTokens = [];
      let RoomDetails = [];
      let RoomDetail = [];

      for (let i = 0; i < body.RoomResultToken.length; i++) {
        RoomData = await this.redisServerService.read_list(
          body.RoomResultToken[i]
        );
        RoomData = JSON.parse(RoomData);
        let RoomIndexData = await this.redisServerService.read_list(
          RoomData.RoomData[0].Index
        );
        let RoomIndex = JSON.parse(RoomIndexData);
        roomTokens.push(RoomIndex.roomToken);
        RoomDetail.push(RoomData.RoomData[0]);
      }
      let request = {
        packageToken: RoomData.packToken,
        roomTokens: roomTokens,
      };
      const availability = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${RoomData.offerId}/availability?token=${BackData.api_token}`;
      const response: any = await this.httpService
        .post(availability, request, { headers })
        .toPromise();

      const fs = require("fs");
      if (this.isLogXml) {
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/Block_RQ_${BackData.data.searchRequest.searchId}.json`,
          JSON.stringify(request)
        );
        fs.writeFileSync(
          `${logStoragePath}/hotels/Irix/Block_RS_${BackData.data.searchRequest.searchId}.json`,
          JSON.stringify(response)
        );
      }
      let hotelData = {
        ResultIndex: "",
        HotelName: HotelData?.HotelName ?? "",
        HotelCategoty: HotelData?.HotelCategoty ?? "",
        StarRating: HotelData?.StarRating ?? "",
        HotelAddress: HotelData?.HotelAddress ?? "",
        MainImage: HotelData?.MainImage ?? [],
        HotelDescription: HotelData?.HotelDescription ?? "",
        HotelPromotion: HotelData?.HotelPromotion ?? "",
        HotelPolicy: HotelData?.HotelPolicy ?? [],
        price: BackData?.data?.Price ?? "",
        HotelPicture: [],
        HotelContactNo: BackData?.data?.PhoneNumber ?? "",
        HotelMap: "",
        Latitude: HotelData?.Latitude ?? "",
        Longitude: HotelData?.Longitude ?? "",
        Breakfast: "",
        HotelLocation: HotelData?.HotelLocation ?? "",
        RoomDetails: RoomDetail,
        SupplierPrice: "",
        searchRequest: BackData?.data?.searchRequest ?? {},
        booking_source: BackData?.data?.searchRequest?.booking_source ?? "",
        search_id: BackData?.data?.searchRequest?.searchId ?? "",
        UserId: BackData?.data?.searchRequest?.UserId ?? 0,
        UserType: BackData?.data?.searchRequest?.UserType ?? "",
        MarkupCity: BackData?.data?.searchRequest?.MarkupCity ?? "",
        MarkUpCountry: BackData?.data?.searchRequest?.MarkupCountry ?? "",
        Free_cancel_date: "",
        trip_adv_url: "",
        trip_rating: "",
        NoOfRoomsAvailableAtThisPrice: "",
        Refundable: RoomData.RoomData[0].NonRefundStatus,
        HotelCurrencyCode: BackData.data.Price.Currency ?? "",
        NoOfReviews: "",
        ReviewScore: "",
        ReviewScoreWord: "",
        NoOfNights: BackData?.data?.searchRequest?.NoOfNights ?? "",
        NoOfRooms: BackData?.data?.searchRequest?.NoOfRooms ?? "",
        Currency: BackData?.data?.searchRequest?.Currency ?? "",
        Market: BackData?.data?.searchRequest?.Market ?? "",
      };
      let token = this.redisServerService.geneateResultToken(body);
      let saveData = {};
      saveData["HotelData"] = hotelData;
      saveData["BackData"] = BackData;
      saveData["ApiBlockData"] = JSON.stringify(response);

      let resp = await this.redisServerService.insert_record(
        token,
        JSON.stringify(saveData)
      );

      return {
        ...hotelData,
        ResultIndex: resp["access_key"],
      };
    } catch (error) {
      throw new Error("Error.");
    }
  }

  async formatReservationRequest(
    booking: any,
    pax: any,
    room: any,
    body,
    RedisData
  ) {
    let RedisParse = JSON.parse(RedisData);

    let BackData = RedisParse["BackData"];
    let ApiData = JSON.parse(RedisParse["ApiBlockData"]);
    let searchData = RedisParse.HotelData.searchRequest;
    let NoRooms = searchData.NoOfRooms;
    let offerId = RedisParse.HotelData.RoomDetails[0].Id;
    const fs = require("fs");

    let passengerData =pax


    let payment = "";
    let provider = "";
    let paymentToken = "";
    let paymentId:any;
    if (ApiData.paymentMethods.paynow) {
      payment = ApiData.paymentMethods.paynow.code;
      provider = ApiData.paymentMethods.paynow.options[0].provider;
      paymentToken = ApiData.paymentMethods.paynow.options[0].token;

      const headers = await this.getHeader(
        "HOTEL_SEARCH_REQUEST",
        "Request",
        body["UserType"]
      );

      let request = {
        availabilityToken: ApiData.availabilityToken,
        provider: provider,
        paymentToken: paymentToken,
        params: {
          successUrl : "http://www.example.com/success",
          failureUrl : "http://www.example.com/failure",
          notificationUrl : "http://www.example.com/notification"
        },
      };
      const payment_url = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${offerId}/payment?token=${BackData.api_token}`;

      const response: any = await this.httpService
        .post(payment_url, request , { headers })
        .toPromise();
       paymentId = Number(response.id);
        if (this.isLogXml) {
          fs.writeFileSync(
            `${logStoragePath}/hotels/Irix/Payment_RQ_${searchData.searchId}.json`,
            JSON.stringify(request)
          );
          fs.writeFileSync(
            `${logStoragePath}/hotels/Irix/Payment_RS_${searchData.searchId}.json`,
            JSON.stringify(response)
          );
        }
    } else {
      payment = "credit";
    }
    let RoomDetails = RedisParse.HotelData.RoomDetails;

    const headers = await this.getHeader(
      "HOTEL_BOOK_REQUEST",
      "Request",
      body["UserType"]
    );
    let Pax = []; // Initialize Pax as an empty array

    for (let j = 0; j < NoRooms; j++) {
      // Loop over each room
      let roomIndex = RoomDetails[j].Index;
      let RedisIndexToken = await this.redisServerService.read_list(roomIndex);
      RedisIndexToken = JSON.parse(RedisIndexToken);
      let roomToken = RedisIndexToken.roomToken;
      let paxArr = []; // Initialize paxArr for each room
      let k = 1; // Assuming 'k' is for reference or the traveler index

      // Loop over each passenger (pax)
      for (let i = 0; i < pax.length; i++) {
        // Correct the condition to loop through pax
        let paxId = Number(pax[i].attributes); // Get paxId from the attribute
        let lead = false;

        // Set lead to true for the first passenger in each room
        if (i === 0) {
          lead = true;
        }

        // Check if paxId matches the room index (adjusting for 0-based index)
        if (paxId === j + 1) {
          let paxData = pax[i]; // Get the current passenger data

          // Create travelDetails object
          let travelDetails = {
            reference: `${Number(paxId)}-${k}`,
            type: paxData["pax_type"].toLowerCase(),
            lead: lead,
            title: paxData["title"].toLowerCase(),
            firstName: paxData["first_name"],
            lastName: paxData["last_name"],
            email: paxData["email"],
            phonePrefix: paxData["phone_code"],
            phone: paxData["phone"],
            identificationNumbers: {
              fiscalIdentificationNumber: "",
              identityNo: "",
            },
            address: paxData["address"],
            country: paxData["country"],
            city: paxData["city"],
            postalCode: paxData["postal_code"],
          } as any;
          if(paxData["pax_type"] == 'Child'){
            travelDetails = {
              ...travelDetails,
              BirthDate:paxData.date_of_birth,
            }
          }

          paxArr.push(travelDetails); // Add the current traveler to paxArr
          k++; // Increment traveler index (assuming each room can have multiple travelers)
        }
      }

      // After processing all passengers for this room, assign the room details
      Pax[j] = {
        packageRoomToken: roomToken, // You can update this if needed
        travelers: paxArr, // Add the travelers for this room
      };
    }

    const reservation_url = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${offerId}/book?token=${BackData.api_token}`;
    let request = {
      availabilityToken: ApiData.availabilityToken,
      clientRef: booking[0].app_reference,
      bookingOptions: ApiData.bookingOptions,
      rooms: Pax,
      payment: {
        method: payment,
        order:{
          id:paymentId,
          token:paymentToken
        }
      },
      backOfficeRemarks: [
        {
          id: null,
          text: "Test Booking",
        },
      ],
    };
    const response: any = await this.httpService
      .post(reservation_url, request, { headers })
      .toPromise();
    if (this.isLogXml) {
      fs.writeFileSync(
        `${logStoragePath}/hotels/Irix/Book_req_${searchData.searchId}.json`,
        JSON.stringify(request)
      );
      fs.writeFileSync(
        `${logStoragePath}/hotels/Irix/Book_res_${searchData.searchId}.json`,
        JSON.stringify(response)
      );
      let ApiResponse = {}
      if(response.status == 'OK'){
        ApiResponse = {
          BookingStatus:"BOOKING_CONFIRMED",
          reference:response.reference.external,
          totalSellingRate:response?.price?.selling?.value ?? "",
          currency:response?.price?.selling?.currency ?? ""

        }

      }else{
        ApiResponse = {
          BookingStatus:"BOOKING_FAILED",
          ClientReference:'',
          totalSellingRate:response?.price?.selling?.value ?? 0,
          currency:response?.price?.selling?.currency ?? 'USD'
        }
        
      }
      return this.IRIXTransformService.updateData(ApiResponse,body, booking ,passengerData,room);

      
    }
  }
  async hotelsReservation(body: any): Promise<any> {
    let RedisData: any = await this.redisServerService.read_list(
      body.ResultToken
    );

    let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
    let paxDetails = await this.hotelDbService.getHotelBookingPaxDetails(body);
    let roomDetails = await this.hotelDbService.getHotelBookingItineraryDetails(
      body
    );

    let formattedRequest = this.formatReservationRequest(
      bookingDetails,
      paxDetails,
      roomDetails,
      body,
      RedisData
    );

    return formattedRequest;
  }
  
  //insert cities
  async insertCities(body: any) {
    try {

      const filepath = `/Users/adithya/Provab/capital-sky/CapitalSky-webservice/Cities.xml`;
      const xmlData = fs.readFileSync(filepath, 'utf-8');
      const parser = new xml2js.Parser();
      const parsedData = await parser.parseStringPromise(xmlData);
  
      let cities = parsedData.CityStaticData.City;
  
      const values = cities.map((el: any) => {
        const city_id = el.$.ID ?? "";
        const country_id = el.$.CountryID ?? "";
        const name = el.$.Name ?? "";
        const code = el.$.Code ?? "";
        const searchable = el.$.Searchable ?? ""; 
        const searchableOn = el.$.SearchableOn ?? "";
  
        const escapedName = name.replace(/'/g, "''");
        const escapedCode = code.replace(/'/g, "''");
        const escapedSearchableOn = searchableOn.replace(/'/g, "''");
        const escapedSearchable = searchable.replace(/'/g, "''"); 
  
        return `(${city_id}, ${country_id}, '${escapedName}', '${escapedCode}', '${escapedSearchable}', '${escapedSearchableOn}')`;
      }).join(",");
  
      const query = `INSERT INTO cities (city_id, country_id, name, code, Searchable, SearchableOn) VALUES ${values}`;
  
      const result = await this.manager.query(query);
  
      if (result) {
        console.log("Cities inserted successfully");
      }
  
    } catch (error) {
      console.error("Error inserting cities:", error);
    }
  }

  //insert countries
  async insertCountries(body: any) {
    try {

      const filepath = `/Users/adithya/Provab/capital-sky/CapitalSky-webservice/Countries.xml`;
      const xmlData = fs.readFileSync(filepath, 'utf-8');
      const parser = new xml2js.Parser();
      const parsedData = await parser.parseStringPromise(xmlData);

      let countries = parsedData.CountryStaticData.Country;
  
      const values = countries.map((el: any) => {
        const country_id = el.$.ID ?? "";
        const name = el.$.Name ?? "";
        const ISO = el.$.ISO ?? "";
        const searchable = el.$.Searchable ?? ""; 
        const searchableOn = el.$.SearchableOn ?? "";
  
        const escapedName = name.replace(/'/g, "''");
        const escapedCode = ISO.replace(/'/g, "''");
        const escapedSearchableOn = searchableOn.replace(/'/g, "''");
        const escapedSearchable = searchable.replace(/'/g, "''"); 
  
        return `(${country_id}, '${escapedName}', '${escapedCode}', '${escapedSearchable}', '${escapedSearchableOn}')`;
      }).join(",");
  
      const query = `INSERT INTO countries(country_id, name, ISO, Searchable, SearchableOn) VALUES ${values}`;
  
      const result = await this.manager.query(query);
  
      if (result) {
        console.log("Cities inserted successfully");
      }
  
    } catch (error) {
      console.error("Error inserting cities:", error);
    }
  }

  async insertHotelDetails(body: any) {
    try {
      const folderPath = `/Users/adithya/Provab/capital-sky/CapitalSky-webservice/HotelDetails/`;
      const files = fs.readdirSync(folderPath); 
      const parser = new xml2js.Parser();
      
      // Loop through each XML file
      for (const file of files) {

        let fileName
        const filePath = `${folderPath}${file}`; 
        const xmlData = fs.readFileSync(filePath, 'utf-8');
        const parsedData = await parser.parseStringPromise(xmlData);
  
        let hotelDetails = parsedData.HotelDetailsStaticData?.HotelDetails ?? [];
  
        if (hotelDetails && hotelDetails.length > 0) {
          const values = hotelDetails.map((el: any) => {
            const city_id = el?.$?.CityID ?? "";
            const country_id = el?.$?.CountryID ?? "";
            const id = el?.$?.ID ?? "";
            const hotelname = el?.$?.Name?.replace(/'/g, "''") ?? "";
            const searchable = el?.$?.Searchable ?? ""; 
            const stars = el?.$?.Stars ?? "";
            const type = el?.$?.Type ?? "";
            const address = el?.Address?.[0] ?? 'NULL';  // Fallback to 'NULL' if Address is missing
            const gallery = el?.Gallery && el?.Gallery[0]?.GalleryImage ? JSON.stringify(el.Gallery[0].GalleryImage.map((item: any) => item.$.URL)) : 'NULL';  // Handle missing Gallery
            const image = el?.Image?.[0]?.$?.URL ? `'${el.Image[0].$.URL.replace(/'/g, "''")}'` : 'NULL';  // Handle missing Image
            const Latitude = el?.Position?.[0]?.$.Latitude ?? 'NULL';  // Handle missing Position (Latitude)
            const Longitude = el?.Position?.[0]?.$.Longitude ?? 'NULL';  // Handle missing Position (Longitude)
            // const Location = el?.Location?.[0] ?? 'NULL';  
            const Location = el?.Location?.[0]?.replace(/'/g, "''") ?? 'NULL';
            const translations = el?.Translations?.[0] ?? 'NULL';  // Handle missing Translations
            const contact = el?.Contact?.[0]?.Fax ? `'${el.Contact[0].Fax[0]}'` : (el?.Contact?.[0]?.Email ? `'${el.Contact[0].Email[0]}'` : 'NULL');
            const escapedHotelName = hotelname.replace(/'/g, "''");
            const escapedAddress = address.replace(/'/g, "''");
            const escapedTranslations = translations.replace(/'/g, "''");
            const escapedSearchable = searchable.replace(/'/g, "''"); 
            const escapedType = type.replace(/'/g, "''"); 
            const escapedGallery = gallery !== 'NULL' ? `'${gallery.replace(/'/g, "''")}'` : 'NULL';  
            const fileName = file
  
            return `(${city_id},${country_id},${id},'${escapedHotelName}','${escapedSearchable}',${stars},'${escapedType}','${escapedAddress}',${escapedGallery},${image},${Latitude},${Longitude},'${Location}','${escapedTranslations}',${contact},'${fileName}')`;
          }).join(",");
  
          const query = `INSERT INTO hoteldetails(city_id,country_id,id,hotelname,Searchable,stars,type,address,gallery_image,image,Latitude,Longitude,Location,translations,contact,file) VALUES ${values}`;
          const result = await this.manager.query(query);
        } 
      }
  
    } catch (error) {
      console.error("Error inserting Hotel Details:", error);
    }
  }

  async insertHotelXml(body: any) {
    try {
      const filepath = `/Users/adithya/Provab/capital-sky/CapitalSky-webservice/Hotels.xml`;
      const xmlData = fs.readFileSync(filepath, 'utf-8');
      const parser = new xml2js.Parser();
      const parsedData = await parser.parseStringPromise(xmlData);
  
      let Hotels = parsedData.HotelStaticData.Hotel;
  
      const values = Hotels.map((el: any) => {
        const id = el.$.ID ?? null;
        const city_id = el?.$?.CityID ?? null;
        const country_id = el?.$?.CountryID ?? null;
        const Latitude = el?.$?.Latitude ?? null;
        const Longitude = el?.$?.Longitude ?? null;
        const name = el.$.Name ?? '';
        const recommended = el?.$?.Recommended ?? '';
        const searchable = el.$.Searchable ?? ''; 
        const stars = el.$.Stars ?? null;
        const type = el.$.Type ?? '';
  
        const escapedName = name.replace(/'/g, "''");
        const escapedSearchable = searchable.replace(/'/g, "''"); 
        const escapedType = type.replace(/'/g, "''");
  
        return `(${id}, ${city_id}, ${country_id}, ${Latitude}, ${Longitude}, '${escapedName}', '${recommended}', '${escapedSearchable}', ${stars}, '${escapedType}')`;
      }).join(",");
  
      const query = `INSERT INTO hotels (id, city_id, country_id, Latitude, Longitude, name, recommended, Searchable, stars, type) VALUES ${values}`;
      const result = await this.manager.query(query);
  
      if (result) {
        console.log("Hotels inserted successfully");
      }
  
    } catch (error) {
      console.error("Error inserting hotels:", error);
    }
  }

  async insertLocationXml(body: any) {
    try {
      const filepath = `/Users/adithya/Provab/capital-sky/CapitalSky-webservice/Locations.xml`;
      const xmlData = fs.readFileSync(filepath, 'utf-8');
      const parser = new xml2js.Parser();
      const parsedData = await parser.parseStringPromise(xmlData);
  
      let Locations = parsedData.LocationStaticData.Location;
  
      const values = Locations.map((el: any) => {
        const id = el.$.ID ?? null;
        const city_id = el?.$?.CityID ?? null;
        const code = el?.$?.Code ?? null;
        const name = el.$.Name ?? '';
        const searchable = el.$.Searchable ?? ''; 
        const type = el.$.Type ?? '';
        const Latitude = el?.Position?.[0].$?.Latitude ?? "";
        const Longitude = el?.Position?.[0].$?.Longitude ?? "";
        const linkedCity = el?.LinkedCities?.[0] ?? "";
  
        const escapedName = name.replace(/'/g, "''");
        const escapedSearchable = searchable.replace(/'/g, "''"); 
        const escapedType = type.replace(/'/g, "''");
  
        return `(${id}, ${city_id}, ${code}, '${escapedName}', '${escapedSearchable}', '${escapedType}', '${linkedCity}', '${Latitude}', '${Longitude}')`;
      }).join(",");
  
      const query = `INSERT INTO hotellocation (id, city_id, code, name, Searchable, type, linkedCities, Latitude, Longitude) VALUES ${values}`;
      const result = await this.manager.query(query);
  
      if (result) {
        console.log("Hotels inserted successfully");
      }
  
    } catch (error) {
      console.error("Error inserting hotels:", error);
    }
  }

  async insertNationXml(body: any) {
    try {
      const filepath = `/Users/adithya/Provab/capital-sky/CapitalSky-webservice/Nationalities.xml`;
      const xmlData = fs.readFileSync(filepath, 'utf-8');
      const parser = new xml2js.Parser();
      const parsedData = await parser.parseStringPromise(xmlData);
  
      let Nationalities = parsedData.NationalityStaticData.Nationality;
  
      const values = Nationalities.map((el: any) => {
        const id = el?.$?.ID ?? null;
        const name = el?.$?.Name ??  "";
        const ISO = el?.$?.ISO ?? "";
  
        const escapedName = name.replace(/'/g, "''");
        const escapedISO = ISO.replace(/'/g, "''"); 
  
        return `(${id}, '${escapedName}', '${escapedISO}')`;
      }).join(",");
  
      const query = `INSERT INTO nationalities (id, name, ISO) VALUES ${values}`;
      const result = await this.manager.query(query);
  
      if (result) {
        console.log("Hotels inserted successfully");
      }
  
    } catch (error) {
      console.error("Error inserting hotels:", error);
    }
  }
  
}
