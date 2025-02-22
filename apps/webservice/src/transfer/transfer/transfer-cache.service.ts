import { Injectable } from "@nestjs/common";

@Injectable()
export class TransferCacheservice {

    constructor() { }

    async getSearch(body: any): Promise<any[]> {
        return [];
    }

}