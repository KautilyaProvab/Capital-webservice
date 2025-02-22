import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req} from "@nestjs/common";
import { CoreDomainService } from "./core-domain.service";

@Controller("core/core-domain")
export class CoreDomainController {
  constructor(private readonly coreDomainService: CoreDomainService) {}

  @Post("domainInformationList")
  @HttpCode(200)
  async domainInformationList(
    @Body() body: any,
    @Req() req: any
  ): Promise<any> {
    const result = await this.coreDomainService.domainInformationList(
      body,
      req
    );
    return result;
  }
}
