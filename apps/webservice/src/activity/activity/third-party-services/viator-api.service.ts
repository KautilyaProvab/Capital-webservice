import { Injectable, HttpService } from "@nestjs/common";
import { SearchDao, SearchDto, DetailsDto, DetailsDao, AvailabilityDto, AvailabilityDao, BlockDto, BlockDao, BookDto, BookDao } from "../swagger";
import { viatorUrl, viatorApiKey } from "../../../constants";
import { ActivityApi } from "../../activity.api";
import { toPascal } from "../../../app.helper";
import * as moment from "moment";

@Injectable()
export class ViatorApiService extends ActivityApi {

    constructor(private httpService: HttpService) {
        super()
    }

    async search(body: SearchDto): Promise<any> {
        const url = viatorUrl + 'search/products';
        const result = await this.httpService.post(url,
            {
                destId: body.city_id,
                subCatId: body.sub_cat_id ? body.sub_cat_id : 0,
                sortOrder: "REVIEW_AVG_RATING_D",
                startDate: body.start_date != '' ? body.start_date : undefined,
                endDate: body.end_date != '' ? body.end_date : undefined
            }, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en',
                'Content-Type': 'application/json',
                'exp-api-key': viatorApiKey
            }
        }).toPromise();
        // console.log(typeof result, result.data.length); return;
        if (!result.data.length) {
            return { result: [], message: 'Not available!' };
        }
        const finalResult = result.data.map(t => {
            const tempData = {
                ProductName: t.title,
                ProductCode: t.code,
                ImageUrl: t.thumbnailURL,
                ImageHisUrl: t.thumbnailHiResURL,
                BookingEngineId: t.bookingEngineId,
                Promotion: false,
                PromotionAmount: 0,
                StarRating: t.rating,
                ReviewCount: t.reviewCount,
                DestinationName: t.primaryDestinationName,
                Price: {
                    TotalDisplayFare: t.price,
                    GSTPrice: 0,
                    PriceBreakup: {
                        AgentCommission: t.merchantNetPriceFrom,
                        AgentTdsOnCommision: t.price - t.merchantNetPriceFrom
                    },
                    Currency: t.currencyCode
                },
                Description: t.shortDescription,
                Cancellation_available: t.merchantCancellable,
                Cat_Ids: t.catIds,
                Sub_Cat_Ids: t.subCatIds,
                Supplier_Code: t.supplierCode,
                Duration: t.duration,
                webURL: t.webURL,
                ResultToken: '223d957caf12d51558b340c62477c57f*_*1*_*L0Lfra08r9dBRpYV'
            }
            return this.getSearchUniversal(tempData);
        });
        return { result: finalResult, message: '' };
    }

    async details(body: any): Promise<any> {
        const url = viatorUrl + 'product?code=' + body.ProductCode + '&currencyCode=' + body.CurrencyCode;
        const result: any = await this.httpService.get(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en',
                'Content-Type': 'application/json',
                'exp-api-key': viatorApiKey
            }
        }).toPromise();

        const t = result.data;

        let reviewsResult = [];
        if (t.hasOwnProperty('reviews') && Array.isArray(t.reviews)) {
            reviewsResult = t.reviews.length ? t.reviews.map(u => {
                return {
                    UserName: u.ownerName,
                    UserCountry: u.ownerCountry,
                    UserImage: u.ownerAvatarURL,
                    Rating: u.rating,
                    Review: u.review,
                    Published_Date: u.publishedDate
                }
            }) : [];
        }

        let photosResult = [];
        if (t.hasOwnProperty('productPhotos') && Array.isArray(t.productPhotos)) {
            photosResult = t.productPhotos.length ? t.productPhotos.map(v => {
                return {
                    photoHiResURL: v.photoHiResURL,
                    photoURL: v.photoURL,
                    ImageCaption: v.caption,
                    photoMediumResURL: v.photoMediumResURL
                }
            }) : [];
        }
        let tourGrades = [];
        if (t.hasOwnProperty('tourGrades') && Array.isArray(t.tourGrades)) {
            tourGrades = t.tourGrades.length ? t.tourGrades.map(w => {
                return {
                    sortOrder: w.sortOrder,
                    currencyCode: w.currencyCode,
                    langServices: w.langServices,
                    gradeCode: w.gradeCode,
                    gradeTitle: w.gradeTitle,
                    gradeDescription: w.gradeDescription,
                    defaultLanguageCode: w.defaultLanguageCode,
                    gradeDepartureTime: w.gradeDepartureTime,
                    Price: {
                        TotalDisplayFare: w.priceFrom,
                        GSTPrice: 0,
                        PriceBreakup: {
                            AgentCommission: w.merchantNetPriceFrom,
                            AgentTdsOnCommision: w.priceFrom - w.merchantNetPriceFrom
                        },
                        Currency: w.Currency
                    }
                }
            }) : [];
        }

        const tempData = {
            ProductName: t.title,
            ReviewCount: t.reviewCount,
            product_image: t.thumbnailHiResURL,
            StarRating: t.rating,
            Promotion: false,
            Duration: t.duration,
            ProductCode: t.code,
            ProductPhotos: photosResult,
            Product_Video: '',
            Price: {
                TotalDisplayFare: t.price,
                GSTPrice: 0,
                PriceBreakup: {
                    AgentCommission: t.merchantNetPriceFrom,
                    AgentTdsOnCommision: t.price - t.merchantNetPriceFrom
                },
                Currency: t.currencyCode
            },
            Product_Reviews: reviewsResult,
            Product_Tourgrade: tourGrades,
            Product_available_date: {},
            Cancellation_available: t.merchantCancellable,
            Cancellation_day: 0,
            Cancellation_Policy: '',
            BookingEngineId: t.bookingEngineId,
            Voucher_req: t.voucherRequirements,
            Tourgrade_available: t.tourGradesAvailable,
            UserPhotos: t.userPhotos,
            Product_AgeBands: t.ageBands,
            BookingQuestions: t.bookingQuestions,
            Highlights: t.highlights,
            SalesPoints: t.salesPoints,
            TermsAndConditions: t.termsAndConditions,
            MaxTravellerCount: t.maxTravellerCount,
            Itinerary: t.itinerary,
            VoucherOption: t.voucherOption,
            VoucherOption_List: 'VOUCHER_E',
            AdditionalInfo: t.additionalInfo,
            Inclusions: t.inclusions,
            DepartureTime: t.departureTime,
            DeparturePoint: t.departurePoint,
            DepartureTimeComments: t.departureTimeComments,
            ReturnDetails: t.returnDetails,
            Exclusions: t.exclusions,
            ShortDescription: t.shortDescription,
            Description: t.description,
            Location: t.location,
            AllTravellerNamesRequired: true,
            Country: t.country,
            Region: t.region,
            // webURL: "http://shop.live.rc.viator.com/tours/Sydney/Sydney-and-Bondi-Hop-on-Hop-off-Tour/d357-5010SYDNEY?eap=brand-subbrand-17895&aid=vba17895en",
            webURL: t.webURL,
            ResultToken: '63c8d99720b822059e9b48629b3372b0*_*302*_*t49ZtlvzkSVN9c9X'
        }
        return { result: this.getDetailsUniversal(tempData), message: '' };
    }

    async availability(body: any): Promise<any> {
        const url = viatorUrl + 'available/products';
        const result: any = await this.httpService.post(url,
            {
                currencyCode: body['currencyCode'] || 'USD',
                startDate: body['startDate'] || '2020-12-21',
                endDate: body['endDate'] || '2020-12-31',
                numAdults: body['numAdults'] || 1,
                productCodes: body['productCodes'] || ['3431UHDT'],
            }, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en',
                'Content-Type': 'application/json',
                'exp-api-key': viatorApiKey
            }
        }).toPromise();
        const t: any = result.data;
        if (!t.length) {
            return { result: [], message: 'Not available!' };
        }


        /* const fs = require('fs');
        const data = fs.readFileSync('./test-data/activity/availability/response.json');
        const result = JSON.parse(data);
        const t = result;
        if (!t.length) {
            return {result: [], message: 'Not available!'};
        } */
        const tourGrades = [];
        if (t[0].hasOwnProperty('pas') && t[0]['pas'].hasOwnProperty('tourGrades')) {
            const tourGradesArray = t[0]['pas']['tourGrades'];
            for (const key in tourGradesArray) {
                const w = tourGradesArray[key];
                const defaultLanguageCode = Object.keys(w.languageServices)[0];
                const gradeDepartureTimeTemp = key.split('~')[1];
                const gradeDepartureTime = moment('2020-01-01 ' + gradeDepartureTimeTemp).format('HH:mm A');
                tourGrades.push({
                    sortOrder: t[0].sortOrder,
                    currencyCode: t[0].currencyCode,
                    langServices: w.languageServices,
                    gradeCode: w.tourGradeCode,
                    gradeTitle: w.title,
                    gradeDescription: w.description,
                    defaultLanguageCode,
                    gradeDepartureTime,
                    Price: {
                        TotalDisplayFare: w.availDates[0].priceFrom,
                        GSTPrice: 0,
                        PriceBreakup: {
                            AgentCommission: t[0].merchantNetPriceFrom,
                            AgentTdsOnCommision: w.availDates[0].priceFrom - t[0].merchantNetPriceFrom
                        },
                        Currency: t[0].currencyCode
                    },
                    availDates: w.availDates,
                    bookingEngine: w.bookingEngine,
                    sapi: w.sapi
                });
            }
        }
        Object.assign(t[0], { Product_Tourgrade: tourGrades });
        // return {result: toPascal(t[0]), message: ''};
        return { result: t[0], message: '' };
    }

    async block(body: BlockDto): Promise<BlockDao[]> {
        return [];
    }

    async book(body: BookDto): Promise<BookDao[]> {
        return [];
    }

}