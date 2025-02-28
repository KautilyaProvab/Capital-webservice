import { Global, HttpModule, Module } from "@nestjs/common";
import { UserTravellersController } from "./user/user-travellers.controller";
import { UserTravellerService } from "./user/user.traveller.service";
import { RedisServerService } from "../shared/redis-server.service";


@Module({
    imports: [],
    controllers: [
        UserTravellersController
    ],
    providers: [
      UserTravellerService,RedisServerService
    ]
})
export class UserModule { }