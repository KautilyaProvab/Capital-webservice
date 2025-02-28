import { Body, Injectable, Req } from "@nestjs/common";
import { getExceptionClassByCode } from "../../all-exception.filter";
import { BaseApi } from "../../base.api";
import { v4 as uuidv4 } from 'uuid';
import { RedisServerService } from "../../shared/redis-server.service";

@Injectable()
export class UserTravellerService extends BaseApi {
  constructor(
    private redisServerService: RedisServerService,
  ) {
    super();
  }

  async addUserTraveller(@Body() body, @Req() req): Promise<any> {
    try {
      const result = await this.getGraphData(
        `mutation{
                createUserTraveller(userTraveller:{
                  title:"${body.title}"
                  lead_user_id:${req.user.id}
                  first_name:"${body.first_name}"
                  middle_name:"${body.middle_name ? body.middle_name : ""}"
                  last_name:"${body.last_name}"
                  email:"${body.email}"
                  date_of_birth:"${body.date_of_birth}"
                  gender:"${body.gender}"
                  phone_number:"${body.phone_number}"
                  address:"${body.address ? body.address1 : ""}"
                  address1:"${body.address1 ? body.address1 : ""}"
                  city:"${body.city ? body.city : ""}"
                  state:"${body.state ? body.state : ""}"
                  country:"${body.country ? body.country : "BGD"}"
                  postal_code:"${body.postal_code ? body.postal_code : ""}"
                  passport_no:"${body.passport_no ? body.passport_no : ""}"
                  passport_expiry:"${body.passport_expiry ? body.passport_expiry : ""}"
                  issuing_country:"${body.issuing_country ? body.issuing_country : "BGD"}"
                  created_by_id:${req.user.id}
                  status:${1}
                }){
                  id
                  lead_user_id
                  title
                  first_name
                  last_name
                  email
                  phone_number
                  date_of_birth
                  gender
                  address
                  address1
                  country
                  state
                  city
                  postal_code
                  passport_no
                  passport_expiry
                  issuing_country
                  status
                }
              }`,
        "createUserTraveller"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async updateUserTraveller(@Body() body, @Req() req): Promise<any> {
    try {
      const result = this.getGraphData(
        `mutation{
      updateUserTraveller(
        id:${body.id},
        userTravellerPartial:{
          title:"${body.title}"
          first_name:"${body.first_name}"
          middle_name:"${body.middle_name}"
          last_name:"${body.last_name}"
          email:"${body.email}"
          phone_number:"${body.phone_number}"
          date_of_birth:"${body.date_of_birth}"
          gender:"${body.gender}"
          country:"${body.country}"
          postal_code:"${body.postal_code}"
          passport_no:"${body.passport_no}"
          passport_expiry:"${body.passport_expiry}"
          issuing_country:"${body.issuing_country}"
        })
    }
    `,
        "updateUserTraveller"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async deleteUserTraveller(@Body() body, @Req() req): Promise<any> {
    try {
      const result = this.getGraphData(
        `mutation{
      deleteUserTraveller(id:${body.id})
    }`,
        "deleteUserTraveller"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getUserTravellersList(@Body() body, @Req() req): Promise<any> {
    try {
      const result = this.getGraphData(
        `{
        userTravellers(where:{
          lead_user_id:{
            eq:${req.user.id}
          }
          status:{
            eq:${1}
          }
        }){
          id
          lead_user_id
          title
          first_name
          middle_name
          last_name
          phone_number
          email
          date_of_birth
          gender
          address
          address1
          city
          state
          country
          postal_code
          passport_no
          passport_expiry
          issuing_country
          status
        }
      }`,
        "userTravellers"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getWallet(body:any,req:any):Promise<any>{
    try {
        let userId = req.user.id
        let walletType = body['Wallet']
        const query = `SELECT * FROM b2c_users WHERE auth_user_id = ${userId}`;
        const res_data = await this.manager.query(query);
        const emcode = `SELECT em_code FROM emulator WHERE currency = "${walletType}"`;
        const em_codeResponse = await this.manager.query(emcode)
        let depositBalance ='';
        if(walletType == 'IQD'){
            depositBalance = res_data[0].IQD_balance
        }else if(walletType == 'USD'){
            depositBalance = res_data[0].balance
        }
        // let exchangeRate = await this.currencyMgmt.CurrencyConvertor('USD',walletType,depositBalance)
        let response = {
          'WalletCurrency':walletType,
          'WalletAmount':depositBalance,
          'EmullatorCode':em_codeResponse[0].em_code,
      } 
        return response;
    } catch (error) {
        throw new Error(error);
    }
}
}
