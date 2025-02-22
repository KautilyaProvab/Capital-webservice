import { Injectable } from "@nestjs/common";
import { RedisService } from "nestjs-redis";

@Injectable()
export class AppService {
    constructor(
        private readonly redisService: RedisService
    ) { }

    getHello(): string {
        return `
        1. <a href="/ws-flight-docs">Flight Api Documentation</a><br/><br/>
        2. <a href="/ws-car-docs">Car Api Documentation</a><br/><br/>
        3. <a href="/ws-activity-docs">Activity Api Documentation</a><br/><br/>
        4. <a href="/ws-hotel-docs">Hotel Api Documentation</a><br/><br/>
        5. <a href="/ws-home-docs">Home Api Documentation</a><br/><br/>
        6. <a href="/ws-common-docs">Common Api Documentation</a><br/><br/>
        `;
    }

    getRedisData(): any {
        const client = this.redisService.getClient();
        return (client as any).get("getHello");
    }

    setRedisData(body: any): any {
        const client = this.redisService.getClient();
        return (client as any).set("project", body["project"]);
    }
}
