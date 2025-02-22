import { Body, Req } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { BaseApi } from "apps/webservice/src/base.api";

export class CoreStaticPageContentService extends BaseApi {
  
  constructor() {
    super();
  }
    async staticPageContentList(@Body() body: any) {
        try {
          if(body.id){
          const result = this.getGraphData(
            `query{
                coreStaticPageContents(where:{
                  
                  status:{
                    eq:"${1}"
                  }
                  id:{
                    eq:${body.id}
                  }
                  data_source:{
                    eq:"b2c"
                  }
                },take:50){
                  id
                  module
                  page_title
                  page_description
                  page_seo_title
                  page_seo_keyword
                  page_seo_description
                  page_redirection_url
                  page_position
                  created_by_id
                }
              }`,
            "coreStaticPageContents"
          );
          return result;
        } else {
          const result = this.getGraphData(
            `query{
                coreStaticPageContents(where:{
                  status:{
                    eq:"${1}"
                  }
                  data_source:{
                    eq:"b2c"
                  }
                },take:50){
                  id
                  module
                  page_title
                  page_description
                  page_seo_title
                  page_seo_keyword
                  page_seo_description
                  page_redirection_url
                  page_position
                  created_by_id
                }
              }`,
            "coreStaticPageContents"
          );
          return result;
        }
        } catch (error) {
          const errorClass: any = getExceptionClassByCode(error.message);
          throw new errorClass(error.message);
        }
      }

      async socialNetworks(@Body() body: any,@Req() req:any) {
        try {
          const result = this.getGraphData(
            `{
                cmsSocialNetworks(where:{
                  status:{eq:1}
                }){
                  id
                  socialnetwork
                  url
                  authentication_key
                  
                }
              }`,
            "cmsSocialNetworks"
          );
          return result;
        } catch (error) {
          const errorClass: any = getExceptionClassByCode(error.message);
          throw new errorClass(error.message);
        }
      }

      async discountInformation(@Body() body: any,@Req() req:any) {
        const currenTimeStamp = Date.now();
        const currentDate = new Date(currenTimeStamp);
        var query=""
        if(body.category){
          var query=`category:{eq:"${body.category}"}`
        }
        try {
          const result = this.getGraphData(
            `{
              corePromocodes(where:{
                status:{
                  eq:${1}
                }
                ${query}
                use_type:{
                  eq:"B2C"
                }
                expiry_date:{
                  gte:"${currentDate.getFullYear()+"-"+(currentDate.getMonth()+1)+"-"+currentDate.getDate()}"
                }
              }){
                id
                promo_code
                promo_image
                description
                category
                discount_type
                discount_value
                start_date
                created_by_id
                use_type
                expiry_date
                created_at
              }
            }`,
            "corePromocodes"
          );
          return result;
        } catch (error) {
          const errorClass: any = getExceptionClassByCode(error.message);
          throw new errorClass(error.message);
        }
      }
}