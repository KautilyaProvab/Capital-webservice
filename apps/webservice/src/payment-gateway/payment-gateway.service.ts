import { MailerService } from "@nestjs-modules/mailer";
import { InjectPdf, PDF } from "nestjs-pdf";
const fs = require("fs");
import { getExceptionClassByCode } from "../all-exception.filter";
import { BaseApi } from "../base.api";
import { STRIPE_SECRET_KEY, logStoragePath } from "../constants";
import { BadRequestException, HttpService } from "@nestjs/common";
import { RedisServerService } from "../shared/redis-server.service";
const stripe = require("stripe")(STRIPE_SECRET_KEY);
export class PaymentGatewayService extends BaseApi {
  createPaymentResult: string;
  constructor( private readonly mailerService: MailerService,
    private redisServerService: RedisServerService,
    private readonly httpService: HttpService,
    @InjectPdf() private readonly pdf: PDF,) {
    super();
  }

async  new_test(){
  let mailBody = '<b>Booking Confirmed!</b>';
  await this.pdf({
    filename: './voucher/data/' + 'booking_reference' + '.pdf',
    template: 'data',
    locals: {
      test :" check"
    }
});
let attachments=[]
attachments.push({
    filename: 'booking_reference' + '.pdf',
    contentType: 'application/pdf',
    path: process.cwd() + '/voucher/data/' +'booking_reference' + '.pdf'
})

const { cc } = await this.getEmailConfig();

this.mailerService.sendMail({
    to: 'shivanimaragi1@gmail.com',
    cc,
    from: 'ajeet.kumarprovab@gmail.com',
    subject: "test",
    html: mailBody,
    attachments:attachments
})
    .then((t) => { })
    .catch((e) => { console.log(e) });

    return "CHECK SUCCESS"
}

async getEmailConfig() {
  try {
    const emailConfig = await this.manager.query(`
              SELECT * FROM cms_emailconfigs LIMIT 1
    `);

    const ccArr = emailConfig[0].cc.split(',').map((email: string) => email.trim())
    return { ...emailConfig[0], cc: ccArr }
  } catch (error) {
      console.log(error);
      return error
  }
}

  async checkoutPayment(body) {
    console.log("Stripe Payment",body)
    const response =await stripe.customers
      .create({
        email: body.stripeEmail,
        source: body.stripeToken,
        name: "Zee Business",
        address: {
          line1: '510 Townsend St',
          postal_code: '98140',
          city: 'San Francisco',
          state: 'CA',
          country: 'US',
        }
      })
      .then((customer) => {
        return stripe.charges.create({
          amount: body.amount,
          description: "Zee Business Test payment",
          currency: "USD",
          customer: customer.id,
        });
      })
      .then((charge) => {
        console.log("Success",charge)
        return charge
        // res.send("Success"); // If no error occurs
      })
      .catch((err) => {
        console.log("Error",err)
        const errorClass: any = getExceptionClassByCode(
          `400 ${err}`,
        );
        throw new errorClass(`400 ${err}`);
        // res.send(err); // If some error occurs
      }).then();
      console.log("Respose",response)
      return response;
  }

  async getPaymentGateWays(){
    const query = `
        SELECT * FROM ws_paymentgateway_list WHERE status=1
        `;
        try {
            const result = await this.manager.query(query);
            return result;
        } catch (error) {
            throw new BadRequestException(error);
        }
  }

  async requestAccessToken(result:any) {
    try {
      const headers: any = {
        'Content-Type': 'application/vnd.ni-identity.v1+json',
        'Authorization': `Basic ${result[0].authenticate}`
      };
      const token_url = `https://api-gateway.sandbox.ngenius-payments.com/identity/auth/access-token`;
      const response: any = await this.httpService
        .post(token_url, {}, { headers })  
        .toPromise();
        return response.access_token;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async formatPriceDetailToSelectedCurrency(currency: any) {
    try {
      const currencyDetails = await this.getGraphData(`
  query {
    cmsCurrencyConversions(where: {
                  currency: {
                      eq:"${currency}"
                  } 
              }
              ) {
      id
      currency
      value
      status
    }
    }
`, "cmsCurrencyConversions"
      );
      if (currencyDetails.length < 1) {
        throw new Error("No Currency Conversion Found");
      }
      return currencyDetails[0];
    }
    catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async createOrder(body:any){
    try {
      const query = `SELECT authenticate  FROM pg_setup WHERE em_code = "${body.emulator}"`;
      const result = await this.manager.query(query);
      let getToken  = await this.requestAccessToken(result);
      let Conversion_Rate = 1;
      let currencyDetails;
      if(body.Currency && body.Currency !="AED"){
        currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.Currency);
        Conversion_Rate = Number(currencyDetails['value']);
      }
      let amount = body.Amount * Conversion_Rate;
      let amountInCents = Math.round(amount * 100);
      let createOrderUrl = `https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/3a64c473-5562-42c4-83af-a96103669a30/orders`;
      let headers = {
        "Authorization" :`Bearer ${getToken}`,
        "Content-Type" :"application/vnd.ni-payment.v2+json",
        "Accept" :"application/vnd.ni-payment.v2+json"  
      };
      let request =   {  
        "action":"SALE",   
        "amount" :{"currencyCode":"AED","value":amountInCents}
      }
      const orderResponse: any = await this.httpService
        .post(createOrderUrl,request,{headers})  
        .toPromise();
        if (this.isLogXml) {
          fs.writeFileSync(
            `${logStoragePath}/hotels/Irix/Payment_GateWay_RQ_${body.app_reference}.json`,
            JSON.stringify(request)
          );
          fs.writeFileSync(
            `${logStoragePath}/hotels/Irix/Payment_GateWay_RS_${body.app_reference}.json`,
            JSON.stringify(orderResponse)
          );
        }
        let responseData = {
          payment : orderResponse._links.payment.href
        }
      return responseData;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }
  
}
