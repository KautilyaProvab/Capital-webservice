import { Global, HttpModule, Module } from "@nestjs/common";
import { UserTravellersController } from "./user/user-travellers.controller";
import { UserTravellerService } from "./user/user.traveller.service";


@Module({
    imports: [],
    controllers: [
        UserTravellersController
    ],
    providers: [
      UserTravellerService
    ]
})
export class UserModule { }