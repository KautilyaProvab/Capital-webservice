import { Injectable } from "@nestjs/common";
import { ActivityApi } from "../activity.api";
import { getExceptionClassByCode } from "../../all-exception.filter";
import { RedisServerService } from "../../shared/redis-server.service";
import * as moment from "moment";
import { MailerService } from "@nestjs-modules/mailer";
import { SUPPORT_EMAIL } from "../../constants";
import { formatHotelDateTime } from "../../app.helper";
import { InjectPdf, PDF } from "nestjs-pdf";

@Injectable()
export class ActivityDbService extends ActivityApi {
  constructor(
    private redisServerService: RedisServerService,
    private readonly mailerService: MailerService,
    @InjectPdf() private readonly pdf: PDF,
  ) {
    super()
  }

  async getDestinations(body: any) {
    const result = await this.manager.query(`SELECT id,
       destination_name, 
       destination_id,
       destination_type,
       timeZone,
       iataCode,
       lat,
       lng 
             FROM activity_master_destinations 
           WHERE destination_name LIKE "%${body.DestName}%" 
             ORDER BY destination_name ASC
`)

    return result.map((t) => {
      const tempData = {
        ...t,
        source: "db",
      };
      return this.getDestinationsUniversal(tempData);
    });
  }

  async addRecentSearch(req: any, body: any) {
    try {
      const result = await this.getGraphData(
        `mutation{
                createActivityRecentSearch(activityRecentSearch:{
                 created_by_id:${req.user.id}
                 city_id:"${body.city_id}"
                 city_name:"${body.city_name}"
                 start_date:"${body.start_date}"
                 end_date:"${body.end_date}"
                 currency_code:"${body.currency_code}"
                 product_code:"${body.product_code}"
                 activity_image:"${body.activity_image}"
                 status:${1}
                 product_name:"${body.product_name}"
                 price:"${body.price}"
                 booking_source:"b2c"
            }){
              id
              created_at
              created_by_id
              status
              city_name
              city_id
              start_date
              end_date
              currency_code
              product_code
              activity_image
              product_name
              price
            }	 
        
          }`,
        `createActivityRecentSearch`
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
  async getRecentSearch(req: any, body: any) {
    try {
      const result = await this.getGraphData(
        `{
                activityRecentSearches(take:4 , order:{
                  created_at: DESC
                },where:{
                  created_by_id:{
                    eq:${req.user.id}
                  }
                  status:{
                    eq:${1}
                }
                booking_source:{
                    eq:"b2c"
                }
                }){
                    id
                    created_at
                    created_by_id
                    status
                    city_name
                    city_id
                    start_date
                    end_date
                    currency_code
                    product_code
                    activity_image
                    product_name
                    price
                }
              }`,
        `activityRecentSearches`
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
  async deleteRecentSearch(req, body) {
    try {
      const result = await this.getGraphData(
        `mutation{
                  deleteActivityRecentSearch(id:${body.id})
                }`,
        `deleteActivityRecentSearch`
      );

      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }


  // async addPaxDetails(body: any): Promise<any> {
  //   let resp = await this.redisServerService.read_list(body.ResultToken);
  //   let parsedInfo = JSON.parse(resp);

  //   let Rooms=[];
  //   let BlockRoomId=[];
  //   // if(body.BookingSource==HOTELBEDS_HOTEL_BOOKING_SOURCE){

  //   //     for (let BlockRoomIndex = 0; BlockRoomIndex < body.BlockRoomId.length; BlockRoomIndex++) {

  //   //         Rooms.push(parsedInfo.Rooms[BlockRoomIndex]);
  //   //        const roomKey= {
  //   //         rateKey: parsedInfo.Rooms[BlockRoomIndex].Id
  //   //           };
  //   //         BlockRoomId.push(roomKey);
  //   //     }
  //   //     // for (let index = 0; index < parsedInfo.Rooms.length; index++) {
  //   //     //     const element = parsedInfo.Rooms[index];
  //   //     //     parsedInfo.Rooms.splice(index, 1);
  //   //     // }

  //   //     parsedInfo.Rooms=Rooms;
  //   //     parsedInfo.ResultToken=parsedInfo['AgencyToken'];
  //   // let Hotel = await this.redisServerService.read_list(parsedInfo['AgencyToken']);
  //   // parsedInfo.hotel = JSON.parse(Hotel);
  //   // }

  //   let parsedData = this.formatHotelRoomData(parsedInfo);
  //   body.booking_from="";
  //   parsedData["appRef"] = body.AppReference;
  //   parsedData["userId"] = body.UserId ? body.UserId : "";
  //   parsedData["source"] = body.booking_source
  //   parsedData["booking_from"] = body.booking_from
  //   parsedData["Email"] = body.Email


  //   const appRefInDB = await this.getGraphData(
  //       `query {
  //               hotelHotelBookingDetails (
  //                   where: {
  //                       app_reference: {
  //                           eq: "${body.AppReference}"
  //                       }
  //                   }
  //               ) {
  //                   app_reference
  //               }
  //           }
  //           `,
  //       "hotelHotelBookingDetails"
  //   );
  //   if (appRefInDB.length > 0) {
  //       const errorClass: any = getExceptionClassByCode(
  //           "409 Duplicate entry for AppReference"
  //       );
  //       throw new errorClass("409 Duplicate entry for AppReference");
  //   } else {
  //       let paxDetails = body.RoomDetails[0].PassengerDetails;

  //       // paxDetails.push(body.RoomDetails[0].AddressDetails);
  //       const formattedPaxDetails = await this.formatPaxDetailsUniversal(
  //           paxDetails,
  //           body
  //       );

  //       let hotelBookingData = { ...parsedData, parsedInfo, addressDetails: body.RoomDetails[0].AddressDetails }


  //       const bookingDetailsResp = await this.addHotelBookingDetails(
  //           hotelBookingData
  //       );

  //       const bookingItineraryResp = await this.addHotelBookingItineraryDetails(
  //           parsedData
  //       );
  //       const bookingPaxDetailsResp = await this.getGraphData(
  //           `mutation {
  //                   createHotelHotelBookingPaxDetails(
  //                       hotelHotelBookingPaxDetails: ${JSON.stringify(formattedPaxDetails).replace(/"(\w+)"\s*:/g, "$1:")}
  //                   ) {
  //                       id
  //                       app_reference
  //                       title
  //                       first_name
  //                       middle_name
  //                       last_name
  //                       phone
  //                       email
  //                       pax_type
  //                       date_of_birth
  //                       age
  //                       passenger_nationality
  //                       passport_number
  //                       passport_issuing_country
  //                       passport_expiry_date
  //                       address
  //                       address2
  //                       city
  //                       state
  //                       country
  //                       postal_code
  //                       phone_code
  //                       status
  //                       attributes
  //                   }
  //               }`,
  //           "createHotelHotelBookingPaxDetails"
  //       );
  //       return this.getHotelBookingPaxDetailsUniversal(
  //           body,
  //           bookingPaxDetailsResp,
  //           bookingDetailsResp,
  //           bookingItineraryResp
  //       );
  //   }
  // }
  // }


  async addPaxDetails(body: any): Promise<any> {
    let resp = await this.redisServerService.read_list(body.ResultToken);
    let parsedInfo = JSON.parse(resp);
    const appRefInDB = await this.manager.query(`select * from activity_booking_details where app_reference = "${body.AppReference}"`)

    if (appRefInDB.length > 0) {
      const errorClass: any = getExceptionClassByCode(
        "409 Duplicate entry for AppReference"
      );
      throw new errorClass("409 Duplicate entry for AppReference");
    } else {

      let paxDetails = body.PassengerDetails;
      const passengerCount = paxDetails.length;
      
      const formattedPaxDetails = await this.formatPaxDetailsUniversal(paxDetails, body)

      parsedInfo.app_reference = body.AppReference,
        parsedInfo.UserId = body.UserId ? body.UserId : ''

      parsedInfo.UserType = body.UserType ? body.UserType : ''
      parsedInfo.PromoCode = body.PromoCode ? body.PromoCode : ''
      parsedInfo.answers = body?.BookingQuestions ?? []
      

      let ActivityBookingData = { parsedInfo, addressDetails: body.AddressDetails }
      let FormaItineraryDetails = await this.formatBookingItineraryDetailsUniversal(parsedInfo, body)
      const bookingDetailsResp = await this.addHotelBookingDetails(ActivityBookingData, FormaItineraryDetails, passengerCount);
      delete FormaItineraryDetails.attributes.body

      let obj = {
        BookingSource: body.booking_source,
        BookingDetails: bookingDetailsResp,
        BookingItineraryDetails: FormaItineraryDetails,
        BookingPaxDetails: formattedPaxDetails
      }
      return obj
    }


  }

  // async getHotelBookingDetails(body: any): Promise<any> {
  //   let result = await this.manager.query(`select * from activity_booking_details where app_reference = "${body.AppReference}"`)
  //   result = result[0]
  //   return result
  // }
  async getHotelBookingDetails(body: any): Promise<any> {
    let response:any = [];
    let result = await this.manager.query(`
    select 
    id,
    created_at,
    domain_origin,
    booking_source,
    booking_reference,
    app_reference,
    status,
    currency,
    clientReference,
    creationDate,
    creationUser,
    paymentTypeCode,
    invoicingCompany_code,
    invoicingCompany_name,
    invoicingCompany_registrationNumber,
    pendingAmount,
    total,
    admin_markup,
    agent_markup,
    totalNet,
    agent_payable,
    AgentServiceTax,
    service_tax,
    country,
    created_by_id,
    created_datetime,
    holder_name,
    holder_contact,
    holder_email,
    attributes,
    promo_code,
    discount,
    convinence,
    pay_later,
    payment_mode,
    paid_mode,
    payment_status
    from activity_booking_details where app_reference = "${body.AppReference}"
    `)
    response = result[0]
console.log('response-',response);
    return response
  }

  async getHotelBookingPaxDetails(body: any): Promise<any> {
    let result = await this.manager.query(`select * from activities_booking_pax_details where app_reference = "${body.AppReference}"`)
    return result
  }


  async updateData(ConfirmBookingDetails: any, bookingDetails, body, ItenaryData) {
    try {
      // body.TotalPrice = bookingItineraryDetails[0].total_fare;
      // body.Currency = bookingItineraryDetails[0].currency;

      let activityData = ConfirmBookingDetails.activities[0]

      let AppReference = body.AppReference
      let BookingDetailsID = bookingDetails.id
      const payment_mode = bookingDetails.payment_mode;
      const booking_reference = ConfirmBookingDetails.reference ? ConfirmBookingDetails.reference : ''
      let status = ConfirmBookingDetails.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : ConfirmBookingDetails.status
     
      if(bookingDetails.payment_mode == 'pay_later'){
        status = 'BOOKING_HOLD';
      }
      if (ConfirmBookingDetails) {
        let child_age = []

        if (activityData.paxes && activityData?.paxes.length) {
          activityData.paxes.map((child) => {
            if (child.paxType === "CH") {
              child_age.push(child.age)
            }

          })
        }
        let language
        if (  activityData?.modality?.rates?.length > 0 &&   activityData.modality.rates[0]?.rateDetails?.languages?.length > 0 ) {
          language = activityData.modality.rates[0].rateDetails.languages[0]?.code || 'en';
        } else {
          language = 'en';
        } 
        let activityRemark = []
        if(activityData?.comments && activityData?.comments.length){
          activityData?.comments.map((remark)=>{
            remark.text = remark?.text.replace(/"/g, '-')
            let obj = {
              type : remark?.type ?? '' ,
              text : remark?.text.replace(/\//g, '') ?? ''
            }
            activityRemark.push(obj)
          })
        }

        ItenaryData['status'] = status,
          ItenaryData['booking_reference'] = booking_reference
        ItenaryData['ItenaryData']['status'] = status
        ItenaryData['ItenaryData']['booking_reference'] = booking_reference
        ItenaryData['ItenaryData']['dateFrom'] = activityData?.dateFrom ?? ''
        ItenaryData['ItenaryData']['dateTo'] = activityData?.dateTo ?? ''
        ItenaryData['ItenaryData']['modalityName'] = activityData?.modality?.name ?? ''
        ItenaryData['ItenaryData']['paxes'] = activityData?.paxes ?? []
        ItenaryData['ItenaryData']['ChildAge'] = child_age
        ItenaryData['ItenaryData']['Destination'] = activityData?.content?.countries?.[0]?.destinations?.[0]?.name ?? '';
        ItenaryData['ItenaryData']['activityRemark'] = activityRemark ? activityRemark : []
        ItenaryData['ItenaryData']['providerInfo'] = activityData?.providerInformation ?? []
        ItenaryData['ItenaryData']['supplierInfo'] = activityData?.supplier ?? {}
        ItenaryData['ItenaryData']['voucher'] = activityData?.vouchers ?? []  
        ItenaryData['ItenaryData']['language'] = language ? language : 'en'

        ItenaryData
        let updateBookingDetails = {
          booking_reference,
          status,
          created_datetime: moment(Date.now()).format('YYYY-MM-DD HH:mm:ss'),
          clientReference: ConfirmBookingDetails.clientReference,
          attributes: `${JSON.stringify(ItenaryData).replace(/"/g, "'")}`
        }
        await this.manager.query(`update activity_booking_details set ? where id = "${BookingDetailsID}" and app_reference = "${AppReference}"`, [updateBookingDetails])
        await this.manager.query(`update activities_booking_pax_details set  booking_reference = "${booking_reference}" , status = "${status}"  where  app_reference = "${AppReference}"`)
      }
      return ItenaryData
    }
    catch (err) {
      throw Error(err)
    }
  }

  async formatBookingRes(ItenaryData, body) {
    try {
      let bookingDetails = await this.manager.query(`Select * from activity_booking_details where app_reference = "${body.AppReference}"`)
      bookingDetails = bookingDetails[0]
      let paxDetails = await this.manager.query(`Select * from activities_booking_pax_details where app_reference = "${body.AppReference}"`)
      let formatArr = [
        bookingDetails,
        ItenaryData,
        paxDetails

      ]
      return formatArr
    }
    catch (err) {
      throw Error(err)
    }

  }

  async updateCancellation(app_reference: string) {
    try {
  
        const ItenaryData = await this.manager.query(
            'SELECT * FROM activity_booking_details WHERE app_reference = ?',
            [app_reference]
        );

        if (ItenaryData.length === 0) {
            throw new Error('No data found for the given app_reference');
        }


        let attributesData = ItenaryData[0].attributes.replace(/'/g, '"');

        // try {
        //     attributesData = JSON.parse(attributesData);
        // } catch (parseError) {
        //     throw new Error(`Invalid JSON in attributes: ${parseError.message}`);
        // }

        // console.log(attributesData, '111111111111111111111111111111');

        // Update status fields
        // attributesData['status'] = "BOOKING_CANCELLED";
   

        // if (attributesData['ItenaryData']) {
        //     attributesData['ItenaryData']['status'] = "BOOKING_CANCELLED";
        // } else {
        //     console.warn('Warning: ItenaryData is missing in attributes');
        // }
 
        // const updatedAttributes = JSON.stringify(attributesData);
        // console.log(updatedAttributes, 'updatedAttributesupdatedAttributesupdatedAttributes');

        // await this.manager.query(
        //     'UPDATE activity_booking_details SET status = ?,cancelled_datetime WHERE app_reference = ?',
        //     ["BOOKING_CANCELLED",new Date() , app_reference]
        // );

        await this.manager.query(
          'UPDATE activity_booking_details SET status = ?, cancelled_datetime = ? WHERE app_reference = ?',
          ["BOOKING_CANCELLED", new Date(), app_reference]
      );
      

        await this.manager.query(
            'UPDATE activities_booking_pax_details SET status = ? WHERE app_reference = ?',
            ["BOOKING_CANCELLED", app_reference]
        );

        console.log(4444444444444444444444);

        return attributesData;
    } catch (err) {
        throw new Error(`Error updating cancellation: ${err.message}`);
    }
}



  // async getMarkupDetails(userType: any, userId: any): Promise<any> {
  //   if (userType == 'B2B' && userId) {
  //     const result = await this.getGraphData(`
  //           query {
  //               coreMarkups (
  //                   where: {
  //                       module_type:{
  //                           eq: "b2b_activity"
  //                       }
  //                       type: {
  //                           eq: "supplier"
  //                       }
  //                       auth_user_id: {
  //                           eq: ${userId}
  //                       }
  //                   }
  //               ) {
  //                   id 
  //                   markup_level
  //                   type
  //                   fare_type
  //                   module_type 
  //                   flight_airline_id
  //                   value
  //                   value_type
  //                   domain_list_fk
  //                   markup_currency
  //               }
  //           }
  //       `, 'coreMarkups');
  //     return result[0];
  //   } 
  //   else {
  //     const result = await this.getGraphData(`
  //           query {
  //               coreMarkups (
  //                   where: {
  //                       module_type:{
  //                           eq: "b2c_activity"
  //                       }
  //                       type: {
  //                           eq: "generic"
  //                       }
  //                       is_deleted: { 
  //                           eq: "1" 
  //                       }
  //                   }
  //               ) {
  //                   id 
  //                   markup_level
  //                   type
  //                   fare_type
  //                   module_type 
  //                   flight_airline_id
  //                   value
  //                   value_type
  //                   domain_list_fk
  //                   markup_currency
  //               }
  //           }
  //       `, 'coreMarkups');
  //     return result[0];
  //   }
  // }

  async getMarkupDetails(userType: any, userId: any, body: any): Promise<any> {
    let response:any=[];
    if (userType == 'B2B' && userId) {
      const query = `SELECT agent_group_id FROM auth_users WHERE id = ${userId}`;
      const agent_group =await this.manager.query(query);
      let agent_group_id_condition = ``;
      if(agent_group){
      const agent_group_id=agent_group[0].agent_group_id;
      agent_group_id_condition=`group_id: {
                                eq: ${agent_group_id}
                            }`
      }
      const result1 = await this.getGraphData(
        `
                query {
                    coreMarkups (
                        where: {
                            module_type:{
                                eq: "b2b_activity"
                            }
                            type: {
                                eq: "supplier"
                            }
                            ${agent_group_id_condition}
                            supplier: {
                                eq: "${body.booking_source}"
                            } 
                            is_deleted: { 
                                eq: "1" 
                            }
                        }
                    ) {
                        id 
                        markup_level
                        type
                        fare_type
                        module_type 
                        flight_airline_id
                        value
                        value_type
                        supplier
                        domain_list_fk
                        markup_currency
                    }
                }
            `,
        "coreMarkups"
      );
      if(result1[0] && body.MarkupCountry != "" && body.MarkupCity !=""){
        const api = body.booking_source;
        // let supplier = JSON.parse(result1[0].supplier);
        const supplier = result1[0].supplier;
       
        let supplierSource:any ={};
       

        if(supplier[api]){
          let priceArray = supplier[api];
          if(priceArray.value && priceArray.value!=0){
          result1[0].value_type=priceArray.value_type;
          result1[0].value=Number(priceArray.value);
          }
          if(supplier[api].country){  
          const countryMarkup = supplier[api].country;
          const MarkupCountry = body.MarkupCountry;
         
          if(countryMarkup[MarkupCountry]){
            priceArray = countryMarkup[MarkupCountry];
            if(priceArray.value && priceArray.value!=0){
              result1[0].value_type=priceArray.value_type;
              result1[0].value=Number(priceArray.value);
              }
          }
        }

          if(supplier[api].city){
          const cityMarkup = supplier[api].city;
          const MarkupCity = body.MarkupCity;
         
          if(cityMarkup[MarkupCity]){
            priceArray = cityMarkup[MarkupCity];
            if(priceArray.value && priceArray.value!=0){
              result1[0].value_type=priceArray.value_type;
              result1[0].value=Number(priceArray.value);
              }
            console.log(result1);
          }
        }
         
          
        }
          
        response=result1[0];
      }
      else{
        const result2 = await this.getGraphData(
          `
          query {
            coreMarkups (
                where: {
                    module_type:{
                        eq: "b2b_activity"
                    }
                    type: {
                        eq: "supplier"
                    }
                    auth_user_id: {
                        eq: ${userId}
                    }
                }
            ) {
                id 
                markup_level
                type
                fare_type
                module_type 
                flight_airline_id
                value
                value_type
                domain_list_fk
                markup_currency
            }
        }
    `, 'coreMarkups');
        return result2[0];
      }
      return response
    } 
    else {
      const result = await this.getGraphData(`
            query {
                coreMarkups (
                    where: {
                        module_type:{
                            eq: "b2c_activity"
                        }
                        type: {
                            eq: "generic"
                        }
                        is_deleted: { 
                            eq: "1" 
                        }
                    }
                ) {
                    id 
                    markup_level
                    type
                    fare_type
                    module_type 
                    flight_airline_id
                    value
                    value_type
                    domain_list_fk
                    markup_currency
                }
            }
        `, 'coreMarkups');
      return result[0];
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



  async bookingConfirmed(body: any) {
    try {

      let bookingDetails = await this.getHotelBookingDetails(body);
      let paxDetails = await this.getHotelBookingPaxDetails(body);

      const attribute = bookingDetails.attributes.replace(/'/g, '"');
      let Bookattrribute = JSON.parse(attribute);

      let ItenaryData = Bookattrribute.ItenaryData;

      if ((ItenaryData['attributes']['body'])) {
        delete ItenaryData['attributes']['body']
      }
      bookingDetails.attributes = ItenaryData



      let result = {
        bookingDetails,
        paxDetails,
        ItenaryData
      }



      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getActivityMarkupDetails(
    searchData: any,
    module_type: any,
    markup_level: any
  ): Promise<any> {
    let type = 'generic'
    let UserId =searchData["UserId"];
    let agent_group_id_condition = ``;
   if(searchData['UserType'] === "B2B" && markup_level=="b2b_admin"){
    const query = `SELECT agent_group_id FROM auth_users WHERE id = ${UserId}`;
    const agent_group =await this.manager.query(query);
    if(agent_group){
    const agent_group_id=agent_group[0].agent_group_id;
    agent_group_id_condition=`group_id: {
                              eq: ${agent_group_id}
                          }`
      UserId=1;
      type = 'agent_group'
   }}  


    const result = await this.getGraphData(
      `
          query {
              coreMarkups (
                  where: {
                      module_type:{
                          eq: "${module_type}"
                      }
                      markup_level:{
                          eq: "${markup_level}"
                      }
                            type:{
                          eq: "${type}"
                      }
                     ${agent_group_id_condition}
                      auth_user_id: {
                          in: "0,${UserId}"
                      }
                      is_deleted: { 
                          eq: "1" 
                      }
                  }
              ) {
                  id 
                  markup_level
                  type
                  fare_type
                  module_type 
                  auth_user_id
                  value
                  value_type
                  domain_list_fk
                  markup_currency
                  segment_list
              }
          }
      `,
      "coreMarkups"
    );
    return result;
  }

  async markupAndCommissionDetails(body: any): Promise<any> {
    let admin_markup: any = [], agent_markup: any = [], markupDetails: any = {}, commission: any = [], commissionDetails: any = {};
    if (body['UserType']) {
      if (body['UserType'] == "B2B") {

        admin_markup = await this.getActivityMarkupDetails(body, "b2b_activity", "b2b_admin");
        markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];

        agent_markup = await this.getActivityMarkupDetails(body, "b2b_activity", "b2b_own");
        markupDetails.agentMarkup = agent_markup.length > 0 ? agent_markup : [];

        commission = await this.getActivityCommissionDetails(body, "b2b_activity");
        commissionDetails.commission = commission.length > 0 ? commission : [];

      } else {
        body["UserId"] = 1;
        admin_markup = await this.getActivityMarkupDetails(body, "b2c_activity", "b2c_admin");
        markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
      }
    } else {
      body["UserId"] = 1;
      admin_markup = await this.getActivityMarkupDetails(body, "b2c_activity", "b2c_admin");
      markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
    }
    return {
      markupDetails,
      commissionDetails
    }
  }

  async getActivityCommissionDetails(searchData: any, module_type: any): Promise<any> {
    if (searchData["UserType"] == "B2B" && searchData["UserId"]) {
      let flight_airline_id: any = '';
      const result = await this.getGraphData(
        `
    query {
        coreCommissions (
             where: { 
                 status:{ eq: 1 } 
                 auth_user_id:{ in: "${searchData["UserId"]},0"}
                 module_type:{eq:"${module_type}"}
             }
          ) {
            id
            value
            api_value
            value_type
            module_type
            domain_list_fk
            commission_currency
            auth_user_id
            segment_list
            flight_airline_id
            flightAirline{
                code
                name
            }
          }
      }
    `,
        "coreCommissions"
      );
      return result;
    }
  }

  async emailActivityDetails(body) {
    const bookingDetails = await this.manager.query(`
          SELECT 
            id,
            domain_origin,
            attributes,
            booking_source,
            booking_reference,
            app_reference,
            status,
            currency,
            clientReference,
            paymentTypeCode,
            invoicingCompany_code,
            invoicingCompany_name,
            invoicingCompany_registrationNumber,
            total,
            totalNet,
            created_by_id,
            created_datetime,
            holder_name,
            holder_contact,
            holder_email,
            country,
            service_tax,
            AgentServiceTax,
            discount,
            admin_markup,
            promo_code,
            agent_markup
          FROM 
              activity_booking_details
          WHERE 
              app_reference = '${body.AppReference}'
    `)

    // const query1 = `select 
    //                   abd.*, 
    //                   (SELECT attributes FROM activities_booking_pax_details abpd WHERE abpd.app_reference = abd.app_reference LIMIT 1) AS attributes 
    //                 from activities_booking_activitydetail AS abd 
    //                 WHERE 
    //                   abd.app_reference = "${body.AppReference}"`;

    const query2 = `select * from activities_booking_pax_details WHERE app_reference = "${body.AppReference}"`;

    // const result = await this.manager.query(query1);
    const resultPassengers = await this.manager.query(query2);

    const attribute = bookingDetails[0].attributes.replace(/'/g, '"');
    let Bookattrribute = JSON.parse(attribute);

    const result = Bookattrribute.ItenaryData;

    let subjectString = ""
    let mailObject: any
    let attchment: any;

    console.log("++++++++++++++++")
    console.log(result)
    console.log("++++++++++++++++")
    console.log(resultPassengers)
    console.log("++++++++++++++++")
    // const priceDetails = JSON.parse(result[0].flightBookingTransactions[0].attributes)
    // const created_by_id = result[0].created_by_id

    // let itinerariesHtml = ""
    // itineraries.forEach((element, index) => {
    //     itinerariesHtml = itinerariesHtml + ` <span style="display:block; font-size: 13px; padding-left:0%">
    // ${element.room_type_name}
    // </span> `
    // })
    let PassengerDetails = resultPassengers;
    let passengerDataHtml = ""
    let PassengerData = []
    const filename = bookingDetails[0].app_reference;
    const inputDate = bookingDetails[0].created_datetime;
    const formattedDate = moment(inputDate).format('DD/MM/YYYY');
    
    // let PassengerContactInfo = PassengerDetails.pop()
    PassengerDetails.forEach((element, index) => {
        element.pax_type = element.pax_type == 1 ? "Adult" : "Child"
        passengerDataHtml = passengerDataHtml + `
        <tr>
        <td style="font-size: 15px; line-height: 25px;"><span>${element.first_name} ${element.last_name}</span>
                            </td>
                            <!-- <td style="font-size: 15px; line-height: 25px;"><span>${formatHotelDateTime(element?.pax_dob)}</span>
                            </td> -->
                            <td>
                                <span
                                    style="display:block; font-size: 13px; padding-left:0%">
                                    ${element.pax_type}
                                </span>
                            </td>
                        </tr>
        `
        element.index = index + 1
        PassengerData.push(element)
    });

    const { cc } = await this.getEmailConfig()

    if (bookingDetails[0].status === "BOOKING_CONFIRMED" || bookingDetails[0].status === "BOOKING_HOLD") {
        subjectString = `ACTIVITY BOOKING DETAILS : ${bookingDetails[0].app_reference}`
        
        // await this.pdf({
        //   filename: "./voucher/activity/" + filename + ".pdf",
        //   template: "activity",
        //   viewportSize: {
        //       width: 1500
        //   },
        //   locals: {
        //       activityInfo: result,
        //       app_reference: bookingDetails[0].app_reference,
        //       PassengerDetails,
        //       booked_on: formattedDate,
        //       images: result.attributes.ProductImage,
        //       totalFareSum: bookingDetails[0].total,
        //       currency: bookingDetails[0].currency,
        //   },
        // });


        // attchment = {
        //     filename: `${bookingDetails[0].app_reference}.pdf`,
        //     contentType: "application/pdf",
        //     path:
        //         process.cwd() +
        //         "/voucher/activity/" + filename +
        //         ".pdf",
        // }
        
        mailObject = {
            // to: `${result[0].email}`,
            to: `${bookingDetails[0].holder_email}`,
            cc,
            from: `"Booking247" <${SUPPORT_EMAIL}>`,
            subject: subjectString,
            // attachments: [
            //     attchment
            // ],

        }
    }

    if (bookingDetails[0].status === "BOOKING_CANCELLED") {
        subjectString = `ACTIVITY BOOKING CANCELLED : ${bookingDetails[0].app_reference}`

        mailObject = {
            to: `${bookingDetails[0].holder_email}`,
            cc,
            from: `"Booking247" <${SUPPORT_EMAIL}>`,
            subject: subjectString,
        }
    }

    const booking247Logo = process.env.NODE_ENV == "LOCAL" || process.env.NODE_ENV == "UAT"
      ? "http://54.198.46.240/booking247/supervision/assets/images/login-images/l-logo.png"
      : "https://www.booking247.com/supervision/assets/images/login-images/l-logo.png";
    
    const htmlData = ` <table cellpadding="0" border-collapse="" cellspacing="0" width="100%"
    style="font-size:10px; font-family: 'Open Sans', sans-serif; width:100%; margin:0px auto;background-color:#fff; padding:20px;border-collapse:separate; color: #000;">
    <tbody>

        <tr>
            <td colspan="8" style="border-bottom: 1px solid #ddd;">
                <table style="width: 100%;">
                    <tr>
                    <td style="padding:10px 0;">
                        <img style="width:120px;" src="${booking247Logo}">
                    </td>

                    <td style="font-size:14px; line-height:25px" align="right">
                        <span>Booking Reference: ${bookingDetails[0].app_reference}</span>
                        <br>
                        <span>Booked Date : ${formattedDate}</span>
                        <br>
                        <span>Booking Status : ${bookingDetails[0].status}</span>
                    </td>
                   </tr>
                </table>
            </td>
        </tr>

        <tr>
            <td style="padding:10px 0; width:240px;">
                <img style="width:220px; height: 140px;" src="${result.attributes.ProductImage}">
            </td>
            <td style="padding:10px 0; line-height:25px;">
                <span style="display: block;">
                    <span
                        style="font-size:22px; font-weight:600;">${result.activity_name}</span>
                        <br>
                    <span style="font-size:14px;">${result.city}</span>
                    <br>
                     <img src="http://tlntrip.com/assets/images/star_rating_black_3.png">
                </span>
            </td>
           
        </tr>
        <tr></tr>

        <tr>
        <td colspan="6" style="border:1px solid #ddd; padding:0;">
            <table cellspacing="0" cellpadding="5" width="100%" style="font-size:12px; padding:0;">
                <tbody>
                    <tr>
                        <td colspan="6" style="background-color:#189AD3; color:#fff">
                            <span
                                style="vertical-align:middle;font-size:13px; font-weight:600;">Guest Details
                            </span>
                        </td>
                        
                    </tr>
                    <tr>

                        <td style="background-color:#d9d9d9; color:#000; font-weight: 500; font-size: 14px;">
                            <span
                                style="vertical-align:middle">Name</span>
                        </td>


                            <!-- <td style="background-color:#d9d9d9; color:#000; font-weight: 500; font-size: 14px;">
                            DOB</td> -->
                            <td style="background-color:#d9d9d9; color:#000; font-weight: 500; font-size: 14px;">
                            Guest Type</td>    
                    </tr>
                    ${passengerDataHtml}
                </tbody>
            </table>
        </td>
    </tr>
        <tr>
            <td style="line-height:15px;padding:0;">&nbsp;</td>
        </tr>
        <tr>
            <td style="line-height:15px;padding:0;">&nbsp;</td>
        </tr>
        <tr>
            <td colspan="4" style="padding:0;">
                <table cellspacing="0" cellpadding="5" width="100%" style="font-size:12px; padding:0;">
                    <tbody>
                        <tr>
                            <td width="50%" style="padding:0;padding-right:14px;">
                                <table cellspacing="0" cellpadding="5" width="100%"
                                    style="font-size:14px; line-height:19px; padding:0;border:1px solid #ddd;">
                                    <tbody>
                                        <tr style="background: #189AD3;">
                                            <td style="border-bottom:1px solid #ccc"><span
                                                    style="font-size:14px; color: #fff;">Payment Details</span>
                                            </td>
                                            <td style="border-bottom:1px solid #ccc"><span
                                                    style="font-size:14px; color: #fff;">Amount (${bookingDetails[0].currency})</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td><span>Base Price</span>
                                            </td>
                                            <td><span>${bookingDetails[0].total}</span>
                                            </td>
                                        </tr>
                                        
                                        <tr>
                                            <td style="border-top:1px solid #ccc"><span
                                                    style="font-size:15px; font-weight: bold;">Total Fare</span>
                                            </td>
                                            <td style="border-top:1px solid #ccc"><span
                                                    style="font-size:15px; font-weight: bold;">${bookingDetails[0].total}</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                
                        </tr>
                        <tr>
                            <td style="line-height:15px;padding:0;">&nbsp;</td>
                        </tr>
                    </tbody>
                </table>
            </td>
        </tr>
        <tr>
            <td style="line-height:15px;padding:0;">&nbsp;</td>
        </tr>
    </tbody>
</table>`;
    mailObject.html = htmlData
    await this.mailerService.sendMail(mailObject);
    return true
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

  async payLaterCheck(body){
    try{
      let response= true;
      const ActivityBookingDetails=await this.getHotelBookingDetails(body);
   
     if(ActivityBookingDetails.status != 'BOOKING_HOLD' || ActivityBookingDetails.booking_source != 'B2B' || ActivityBookingDetails.pay_later != 'true'){
      throw new Error("409 Pay later is not available for this Booking");  
     }else{
      const query = `UPDATE activity_booking_details SET payment_mode = "pay_later" WHERE app_reference = "${body.AppReference}" `;
      this.manager.query(query);
     }
      
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
  }
}

async getPayLaterUnpaidActivityBookings(status: any, currentDate: any) {
  const query1 = `SELECT app_reference  FROM activity_booking_details WHERE cancel_deadline LIKE '${currentDate}%'  AND booking_source = 'B2B' AND payment_mode = 'pay_later' AND payment_status='Not Paid'  AND status='${status}' AND paid_mode IS NULL`

const UnpaidBookingDetails = await this.manager.query(query1);
const result = UnpaidBookingDetails[0];
  return result;
}

}