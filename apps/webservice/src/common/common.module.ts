import { Global, HttpModule, Module } from "@nestjs/common";
import { CommonController } from "./common/common.controller";
import { CommonService } from "./common/common.service";
import { ReviewRatingDbService } from "./review-rating/review-rating-db.service";
import { ReviewRatingController } from "./review-rating/review-rating.controller";
import { ReviewRatingService } from "./review-rating/review-rating.service";
import { BookingsService } from './bookings/bookings.service';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsDbService } from "./bookings/bookings-db.service";

@Module({
    imports: [],
    controllers: [
        ReviewRatingController,
        CommonController,
        BookingsController
    ],
    providers: [
        ReviewRatingService,
        ReviewRatingDbService,
        CommonService,
        BookingsService,
        BookingsDbService
    ]
})
export class CommonModule { }