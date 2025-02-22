import { Injectable } from "@nestjs/common";

@Injectable()
export class HotelCacheservice {

    constructor() { }

    async getSearch(body: any): Promise<any[]> {
        return [];
    }

}