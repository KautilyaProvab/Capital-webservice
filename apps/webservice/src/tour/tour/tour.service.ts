import { Injectable } from "@nestjs/common";
import { BaseApi } from "../../base.api";
import { TourDbService } from './tour-db.service'
import {  META_SIGHTSEEING_COURSE, TR_SIGHTSEEING_BOOKING_SOURCE, TMX_SIGHTSEEING_BOOKING_SOURCE } from "../../constants";
import { ToursRadarService } from "./third-party-services/tours-radar.service";
import { getExceptionClassByCode } from "../../all-exception.filter";

@Injectable()
export class TourService extends BaseApi {
    private currentSuppliers: any = [];
    constructor(
        private tourDbService: TourDbService,
        private ToursRadarService : ToursRadarService
    ) {
        super()
        this.currentSuppliers.push({ name: TR_SIGHTSEEING_BOOKING_SOURCE, service: this.ToursRadarService });
    }

    async autoComplete(body: any): Promise<any> {
        const autoComplete = await this.tourDbService.autoComplete(body);
        return autoComplete;
    }

    async countryList(body: any): Promise<any> {
        const autoComplete = await this.tourDbService.countryList(body);
        return autoComplete;
    }

    // async search(body: any): Promise<any> {
    //     const search = await this.tourDbService.search(body);
    //     return search;
    // }

    async search(body: any): Promise<any> {
        var query = `SELECT BS.name,BS.source_key as booking_source, BS.authentication as check_auth 
                    FROM ws_apis BS join ws_api_credentials AC ON AC.ws_api_id=BS.id 
                    JOIN ws_api_maps DAM ON DAM.ws_api_id=BS.id 
                    JOIN ws_domains DL ON DL.id=DAM.ws_domain_id 
                    WHERE BS.booking_engine_status=1 
                    AND AC.status=1 AND BS.meta_course_key = '${META_SIGHTSEEING_COURSE}'
                    AND DL.id = 1`;
        if (body.booking_source) {
            query = `${query}  AND BS.source_key='${body.booking_source}'`
        }
        query = `${query}  ORDER BY BS.id DESC`;
        let suppliers: any = await this.manager.query(query);
        // suppliers=JSON.parse(JSON.stringify(suppliers))
       
        
        if (suppliers.length) {
            let allResults = [];
            let result=[];
            for (let i = 0; i < suppliers.length; i++) {
              
               
                if(body.booking_source == TR_SIGHTSEEING_BOOKING_SOURCE){
                    const source = this.currentSuppliers.find(t => t.name == suppliers[i]['booking_source']);
                    result = await source['service'].search(body);
                   
                }else{
                    result = await this.tourDbService.search(body);
                }
                
                // const result = await source['service'].search(body);
                // BookingTravelerRefObj[suppliers[i]['booking_source']] = result['BookingTravelerRefObj'];
                // allResults.push(...result);
                return result;
            }
        }
    }

    async homePublishsearch(body: any): Promise<any> {
        const homePublishsearch = await this.tourDbService.homePublishsearch(body);
        return homePublishsearch;
    }

    async tourDetail(body: any): Promise<any> {
       
        if(body.BookingSource == TR_SIGHTSEEING_BOOKING_SOURCE){
        const source = this.currentSuppliers.find(t => t.name == body.BookingSource);
        return await source['service'].getTourDetails(body);
        }else{
        const tourDetail = await this.tourDbService.tourDetail(body);
        return tourDetail;
        }
    }

    async broucher(body: any): Promise<any> {
        const broucher = await this.tourDbService.broucher(body);
        return broucher;
    }

    async tourValuation(body: any): Promise<any> {
        if(body.BookingSource == TR_SIGHTSEEING_BOOKING_SOURCE){
            const source = this.currentSuppliers.find(t => t.name == body.BookingSource);
            return await source['service'].tourValuation(body);
            }else{
        const tourValuation = await this.tourDbService.tourValuation(body);
        return tourValuation;
            }
    }

    async departureDates(body: any): Promise<any> {
        const source = this.currentSuppliers.find(t => t.name == body.BookingSource);
        return await source['service'].departureDates(body);
    }
    
    async sendEnquiry(body: any): Promise<any> {
        const sendEnquiry = await this.tourDbService.sendEnquiry(body);
        return sendEnquiry;
    }
    async addPaxDetails(body: any): Promise<any> {
        const addPaxDdetails = await this.tourDbService.addPaxDetails(body);
        return addPaxDdetails;
    }
    async Voucher (body: any): Promise<any> {
        const Voucher = await this.tourDbService.Voucher(body);
        return Voucher;
    }
    async confirmBooking(body: any): Promise<any> {
        let check_req: any = {};
        
        if(body.booking_source == TR_SIGHTSEEING_BOOKING_SOURCE){
         try{
            const source = this.currentSuppliers.find(t => t.name == body.booking_source);
            const bookingResponse = await source['service'].confirmBooking(body);

            if(bookingResponse.status == 'confirmed'){
                body.bookingId = bookingResponse.Id;
                body.status = bookingResponse.status;
                const confirmBooking = await this.tourDbService.generatebookingId(body);
                this.tourDbService.emailTourDetails(body)
                return confirmBooking;
            }else{
                
                throw new Error(`Booking ${bookingResponse.status} - Reason ${bookingResponse.status_reason_text}`);
                // const response={Status:bookingResponse.status,
                //     StatusReason:bookingResponse.status_reason,
                //     StatusReasonText:bookingResponse.status_reason_text
                // }
                // return response;
            }
        }catch (error) {
                const errorClass: any = getExceptionClassByCode(error.message);
                throw new errorClass(error.message);
            }
        
        }else{
        let payment_status = false;
        if (body.AppReference) {
            check_req.app_reference = body.AppReference;
            if (body.orderId != undefined) {
                if (body.orderId != '') {
                    check_req.order_id = body.orderId;
                    payment_status = await this.tourDbService.paymentConfirmation(check_req);
                }
            }
        }
         // else {
        //     const errorClass: any = getExceptionClassByCode(`400 This booking is not exist.`);
        //     throw new errorClass(`This booking is not exist.`);
        // }
        // if (payment_status) {
            const confirmBooking = await this.tourDbService.generatebookingId(body);
            this.tourDbService.emailTourDetails(body)
            return confirmBooking;
        // }
        // else {
        //     const errorClass: any = getExceptionClassByCode(`400 This booking is not exist.`);
        //     throw new errorClass(`This booking is not exist.`);
        // }
    }
       
    }

     async currencies(body: any): Promise<any> {
        const search = await this.ToursRadarService.currencies(body);
        return search;
    }

    async destinations(body: any): Promise<any> {
        const search = await this.ToursRadarService.destinations(body);
        return search;
    }

    async tourTypes(body: any): Promise<any> {
        const search = await this.ToursRadarService.tourTypes(body);
        return search;
    }
    
    async emailTourDetails(body: any): Promise<any> {
        const search = await this.tourDbService.emailTourDetails(body);
        return search;
    }
}
