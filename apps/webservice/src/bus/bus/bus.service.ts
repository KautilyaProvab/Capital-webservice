import { Injectable } from "@nestjs/common";
import { BaseApi } from "../../base.api";
import { TravelomatixService } from "./third-party-services";
import { BusDbService } from "./bus-db.service"
import { META_TL_HOTEL_COURSE, TMX_HOTEL_BOOKING_SOURCE } from "../../constants";
import { CityListDao, CityListDto, SearchBusDto, SearchBusDao, SeatLayoutBusDao, SeatLayoutBusDto } from './swagger';

@Injectable()
export class BusService extends BaseApi {
    private currentSuppliers: any = [];
    constructor(
        private travelomatixService: TravelomatixService,
        private busDbService: BusDbService
    ) {
        super();
        this.currentSuppliers.push({ name: TMX_HOTEL_BOOKING_SOURCE, service: this.travelomatixService });
    }
    /* travelomatix API*/
    async cityListBusTravelomatix(body:any): Promise<[]> {
        // const source = this.currentSuppliers.find(t => t.name == body['booking_source']);
        // return await source['service'].getcityList(body);
        return await this.travelomatixService.getCityList(body);
    }

    async searchBusTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getsearch(body);
        return await this.travelomatixService.getsearch(body);
    }

    async seatLayoutBusTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getseatLayout(body);
        return await this.travelomatixService.getseatLayout(body);
    }
    
    async seatBusInfoTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getseatLayout(body);
        return await this.travelomatixService.getseatBusInfo(body);
    }
    
    async addPaxDetailsBusTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getseatLayout(body);
        return await this.travelomatixService.getAddPaxDetails(body);
    }

    async holdSeatsBusTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getholdSeats(body);
        return await this.travelomatixService.getholdSeats(body);
    }
    
    async BookSeatsBusTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getholdSeats(body);
        return await this.travelomatixService.getBookSeats(body);
    }
    
    async VoucherBusTravelomatix(body: any): Promise<[]> {
        // const source = this.currentSuppliers.find((t: { name: any; }) => t.name == body['booking_source']);
        // return await source['service'].getholdSeats(body);
        return await this.travelomatixService.getVoucher(body);
    }
}