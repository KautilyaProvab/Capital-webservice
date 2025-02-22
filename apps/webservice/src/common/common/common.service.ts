import {
  BadRequestException,
  Body,
  Get,
  Global,
  HttpCode,
  HttpService,
  Injectable,
  Param,
  Res,
  HttpException,
} from "@nestjs/common";
import * as  moment from 'moment';
import { getExceptionClassByCode } from "../../all-exception.filter";
import { formatDepartDate } from "../../app.helper";
import { SMS_FROM, SMS_PASSWORD, SMS_USERNAME } from "../../constants";
import { CommonApi } from "../common.api";
import { CommonCityListDto } from "./swagger/common-city-list.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { RedisService } from "nestjs-redis";
const fetch = require("node-fetch");
var btoa = require("btoa");
const crypto = require("crypto");
const OTP_TIMEOUT = 300;
const OTP_RETRY_LIMIT = 5;
@Injectable()
export class CommonService extends CommonApi {
  findAllState(body: {
    core_country_id: string;
    offset: number;
    limit: number;
  }): any {
    return this.manager.query(
      `SELECT * FROM core_states WHERE core_country_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [body.core_country_id, body.limit, body.offset]
    );
  }
  private readonly redisClient = this.redisService.getClient();

  async generateOTP(email: string) {
    try {
      const result = await this.manager.query(
        "SELECT id FROM auth_users WHERE email = ? AND auth_role_id=6 ORDER BY id DESC",
        [email]
      );
      if (result.length > 0) {
        throw new Error("409 User already exists");
      }
      const buffer = crypto.randomBytes(3); // Generate 3 random bytes
      let otp: any = "";
      otp = parseInt(buffer.toString("hex"), 16) % 1000000; // Convert to a 6-digit number
      if (otp.toString().length < 6) {
        otp = otp.toString().padStart(6, "0");
      }
      await (this.redisClient as any).set(`${email}`, otp.toString(), "EX", OTP_TIMEOUT);
      await (this.redisClient as any).set(`${email}_count`, "0", "EX", OTP_TIMEOUT);
      const { cc } = await this.getEmailConfig();
      
      await (this.mailerService as any).sendMail({
        to: email,
        from: `booking247@gmail.com`,
        cc,
        subject: "OTP for Booking247 Supplier Login Validation",
        template: process.cwd() + "/templates/otp.hbs",
        context: {
          otp,
        },
      });
      return { message: "OTP has been sent to your email" };
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
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

  async validateOTP(req: any, email: string, otp: string) {
    const result = await (this.redisClient as any).get(`${email}`);
    const count = await (this.redisClient as any).get(`${email}_count`);

    if (!result || !count) {
      throw new HttpException("OTP not found or expired", 404);
    }

    const count_int = parseInt(count);
    if (count_int > OTP_RETRY_LIMIT) {
      await this.deleteOTP(email);
      throw new HttpException("OTP limit exceeded", 400);
    }

    await (this.redisClient as any).set(
      `${email}_count`,
      count_int + 1,
      "EX",
      OTP_TIMEOUT
    );
    if (result != otp) {
      throw new HttpException(
        `OTP INVALID ${OTP_RETRY_LIMIT - count_int} attemps left`,
        400
      );
    }
    //remove otp from db
    await this.deleteOTP(email);
    return true;
  }
  private async deleteOTP(email: string) {
    await (this.redisClient as any).del(email);
    await (this.redisClient as any).del(`${email}_count`);
  }
  async findAllMeals(): Promise<any> {
    return await this.manager.query(`SELECT * FROM meals_masters`);
  }
  async findAllViews(): Promise<any> {
    return await this.manager.query(`SELECT * FROM views_masters`);
  }
  async findAllCity(query: string): Promise<any> {
    return await this.manager.query(
      `SELECT id, CityCode, city_name FROM city_list_dcb WHERE city_name LIKE '%${query}%'`
    );
  }
  async findAllHotelType(): Promise<any> {
    return await this.manager.query("SELECT * FROM hotel_hotel_types");
  }
  async findAllCountry(): Promise<any> {
    return await this.manager.query(`SELECT * FROM core_countries`);
  }

  constructor(
    private httpService: HttpService,
    private readonly mailerService: MailerService,
    private readonly redisService: RedisService
  ) {
    super();
  }
  async getCommonCities(body: CommonCityListDto) {
    const query = `SELECT distinct cc.id, cc.city_name ,cc.longitude,cc.latitude,cc.top_destination,cc.common_country_id ,cr.name, cr.country_code FROM zb_new.common_countries as cr left join zb_new.common_cities cc on cr.id=cc.common_country_id where city_name like "${body.city_name}%" LIMIT 15;`;
    const result = await this.manager.query(query);
    return result.map((t) => {
      const tempData = {
        city_name: t.city_name,
        longitude: t.longitude,
        latitude: t.latitude,
        top_destination: t.top_destination,
        country_name: t.name,
        country_code: t.country_code,
        country_id: t.common_country_id,
        source: "db",
      };
      return this.getCommonCitiesUniversal(tempData);
    });
  }

  async usdToAnyCurrency(body: any): Promise<any> {
    const result = await this.usdToAnyCurrencyBaseApi(body["currency_code"]);
    return { result, message: "" };
  }

  async anyCurrencyToUSD(body: any): Promise<any> {
    const result = await this.anyCurrencyToUSDBaseApi(body["currency_code"]);
    return { result, message: "" };
  }

  async getPaymentCharges(body: any): Promise<any> {
    if (body.module) {
      try {
        const result = this.getGraphData(
          `{
                corePaymentCharges(where:{
                  module : {eq:"${body.module}"}
                }){
                  id
                  created_at
                  module
                  fees_type
                  fees
                  added_per_pax
                  created_by_id
                  status
                }
              }`,
          "corePaymentCharges"
        );
        return result;
      } catch (error) {
        const errorClass: any = getExceptionClassByCode(error.message);
        throw new errorClass(error.message);
      }
    } else {
      return "Module not Sent";
    }
  }
  async promoCodeExists(promocode: string) {
    const promoCode = await this.getGraphData(
      `{
                corePromocodes(where:{
                  promo_code:{
                    eq: "${promocode}"
                  }
                 }){
                  id
              }
            }`,
      "corePromocodes"
    );
    if (promoCode.length > 0) {
      return true;
    }
    return false;
  }
  async getPromoCodeInfo(body: any): Promise<any> {
    const currentDateTime = new Date();
    const currentDate = `${currentDateTime.getFullYear()}-0${currentDateTime.getMonth() +
      1}-${currentDateTime.getDate()}`;
    if (body.promocode) {
      try {
        const promoCode = await this.promoCodeExists(body.promocode);
        if (promoCode) {
          const result = await this.getGraphData(
            `{
                corePromocodes(where:{
                  promo_code:{
                    eq: "${body.promocode}"
                  }
                      expiry_date:{
                    gte :"${currentDate}"
                  }
              start_date:{
                    lte :"${currentDate}"
                  }
              
                }){
                  id
                  created_at
                  promo_code
                  promo_image
                  description
                  discount_type
                  discount_value
                  use_type
                  start_date
                  expiry_date
                  created_by_id
              }
              }`,
            "corePromocodes"
          );
          if (result.length > 0) {
            return result;
          } else {
            return "Promo Code Expired";
          }
        } else {
          return "Promo Code Not Found";
        }
      } catch (error) {
        const errorClass: any = getExceptionClassByCode(error.message);
        throw new errorClass(error.message);
      }
    } else {
      return "Promocode not sent";
    }
  }

  async mainBannerImagesList(body: any): Promise<any> {
    try {
      const result = this.getGraphData(
        `query{
            coreMainBannerImages(where:{
            status :{ 
              eq : ${1}
          }
            }){
              id
              image_url
              status
              title
              description
              sequence
              created_by_id
            }
          }`,
        "coreMainBannerImages"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getStaticPageModules(body: any): Promise<any> {
    try {
      const result = await this.getGraphData(
        `
                    query {
                      commonStaticPages(where:{
                      }
                    ) {
                    id
                    module_type
                    }
                }
            `,
        "commonStaticPages"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
  async CountryList(): Promise<any> {
    const coreCountries = await this.getGraphData(
      `query {
        coreCountries(take: 300) {
            id
            name
            code
            flag_url
            status
        }
    }`,
      "coreCountries"
    );
    return {
      result: {
        popular_countries: [],
        countries: coreCountries,
      },
      message: "",
    };
  }

  async listPromocode(body: any): Promise<any> {
    try {
      body.Currency = body.Currency ? body.Currency: "GBP"

      let query = "";
      if (body.promo_code) {
        query = query.concat(`promo_code:{eq: "${body.promo_code}"}`);
      }
      if (body.category) {
        query = query.concat(`category:{eq: "${body.category}"}`);
      }
      query = query.concat(`status:{eq: "1"}`);
      const result = await this.getGraphData(
        `
                    query {
                      corePromocodes(take:1000, where:{
                    ${query}
                   }
                    ) {
                    id
                    promo_code
                    promo_image
                    description
                    category
                    promo_image
                    discount_type
                    discount_value 
                    use_type 
                    limitation
                    start_date 
                    expiry_date 
                    status
                    }
                }
            `,
        "corePromocodes"
      );

      const currentDate = moment();
      const formattedDate = currentDate.format('YYYY-MM-DD');
      
      const validPromocodes = result.filter((promo: any) => {
        const expiryDate = moment(promo.expiry_date);
        return expiryDate.isSameOrAfter(formattedDate)
      });
      const currencyDetails = body.Currency !== "GBP" ? await this.formatPriceDetailToSelectedCurrency(body.Currency) : { value: 1, currency: "GBP" };

      return validPromocodes.map((promo: any) => {
        if (promo.discount_type === "plus") {
            promo.discount_value = (promo.discount_value * currencyDetails.value).toFixed(2);
        }
        return promo;
    });
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async listRefundPolicies(body: any): Promise<any> {
    try {
      const result = this.getGraphData(
        `query{
                    cmsRefundPolicies(take:1000
                        where:{
                            status:{
                              eq:1
                            }
                        }
                    ){
                        id
                        refund_policy_description   
                        status
                        created_at
                    }
                }`,
        "cmsRefundPolicies"
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async coreTestimonialContentList(body): Promise<any> {
    try {
      const result = this.getGraphData(
        `{
          coreTestimonialContents(take:1000,where:{
                  status:{
                    eq:1
                  }
                }){
                  id
                  image
                  title
                  description
                  status
                }
              }`,
        "coreTestimonialContents"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async coreDiscountContentList(body): Promise<any> {
    try {
      const result = this.getGraphData(
        `{
          coreDiscountContents(take:1000,where:{
                  status:{
                    eq:1
                  }
                }){
                  id
                  image
                  title
                  description
                  discount_type
                  discount_value
                  status
                }
              }`,
        "coreDiscountContents"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getPhoneCodeList() {
    const result = await this.getGraphData(
      `
            query {
                coreCountries(
                    take: 500
                    where: {
                        status: {
                        eq: true
                        }
                    }
                ) {
                    id
                    name
                    code
                    phone_code
                    status
                }
            }
        `,
      "coreCountries"
    );
    return result;
  }

  async currentMonthRecordList(body: any, req: any) {
    const carQuery = `SELECT * FROM car_bookings WHERE MONTH(created_at) = MONTH("${body.date}") AND YEAR(created_at) = YEAR("${body.date}") AND created_by_id = '${req.user.id}'`;
    const flightQuery = `SELECT * FROM flight_bookings WHERE MONTH(created_at) = MONTH("${body.date}") AND YEAR(created_at) = YEAR("${body.date}") AND created_by_id = '${req.user.id}'`;
    const hotelQuery = `SELECT * FROM hotel_hotel_booking_details WHERE MONTH(created_at) = MONTH("${body.date}") AND YEAR(created_at) = YEAR("${body.date}") AND created_by_id = '${req.user.id}'`;
    const carResult = await this.manager.query(carQuery);
    const flightResult = await this.manager.query(flightQuery);
    const hotelResult = await this.manager.query(hotelQuery);
    return [{ carResult, flightResult, hotelResult }];
  }

  async createAppReference(body: any) {
    try {
      let query = "";
      if (body.module == "flight") {
        query = `SELECT app_reference FROM flight_bookings ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "hotel") {
        query = `SELECT app_reference FROM hotel_hotel_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "bus") {
        query = `SELECT app_reference FROM bus_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "transfer") {
        query = `SELECT app_reference FROM transfer_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "activity") {
        query = `SELECT app_reference FROM activity_booking_details ORDER BY ID DESC LIMIT 1`;
      } else if (body.module == "tour") {
        query = `SELECT app_reference FROM tour_booking_details ORDER BY ID DESC LIMIT 1`;
      }
      const result = await this.manager.query(query);
      let last_app_reference: any;
      if (result[0]) {
        last_app_reference = result[0].app_reference;
      }
      if (last_app_reference && (last_app_reference.startsWith("AWT") || last_app_reference.startsWith("BG"))) {
        const number = parseInt(last_app_reference.split("-")[1]) + 1;
        const number_length = JSON.stringify(number).length;
        var serialNumber = JSON.stringify(number);
        if (number_length == 1) {
          serialNumber = "00" + number;
        } else if (number_length == 2) {
          serialNumber = "0" + number;
        }
        const app_reference =
          last_app_reference.substring(0, 4) +
          formatDepartDate(new Date()) +
          "-" +
          serialNumber;
        return app_reference;
      } else {
        var app_reference = "";
        if (body.module == "hotel") {
          app_reference = "AWTH" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "flight") {
          app_reference = "AWTF" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "bus") {
          app_reference = "AWTB" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module === "tour") {
          app_reference = "AWTT" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "activity") {
          app_reference = "AWTA" + formatDepartDate(new Date()) + "-" + "001";
        } else if (body.module == "transfer") {
          app_reference = "BGTR" + formatDepartDate(new Date()) + "-" + "001";
        }
        return app_reference;
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async titleList(body: any): Promise<any[]> {
    const result = await this.getGraphData(
      `query {
                authUserTitles {
                    id
                    title
                    pax_type
                }
            }`,
      "authUserTitles"
    );
    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.titleListUniversal(tempData);
    });
  }

  titleListUniversal(body: any): any {
    return {
      titleId: body.id,
      titleName: body.title,
      paxType: body.pax_type,
    };
  }

  async paymentConfirmation(body: any, req: any): Promise<any> {
    let booking_details = [];
    try {
      const payment_info = await this.getGraphData(
        `
      {
          paymentGatewayDetails(where : {
            app_reference :{eq : "${body.app_reference}"}
            order_id:{eq : "${body.order_id}"}
          }){
            status
          }
        }
      `,
        "paymentGatewayDetails"
      );
      if (body.app_reference.startsWith("TLNF")) {
        booking_details = await this.getGraphData(
          `
          {
            flightBookings(where:{
              app_reference :{eq:"${body.app_reference}"}
            }){
                booking_status
            }  
          }
      `,
          "flightBookings"
        );
      } else if (body.app_reference.startsWith("TLNH")) {
        booking_details = await this.getGraphData(
          `
          {
            hotelHotelBookingDetails(where:{
              app_reference :{eq:"${body.app_reference}"}
            }){
                booking_status:status
            }  
          }
      `,
          "hotelHotelBookingDetails"
        );
      }
      if (payment_info[0] && booking_details[0]) {
        if (
          payment_info[0].status === "completed" &&
          booking_details[0].booking_status === "BOOKING_HOLD"
        ) {
          return true;
        } else {
          return false;
        }
      }
      return false;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async authorizationKey() {
    let clientID = "V1:142068:E3ID:AA";
    let clientSecret = "tln1213";
    let clientIDEncoded = Buffer.from(clientID).toString("base64");
    let clientSecretEncoded = Buffer.from(clientSecret).toString("base64");
    console.log(clientIDEncoded);
    console.log(clientSecretEncoded);
    let authorization = Buffer.from(
      clientIDEncoded + ":" + clientSecretEncoded
    ).toString("base64");
    console.log("Authorization", authorization);
  }

  async sendSMS(msg, to) {
    const udh_content = btoa("HeaderTEST");
    const username = `${SMS_USERNAME}`;
    const password = `${SMS_PASSWORD}`;
    // const to = result[0].phone_code + result[0].phone
    const from = `${SMS_FROM}`;
    var url = `https://http.myvfirst.com/smpp/sendsms?username=${username}&password=${password}&to=${to}&udh=${udh_content}&from=${from}&text=${msg}&dlr-url=http://54.198.46.240:4008/b2b/common/dlrurl`;
    var givenUrl = `https://http.myvfirst.com/smpp/sendsms?username=${username}&password=${password}&to=${to}&from=${from}&text=${msg}&category=bulk`;
    const smsResult: any = await this.httpService
      .get(givenUrl, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
        },
      })
      .toPromise();
    if (smsResult) return true;
  }
  async AddContactList(@Body() body: any) {
    try {
      const query = `INSERT INTO 
          contact_us(first_name,last_name,contact_no,contact_email,description) 
          VALUES 
          ('${body.first_name}','${body.last_name}','${body.contact_no}','${body.contact_email}','${body.description}')`;
      const result = await this.manager.query(query);
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(`400 Already exists!`);
      throw new errorClass(`400 Already exists!`);
    }
  }
  async ListFaq(@Body() body: any) {
    try {
      const user_type = 'B2B';
      let query = `SELECT faq.id,faq.question,faq.answer FROM faq WHERE user_type = '${user_type}'`;
      const queryParams: any[] = [];
      if (body && body.id) {
        query += " WHERE id = ?";
        queryParams.push(body.id);
      }
      const result = await this.manager.query(query, queryParams);
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(
        `400 Something Went Wrong!`
      );
      throw new errorClass(`400 Something Went Wrong!`);
    }
  }
  async ListCustomerFaq(@Body() body:any){
    try {
      const user_type = 'B2C'
      let query=`SELECT faq.id,faq.question,faq.answer,faq.status,faq.user_type FROM faq WHERE user_type='${user_type}'`;
      const result= await this.manager.query(query);
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(`400 Something Went Wrong!`);
      throw new errorClass(`400 Something Went Wrong!`);
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
            throw new Error("400 No Currency Conversion Found");
        }
        return currencyDetails[0];
    }
    catch (error) {
        const errorClass: any = getExceptionClassByCode(error.message);
        throw new errorClass(error.message);
    }
  }

  getTransportConfig(service: string) {
    const configs = {
      default: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // upgrade later with STARTTLS
          auth: {
              user: 'bookings@booking247.com',
              pass: 'pcof nuqd vhnz pjsm',
          },
      },
      noreply: {
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
              user: 'noreply@booking247.com',
              pass: 'gGG72un2MUJU6rG&',
          },
      },
  };
    return configs[service] || configs.default;
}
}
