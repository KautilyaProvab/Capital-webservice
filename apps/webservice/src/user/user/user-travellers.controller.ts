import { Controller, Post, Body, UseGuards, Req, Res, Get } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AddUserTravellerDto, DeleteUserTravellerDto, UpdateUserTravellerDto, UserTravellerListDto } from "./swagger/user-travellers.dto";

import { UserTravellerService } from "./user.traveller.service";

@Controller("user")
export class UserTravellersController {
  constructor(
    private readonly userTravellellersService: UserTravellerService
  ) {}

  @Post("userTravellersList")
  @UseGuards(AuthGuard("jwt"))
  async userTravellersList(
    @Body() body: UserTravellerListDto,
    @Req() req: any
  ): Promise<any> {
    const result = await this.userTravellellersService.getUserTravellersList(
      body,
      req
    );
    return result;
  }

  @Post("addUserTraveller")
  @UseGuards(AuthGuard("jwt"))
  async addUserTraveller(
    @Body() body: AddUserTravellerDto,
    @Req() req: any
  ): Promise<any> {
    const result = await this.userTravellellersService.addUserTraveller(
      body,
      req
    );
    return result;
  }

  @Post("updateUserTraveller")
  @UseGuards(AuthGuard("jwt"))
  async updateUserTraveller(
    @Body() body: UpdateUserTravellerDto,
    @Req() req: any
  ): Promise<any> {
    const result = await this.userTravellellersService.updateUserTraveller(
      body,
      req
    );
    return result;
  }

  @Post("deleteUserTraveller")
  @UseGuards(AuthGuard("jwt"))
  async deleteUserTraveller(
    @Body() body: DeleteUserTravellerDto,
    @Req() req: any
  ): Promise<any> {
    const result = await this.userTravellellersService.deleteUserTraveller(
      body,
      req
    );
    return result;
  }

  @Get('getWallet')
  @UseGuards(AuthGuard('jwt'))
  async getWallet(@Body() body: any, @Req() req: any): Promise<any> {
      return await this.userTravellellersService.getWallet(body, req);
  }
}
