import * as moment from 'moment';
import { formatDate } from "../app.helper";
import { BaseApi } from "../base.api";
import { RedisServerService } from '../shared/redis-server.service';

export abstract class BusApi extends BaseApi {

    constructor() {
        super();
    }

    countryListUniversal(body: any): any {
        return {
            countryId: body.id,
            countryName: body.name,
            countryCode: body.code.toLowerCase()
        };
    }
}