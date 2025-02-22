import { Body, Req } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { BaseApi } from "apps/webservice/src/base.api";

export class CoreDomainService extends BaseApi {

  constructor() {
    super();
  }
  
  async domainInformationList(@Body() body, @Req() req: any) {
    try {
      const result = this.getGraphData(
        `{
                wsDomains{
                  ws_currency_converter_id
                  domain_name
                  domain_website
                  domain_logo
                  email
                  phone
                  address                      
                }
              }
              `,
        "wsDomains"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
}
