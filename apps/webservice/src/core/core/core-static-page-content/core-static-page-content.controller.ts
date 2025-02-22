import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req} from "@nestjs/common";
import { CoreStaticPageContentService } from "./core-static-page-content.service";
import { CoreStaticPageContentList, DiscountInformationListDto } from "./swagger/core-static-page.dto";

@Controller("core/core-staticPageContent")
export class CoreStaticPageContentController {
  constructor(
    private readonly coreStaticPageService: CoreStaticPageContentService
  ) {}

  @Post("staticPageContentList")
  @HttpCode(200)
  async staticPageContentList(@Body() body: CoreStaticPageContentList): Promise<any> {
    const result = await this.coreStaticPageService.staticPageContentList(body);
    return result;
  }

  @Post("socialNetworks")
  @HttpCode(200)
  async socialNetworks(@Body() body: any, @Req() req: any): Promise<any> {
    const result = await this.coreStaticPageService.socialNetworks(body, req);
    return result;
  }

  @Post("discountInformation")
  @HttpCode(200)
  async discountInformation(@Body() body: DiscountInformationListDto, @Req() req: any): Promise<any> {
    const result = await this.coreStaticPageService.discountInformation(body, req);
    return result;
  }

  
}
