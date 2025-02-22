import { Injectable } from "@nestjs/common";
import {
  BASE_CURRENCY,
  CRS_HOTEL_BOOKING_SOURCE,
  numberOfNights,
} from "apps/webservice/src/constants";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { getConnection } from "typeorm";
import { HotelApi } from "../../../hotel.api";
import {
  RoomDetail,
  SearchRequest,
  RoomPrice,
  RoomDetailRoomWithResultIndex,
} from "../../hotel-types/hotel.types";
import {
  HotelDB,
  RoomDB,
  RoomPricing,
  BookingDiscount,
  ModifiedRoomPricing,
  GroupedData,
  HotelSearch,
} from "../hote-crs.types";
import * as moment from "moment";
import { duration, DefaultMap } from "../../../../app.helper";
import { ReducedGroupedData, SimplePrice, RoomSearch } from "../hote-crs.types";
import { price } from "../../../../constants";
import { ActivityDbService } from "apps/webservice/src/activity/activity/activity-db.service";
import { HotelDbService } from "../../hotel-db.service";

@Injectable()
export class HotelCrsSearchService extends HotelApi {
  constructor(private redisServerService: RedisServerService,
    private readonly activityDbService: ActivityDbService,
    private readonly hotelDbService: HotelDbService
  ) {
    super();
  }

  /**
   * Executes a function and returns its result. If an error occurs during execution, it returns a default value.
   *
   * @template T - The type of the result.
   * @param {() => T} fn - The function to execute.
   * @param {T} defaultValue - The default value to return if an error occurs.
   * @returns {T} - The result of the function or the default value.
   */
  preventError<T>(fn: () => T, defaultValue: T): T {
    try {
      let res = fn();
      return res || defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }
  async search(request: SearchRequest): Promise<HotelSearch[]> {
    const hotels: HotelDB[] = await this.manager
      .createQueryBuilder()
      .distinct()
      .select("chld.*")
      .from("contract_hotel_list_dcb", "chld")
      .innerJoin(
        "supplier_room_details",
        "srd",
        "srd.HotelCode = chld.HotelCode"
      )
      .innerJoin("supplier_room_price", "srpv", "srpv.room_id = srd.origin")
      .where("chld.CityCode IN (:...cityCodes)", { cityCodes: request.CityIds })
      .andWhere("srpv.season_date BETWEEN :startDate AND :endDate", {
        startDate: request.CheckIn,
        endDate: request.CheckOut,
      })
      .andWhere(
        `(chld.contract_expiry IS NULL OR chld.contract_expiry >= :checkOut)`,
        { checkOut: request.CheckOut }
      )
      .andWhere("srpv.available_rooms >= :NoOfRooms", { NoOfRooms: request.NoOfRooms })
      .andWhere("chld.hotel_status = 1")
      .andWhere("srd.room_status = 1")
      .getRawMany();

    if (hotels.length === 0) {
      return [];
    }

    let hotelCodes = hotels.map(hotel => {
      return hotel.HotelCode;
    });
    console.log('hotelCodes:', hotelCodes);

    const hotelTaxDetails = await this.manager.query(
      "SELECT * FROM tax_masters WHERE hotel_code IN (?) AND status = ? AND tax_type = ?",
      [hotelCodes, 1, 'percent']
    );
    console.log('hotelTaxDetails:', hotelTaxDetails);

    const roomData = await this.getRooms(hotels, request);

    const hotelsResult: any = await Promise.all(hotels
      .map(async (hotel) => {
        const hotelRooms: any = roomData.filter(
          (room) => room.HotelCode === hotel.HotelCode
        );
        let minimum_price = Math.min(
          ...hotelRooms.map((t) => t.price_per_night_minimum)
        );
        console.log('minimum_price:', minimum_price);
        // console.log(
        //   hotelRooms.map((t) => t.price_per_night_minimum).join("\n")
        // );
        if (!minimum_price || minimum_price === Infinity) {
          return;
        }

        // Find the room object that has the minimum price
        const minRoom = hotelRooms.find(t => t.price_per_night_minimum === minimum_price);
        console.log('minRoom', minRoom);
        minimum_price += minRoom.adult_range_discount;
        minimum_price += minRoom.child_range_discount;
        minimum_price += minRoom.adult_early_discount;
        minimum_price += minRoom.child_early_discount;
        minimum_price += minRoom.adult_duration_discount;
        minimum_price += minRoom.child_duration_discount;

        const isRefundable = minRoom.is_refundable;

        const filteredTaxes = hotelTaxDetails.filter(tax => tax.hotel_code === hotel.HotelCode);
        console.log('filteredTaxes', filteredTaxes);

        if (filteredTaxes.length > 0) {
          const totalTaxValue = filteredTaxes.reduce((sum, tax) => {
            return sum + parseFloat(tax.tax_value);
          }, 0);
          console.log('totalTax', totalTaxValue);
          console.log('totalTaxValue', (minimum_price * totalTaxValue / 100));

          minimum_price += (minimum_price * totalTaxValue / 100);
          console.log('newMinimumPrice:', minimum_price);

        } else {
          console.log('No taxes found for hotel code:', hotel.HotelCode);
        }

        let hotelCurrency = hotel.currency;
        let conversionRate: any;
        let currencyData;
        if (hotelCurrency && hotelCurrency != BASE_CURRENCY) {
          currencyData = await this.activityDbService.formatPriceDetailToSelectedCurrency(hotelCurrency);
          conversionRate = currencyData['value'];
          minimum_price = minimum_price / conversionRate;
        }

        let Currency = request.Currency;
        let Conversion_Rate = 1;
        let currencyDetails;
        if (Currency && Currency != BASE_CURRENCY) {
          currencyDetails = await this.activityDbService.formatPriceDetailToSelectedCurrency(Currency);
          Conversion_Rate = currencyDetails['value'];
        }

        request['MarkupCity'] = request.CityIds[0];
        request['MarkupCountry'] = request.Market;
        minimum_price = (minimum_price * Conversion_Rate);
        console.log('after cc minimum_price:', minimum_price);
        
        let markup: any;
        if (request['UserType']) {
          markup = await this.hotelDbService.getMarkup(request);
        }
        console.log('markup:', JSON.stringify(markup));

        let markupDetails = await this.hotelDbService.markupDetails(markup, minimum_price);
        console.log('markupDetails', markupDetails);
        
        const body = {
          ...hotel,
          Amenities: Array.from(
            new Set(hotelRooms.flatMap((t) => t.ameneties?.split(",") || []))
          ),
          roomDetails: hotelRooms,
          is_refundable: isRefundable,
          minimum_price: minimum_price,
          no_of_nights: numberOfNights(request.CheckIn, request.CheckOut),
          ResultIndex: "",
          markupDetails,
        };
        return body;
      })
    );
    return hotelsResult.filter((t) => t);
  }

  async getRooms(
    hotel: HotelDB[],
    request: SearchRequest
  ): Promise<RoomSearch[]> {
    const roomData: RoomDB[] = await this.manager
      .createQueryBuilder()
      .distinct()
      .select("srd.*, chld.weekend_days")
      .from("supplier_room_details", "srd")
      .innerJoin("supplier_room_price", "srpv", "srpv.room_id = srd.origin")
      .innerJoin(
        "contract_hotel_list_dcb",
        "chld",
        "chld.HotelCode = srd.HotelCode"
      )
      .where("srd.HotelCode IN (:...hotelCodes)", {
        hotelCodes: hotel.map((h) => h.HotelCode),
      })
      .andWhere("srpv.season_date BETWEEN :startDate AND :endDate", {
        startDate: request.CheckIn,
        endDate: request.CheckOut,
      })
      .andWhere("srpv.available_rooms >= :NoOfRooms", { NoOfRooms: request.NoOfRooms })
      .andWhere("srd.room_status = 1")
      .getRawMany();
    const priceData = await this.getPriceDetails(roomData, request);
    // for (let index = 0; index < request.RoomGuests.length; index++) {
    //   const guest = request.RoomGuests[index];
    // }
    const roomWithPrice = roomData.map((room) => {
      const roomPrice = priceData[room.origin];
      if (!roomPrice) {
        return;
      }
      const roomPriceData: SimplePrice[][] = [];
      let currentRoomMinimumPrice = 0;
      for (let i = 0; i < request.RoomGuests.length; i++) {
        const roomPriceDataGuest: SimplePrice[] = [];
        for (const room_view in roomPrice) {
          for (const meal_type in roomPrice[room_view]) {
            const price = roomPrice[room_view][meal_type];
            console.log('price:', price);
            console.log({ 'price.adult_price': price.adult_price, 'price.child_price': price.child_price });
            const guest = request.RoomGuests[i];
            const adult_price = price.adult_price[guest.NoOfAdults] || 0;
            const child_price = price.child_price[guest.NoOfChild] || 0;
            if (
              (!adult_price && guest.NoOfAdults != 0) ||
              (!child_price && guest.NoOfChild != 0)
            ) {
              continue;
            }
            const total_price = (adult_price || 0) + (child_price || 0);
            console.log('total_price:', total_price);
            const priceRoomViewMeal: SimplePrice = {
              eligible_discount: price.elgible_discount,
              room_view,
              meal_type,
              total_price,
              adult_price,
              child_price,
              guest,
              cancellation_policy: price.hotel_room_cancellation_policy,
              room_id: i + 1,
              is_refundable: price.is_refundable === true ? false : price.is_refundable,
              rate_type: price.rate_type,
              adult_range_discount: price.range_discount_adult ?
                price.range_discount_adult[guest.NoOfAdults] || 0 : 0,
              child_range_discount: price.range_discount_child ?
                price.range_discount_child[guest.NoOfChild] || 0 : 0,
              adult_early_discount: price.early_discount_adult ?
                price.early_discount_adult[guest.NoOfAdults] || 0 : 0,
              child_early_discount: price.early_discount_child ?
                price.early_discount_child[guest.NoOfChild] || 0 : 0,
              adult_duration_discount: price.duration_discount_adult ?
                price.duration_discount_adult[guest.NoOfAdults] || 0 : 0,
              child_duration_discount: price.duration_discount_child ?
                price.duration_discount_child[guest.NoOfChild] || 0 : 0,
            };
            if (price.is_refundable) {
              const priceRoomViewMealRefundableNon: SimplePrice = JSON.parse(
                JSON.stringify(priceRoomViewMeal)
              );
              const adult_refundable_discount =
                price.nonRefundableDiscountMapAdult[guest.NoOfAdults] || 0;                
              const child_refundable_discount =
                price.nonRefundableDiscountMapChild[guest.NoOfChild] || 0;
              priceRoomViewMealRefundableNon.adult_price =
                adult_price + adult_refundable_discount;
              priceRoomViewMealRefundableNon.child_price =
                child_price == 0 ? 0 : child_price + child_refundable_discount;
              priceRoomViewMealRefundableNon.total_price =
                priceRoomViewMealRefundableNon.adult_price +
                priceRoomViewMealRefundableNon.child_price;
              priceRoomViewMealRefundableNon.eligible_discount =
                priceRoomViewMealRefundableNon.eligible_discount -
                price.non_refundable_discount;
              priceRoomViewMealRefundableNon.is_refundable = true;
              roomPriceDataGuest.push(priceRoomViewMealRefundableNon);
            }
            roomPriceDataGuest.push(priceRoomViewMeal);
          }
        }
        
        console.log('roomPriceDataGuest:', roomPriceDataGuest);
        // find the current minimum
        currentRoomMinimumPrice += Math.min(
          ...roomPriceDataGuest.map((t) => t.total_price)
        );

        if (currentRoomMinimumPrice) {
          var refundableObject = roomPriceDataGuest.find(
            (t) => t.total_price === currentRoomMinimumPrice
          );
        }
        roomPriceData.push(roomPriceDataGuest);
      }
      if (!currentRoomMinimumPrice) {
        return;
      }
      return {
        ...room,
        price: roomPriceData,
        price_per_night_minimum: currentRoomMinimumPrice,
        is_refundable: refundableObject ? refundableObject.is_refundable : '',
        adult_range_discount: refundableObject ? refundableObject.adult_range_discount : 0,
        child_range_discount: refundableObject ? refundableObject.child_range_discount : 0,
        adult_early_discount: refundableObject ? refundableObject.adult_early_discount : 0,
        child_early_discount: refundableObject ? refundableObject.child_early_discount : 0,
        adult_duration_discount: refundableObject ? refundableObject.adult_duration_discount : 0,
        child_duration_discount: refundableObject ? refundableObject.child_duration_discount : 0,
      };
    });
    return roomWithPrice.filter((t) => t);
  }

  async getPriceDetails(
    roomData: RoomDB[],
    request: SearchRequest
  ): Promise<ReducedGroupedData> {
    // if()
    const bookingDaysFromToDay = numberOfNights(
      moment().format("YYYY-MM-DD"),
      moment(request.CheckIn).format("YYYY-MM-DD")
    );

    const stayDays = numberOfNights(request.CheckIn, request.CheckOut);
    const startDate = moment(request.CheckIn).format("YYYY-MM-DD");
    const endDate = moment(request.CheckOut)
      .subtract(1, "day")
      .format("YYYY-MM-DD");

    let query: (RoomPricing & {
      rate_type: "night_rate";
    })[] = await this.manager
      .createQueryBuilder()
      .select("srp.*")
      .from("supplier_room_price", "srp")
      .where("srp.season_date BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
      .andWhere("srp.rate_type = :rateType", { rateType: "night_rate" })
      .andWhere("srp.minimum_stay <= :minimumStay", { minimumStay: stayDays })
      .andWhere("srp.room_id IN (:...roomIds)", {
        roomIds: roomData.map((room) => room.origin),
      })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select("1")
          .from("supplier_room_price", "srp2")
          .where("srp2.room_id = srp.room_id")
          .andWhere("srp2.room_view = srp.room_view")
          .andWhere("srp2.meal_type = srp.meal_type")
          .andWhere("srp2.season_date BETWEEN :startDate AND :endDate", {
            startDate,
            endDate,
          })
          .groupBy("srp2.room_id, srp2.room_view, srp2.meal_type")
          .having(
            "COUNT(DISTINCT srp2.season_date) = DATEDIFF(:endDate, :startDate) + 1",
            { startDate, endDate }
          )
          .getQuery();

        return "EXISTS (" + subQuery + ")";
      })
      .orderBy("srp.room_id")
      .addOrderBy("srp.room_view")
      .addOrderBy("srp.meal_type")
      .addOrderBy("srp.season_date")
      .getRawMany();

    // Step 1: Find all room IDs with status = 1 or no_of_room < request.NoOfrooms
    const roomIdsToRemove = query
      .filter(item => item.status === 1 || item.available_rooms < request.NoOfRooms)
      .map(item => item.room_id);

    // Step 2: Filter out objects with those room IDs
    query = query.filter(item => !roomIdsToRemove.includes(item.room_id));

    // checking packageRate dates
    const checkPackageDate = await this.manager.query(`
        SELECT srp.* 
        FROM supplier_room_price_record srp 
        WHERE srp.from_date = ? 
          AND srp.to_date = ? 
          AND srp.rate_type = ? 
          AND srp.room_id IN (${roomData.map(() => '?').join(',')})
      `, [
      startDate,
      endDate,
      "package_rate",
      ...roomData.map((room) => room.origin)
    ]);

    let packageRateQuery: (RoomPricing & {
      rate_type: "package_rate";
    })[];
    if (checkPackageDate && checkPackageDate.length) {
      packageRateQuery = await this.manager
        .createQueryBuilder()
        .select("srp.*")
        .from("supplier_room_price", "srp")
        .where("srp.season_date BETWEEN :startDate AND :endDate", {
          startDate,
          endDate,
        })
        .andWhere("srp.rate_type = :rateType", { rateType: "package_rate" })
        .andWhere("srp.room_id IN (:...roomIds)", {
          roomIds: roomData.map((room) => room.origin),
        })
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select("1")
            .from("supplier_room_price", "srp2")
            .where("srp2.room_id = srp.room_id")
            .andWhere("srp2.room_view = srp.room_view")
            .andWhere("srp2.meal_type = srp.meal_type")
            .andWhere("srp2.season_date BETWEEN :startDate AND :endDate", {
              startDate,
              endDate,
            })
            .groupBy("srp2.room_id, srp2.room_view, srp2.meal_type")
            .having(
              "COUNT(DISTINCT srp2.season_date) = DATEDIFF(:endDate, :startDate) + 1",
              { startDate, endDate }
            )
            .getQuery();

          return "EXISTS (" + subQuery + ")";
        })
        .orderBy("srp.room_id")
        .addOrderBy("srp.room_view")
        .addOrderBy("srp.meal_type")
        .addOrderBy("srp.season_date")
        .getRawMany();
    } else {
      packageRateQuery = [];
    }

    if (packageRateQuery && packageRateQuery.length) {
      // Step 1: Find all room IDs with status = 1 or no_of_room < request.NoOfrooms
      const roomIds = packageRateQuery
        .filter(item => item.status === 1 || item.available_rooms < request.NoOfRooms)
        .map(item => item.room_id);

      // Step 2: Filter out objects with those room IDs
      packageRateQuery = packageRateQuery.filter(item => !roomIds.includes(item.room_id));
    }

    const groupedData: GroupedData = query.reduce((acc, item) => {
      if (!acc[item.room_id]) {
        acc[item.room_id] = {};
      }
      if (!acc[item.room_id][item.room_view]) {
        acc[item.room_id][item.room_view] = {};
      }
      if (!acc[item.room_id][item.room_view][item.meal_type]) {
        acc[item.room_id][item.room_view][item.meal_type] = [];
      }
      acc[item.room_id][item.room_view][item.meal_type].push(item);
      return acc;
    }, {} as GroupedData);

    const groupedPackageData: ReducedGroupedData = packageRateQuery.reduce(
      (acc, item) => {
        if (!acc[item.room_id]) {
          acc[item.room_id] = {};
        }
        if (!acc[item.room_id][item.room_view]) {
          acc[item.room_id][item.room_view] = {};
        }
        if (!acc[item.room_id][item.room_view][item.meal_type]) {
          acc[item.room_id][item.room_view][item.meal_type] = {
            ...item,
            adult_price: this.convertStringToObject(item.adult_price),
            child_price: this.convertStringToObject(item.child_price),
            elgible_discount: 0,
            nonRefundableDiscountMapAdult: {},
            nonRefundableDiscountMapChild: {},
            is_refundable: item.is_refundable == 1,
          };
        }

        return acc;
      },
      {} as ReducedGroupedData
    );

    // console.log("Grouped Data");
    // console.dir(groupedData, { depth: null });
    const modifiedGroupedData: ReducedGroupedData = {};

    for (const roomId in groupedData) {
      const roomViews = groupedData[roomId];
      const room = roomData.find((room) => room.origin === +roomId);
      const weekendDays =
        room?.weekend_days?.split(",").map((t) => t.toLowerCase()) || [];
      for (const roomView in roomViews) {
        const mealTypes = roomViews[roomView];
        for (const mealType in mealTypes) {
          const roomPrices = mealTypes[mealType];
          const final_price = roomPrices
            .map((roomPrice) => {
              return this.calculateModifiedPrices(
                weekendDays,
                roomPrice,
                request,
                bookingDaysFromToDay,
                stayDays,
                query
              );
            })
            .reduce((acc, item) => {
              if (Object.keys(acc).length === 0) {
                acc = { ...item, is_refundable: item.is_refundable == 1 };
                acc.elgible_discount = acc.elgible_discount / roomPrices.length;
              } else {
                for (const key in item.adult_price) {
                  acc.adult_price[key] += item.adult_price[key];
                }
                for (const key in item.child_price) {
                  acc.child_price[key] += item.child_price[key];
                }

                for (const key in item.nonRefundableDiscountMapAdult) {
                  acc.nonRefundableDiscountMapAdult[key] += item.nonRefundableDiscountMapAdult[key];
                }

                for (const key in item.nonRefundableDiscountMapChild) {
                  acc.nonRefundableDiscountMapChild[key] += item.nonRefundableDiscountMapChild[key];
                }

                for (const key in item.range_discount_adult) {
                  acc.range_discount_adult[key] += item.range_discount_adult[key];
                }

                for (const key in item.range_discount_child) {
                  acc.range_discount_child[key] += item.range_discount_child[key];
                }

                for (const key in item.early_discount_adult) {
                  acc.early_discount_adult[key] += item.early_discount_adult[key];
                }

                for (const key in item.early_discount_child) {
                  acc.early_discount_child[key] += item.early_discount_child[key];
                }

                for (const key in item.duration_discount_adult) {
                  acc.duration_discount_adult[key] += item.duration_discount_adult[key];
                }

                for (const key in item.duration_discount_child) {
                  acc.duration_discount_child[key] += item.duration_discount_child[key];
                }

                acc.elgible_discount +=
                  item.elgible_discount / roomPrices.length;
              }
              return acc;
            }, {} as ModifiedRoomPricing);
          // console.dir(final_price, { depth: null });
          console.log("final_price:", final_price)
          if (!modifiedGroupedData[roomId]) {
            modifiedGroupedData[roomId] = {};
          }
          if (!modifiedGroupedData[roomId][roomView]) {
            modifiedGroupedData[roomId][roomView] = {};
          }
          modifiedGroupedData[roomId][roomView][mealType] = final_price;
        }
      }
    }

    for (const roomId in groupedPackageData) {
      const roomViews = groupedPackageData[roomId];
      for (const roomView in roomViews) {
        const mealTypes = roomViews[roomView];
        for (const mealType in mealTypes) {
          if (!modifiedGroupedData[roomId]) {
            modifiedGroupedData[roomId] = {};
          }
          if (!modifiedGroupedData[roomId][roomView]) {
            modifiedGroupedData[roomId][roomView] = {};
          }
          modifiedGroupedData[roomId][roomView][mealType] = mealTypes[mealType];
        }
      }
    }

    // console.log("Modified Data");
    // console.dir(modifiedGroupedData, { depth: null });
    return modifiedGroupedData;
  }

  private calculateModifiedPrices(
    weekendDays: string[],
    roomPrice: RoomPricing,
    request: SearchRequest,
    bookingDaysFromToDay: number,
    stayDays: number,
    roomDays: any
  ) {
    const isWeekend = weekendDays.includes(
      moment(roomPrice.season_date)
        .format("dddd")
        .toLowerCase()
    );

    const supplement_type = roomPrice.supplement_type.split(",")[1].trim();
    const supplement_value = +roomPrice.supplement_value.split(",")[1];
    console.log({'supplement_type': supplement_type, 'supplement_value': supplement_value});
    
    const adult_price = this.convertStringToObject(roomPrice.adult_price);
    const child_price = this.convertStringToObject(roomPrice.child_price);
    if (isWeekend) {
      if (supplement_type === "percent") {
        for (const key in adult_price) {
          if (adult_price[key] !== 0) {
            adult_price[key] =
              adult_price[key] + (adult_price[key] * supplement_value) / 100;
          }
        }
        // for (const key in child_price) {
        //   if (child_price[key] !== 0) {
        //     child_price[key] =
        //       child_price[key] + (child_price[key] * supplement_value) / 100;
        //   }
        // }
      } else {
        for (const key in adult_price) {
          if (adult_price[key] !== 0) {
            adult_price[key] = adult_price[key] + supplement_value;
          }
        }
        // for (const key in child_price) {
        //   if (child_price[key] !== 0) {
        //     child_price[key] = child_price[key] + supplement_value;
        //   }
        // }
      }
    }

    const filteredData = roomDays.filter(item => {
      // Check if `date_range_discount` is not null and if `room_id` matches
      return item.room_id === roomPrice.room_id && item.date_range_discount !== null;
    });
    
    console.log('stayDays:', stayDays, 'filteredData length:', filteredData.length);
    stayDays = stayDays - filteredData.length;
    console.log('stayDays:', stayDays);
    
    const nonRefundableDiscountMapAdult = {};
    const nonRefundableDiscountMapChild = {};
    const range_discount_adult = {};
    const range_discount_child = {};
    const early_discount_adult = {};
    const early_discount_child = {};
    const duration_discount_adult = {};
    const duration_discount_child = {};
    
    const earlyBooking: BookingDiscount = JSON.parse(roomPrice.early_booking);
    let elgible_discount = 0;
    console.log('bookingDaysFromToDay:', bookingDaysFromToDay);
    console.log('roomPrice:', roomPrice);

    // new range discount
    if (roomPrice.date_range_discount) {
      elgible_discount += roomPrice.date_range_discount;
      for (const key in adult_price) {
        range_discount_adult[key] = (adult_price[key] * (roomPrice.date_range_discount || 0)) / 100;
        early_discount_adult[key] = 0;
        duration_discount_adult[key] = 0;
      }
      for (const key in child_price) {
        range_discount_child[key] = (child_price[key] * (roomPrice.date_range_discount || 0)) / 100;
        early_discount_child[key] = 0;
        duration_discount_child[key] = 0;
      }
    } else {
      // early bird discount
      if (!(earlyBooking.days > bookingDaysFromToDay)) {
        elgible_discount += earlyBooking.discount_value;
        for (const key in adult_price) {
          early_discount_adult[key] = (adult_price[key] * (earlyBooking.discount_value || 0)) / 100;
          range_discount_adult[key] = 0;
          duration_discount_adult[key] = 0;
        }
        for (const key in child_price) {
          early_discount_child[key] = (child_price[key] * (earlyBooking.discount_value || 0)) / 100;
          range_discount_child[key] = 0;
          duration_discount_child[key] = 0;
        }
      }

      // duration of stay discount
      const durationOfStay: BookingDiscount = JSON.parse(
        roomPrice.duration_of_stay
      );

      if (!(durationOfStay.days > stayDays)) {
        elgible_discount += durationOfStay.discount_value;
        for (const key in adult_price) {
          duration_discount_adult[key] =
            (adult_price[key] * (durationOfStay.discount_value || 0)) / 100;
            if (Object.keys(early_discount_adult).length === 0) {
              early_discount_adult[key] = 0;
            }
            range_discount_adult[key] = 0;
        }
        for (const key in child_price) {
          duration_discount_child[key] =
            (child_price[key] * (durationOfStay.discount_value || 0)) / 100;
            if (Object.keys(early_discount_adult).length === 0) {
              early_discount_child[key] = 0;
            }
            range_discount_child[key] = 0;
        }
      }
    }
    
    elgible_discount += roomPrice.non_refundable_discount || 0;
    console.log('elgible_discount:', elgible_discount);

    //apply discount
    for (const key in adult_price) {
      nonRefundableDiscountMapAdult[key] =
        (adult_price[key] * (roomPrice.non_refundable_discount || 0)) / 100;
      adult_price[key] =
        adult_price[key] - (adult_price[key] * elgible_discount) / 100;
    }
    for (const key in child_price) {
      nonRefundableDiscountMapChild[key] =
        (child_price[key] * (roomPrice.non_refundable_discount || 0)) / 100;
      range_discount_child[key] =
        (child_price[key] * (roomPrice.date_range_discount || 0)) / 100;
      child_price[key] =
        child_price[key] - (child_price[key] * elgible_discount) / 100;
    }
    // console.dir(adult_price, { depth: null });
    return {
      ...roomPrice,
      adult_price,
      child_price,
      elgible_discount,
      nonRefundableDiscountMapAdult,
      nonRefundableDiscountMapChild,
      range_discount_adult,
      range_discount_child,
      early_discount_adult,
      early_discount_child,
      duration_discount_adult,
      duration_discount_child
    };
  }

  // function to convert 1:5666,2:6666 to {1:5666, 2:6666}
  convertStringToObject(str: string): Record<number, number> {
    return str.split(",").reduce((acc, item) => {
      const [key, value] = item.split(":");
      acc[Number(key)] = Number(value);
      return acc;
    }, {});
  }
}
