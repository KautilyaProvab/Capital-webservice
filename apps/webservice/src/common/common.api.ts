import { formatDate } from "../app.helper";
import { BaseApi } from "../base.api";

export abstract class CommonApi extends BaseApi {
    constructor() {
        super();
    }
    getReviewRatingsUniversal(body) {
        return {
            Id: body.id,
            StarRating: body.star_rating,
            Comment: body.comment,
            PhotoUrl: body.photo_url,
            ModuleName: body.module_name,
            UserName: body.username,
            LikeCount: body.like_count,
            PostedOn: body.posted_on,
            CreatedBy: body.created_by_id,
            ReviewImages:body.review_images
        }
    }

    getHotelReviewRatingsUniversal(body) {
        return {
            Id: body.id,
            StarRating: body.star_rating,
            Comment: body.comment,
            PhotoUrl: body.photo_url,
            ModuleName: body.module_name,
            UserName: body.username,
            LikeCount: body.like_count,
            PostedOn: body.posted_on,
            CreatedBy: body.created_by_id,
            ReviewImages:body.review_images,
            HotelName:body.hotel_name,
            HotelAddress:body.hotel_address,
            HotelPhoto:body.hotel_photo
        }
    }
    getCarReviewRatingsUniversal(body){
        return {
            Id: body.id,
            StarRating: body.star_rating,
            Comment: body.comment,
            PhotoUrl: body.photo_url,
            ModuleName: body.module_name,
            UserName: body.username,
            LikeCount: body.like_count,
            PostedOn: body.posted_on,
            CreatedBy: body.created_by_id,
            ReviewImages:body.review_images,
            CarName:body.car_name,
            CarModel:body.car_model,
            CarSupplierName:body.car_supplier_name,
            CarImage:body.car_picture_url
        }
    }

    getCommonCitiesUniversal(body: any): any {
        return {
            city_name: body.city_name,
            latitude: body.latitude,
            longitude: body.longitude,
            top_destination: body.top_destination,
            country_name: body.country_name,
            country_code: body.country_code,
            country_id: body.country_id

        }
    }
}
