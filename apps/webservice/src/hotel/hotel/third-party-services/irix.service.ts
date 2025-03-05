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
        return formattedResult;
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

  async getHotelDetails(body){
    try {
        let BackData = await this.redisServerService.read_list(body.ResultToken);
        BackData = JSON.parse(BackData);
        let token = BackData.data["ResultToken"];
        let data = BackData.data;
        let paxCount = Object.values(data.searchRequest.RoomGuests);
        let updatedData = paxCount.map((item: any) => {
            item.paxCount = item.NoOfAdults + item.NoOfChild;
            return item;
          });
    
          let totalPaxCount = updatedData.reduce(
            (total, item) => total + item.paxCount,
            0
          );
          let totalAdultCount = updatedData.reduce(
            (total, item) => total + item.NoOfAdults,
            0
          );
          let totalChildCount = updatedData.reduce(
            (total, item) => total + item.NoOfChild,
            0
          );
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
          let roomsResponse: any;
          for (let i = 0; i < data.searchRequest.NoOfRooms; i++) {
            // Initialize RoomPush for each room index
            let RoomPush = [];
    
          // Loop through all the offers
          for (let j = 0; j < offers.length; j++) {
            const offer = offers[j];
            let offerId = offer.id;
    
            let RoomPush = [];
            let redisRmpsh = [];
    
            // Loop through all packages in the current offer
            for (let index = 0; index < offer.packages.length; index++) {
              let packages = offer.packages[index];
              let packageCode = packages.packageCode;
              let packageToken = packages.packageToken;
              let rmCode = [];
              let rmToken = [];
              let rmPrice = 0;
              let currency = "";
              let rmName = [];
              let rmDescription = [];
              let rmBoard = [];
              let rmRefund = [];
              for (let i = 0; i < data.searchRequest.NoOfRooms; i++) {
                let packageRoom = packages.packageRooms[i]; // Get room data for the specific room index
    
                // Loop through all room references in the package
                for (const packRoom of packageRoom.roomReferences) {
                  let room = packRoom;
    
                  if (room?.selected === true) {
                    // Generate unique UID for each room (moved here to ensure unique UID for each room)
                    // let UID = await this.redisServerService.uniqueId(
                    //   packageCode,
                    //   packageCode
                    // );
    
                    // Generate room-specific data
                    let roomCode = room.roomCode;
                    let roomtoken = room.roomToken;
                    let RoomData = offers[j].rooms[room.roomCode];
                    let rmname = RoomData.name;
    
                    rmPrice += RoomData?.price.selling.value;
                    currency = RoomData?.price.selling.currency;
    
                    let NonRefundable =
                      RoomData?.nonRefundable == false ? false : true;
    
                    const roomsUrl = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${offerId}/rooms/${RoomData.index}?token=${BackData.api_token}`;
                    roomsResponse = await this.httpService
                      .get(roomsUrl, { headers })
                      .toPromise();
    
                    // Generate unique result token for this specific room's reference
    
                    rmCode.push(roomCode);
                    rmToken.push(roomtoken);
                    rmName.push(rmname);
                    rmDescription.push(RoomData.info);
                    rmBoard.push(RoomData.boardBasis);
                    rmRefund.push(NonRefundable);
                    // Push this room data into RoomPush array for the specific room index (i)
                  }
                }
              }
              let rkey = await this.redisServerService.geneateResultToken(body);
              let rRedis = {
                roomCode: rmCode,
                roomToken: rmToken,
              };
    
              
              // Define room data for this specific room
              let roomsData = {
              
                PackageCode: packageCode,
                PackageToken: packageToken,
                roomCode: rmCode,
                roomToken: rmToken,
                Price: {
                  FromDate: data.searchRequest.CheckIn,
                  ToDate: data.searchRequest.CheckOut,
                  Amount: rmPrice,
                  hotelTaxCharge: 0,
                  Currency: currency,
                  EligibleDiscount: 0,
                  Markup: 0,
                },
                Id: offerId,
                Description: rmDescription,
                RoomType: rmBoard,
                RoomName: rmName,
                NonRefundable: rmRefund,
                // NonRefundStatus: RoomData?.nonRefundable ?? "",
                // MealPlanCode: RoomData?.boardBasis ?? "",
                Occupancy: totalPaxCount ?? 0,
                CancellationPolicies: {},
                PaxCount: totalPaxCount
                  ? `${data.searchRequest.NoOfRooms}~${totalAdultCount}~${totalChildCount}`
                  : 0,
                AdultCount: totalAdultCount ?? 0,
                ChildrenCount: totalChildCount ?? 0,
                Rooms: data.searchRequest.NoOfRooms ?? 0,
                Supplements: [],
                Message: "",
                AvailableRooms: "",
                mealsAmount: "",
                basePrice: rmPrice,
                hotelTaxPlusValue: 0,
                roomImages: roomsResponse?.images ?? [],
                hotelTax: [],
                hotelAmenities: [roomsResponse?.facilitiesDescription] ?? [],
              };
    
              let rkeyResponse = await this.redisServerService.insert_record(
                rkey,
                JSON.stringify(roomsData)
              );
    
              let roomsDaata = {
                Index: rkeyResponse["access_key"] ?? "",
                ...roomsData
              }

              // Save result for this specific room and package
              delete roomsDaata.PackageCode;
              delete roomsDaata.PackageToken;
              delete roomsDaata.roomCode;
              delete roomsDaata.roomToken;
    
              RoomPush.push(roomsDaata);
            }
    
            let resultIndRedis = {
              offerId: offerId,
              RoomData: RoomPush,
            };
    
            // Generate unique result index token for this specific package and offer
            let resultInd = await this.redisServerService.geneateResultToken(body);
    
            let resultResponse = await this.redisServerService.insert_record(
              resultInd,
              JSON.stringify(resultIndRedis)
            );
    
            // Structure for storing room details
            Rooms = {
              AgencyToken: "",
              // ResultIndex: resultResponse["access_key"],
              RoomUniqueId: UID, // Each room gets its own unique UID
              Rooms: RoomPush,
            };
    
            let Roomdata = this.forceObjectToArray(Rooms)
            roomDetails.push(Roomdata);
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
          let minPrice = offers[0].minPrice
          let Data = {
            HotelName: response.name,
            HotelCategoty: response.stars,
            StarRating: response.stars,
            HotelAddress: response.address,
            MainImage: response?.mainImage?.url ?? "",
            HotelImage: [response?.mainImage?.url] ?? [],
            HotelDescription: response?.shortDescription ?? "",
            Price:{
              Amount:minPrice.value,
              Currency:minPrice.currency,
            },
            HotelPromotion: "",
            HotelPolicy: [],
            RoomDetails: roomDetails,
            HotelContactNo: response?.telephone ?? "N/A",
            Latitude: response?.geolocation?.latitude ?? "",
            Longitude: response?.geolocation?.longitude ?? "",
            Breakfast: "",
            HotelLocation: response?.city?.name ?? "",
            SuppliersPrice: "",
            searchRequest : BackData.data.searchRequest ?? ""
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
        }
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
      RoomData = await this.redisServerService.read_list(
        body.RoomResultToken
      );
      RoomData = JSON.parse(RoomData);

      let request = {
        packageToken: RoomData.PackageToken,
        roomTokens: RoomData.roomToken,
      };
      const availability = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${RoomData.Id}/availability?token=${BackData.api_token}`;
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

      delete RoomData.PackageCode;
      delete RoomData.PackageToken;
      delete RoomData.roomCode;
      delete RoomData.roomToken;

      let RoomsData = {
        Index:body.RoomResultToken,
        ...RoomData
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
        Price: BackData?.data?.Price ?? "",
        HotelPicture: [],
        HotelContactNo: BackData?.data?.PhoneNumber ?? "",
        HotelMap: "",
        Latitude: HotelData?.Latitude ?? "",
        Longitude: HotelData?.Longitude ?? "",
        Breakfast: "",
        HotelLocation: HotelData?.HotelLocation ?? "",
        RoomDetails: [RoomsData],
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
        Refundable: RoomsData.NonRefundable[0],
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

    let passengerData = pax;

    let payment = "";
    let provider = "";
    let paymentToken = "";
    let paymentId: any;
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
          successUrl: "http://www.example.com/success",
          failureUrl: "http://www.example.com/failure",
          notificationUrl: "http://www.example.com/notification",
        },
      };
      const payment_url = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${offerId}/payment?token=${BackData.api_token}`;

      const response: any = await this.httpService
        .post(payment_url, request, { headers })
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
    } else if(ApiData.paymentMethods.prepaid){
      payment = ApiData.paymentMethods.prepaid.code
    }
    else {
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
            birthdate:paxData.date_of_birth,
            address: paxData["address"],
            country: paxData["country"],
            city: paxData["city"],
            postalCode: paxData["postal_code"],
          };

          paxArr.push(travelDetails); 
          k++; 
        }
      }

      Pax[j] = {
        packageRoomToken: roomToken[j], 
        travelers: paxArr,
      };
    }
    let paymentMethod
    if (payment === "paynow"){
      paymentMethod = {
        order : {
          id : paymentId,
          token : paymentToken
        }
      }
    }

    const reservation_url = `${IXRIX_URL}search/results/${BackData.srk}/hotels/${BackData.data.HotelCode}/offers/${offerId}/book?token=${BackData.api_token}`;
    let request = {
      availabilityToken: ApiData.availabilityToken,
      clientRef: booking[0].app_reference,
      bookingOptions: ApiData.bookingOptions,
      rooms: Pax,
      payment: {
        method: payment,
        ...paymentMethod
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
      let ApiResponse = {};
      if (response.status == "OK") {
        ApiResponse = {
          BookingStatus: "BOOKING_CONFIRMED",
          reference: response.reference.external,
          totalSellingRate: response?.price?.selling?.value ?? "",
          currency: response?.price?.selling?.currency ?? "",
        };
      } else {
        ApiResponse = {
          BookingStatus: "BOOKING_FAILED",
          ClientReference: "",
          totalSellingRate: response?.price?.selling?.value ?? 0,
          currency: response?.price?.selling?.currency ?? "USD",
        };
      }
      return this.IRIXTransformService.updateData(
        ApiResponse,
        body,
        booking,
        passengerData,
        room
      );
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
  
}