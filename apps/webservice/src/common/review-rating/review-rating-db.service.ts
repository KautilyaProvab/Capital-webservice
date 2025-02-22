import { Body, Injectable, Req, UploadedFiles } from "@nestjs/common";
import { getExceptionClassByCode } from "../../all-exception.filter";
import { CommonApi } from "../common.api";
import { AddReviewDto } from "./swagger/add-review.dto";

@Injectable()
export class ReviewRatingDbService extends CommonApi {
  constructor() {
    super();
  }

  async getReviewRatings(body: any) {
    const result = await this.getGraphData(
      `
            query {
                cmsReviewRatings(
                    where: {
                        module_record_id: {
                            eq: "${body.ModuleRecordId}"
                        }
                        module_name: {
                            eq: "${body.ModuleName}"
                        }
                        status: {
                            eq: 1
                        }
                    }
                ) {
                    id
                    star_rating
                    comment
                    photo_url
                    module_name
                    username
                    like_count
                    posted_on
                    created_by_id
                    review_images
                }
            } 
        `,
      "cmsReviewRatings"
    );
    const moduleData = await this.moduleReviewData(
      body.ModuleRecordId,
      body.ModuleName
    );
    if (body.ModuleName == "Hotel" && moduleData) {
      return result.map((t) => {
        const tempData = {
          ...t,
          source: "DB",
          hotel_name: moduleData["hotel_name"],
          hotel_address: moduleData["hotel_address"],
          hotel_photo: moduleData["hotel_photo"]
        };
        return this.getHotelReviewRatingsUniversal(tempData);
      });
    }
    if (body.ModuleName == "Car" && moduleData) {
      return result.map((t) => {
        const tempData = {
          ...t,
          source: "DB",
          car_name: moduleData["car_name"],
          car_model: moduleData["car_model"],
          car_picture_url: moduleData["PictureURL"],
          car_supplier_name: moduleData["car_supplier_name"]
        };
        return this.getCarReviewRatingsUniversal(tempData);
      });
    }
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "DB",
      };
      return this.getReviewRatingsUniversal(tempData);
    });
  }

  async moduleReviewData(ModuleRecordId, module) {
    let result = "";
    let queryString = "";
    if (module == "Hotel") {
      queryString = `SELECT distinct hotel_name , hotel_address , hotel_photo from 
        zb_new.hotel_hotel_booking_details where hotel_code="${ModuleRecordId}" AND 
        hotel_address!="undefined" ORDER BY hotel_address desc;`;
      result = await this.manager.query(queryString);
      if (result) result = result[0];
    }
    if (module == "Car") {
      queryString = `SELECT DISTINCT car_name,car_model,car_supplier_name,PictureURL FROM 
        zb_new.car_bookings WHERE booking_reference="${ModuleRecordId}";`;
      result = await this.manager.query(queryString);
      if (result) result = result[0];
    }
    return result;
  }

  async saveReviewRatings(body: AddReviewDto, req: any) {
    const result = await this.getGraphData(
      `
            mutation {
                createCmsReviewRating(
                    cmsReviewRating: {
                        star_rating: ${body.StarRating},
                        comment: "${body.Comment}"
                        photo_url: "${body.PhotoUrl}"
                        module_name: "${body.ModuleName}"
                        module_record_id: "${body.ModuleRecordId}"
                        username: "${body.UserName}"
                        like_count: ${body.LikeCount}
                        posted_on: "${body.PostedOn}"
                        created_by_id: ${req.user.id}
                    }
                ) {
                    id
                    star_rating
                    comment
                    photo_url
                    module_name
                    module_record_id
                    username
                    like_count
                    posted_on
                    created_by_id
                }
            }
        `,
      "createCmsReviewRating"
    );
    const tempData = {
      ...result,
      source: "DB",
    };
    return this.getReviewRatingsUniversal(tempData);
  }

  async updateReviewRatings(body: any) {
    const result = await this.getGraphData(
      `
            mutation {
                updateCmsReviewRating(
                    id: ${body.id}
                    cmsReviewRatingPartial: {
                        star_rating: ${body.StarRating},
                        comment: "${body.Comment}"
                        photo_url: "${body.PhotoUrl}"
                        module_name: "${body.ModuleName}"
                        module_record_id: "${body.ModuleRecordId}"
                        username: "${body.UserName}"
                        posted_on: "${body.PostedOn}"
                    }
                )
            }
        `,
      "updateCmsReviewRating"
    );
    return result;
  }

  async getReviewRatingsByUser(body: any) {
    /*  const result = await this.getGraphData(
        `
              query {
                  cmsReviewRatings(
                      where: {
                          created_by_id: {
                              eq: "${body.user.id}"
                          }
                          status: {
                            eq: 1
                        }
                      }
                     
                  ) {
                      id
                      star_rating
                      comment
                      photo_url
                      module_name
                      username
                      like_count
                      posted_on
                      created_by_id
                      review_images
                       hotelHotelBookingDetails {
                          app_reference
                          hotel_name
                        }
                  }
              }
          `,
        "cmsReviewRatings"
      ); */

    var query = `SELECT cms_review_ratings.id AS cms_id, cms_review_ratings.module_record_id,cms_review_ratings.comment,cms_review_ratings.module_name ,cms_review_ratings.username,cms_review_ratings.like_count,cms_review_ratings.posted_on,cms_review_ratings.created_by_id,cms_review_ratings.comment,hotel_hotel_booking_details.hotel_name, hotel_hotel_booking_details.star_rating,hotel_hotel_booking_details.hotel_photo, hotel_hotel_booking_details.hotel_address FROM cms_review_ratings JOIN hotel_hotel_booking_details ON cms_review_ratings.module_record_id = hotel_hotel_booking_details.app_reference WHERE cms_review_ratings.created_by_id = "${body.user.id}" AND cms_review_ratings.status = 1`;

    const result = await this.manager.query(query);
    return result;

  }

  async deleteReviewById(body: any) {
    try {
      const result = this.getGraphData(
        `mutation{
                deleteCmsReviewRating(id:${body.id})
              }`,
        "deleteCmsReviewRating"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async uploadMultipleFiles(@UploadedFiles() files, @Body() body, @Req() req) {
    try {
      const images = [];
      var result: any;
      files.forEach((file) => {
        const fileReponse = {
          originalname: file.originalname,
          filename: file.filename,
        };
        images.push(fileReponse.filename);
        result = this.getGraphData(
          `mutation {
                    updateCmsReviewRating(id:${body.id},cmsReviewRatingPartial:{
                      review_images :"${images.join(",")}"
                    })
                }`,
          "updateCmsReviewRating"
        );
      });
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
}
