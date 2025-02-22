import { Controller, Post, Body, HttpCode, Headers, UseGuards, Req, UseInterceptors, UploadedFiles, Get, Param, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { editFileName, imageFileFilter } from '../../app.helper';
import { ReviewRatingDbService } from './review-rating-db.service';
import { diskStorage } from "multer";
import { ReviewRatingService } from './review-rating.service';
import { AddReviewDto } from './swagger/add-review.dto';

@Controller('common/review-rating')
export class ReviewRatingController {

    constructor(
        private reviewRatingService: ReviewRatingService
    ) { }

    @HttpCode(200)
    @Post('reviewRatings')
    async reviewRatings(@Body() body: any): Promise<any> {
        return await this.reviewRatingService.getReviewRatings(body);
    }

    @Post('addReviewRatings')
    @UseGuards(AuthGuard('jwt'))
    async addReviewRating(@Body() body: AddReviewDto, @Req() req: any): Promise<any> {
        return await this.reviewRatingService.addReviewRating(body, req);
    }

    @Post('updateReviewRatings')
    @UseGuards(AuthGuard('jwt'))
    async updateReviewRating(@Body() body: any): Promise<any> {
        return await this.reviewRatingService.updateReviewRating(body);
    }

    @Post('deleteReviewRatings')
    @UseGuards(AuthGuard('jwt'))
    async deleteReviewRating(@Body() body: any): Promise<any> {
        return await this.reviewRatingService.deleteReviewRatingById(body);
    }

    @Post('reviewRatingsByUser')
    @UseGuards(AuthGuard('jwt'))
    async reviewRatingsByUser(@Req() body: any): Promise<any> {
        return await this.reviewRatingService.getReviewRatingsByUser(body);
    }

    @Post('moduleReviewData')
    @UseGuards(AuthGuard('jwt'))
    async moduleReviewData(@Body() body: any): Promise<any> {
        return await this.reviewRatingService.moduleReviewData(body);
    }

    @Post("addReviewImages")
    @UseGuards(AuthGuard("jwt"))
    @UseInterceptors(
      FilesInterceptor("image", 20, {
        storage: diskStorage({
          destination: "./uploads/reviews/",
          filename: editFileName,
        }),
        fileFilter: imageFileFilter,
      })
    )
    async uploadMultipleFiles(
      @UploadedFiles() files,
      @Body() body: any,
      @Req() req: any
    ) {
      return this.reviewRatingService.uploadMultipleReviewImages(files, body, req);
    }

    @Get(":imgpath")
    @UseGuards(AuthGuard("jwt"))
    seeUploadedFile(@Param("imgpath") image, @Res() res) {
        return res.sendFile(image, {
            root: "./uploads/reviews",
          });
    }
}
