import * as moment from 'moment';
import { formatDate } from "../app.helper";
import { BaseApi } from "../base.api";
import { RedisServerService } from '../shared/redis-server.service';
export abstract class TransferApi extends BaseApi {

    constructor() {
        super();
    }

    
}
