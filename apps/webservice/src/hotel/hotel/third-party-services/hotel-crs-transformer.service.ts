import { Injectable } from "@nestjs/common";
import { HotelSearch, HotelInfoSearch, RoomSearch } from "./hote-crs.types";
import { CRS_HOTEL_BOOKING_SOURCE } from "apps/webservice/src/constants";
import { SearchRequest } from "../hotel-types/hotel.types";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { HotelApi } from "../../hotel.api";
import { safeExecute } from '../../../app.helper';

@Injectable()
export class HotelCrsTransformerService extends HotelApi {
  constructor(private redisServerService: RedisServerService) {
    super();
  }
  search(
    data: HotelSearch[],
    request: SearchRequest
  ): Promise<HotelInfoSearch[]> {
    return Promise.all(
      data.map(async (hotel) => {
        // adding markup details
        if (hotel.markupDetails && hotel.markupDetails.AdminMarkup) {
          hotel.minimum_price = (hotel.minimum_price + hotel.markupDetails.AdminMarkup)
        }

        const hotelInfo = {
          roomDetails: hotel.roomDetails,
          Priority: hotel.priority,
          HotelCode: hotel.HotelCode,
          HotelName: hotel.HotelName,
          StarRating: hotel.Starrating,
          NoOfNights: hotel.no_of_nights,
          HotelDescription: hotel.Description,
          CreatedById: hotel.user_id,
          HotelPromotion: "",
          HotelPolicy: hotel.hotel_policy,
          HotelPicture: safeExecute(() => JSON.parse(hotel.images)[0], ""),
          HotelAddress: hotel.Address,
          MainImage: hotel.mainimage,
          HotelContactNo: "",
          HotelMap: "",
          Latitude: +(hotel.Latitude || "0"),
          Longitude: +(hotel.Longitude || "0"),
          Breakfast: "",
          HotelLocation: hotel.location,
          SupplierPrice: "",
          OrginalHotelCode: hotel.HotelCode,
          HotelPromotionalContent: "",
          PhoneNumber: "",
          HotelAmenities: hotel.Amenities,
          Free_cancel_date: "",
          trip_adv_url: "",
          trip_rating: "",
          NoOfRoomsAvailableAtThisPrice: "",
          HotelCurrencyCode: hotel.currency,
          NoOfReviews: "",
          ReviewScore: "",
          ReviewScoreWord: "",
          RoomDetails: [],
          booking_source: CRS_HOTEL_BOOKING_SOURCE,
          DealTagging: "",
          BoardType: [],
          chain_group: "",
          Price: {
            Amount: parseFloat((hotel.minimum_price).toFixed(2)),
            Currency: request.Currency,
            Commission: 0,
            Markup: hotel.markupDetails,
            IsRefundable: hotel.is_refundable
          },
          LocalTimeZone: hotel.local_timezone,
          meal_type: hotel.meal_plans ? hotel.meal_plans.split(',').map(meal => meal.trim()).filter(meal => meal) : [],
          CheckIn: request.CheckIn,
          CheckOut: request.CheckOut,
          searchRequest: request,
          ResultIndex: hotel.ResultIndex,
        };
        const token = await this.redisServerService.geneateResultToken(
          hotelInfo
        );
        const response = await this.redisServerService.insert_record(
          token,
          JSON.stringify(hotelInfo)
        );
        hotelInfo.ResultIndex = response.access_key;
        delete hotelInfo.roomDetails;
        return hotelInfo;
      })
    );
  }
}
