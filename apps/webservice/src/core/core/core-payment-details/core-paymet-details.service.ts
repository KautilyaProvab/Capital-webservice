import { Body, Injectable, Req } from "@nestjs/common";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { BaseApi } from "../../../base.api";

@Injectable()
export class CorePaymentDetailsService extends BaseApi {

  constructor() {
    super();
  }
  
  async addCorePaymentDetails(@Body() body ,@Req() req): Promise<any> {
    try {
      const result = await this.getGraphData(
        `mutation{
          createCorePaymentDetail(corePaymentDetail:{
            created_by_id:${req.user.id}
            card_type:"${body.card_type}"
            card_holder_name:"${body.card_holder_name}"
            card_number:"${body.card_number}"
            expiry_date:"${body.expiry_date}"
            set_as_preferred:${body.set_as_preferred}
            address:"${body.address}"
            address1:"${body.address1}"
            city:"${body.city}"
            state:"${body.state}"
            country:${12}
            postal_code:"${body.postal_code}"
            status:${1}
          }){
            id
            created_by_id
            card_type
            card_holder_name
            expiry_date
            set_as_preferred
            address
            address1
            city
            state
            country
            postal_code
            status
          }
        }
          `,
        "createCorePaymentDetail"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async deleteCorePaymentDetails(@Body() body,@Req() req): Promise<any> {
    try {
      const result = this.getGraphData(
        `mutation{
            deleteCorePaymentDetail(id:${body.id})
          }`,
        "deleteCorePaymentDetail"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getCorePaymentDetailsList(@Body() body,@Req() req): Promise<any> {
    try {
      const result = this.getGraphData(
        `query{
            corePaymentDetails(where:{
              created_by_id:{
                eq:${req.user.id}
              }
              status:{
                eq:${1}
              }
            }){
              id
              card_type
              card_holder_name
              card_number
              expiry_date
              set_as_preferred
              address
              address1
              city
              state
              country
              postal_code
            }
          }`,
        "corePaymentDetails"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
}
