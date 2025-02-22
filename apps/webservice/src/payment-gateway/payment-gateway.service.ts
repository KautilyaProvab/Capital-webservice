import { MailerService } from "@nestjs-modules/mailer";
import { InjectPdf, PDF } from "nestjs-pdf";

import { getExceptionClassByCode } from "../all-exception.filter";
import { BaseApi } from "../base.api";
import { STRIPE_SECRET_KEY } from "../constants";
import { BadRequestException } from "@nestjs/common";
const stripe = require("stripe")(STRIPE_SECRET_KEY);
export class PaymentGatewayService extends BaseApi {
  createPaymentResult: string;
  constructor( private readonly mailerService: MailerService,
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
}
