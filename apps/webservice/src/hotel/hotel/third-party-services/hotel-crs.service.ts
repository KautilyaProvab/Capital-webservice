import { BASE_CURRENCY, BOOKING_CONFIRMED } from "./../../../constants";
import { BOOKING_SOURCE_CRS, numberOfNights, price } from "../../../constants";
import { Injectable } from "@nestjs/common";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { CRS_HOTEL_BOOKING_SOURCE } from "apps/webservice/src/constants";
import {
  RoomDetail,
  SearchRequest,
  RoomDetailRoomWithResultIndex,
} from "../hotel-types/hotel.types";
import * as moment from "moment";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import {
  ExtendedHotelDetailedInfo,
  HotelDetailedInfo,
  HotelQueryResult,
  BusinessEmailType,
  cancelBookingHelper,
  BusinessEmailTypeRaw,
  HotelSearch,
  HotelDetailsRoomDetail,
  HotelInfoSearch,
  HotelDetailsResult,
  BlockRoom,
  HotelDetailsRoom,
  BlockRoomDetail,
} from "./hote-crs.types";
import { HotelCrsSearchService } from "./crs/search.service";
import { HotelCrsTransformerService } from "./hotel-crs-transformer.service";
import { DefaultMap, safeExecuteAsync } from "apps/webservice/src/app.helper";
// import { HotelCrsNotificationService } from './crs/notification.service';
import { safeExecute } from "../../../app.helper";
import { response } from "express";
import { ActivityDbService } from "apps/webservice/src/activity/activity/activity-db.service";
export interface BlockRoomRequest {
  ResultToken: string[];
  BlockRoomId: string[];
  booking_source: string;
}

export interface HotelDetailsRequest {
  ResultToken: string;
  booking_source: string;
}

@Injectable()
export class HoterlCrsService extends HotelApi {
  constructor(
    private hotelDbService: HotelDbService,
    private redisServerService: RedisServerService,
    private readonly searchService: HotelCrsSearchService,
    private readonly activityDbService: ActivityDbService,
    private readonly hotelCrsTransformerService: HotelCrsTransformerService // private readonly notificationService: HotelCrsNotificationService,
  ) {
    super();
  }

  async search(body: SearchRequest) {
    try {
      const result = await this.searchService.search(body);

      if (!result || result.length === 0) {
        return [];
      }

      const hotelInfo = await this.hotelCrsTransformerService.search(
        result,
        body
      );
      return hotelInfo;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async hotelsValuation(body: BlockRoomRequest): Promise<BlockRoom> {
    const result: BlockRoomDetail[] = [];
    let hotelInfo: HotelInfoSearch;
    let childrenPolicyDetails: any[];
    if (body.ResultToken.length > 0) {
      let resultRaw = await this.redisServerService.read_list(
        body.ResultToken[0]
      );
      const hotelRoom: HotelDetailsRoomDetail = JSON.parse(resultRaw[0]);
      hotelInfo = JSON.parse(
        await this.redisServerService.read_list(hotelRoom.AgencyToken)
      );

      childrenPolicyDetails = await this.manager.query(
        "SELECT * FROM children_policy_details WHERE hotel_code = ?",
        [hotelInfo.HotelCode]
      );
      console.log('childrenPolicyDetails:', childrenPolicyDetails);
    }

    for (let i = 0; i < body.BlockRoomId.length; i++) {
      const blockRoomRaw = await this.redisServerService.read_list(
        body.BlockRoomId[i]
      );
      const blockRoom: HotelDetailsRoom = JSON.parse(blockRoomRaw);

      result.push({
        ...blockRoom,
        cancellationPolicies: JSON.stringify(blockRoom.CancellationPolicies),
        code: "",
        Price: blockRoom.Price[0],
        NonRefundable: blockRoom.NonRefundable,
        RoomName: blockRoom.RoomName
      });
    }

    const finalResult = {
      ...hotelInfo,
      RoomDetails: result,
      HotelCategory: "",
      HotelPromotionContent: "",
      Refundable: result.every((item) => item.NonRefundable),
      Source: CRS_HOTEL_BOOKING_SOURCE,
      childrenPolicyDetails,
      ResultToken: "",
      HotelPolicy: [],
      HotelPicture: hotelInfo.HotelPicture || "",
      Latitude: hotelInfo.Latitude.toString(),
      Longitude: hotelInfo.Longitude.toString(),
      trip_rating: 0,
      NoOfReviews: 0,
      ReviewScore: 0,
      Price: {
        Amount: result
          .map((item) => +item.Price.Amount)
          .reduce((a, b) => a + b, 0),
        Currency: result?.[0]?.Price?.Currency || "USD",
        EligibleDiscount:
          result
            .map((item) => +item.Price.EligibleDiscount)
            .reduce((a, b) => a + b, 0) / result.length,
        Commission: 0,
        Markup: 0,
      },
    };

    delete finalResult.roomDetails;
    const token = this.redisServerService.geneateResultToken(finalResult);
    const response = await this.redisServerService.insert_record(
      token,
      JSON.stringify(finalResult)
    );
    finalResult.ResultToken = response.access_key;
    return finalResult;
  }

  async autoComplete(body: any): Promise<any> {
    const query1 = `
    SELECT DISTINCT
    CityCode as city_id,
    city_name,
    countryCode as country_code,
    country_name,
    "" as status,
    "${CRS_HOTEL_BOOKING_SOURCE}" as booking_source,
    "crs" as Source
    FROM city_list_dcb
    WHERE city_name LIKE('${body.city_name}%');
    `;
    const result = await this.manager.query(query1);
    return result.map((item: any) => this.getCityUniversal(item));
  }

  async getHotelDetails(body: HotelDetailsRequest): Promise<HotelDetailsResult> {
    let resultToken = body.ResultToken;
    let resultRaw = await this.redisServerService.read_list(resultToken);
    let searchHotelResponse: HotelInfoSearch = JSON.parse(resultRaw[0]);
    let roomDetails = new DefaultMap<number, HotelDetailsRoomDetail[]>(() => []);

    const images = await safeExecuteAsync(async () => {
      const result: { images: string; }[] = await this.manager.query(
        "SELECT images FROM contract_hotel_list_dcb WHERE HotelCode = ?",
        [searchHotelResponse.HotelCode]
      );
      return JSON.parse(result[0].images) as string[];
    }, []);

    const hotelTax = await this.manager.query(
      "SELECT * FROM tax_masters WHERE hotel_code = ? AND status = ?",
      [searchHotelResponse.HotelCode, 1]
    );

    console.log("hotelTaxData:", hotelTax);
    let hotelTaxPlusValue = 0;
    // calculate plus tax
    const plusTaxes = hotelTax.filter((tax) => tax.tax_type === "plus");

    let totalTaxPlusValue = plusTaxes.reduce((sum, tax) => {
      return sum + parseFloat(tax.tax_value);
    }, 0);
    console.log('totalTaxPlusValue', totalTaxPlusValue);
    // Apply currency conversion hotelTaxPlusValue
    if (totalTaxPlusValue > 0) {
      hotelTaxPlusValue = await this.getConversionRate(searchHotelResponse, totalTaxPlusValue, BASE_CURRENCY);
      hotelTaxPlusValue = parseFloat((hotelTaxPlusValue).toFixed(2));
      console.log("after cc hotelTaxPlusValue", hotelTaxPlusValue);
      hotelTaxPlusValue = hotelTaxPlusValue * searchHotelResponse.searchRequest.NoOfRooms;
    }

    for (let room of searchHotelResponse.roomDetails) {
      for (let i = 0; i < room.price.length; i++) {
        const roomDetailsCurrent: HotelDetailsRoomDetail = {
          AgencyToken: body.ResultToken,
          ResultIndex: "",
          RoomUniqueId: "",
          Rooms: await Promise.all(
            room.price[i].map(async (item) => {
              console.log({ 'room-item': item });

              let hotelCurrency = searchHotelResponse.HotelCurrencyCode;
              let conversionRate: any;
              let currencyData;
              if (hotelCurrency && hotelCurrency != BASE_CURRENCY) {
                currencyData = await this.activityDbService.formatPriceDetailToSelectedCurrency(hotelCurrency);
                conversionRate = currencyData['value'];
                item.total_price = item.total_price / conversionRate;
              }

              let Currency = searchHotelResponse.searchRequest.Currency;
              let Conversion_Rate = 1;
              let currencyDetails;
              if (Currency && Currency != BASE_CURRENCY) {
                currencyDetails = await this.activityDbService.formatPriceDetailToSelectedCurrency(Currency);
                Conversion_Rate = currencyDetails['value'];
              }

              let total_price = item.total_price * Conversion_Rate;
              console.log('after cc total_price', total_price);

              // adding hotel tax
              let hotelTaxCharge = 0;
              if (hotelTax && hotelTax.length) {
                // Separate percentage-based taxes
                const percentTaxes = hotelTax.filter((tax) => tax.tax_type === "percent");

                // Calculate the total tax value for percentage-based taxes
                const totalPercentTaxValue = percentTaxes.reduce((sum, tax) => {
                  return sum + parseFloat(tax.tax_value);
                }, 0);

                console.log("totalPercentTaxValue:", totalPercentTaxValue);

                // Calculate the tax charge based on percentage
                if (totalPercentTaxValue > 0) {
                  const percentTaxCharge = parseFloat(
                    ((total_price * totalPercentTaxValue) / 100).toFixed(2)
                  );
                  hotelTaxCharge += percentTaxCharge;
                  total_price += percentTaxCharge;

                  console.log("PercentTaxCharge:", percentTaxCharge);
                  console.log("taxTotalPrice:", total_price);
                }
              }

              let markup: any;
              if (searchHotelResponse.searchRequest['UserType']) {
                markup = await this.hotelDbService.getMarkup(searchHotelResponse.searchRequest);
              }
              console.log('markup:', JSON.stringify(markup));

              let markupDetails = await this.hotelDbService.markupDetails(markup, total_price);
              console.log('markupDetails', markupDetails);

              if (markupDetails && markupDetails.AdminMarkup) {
                total_price = total_price + markupDetails.AdminMarkup;
                console.log('markup total_price', total_price);
              }

              let basePrice = total_price;

              // Querying the children policy details
              let childrenPolicyDetails: any = await this.manager.query(
                "SELECT * FROM children_policy_details WHERE hotel_code = ?",
                [searchHotelResponse.HotelCode]
              );
              console.log('childrenPolicyDetails:', childrenPolicyDetails);

              let reqChildAge = item.guest.ChildAge && item.guest.ChildAge.length ? Number(item.guest.ChildAge[0]) : null;
              console.log('reqChildAge:', reqChildAge);

              let mealsAmount = 0;
              if (reqChildAge && reqChildAge >= 1 && childrenPolicyDetails &&
                childrenPolicyDetails.length && childrenPolicyDetails[0].status === 1) {
                console.log({ 'children policy amount adding to item price': total_price });
                childrenPolicyDetails = childrenPolicyDetails[0];

                // Accommodation charge logic
                if (childrenPolicyDetails.is_accommodation === 1 && reqChildAge >= childrenPolicyDetails.accom_children_from_age
                  && reqChildAge <= childrenPolicyDetails.accom_children_to_age && (childrenPolicyDetails.accommodation_charge
                    && childrenPolicyDetails.accommodation_charge > 0)) {
                  console.log("For child adding accommodation_charge:", childrenPolicyDetails.accommodation_charge);
                  // item.total_price += childrenPolicyDetails.accommodation_charge;
                }

                // Meal charge logic
                if (childrenPolicyDetails.is_meals === 1 && reqChildAge >= childrenPolicyDetails.meal_children_from_age
                  && reqChildAge <= childrenPolicyDetails.meal_children_to_age) {
                  let mealsPrice = 0;

                  let meal_prices = JSON.parse(childrenPolicyDetails.meal_prices);
                  meal_prices = meal_prices[0];
                  console.log('meal_prices:', meal_prices);

                  if (meal_prices.hasOwnProperty(item.meal_type)) {
                    mealsPrice += meal_prices[item.meal_type];
                    console.log('mealsPrice:', mealsPrice);
                  }

                  let discountValue = parseFloat(childrenPolicyDetails.discount_value);

                  // Apply discount if applicable
                  if (childrenPolicyDetails.discount_type === 'Amount' && !isNaN(discountValue) && mealsPrice > 0 && mealsPrice > discountValue && discountValue > 0) {
                    mealsPrice -= discountValue;
                  } else if (childrenPolicyDetails.discount_type === 'Percentage' && !isNaN(discountValue) && mealsPrice > 0 && discountValue > 0) {
                    mealsPrice -= mealsPrice * (discountValue / 100);
                  }

                  // Apply currency conversion
                  if (mealsPrice > 0) {
                    mealsPrice = await this.getConversionRate(searchHotelResponse, mealsPrice, BASE_CURRENCY);
                    mealsPrice = parseFloat((mealsPrice).toFixed(2));
                    console.log("For child adding meals_charge:", mealsPrice);
                  }
                  total_price += (mealsPrice);
                  mealsAmount = mealsPrice;
                }
              }

              let checkIn = searchHotelResponse.searchRequest.CheckIn;
              let checkOut = searchHotelResponse.searchRequest.CheckOut;

              let checkOutDate = new Date(checkOut);
              checkOutDate.setDate(checkOutDate.getDate() - 1);
              const updatedCheckOutDate = checkOutDate.toISOString().split('T')[0];
              console.log(checkIn, updatedCheckOutDate, 'e09y6y');
              const fetchedRoomData = await this.manager.query(
                "SELECT status, DATE_FORMAT(season_date, '%d-%m-%Y') as season_date, available_rooms, early_booking, duration_of_stay, rate_type, date_range_discount FROM supplier_room_price WHERE room_id = ? AND season_date BETWEEN ? AND ? AND meal_type = ? AND room_view = ? AND rate_type = ?",
                [room.origin, checkIn, updatedCheckOutDate, item.meal_type, item.room_view, item.rate_type]
              );

              console.log('fetchedRoomData:', fetchedRoomData);
              const roomWithStatusOne = fetchedRoomData.find(room => room.status === 1);

              let message = '';
              if (roomWithStatusOne) {
                console.log(`stop sale is enabled for this date: ${roomWithStatusOne.season_date}`);
                message = `stop sale is enabled for this date ${roomWithStatusOne.season_date}`;
              }

              const NoOfAvailableRooms = fetchedRoomData.find(room => room.available_rooms < searchHotelResponse.searchRequest.NoOfRooms);

              let available_rooms = '';
              if (NoOfAvailableRooms) {
                console.log(`No of available_rooms is: ${NoOfAvailableRooms.available_rooms} for this date: ${NoOfAvailableRooms.season_date}`);
                available_rooms = `No of available_rooms is: ${NoOfAvailableRooms.available_rooms} for this date: ${NoOfAvailableRooms.season_date}`;
              }

              let getEarlyAndDurationDetails = [{ 'earlyBooking': { "Amount": 0 }, 'durationOfStay': { "Amount": 0 } }];
              let dateRangeDiscount = item.adult_range_discount + item.child_range_discount;
              dateRangeDiscount = await this.getConversionRate(searchHotelResponse, dateRangeDiscount, BASE_CURRENCY);

              let earlyDiscount = item.adult_early_discount + item.child_early_discount;
              earlyDiscount = await this.getConversionRate(searchHotelResponse, earlyDiscount, BASE_CURRENCY);
              getEarlyAndDurationDetails[0].earlyBooking.Amount = parseFloat((earlyDiscount).toFixed(2));

              let durationDiscount = item.adult_duration_discount + item.child_duration_discount;
              durationDiscount = await this.getConversionRate(searchHotelResponse, durationDiscount, BASE_CURRENCY);
              getEarlyAndDurationDetails[0].durationOfStay.Amount = parseFloat((durationDiscount).toFixed(2));

              console.log('getEarlyAndDurationDetails:', getEarlyAndDurationDetails);

              // Adding cancellation Policies
              const cancellationPolicies = [];
              if (item.is_refundable) {
                // Ensure the cancellation_policy is a valid JSON string
                let policies = [];
                try {
                  policies = JSON.parse(item.cancellation_policy);
                } catch (error) {
                  console.log('Invalid cancellation policy data:', item.cancellation_policy);
                  policies = [];
                }

                if (policies.length > 0) {
                  for (let policy of policies) {
                    let hotelCurrency = searchHotelResponse.HotelCurrencyCode;
                    let conversionRate: any;
                    let currencyData;
                    let policyCharge = policy.charge;
                    if (hotelCurrency && hotelCurrency !== BASE_CURRENCY && policy.charge_type === 'Amount') {
                      currencyData = await this.activityDbService.formatPriceDetailToSelectedCurrency(hotelCurrency);
                      conversionRate = currencyData['value'];
                      policy.charge = policy.charge / Number(conversionRate);
                    }

                    let Currency = searchHotelResponse.searchRequest.Currency;
                    let Conversion_Rate = 1;
                    let currencyDetails;
                    if (Currency && Currency !== BASE_CURRENCY) {
                      currencyDetails = await this.activityDbService.formatPriceDetailToSelectedCurrency(Currency);
                      Conversion_Rate = currencyDetails['value'];
                    }

                    const checkInDate = new Date(searchHotelResponse.searchRequest.CheckIn);

                    const refundBeforeDays = parseInt(policy.date_from, 10);

                    const startDate = new Date(checkInDate);
                    startDate.setDate(startDate.getDate() - refundBeforeDays);

                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + refundBeforeDays);

                    let charge: any = policy.charge_type === 'Amount' ? parseFloat((policy.charge * Conversion_Rate).toFixed(2)) :
                      parseFloat(((total_price * policyCharge / 100)).toFixed(2));

                    cancellationPolicies.push({
                      cancellation_type: policy.cancellation_type,
                      date_from: startDate.toISOString().split('T')[0],
                      date_to: endDate.toISOString().split('T')[0],
                      charge: charge,
                      currency: searchHotelResponse.searchRequest.Currency,
                      charge_type: policy.charge_type,
                      additional_info: policy.additional_info,
                      refund_before_days: refundBeforeDays,
                    });
                  }
                }
              }

              let basePriceDiscount = 0;
              basePriceDiscount += item.adult_range_discount + item.child_range_discount + item.adult_early_discount + item.child_early_discount + item.adult_duration_discount + item.child_duration_discount;
              basePriceDiscount = await this.getConversionRate(searchHotelResponse, basePriceDiscount, BASE_CURRENCY);
              basePrice = basePrice + basePriceDiscount;
              basePrice = parseFloat((basePrice).toFixed(2));

              const roomImages = await this.manager.query(`SELECT * from hotel_room_images where hotel_room_id=?`,[room.origin]);
              
              // room details
              const current_room = {
                Index: "",
                Price: [
                  {
                    FromDate: searchHotelResponse.searchRequest.CheckIn,
                    ToDate: searchHotelResponse.searchRequest.CheckOut,
                    Amount: (total_price).toFixed(2),
                    hotelTaxCharge: hotelTaxCharge,
                    Currency: searchHotelResponse.searchRequest.Currency,
                    EligibleDiscount: item.eligible_discount,
                    Markup: 0,
                  },
                ],
                Id: room.origin.toString(),
                Description: `${item.room_view} - ${item.meal_type}`,
                RoomType: room.type,
                RoomName: room.name,
                NonRefundable: !item.is_refundable,
                MealPlanCode: item.meal_type,
                Occupancy: room.occu,
                CancellationPolicies: {
                  $t: cancellationPolicies,
                },
                paxCount: "",
                AdultCount: item.guest.NoOfAdults,
                ChildrenCount: item.guest.NoOfChild,
                Rooms: item.room_id,
                Supplements: [],
                Message: message,
                AvailableRooms: available_rooms,
                mealsAmount: mealsAmount,
                getEarlyAndDurationDetails,
                dateRangeDiscount: parseFloat((dateRangeDiscount).toFixed(2)),
                markupDetails,
                basePrice,
                hotelTaxPlusValue,
                roomImages,
              };
              const token = this.redisServerService.geneateResultToken(current_room);
              const response = await this.redisServerService.insert_record(token, JSON.stringify(current_room));
              current_room.Index = response.access_key;
              return current_room;
            })
          ),
        };

        console.log('roomDetailsCurrent.Rooms', roomDetailsCurrent.Rooms);

        function removeDuplicateRooms(rooms) {
          const uniqueRooms = new Map();

          // Iterate over rooms and remove duplicates
          rooms.forEach(room => {
            const key = `${room.Price[0].Amount}-${room.Id}-${room.Description}`;

            if (!uniqueRooms.has(key)) {
              uniqueRooms.set(key, room);
            } else {
              const existingRoom = uniqueRooms.get(key);

              // Replace existing room with a refundable one if the current room is non-refundable
              if (existingRoom.NonRefundable === true && room.NonRefundable === false) {
                uniqueRooms.set(key, room);
              }
            }
          });

          // Convert map to an array
          let uniqueRoomsArray = Array.from(uniqueRooms.values());

          // Sort the rooms by Amount (min to max)
          uniqueRoomsArray.sort((a, b) => {
            const amountA = parseFloat(a.Price[0].Amount);
            const amountB = parseFloat(b.Price[0].Amount);

            return amountA - amountB;
          });

          // Step 1: Create a new array for the result
          let result = [];

          // Step 2: Keep track of seen descriptions
          let seenDescriptions = new Set();

          // Step 3: Iterate through the original array and add items based on the description
          uniqueRoomsArray.forEach(obj => {
            if (!seenDescriptions.has(obj.Description)) {
              seenDescriptions.add(obj.Description);
              // Push all objects with the same description
              uniqueRoomsArray.forEach(innerObj => {
                if (innerObj.Description === obj.Description) {
                  result.push(innerObj);
                }
              });
            }
          });

          return result;
        }

        const uniqueRooms = removeDuplicateRooms(roomDetailsCurrent.Rooms);
        roomDetailsCurrent.Rooms = uniqueRooms;

        const token = this.redisServerService.geneateResultToken(roomDetailsCurrent);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(roomDetailsCurrent));
        roomDetailsCurrent.ResultIndex = response.access_key;
        roomDetails.get(i + 1).push(roomDetailsCurrent);
      }
    }

    const RoomDetails: HotelDetailsRoomDetail[][] = [];
    if (roomDetails.size > 0) {
      roomDetails.forEach((details) => {
        RoomDetails.push(details);
      });
    }

    delete searchHotelResponse.roomDetails;
    const details = {
      ...searchHotelResponse,
      RoomDetails: RoomDetails,
      HotelCategory: "",
      HotelPromotionContent: "",
      Refundable: "",
      Source: CRS_HOTEL_BOOKING_SOURCE,
      HotelPicture: images,
      HotelPolicy: [searchHotelResponse.HotelPolicy],
      Price: {
        Amount: searchHotelResponse.Price.Amount,
        Currency: searchHotelResponse.Price.Currency,
        Commission: "0",
      },
      Latitude: searchHotelResponse.Latitude.toString(),
      Longitude: searchHotelResponse.Longitude.toString(),
      HotelLocation: {
        Latitude: searchHotelResponse.Latitude.toString(),
        Longitude: searchHotelResponse.Longitude.toString(),
      },
      hotelTaxData: hotelTax,
    };
    const token = this.redisServerService.geneateResultToken(details);
    const response = await this.redisServerService.insert_record(token, JSON.stringify(details));
    details.ResultIndex = response.access_key;
    return details;
  }

  // async search2(body: SearchRequest): Promise<any> {
  //   // try {
  //     // body.id
  //     let results: HotelQueryResult[] = await this.searchService.searchDB(body);

  //     const number_of_nights = numberOfNights(body.CheckIn, body.CheckOut);
  //     if (results.length === 0) {
  //       throw new Error("400 No data in db");
  //     }
  //     if (number_of_nights <= 0) {
  //       throw new Error("400 CheckIn and CheckOut date cannot be same");
  //     }
  //     // console.log(`Found ${results.length} hotels in the city ${body.CityIds}`);
  //     const roomResultData = await this.searchService.roomDetailsBuilder2({
  //       HotelQueryRequest: results,
  //       searchRequest: body,
  //     });

  //     const processedHotels = new Set<string>();
  //     const searchResultPromises: Promise<HotelInfo>[] = results.map(
  //       (result: HotelQueryResult) => {
  //         return this.searchService.hotelInfoBuilder(
  //           roomResultData.get(result.HotelCode),
  //           result,
  //           number_of_nights,
  //           body
  //         );
  //       }
  //     );
  //     const searchResult: HotelInfo[] = await Promise.all(searchResultPromises);
  //     const filteredSearchResult = searchResult.filter((hotel) => {
  //       if (processedHotels.has(hotel.HotelCode)) {
  //         return false;
  //       }
  //       processedHotels.add(hotel.HotelCode);
  //       return true;
  //     });
  //     console.log(
  //       `Found ${filteredSearchResult.length} hotels in the city ${body.CityIds}`
  //     );
  //     return this.searchService.sortHotelInfo(filteredSearchResult);
  //   // } catch (error) {
  //   //   const errorClass: any = getExceptionClassByCode(error.message);
  //   //   throw new errorClass(error.message);
  //   // }
  // }

  // async getHotelDetails2(body: any) {
  //   let resultToken = body.ResultToken;
  //   let resultRaw = await this.redisServerService.read_list(resultToken);
  //   let searchHotelResponse: {
  //     result: HotelQueryResult;
  //     searchRequest: SearchRequest;
  //     roomResultData:RoomDetail[][]
  //   } = JSON.parse(resultRaw[0]);

  //    const info = await this.searchService.hotelInfoBuilder(
  //     this.searchService.restructureRoomDetails(searchHotelResponse.roomResultData),
  //     searchHotelResponse.result,
  //     numberOfNights(
  //       searchHotelResponse.searchRequest.CheckIn,
  //       searchHotelResponse.searchRequest.CheckOut
  //     ),
  //     searchHotelResponse.searchRequest,
  //     true
  //   );

  //   const newData: HotelDetailedInfo = {
  //     ...info,
  //     Source: BOOKING_SOURCE_CRS,
  //   };
  //   return newData;
  // }

  async cancelBooking(
    req: {
      user: {
        first_name: string;
        last_name: string;
        id: number;
        created_by_id: number;
      };
    },
    body: {
      cancellationRemarks: string;
      AppReference: string;
    }
  ): Promise<any> {
    let result1 = [];
    const corporate_origin_query = await this.manager.query(
      `SELECT corporate_origin FROM hotel_hotel_booking_details WHERE app_reference = ?`,
      [body.AppReference]
    );
    const corporate_origin =
      corporate_origin_query?.[0]?.corporate_origin || 243;
    try {
      if (corporate_origin === 470) {
        result1 = await this.manager.query(
          `
      SELECT
        hhbd.hotel_name,
        aprov.email as ManagerRemoteEmployeeId,
        hhbd.booking_type as BookingType,
        hhbd.email,
        hhbd.corporate_origin,
        hhbd.booking_reference as request_id,
        CONCAT(au.first_name, ' ', au.last_name) AS name
      FROM
        hotel_hotel_booking_details hhbd
      LEFT JOIN
        auth_users au ON hhbd.created_by_id = au.id
      LEFT JOIN
        auth_users aprov ON au.approvar_id = aprov.id
      WHERE
        hhbd.app_reference = ?
        `,
          [body.AppReference]
        );
      } else {
        result1 = await this.manager.query(`
         SELECT
           hhbd.hotel_name,
           ipr.ManagerRemoteEmployeeId,
           ipr.BookingType,
           hhbd.email,
           hhbd.corporate_origin,
           hhbd.booking_reference as request_id,
           CONCAT(au.first_name, ' ', au.last_name) AS name
         FROM
           hotel_hotel_booking_details hhbd
         LEFT JOIN
           auth_users au ON hhbd.created_by_id = au.id
         LEFT JOIN
           icic_pending_request ipr ON ipr.app_reference = hhbd.booking_reference AND ipr.ProductType = 'Hotel' AND au.email = ipr.Email
         WHERE
           hhbd.app_reference = '${body.AppReference}'
       `);
      }

      if (result1.length === 0) {
        throw new Error("400 No Booking found");
      }

      const hotel_booking: cancelBookingHelper = result1[0];
      // if(hotel_booking.BookingType){
      //   const data = this.manager.query(``)
      // }
      await this.cancelBookingRequest({
        ...body,
        cancel_requested_by_id: req.user?.id,
      });
      await this.cancelBookingItinearyRequest(body);
      await this.cancelBookingPaxRequest(body);
      // await this.notificationService.sendCancellationEmail(req, body, hotel_booking);
      return true;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async cancelBookingRequest(body: {
    cancellationRemarks: any;
    AppReference: any;
    cancel_requested_by_id: number;
  }) {
    return this.cancelRequest(
      "hotelHotelBookingDetails",
      body.AppReference,
      "updateHotelHotelBookingDetail",
      body.cancellationRemarks,
      body.cancel_requested_by_id
    );
  }

  async cancelBookingPaxRequest(body: { AppReference: string }) {
    return this.cancelRequest(
      "hotelHotelBookingPaxDetails",
      body.AppReference,
      "updateHotelHotelBookingPaxDetail"
    );
  }

  private async findId(
    entity_name: string,
    app_reference: string
  ): Promise<number[]> {
    const ids_result = await this.getGraphData(
      `query {
            ${entity_name} (
                where: {
                    app_reference: {
                        eq: "${app_reference}"
                    }
                }
            ) {
                id
            }
        }
        `,
      entity_name
    );
    if (ids_result.length === 0) {
      const errorClass: any = getExceptionClassByCode("400");
      throw new errorClass("400 No Booking found");
    }
    return ids_result.map((item: { id: number }) => item.id);
  }

  private async cancelBookingItinearyRequest(body: { AppReference: string }) {
    return this.cancelRequest(
      "hotelHotelBookingItineraryDetails",
      body.AppReference,
      "updateHotelHotelBookingItineraryDetail"
    );
  }

  private async cancelRequest(
    entityName: string,
    appReference: string,
    updateMethodName: string,
    cancellationRemarks?: string,
    cancel_requested_by_id?: number
  ) {
    const entityIds = await this.findId(entityName, appReference);
    const cancelPromises = entityIds.map(async (entityId) => {
      const result = await this.getGraphData(
        `
        mutation {
          ${updateMethodName}(
            id: ${entityId}
            ${entityName.slice(0, -1)}Partial: {
              status: "CANCELLATION_PENDING"
              ${
                updateMethodName === "updateHotelHotelBookingDetail"
                  ? `cancellation_ts: "${moment().format(
                      "YYYY-MM-DD HH:mm:ss"
                    )}"`
                  : ""
              }
              ${
                updateMethodName === "updateHotelHotelBookingDetail"
                  ? `employee_cancellation_remark: "${cancellationRemarks}"`
                  : ""
              }
            ${
              updateMethodName === "updateHotelHotelBookingDetail"
                ? `cancel_requested_by_id: ${cancel_requested_by_id}`
                : ""
            }
            }
          )
        }
      `,
        updateMethodName
      );
      return result;
    });
    const cancelResults = await Promise.all(cancelPromises);
    return cancelResults;
  }

  updateHotelBookingDetailsCrs(): any {
    throw new Error("Method not implemented.");
  }

  async hotelsReservation(body: any): Promise<any> {
    const bookingDetails = (
      await this.hotelDbService.getHotelBookingDetails(body)
    )[0];
    bookingDetails["created_datetime"] = moment(
      parseInt(bookingDetails.created_datetime)
    ).format("YYYY-MM-DD HH:mm:ss");

    bookingDetails.hotel_check_in = await this.hotelDbService.convertTimestampToISOString(bookingDetails.hotel_check_in);
    bookingDetails.hotel_check_out = await this.hotelDbService.convertTimestampToISOString(bookingDetails.hotel_check_out);

    let checkOutDate = new Date(bookingDetails.hotel_check_out);
    checkOutDate.setDate(checkOutDate.getDate() - 1);

    const updatedCheckOutDate = checkOutDate.toISOString().split('T')[0];
    console.log('updatedCheckOutDate:', updatedCheckOutDate);

    const bookingPaxDetails = await this.hotelDbService.getHotelBookingPaxDetails(
      body
    );
    const bookingItineraryDetails = await this.hotelDbService.getHotelBookingItineraryDetails(
      body
    );
    body;

    console.log(bookingItineraryDetails);
    // const room_details = [];

    await this.manager.query("START TRANSACTION;");
    bookingItineraryDetails.forEach(async (element) => {
      let buffer = Buffer.from(element.attributes, "base64").toString("utf-8");
      let attributes = JSON.parse(buffer);
      const d = {
        room_id: attributes.Id as number,
        room_view: (attributes.Description.split("-")[0] as string).trim(),
        meal_type: (attributes.Description.split("-")[1] as string).trim(),
      };
      await this.manager.query(
        `
        UPDATE supplier_room_price
        SET available_rooms = available_rooms - ${bookingItineraryDetails.length},
        booked_rooms = booked_rooms + ${bookingItineraryDetails.length}
        WHERE room_id = ?
        AND room_view = ?
        AND meal_type = ?
        AND season_date BETWEEN ? AND ?
        `,
        [
          d.room_id,
          d.room_view,
          d.meal_type,
          bookingDetails.hotel_check_in,
          updatedCheckOutDate,
        ]
      );

      // Check and update `status` if `available_rooms` is 0
      await this.manager.query(
        `
      UPDATE supplier_room_price
      SET status = 1
      WHERE available_rooms = 0
      AND room_id = ?
      AND room_view = ?
      AND meal_type = ?
      AND season_date BETWEEN ? AND ?
      `,
        [
          d.room_id,
          d.room_view,
          d.meal_type,
          bookingDetails.hotel_check_in,
          updatedCheckOutDate,
        ]
      );
    });
    // generate random 20 Alphanumeric characters
    const confirmation_reference = Math.random()
      .toString(36)
      .substring(2, 22);
    await this.manager.query(
      "UPDATE hotel_hotel_booking_details SET status = ?, confirmation_reference = ? WHERE app_reference = ?",
      ["BOOKING_CONFIRMED", confirmation_reference, body.AppReference]
    );
    await this.manager.query("COMMIT;");

    const bookingDetails2 = (
      await this.hotelDbService.getHotelBookingDetails(body)
    )[0];

    const result = this.getHotelBookingPaxDetailsUniversal(
      body,
      bookingPaxDetails,
      bookingDetails2,
      bookingItineraryDetails
    );
    return result;
  }

  async hotelsCancellation(body: any): Promise<any> {
    try {
      console.log('body:', body);

      let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
      let response = await this.hotelDbService.updateHotelCancelDetails(bookingDetails[0], body);

      bookingDetails = bookingDetails[0];
      bookingDetails.hotel_check_in = await this.hotelDbService.convertTimestampToISOString(bookingDetails.hotel_check_in);
      bookingDetails.hotel_check_out = await this.hotelDbService.convertTimestampToISOString(bookingDetails.hotel_check_out);

      let checkOutDate = new Date(bookingDetails.hotel_check_out);
      checkOutDate.setDate(checkOutDate.getDate() - 1);
      const updatedCheckOutDate = checkOutDate.toISOString().split('T')[0];
      console.log('updatedCheckOutDate:', updatedCheckOutDate);

      const bookingItineraryDetails = await this.hotelDbService.getHotelBookingItineraryDetails(body);

      // Start a transaction
      await this.manager.query("START TRANSACTION;");

      for (const element of bookingItineraryDetails) {
        let buffer = Buffer.from(element.attributes, "base64").toString("utf-8");
        let attributes = JSON.parse(buffer);

        const d = {
          room_id: attributes.Id as number,
          room_view: (attributes.Description.split("-")[0] as string).trim(),
          meal_type: (attributes.Description.split("-")[1] as string).trim(),
        };

        // Wait for the update query to complete before moving to the next iteration
        await this.manager.query(
          `
            UPDATE supplier_room_price
            SET available_rooms = available_rooms + ${bookingItineraryDetails.length},
            booked_rooms = booked_rooms - ${bookingItineraryDetails.length},
            status = 0
            WHERE room_id = ?
            AND room_view = ?
            AND meal_type = ?
            AND season_date BETWEEN ? AND ?
          `,
          [
            d.room_id,
            d.room_view,
            d.meal_type,
            bookingDetails.hotel_check_in,
            updatedCheckOutDate,
          ]
        );
      }

      await this.manager.query("COMMIT;");
      if (response) {
        console.log('response is coming');
      }

      return response;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      await this.manager.query("ROLLBACK;");
      throw new errorClass(error.message);
    }
  }
  
  async getConversionRate(searchHotelResponse: any, price: any, BASE_CURRENCY: string): Promise<number> {
    let hotelCurrency = searchHotelResponse.HotelCurrencyCode;
    let conversionRate: number;
    let currencyData;
  
    // Check if the hotel's currency is not the same as the base currency
    if (hotelCurrency && hotelCurrency !== BASE_CURRENCY) {
      // Get the conversion rate for the hotel's currency
      currencyData = await this.activityDbService.formatPriceDetailToSelectedCurrency(hotelCurrency);
      conversionRate = currencyData['value'];
      // Adjust the total price for the hotel currency
      price = price / conversionRate;
    }
  
    let Currency = searchHotelResponse.searchRequest.Currency;
    let Conversion_Rate = 1; // Default conversion rate if no conversion is needed
    let currencyDetails;
  
    // Check if the search request currency is not the same as the base currency
    if (Currency && Currency !== BASE_CURRENCY) {
      // Get the conversion rate for the selected currency
      currencyDetails = await this.activityDbService.formatPriceDetailToSelectedCurrency(Currency);
      Conversion_Rate = currencyDetails['value'];
    }
  
    price = price * Conversion_Rate;
    // Return the conversion rate based on the search currency
    return price;
  }  

}
