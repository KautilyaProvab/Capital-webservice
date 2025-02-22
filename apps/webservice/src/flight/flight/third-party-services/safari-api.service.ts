import {
  Injectable,
  HttpService,
  HttpException,
  BadRequestException,
} from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import * as moment from "moment";
import {
  getPropValue,
  getPropValueOrEmpty,
  undefinedToSkip,
  debug,
} from "../../../app.helper";
import {
  DB_SAFE_SEPARATOR,
  RedisServerService,
} from "../../../shared/redis-server.service";
import { RequestResponseLogService } from "../../../shared/request-response-log.service";
import { FlightApi } from "../../flight.api";
import { FlightDbService } from "../flight-db.service";
import { SafariTransformService } from "./safari-transform.service";
import { CommonService } from "apps/webservice/src/common/common/common.service";
import { SAFARI_URL, logStoragePath } from "../../../constants";

@Injectable()
export class SafariService extends FlightApi {
  constructor(
    private httpService: HttpService,
    private safariTransformService: SafariTransformService,
    private readonly redisServerService: RedisServerService,
    // private readonly requestResponseLogService: RequestResponseLogService,
    private readonly flightDbService: FlightDbService,
    private readonly commonService: CommonService
  ) {
    super();
  }
  async getToken(): Promise<any> {
    // let token = await this.redisServerService.read_list("safari_token");
    // if (token! == '' || token! == undefined || token! == 'NaN') {
    let request = {
      channelCredential: {
        ChannelCode: "Test_24425",
        ChannelPassword: "Ykqytl4LQ5EUmbY",
      },
    };
    let headers = {
      "Content-Type": "application/json",
    };

    let response = await this.httpService
      .post(`${SAFARI_URL}/General.svc/Rest/Json/CreateTokenV2`, request, {
        headers,
      })
      .toPromise();
    let token = response["Result"].TokenCode;
    // await this.redisServerService.store_list("safari_token", token);
    // }
    return token;
  }

  async search(body: any): Promise<any> {
    let jsonResponse: any = [];
    let token = await this.getToken();
    let request = await this.safariTransformService.searchRequest(body, token);
    let headers = {
      "Content-Type": "application/json",
    };
    const end1: any = new Date();
    const start2: any = new Date();
    const start1: any = new Date();
    console.log("For Third party request Format time:", end1 - start1);

    let response = await this.httpService
      .post(`${SAFARI_URL}/Air.svc/Rest/Json/SearchAvailability`, request, {
        headers,
      })
      .toPromise();
    if (this.isLogXml) {
      const fs = require("fs");
      fs.writeFileSync(
        `${logStoragePath}/flights/safari/Search_RQ.json`,
        JSON.stringify(request)
      );
      fs.writeFileSync(
        `${logStoragePath}/flights/safari/Search_RS.json`,
        JSON.stringify(response)
      );
    }
    const end2: any = new Date();
    let fs = require("fs");
    console.log("Third party response time:", end2 - start2);

    let formattedResponse = await this.safariTransformService.finalData(
      response,
      body,
      token
    );

    return formattedResponse;
  }

  async fareQuote(body: any): Promise<any> {
    let ResultToken = this.forceObjectToArray(body["ResultToken"]);
    let result: any = [];
    let FlightDetailParsed: any = [];
    body["ResultToken"] = ResultToken;
    for (let i = 0; i < ResultToken.length; i++) {
      let FlightDetail = await this.redisServerService.read_list(
        body["ResultToken"][i]
      );

      FlightDetailParsed.push(JSON.parse(FlightDetail));
      let headers = {
        "Content-Type": "application/json",
      };
      let request = {
        request: {
          FareAlternativeLegKeys: [
            `${FlightDetailParsed[i]["ApiData"]["FlightIds"]}`,
          ],
          Token: {
            TokenCode: `${FlightDetailParsed[i]["ApiData"]["token"]}`,
          },
        },
      };

      let response = await this.httpService
        .post(`${SAFARI_URL}/Air.svc/Rest/Json/GetBrandedFares`, request, {
          headers,
        })
        .toPromise();
        if (this.isLogXml) {
          const fs = require("fs");
          fs.writeFileSync(
            `${logStoragePath}/flights/safari/FareQuote_RQ.json`,
            JSON.stringify(request)
          );
          fs.writeFileSync(
            `${logStoragePath}/flights/safari/FareQuote_RS.json`,
            JSON.stringify(response)
          );
        }

    }
  }
  // private async runCurl(requestURL: string, apiRequestBody: any, requestName: any, appReference): Promise<any> {

  //     const https = require('https');

  //     const options = {
  //       headers: {

  //       }
  //     };

  //     //const xmlResponse = await this.httpService.post(`${TMX_URL}`, apiRequestBody, options).toPromise();
  //     let result: any;
  //     if (1) {
  //       // console.log(TMX_URL + '/webservices/flight/service/' + requestName);
  //       // console.log(apiRequestBody);
  //       // console.log(options);

  //       result = await this.httpService.post(SAFARI_URL + '/webservices/flight/service/' + requestName, apiRequestBody, options).toPromise();

  //       // console.log(result);
  //       // return false;
  //       if (this.isLogXml) {
  //         fs.writeFileSync(`${logStoragePath}/flights/tmx/${appReference}-${requestURL}_RQ.json`, JSON.stringify(apiRequestBody));
  //         fs.writeFileSync(`${logStoragePath}/flights/tmx/${appReference}-${requestURL}_RS.json`, JSON.stringify(result));
  //       }

  //       // result =await this.xmlToJson(result);
  //       //fs.writeFileSync(`${logStoragePath}/flights/novo/${requestURL}_RS.json`, JSON.stringify(result));

  //     } else {
  //       result = JSON.parse(fs.readFileSync(`${logStoragePath}/flights/tmx/${appReference}-CreateBooking_RS.xml`, 'utf-8'))
  //     }

  //     return result;
  //   }
}
