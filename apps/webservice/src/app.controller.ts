import { Body, Controller, Get, Header, Post } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    @Header('content-type', 'text/html')
    getHello(): string {
        return this.appService.getHello();
    }

    @Get("redis-example")
    getRedisData(): any {
        return this.appService.getRedisData();
    }

    @Post("redis-post")
    setRedisData(@Body() body: any): any {
        return this.appService.setRedisData(body);
    }
}
