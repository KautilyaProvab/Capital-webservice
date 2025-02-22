import { Injectable } from "@nestjs/common";
import { Any } from "typeorm";
import { ReviewRatingDbService } from "./review-rating-db.service";
import { AddReviewDto } from "./swagger/add-review.dto";

@Injectable()
export class ReviewRatingService {
    constructor(
        private reviewRatingDbService: ReviewRatingDbService
    ) { }

    async addReviewRating(body: AddReviewDto, req: any): Promise<any> {
        return await this.reviewRatingDbService.saveReviewRatings(body, req);
    }

    async getReviewRatings(body: any): Promise<any> {
        return await this.reviewRatingDbService.getReviewRatings(body);
    }

    async updateReviewRating(body: any): Promise<any> {
        return await this.reviewRatingDbService.updateReviewRatings(body);
    }

    async getReviewRatingsByUser(body: any): Promise<any> {
        return await this.reviewRatingDbService.getReviewRatingsByUser(body);
    }
    
    async moduleReviewData(body: any): Promise<any> {
        return await this.reviewRatingDbService.moduleReviewData(body.module_record_id,body.module_name);
    }
    
    async deleteReviewRatingById(body: any): Promise<any> {
        return await this.reviewRatingDbService.deleteReviewById(body);
    }

    async uploadMultipleReviewImages(files:any,body: any,req:any): Promise<any> {
        return await this.reviewRatingDbService.uploadMultipleFiles(files,body,req);
    }
    
    
}
