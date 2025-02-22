import { Body, Req } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { BaseApi } from "apps/webservice/src/base.api";

export class CoreEmailSubscriptionsService extends BaseApi {

  constructor() {
    super();
  }

  async addemailSubscription(@Body() body: any) {
    let created_by_id = 0;
    if (body.created_by_id) {
      created_by_id = body.created_by_id;
    }

    try {
      const emailCheck = await this.getGraphData(
        `{
          coreEmailSubscriptions(where:{
            email_id:{eq:"${body.email_id}"}
            module:{eq:"${body.module}"}
            subscription_type:{eq:"${body.subscription_type}"}
          }){
            id
          }
        }`,
        "coreEmailSubscriptions"
      );
      if (emailCheck.length !== 0) {
        return "EmailID Already Exists for the subscription type";
      }
      const result = this.getGraphData(
        `mutation{
          createCoreEmailSubscription(coreEmailSubscription:{
            email_id:"${body.email_id}"
            subscription_type:"${body.subscription_type}"
            module:"${body.module}"
            status:1
            created_by_id:${created_by_id}
          }){
            id
            created_at
            email_id
            subscription_type
            module
            created_by_id
            status
          }
        }
              `,
        "createCoreEmailSubscription"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async emailSubscriptionsList(@Body() body: any, @Req() req: any) {
    try {
      const result = this.getGraphData(
        `{
            coreEmailSubscriptions(take:1000,where:{
              status:{eq:1}
            })
            {
              id
              created_at
              email_id
              subscription_type
              module
              created_by_id
            }
          }
              `,
        "coreEmailSubscriptions"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
}
