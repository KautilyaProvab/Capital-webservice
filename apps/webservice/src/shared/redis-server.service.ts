import { BadRequestException, Injectable } from "@nestjs/common";
import { RedisService } from "nestjs-redis";

export const DB_SAFE_SEPARATOR = '***';
const crypto = require('crypto');

@Injectable()
export class RedisServerService {

    private _ttl = 1200000000;
    private readonly client = this.redisService.getClient();

    constructor(private redisService: RedisService) { }

    async store_string(key: string, value: string): Promise<any> {
        return await (this.client as any).setex(key, 100, value);
    }

    async store_list(key: string, value: string): Promise<any> {
        const result = await (this.client as any).rpush(key, value);
        await this.set_expiry(key);
        return result;
    }

    async read_string(key: string): Promise<any> {
        return await (this.client as any).get(key);
    }

    async read_list(key: any, offset: number = -1, limit: number = -1): Promise<any> {   
        key = key.split(DB_SAFE_SEPARATOR);
        
        const access_key = key[0];
        
        if (offset == -1 || limit == -1) {
            offset = key[1] - 1;
            limit = key[1] - 1;
        }
        const result = await (this.client as any).lrange(access_key, offset, limit);
   
        if (Object.keys(result || {}).length < 1) {
            throw new BadRequestException('session expired!');
        }
        return result;
    }

    async set_expiry(key: any) {
        await (this.client as any).expire(key, this._ttl);
    }

    async insert_record(key: any, value: string): Promise<any> {
        const index = await this.store_list(key, value);
        const randonNumber = Math.ceil(Math.random() * 10000);
        return {
            'access_key': key + DB_SAFE_SEPARATOR + index + DB_SAFE_SEPARATOR + randonNumber,
            'index': index
        }
    }

    geneateResultToken(searchData: any) {
        const randonNumber = Math.ceil(Math.random() * 10000);
        const token = crypto.createHash('md5').update(JSON.stringify(searchData) + '_' + randonNumber).digest("hex");
        return token;
    }
}