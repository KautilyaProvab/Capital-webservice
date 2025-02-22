import { BadRequestException, Body, Injectable, HttpService, HttpException, } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { omitDeep } from "apps/webservice/src/apollo-connection";
import { CompanyCode, PseudoCityCode, RequestType, SABER_API_URL, SABRE_TOEKN_HEADERS, logStoragePath, SABRE_FLIGHT_BOOKING_SOURCE } from "apps/webservice/src/constants";
import { response } from "express";
import * as moment from "moment";
import { getPropValue, debug, formatStringtDate, formatStringtDateNoSpace } from "../../../app.helper";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { SabreTransformService } from "../third-party-services/sabre-transform.service";
import { stringify } from "querystring";
//const fetch = require("node-fetch");
const fs = require('fs');

@Injectable()
export class SabreApiService extends FlightApi {
  constructor(
    private httpService: HttpService,
    private sabreTransformService: SabreTransformService,
    private readonly redisServerService: RedisServerService) {
    super();
  }
  async createToken(req_name: any): Promise<any> {
    const data = new URLSearchParams();
    data.append("grant_type", "client_credentials")

    // console.log(Buffer.from("VjE6cHVxeTNjbm5yY3N6ZHduaTpERVZDRU5URVI6RVhU:dUZ1MkpNNms=").toString('base64'));
    // return;

    let url = SABER_API_URL + "v2/auth/token";
    let options = {
      method: "POST",
      headers: SABRE_TOEKN_HEADERS,
      body: data,
    };

   
    // let result = JSON.parse(fs.readFileSync(`${logStoragePath}/flights/sabre/createToken_search_RS.json`, 'utf-8'))

    // let SabreToken:any ={};
    // SabreToken.access_token = result.access_token;
    // SabreToken.expire_time = result.expires_in+'';
    // const result1 = await this.setGraphData('FlightSabreToken', SabreToken);
    // T1RLAQKOkJ9wwn2c8kYKzIxCpSetk0ZlaBCLNfsYjHajXR9zwZxwKEp4AADgF2uo6pb4HrtIcilvbDqEburXjUlGVQTX6Hc+R9vmVhAfqvgIB81nYSC5R0660vVJ71nj/nMIaboopVoyfWFTwR5/5ArXAhjpL6WZanfbfuBu1fdihXPBlq5MQFdDIbwM78nf+uyl+3souRDitO4E7sP2J2BFLHHyjYyTF5IcHyW5YQ9caEh6LlbnG6XMLmwPdpC3dxbEOTkxupfavSQSi7RTACaAUdCs0ywBkd43+CwDbv8+HaUz0FTldmN3EdmsmlObZ5ZHz+Lst4pe7nayuXsl2wWCo2Xg0XF/y6U8Q1Q*

    const result = await this.httpService.post(url, data, {
      headers: SABRE_TOEKN_HEADERS
    }).toPromise();
    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/createToken_${req_name}_RQ.json`, JSON.stringify(options));
      fs.writeFileSync(`${logStoragePath}/flights/sabre/createToken_${req_name}_RS.json`, JSON.stringify(result));
    }
    return result;
  }

  async searchRequest(body: any) {
    const segment_details: any = body.Segments;
    const OriginDestinationInformation = [];
    for (let i: number = 0; i < segment_details.length; i++) {
      let seg: any = {};
      seg = {
        DepartureDateTime: segment_details[i].DepartureDate,
        DestinationLocation: {
          LocationCode: segment_details[i].Destination
        },
        OriginLocation: {
          LocationCode: segment_details[i].Origin
        },
        RPH: String(i)
      }
      OriginDestinationInformation.push(seg);
    }
    if (body.JourneyType == "Return") {
      let seg: any = {};
      seg = {
        DepartureDateTime: segment_details[0].ReturnDate,
        DestinationLocation: {
          LocationCode: segment_details[0].Origin
        },
        OriginLocation: {
          LocationCode: segment_details[0].Destination
        },
        RPH: "1"
      }
      OriginDestinationInformation.push(seg);
    }
    let PCC_list: any = [];
    PCC_list = [{
      PseudoCityCode: PseudoCityCode,
      CompanyCode: CompanyCode
    }]
    let Source: any = [];
    for (let i: number = 0; i < PCC_list.length; i++) {
      let pcc: any = {
        PseudoCityCode: PCC_list[i].PseudoCityCode,
        RequestorID: {
          CompanyName: {
            Code: PCC_list[i].CompanyCode,
          },
          ID: "1",
          Type: "1",
        },
      }
      Source.push(pcc);
    }
    let PassengerTypeQuantity: any = [];
    if (body.AdultCount > 0) {
      let pax_count: any = {
        Code: "ADT",
        Quantity: Number(body.AdultCount)
      }
      PassengerTypeQuantity.push(pax_count);
    }
    if (body.ChildCount > 0) {
      if (body.childDOB) {
        for (let c = 0; c < body.ChildCount; c++) {
          const Age = ('' + this.getPassengeTypeByDOB(body.childDOB[c]).age).padStart(2, '0');
          let pax_count: any = {
            Code: `C${Age}`,
            Quantity: 1
          }
          PassengerTypeQuantity.push(pax_count);
        }
      } else {
        let pax_count: any = {
          Code: "CNN",
          Quantity: Number(body.ChildCount)
        }
        PassengerTypeQuantity.push(pax_count);
      }

    }
    if (body.InfantCount > 0) {
      if (0) {
        for (let i = 0; i < body.InfantCount; i++) {
          const Age = ('' + this.getMonthsByDOB(body.infantDOB[i]).age).padStart(2, '0');
          let pax_count: any = {
            Code: `I${Age}`,
            Quantity: 1
          }
          PassengerTypeQuantity.push(pax_count);
        }
      } else {
        let pax_count: any = {
          Code: "INF",
          Quantity: Number(body.InfantCount)
        }
        PassengerTypeQuantity.push(pax_count);
      }
    }

    const CabinClass = getPropValue(body.Segments[0], 'CabinClass') || getPropValue(body.Segments[0], 'CabinClassOnward');

    let CabinClassCode = 'Y';
    if (CabinClass == 'PremiumEconomy') {
      CabinClassCode = 'S';
    } else if (CabinClass == 'Business') {
      CabinClassCode = 'C';
    } else if (CabinClass == 'First') {
      CabinClassCode = 'F';
    }

    let p_airline = [];
    if (body.PreferredAirlines != undefined) {
      if (body.PreferredAirlines.length >= 1) {
        let air_code = {
          Code: body.PreferredAirlines[0],
          PreferLevel: "Preferred"
        };
        p_airline.push(air_code);
      }
    }

    let searchRequest: any = {
      OTA_AirLowFareSearchRQ: {
        OriginDestinationInformation: OriginDestinationInformation,
        POS: {
          Source: Source,
        },
        TPA_Extensions: {
          IntelliSellTransaction: {
            RequestType: {
              Name: RequestType,
            },
          },
        },
        TravelPreferences: {
          VendorPref: p_airline,
          CabinPref: [
            {
              Cabin: CabinClassCode,
              PreferLevel: "Preferred"
            }
          ],
          ValidInterlineTicket: true,
          FlightTypePref: {
            MaxConnections: "4"
          },
          TPA_Extensions: {
            DataSources: {
              ATPCO: "Enable",
              LCC: "Enable",
              NDC: "Enable",
            },
            LongConnectTime: {
              Min: 780,
              Max: 1439,
              Enable: true
            }
          },
        },
        TravelerInfoSummary: {
          AirTravelerAvail: [
            {
              PassengerTypeQuantity: PassengerTypeQuantity,
            },
          ],
        },
        Version: "4",
      },
    };
    return searchRequest;
  }
  async search(@Body() body) {
    const tokenData = await this.createToken('search');
    // console.log(tokenData);
    // return tokenData;
    let url: string = SABER_API_URL + "v4/offers/shop";
    const searchRequest: any = await this.searchRequest(body);
    if (this.isNotHitApi) {
    }

    // let options = {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: "Bearer " + tokenData.access_token
    //   },
    //   body: JSON.stringify(searchRequest),
    // };


    let result: any = {};
    result = await this.httpService.post(url, JSON.stringify(searchRequest), {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + tokenData.access_token
      }
    }).toPromise();
    console.log("result-",result);

    // result = await fetch(url, options)
    //   .then((res) => res.json())
    //   .then((json) => {
    //     return json;
    //   })
    //   .catch((err) => console.error("error:" + err));
    //return result;

    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/OTA_AirLowFareSearchRQ.json`, JSON.stringify(searchRequest));
      fs.writeFileSync(`${logStoragePath}/flights/sabre/OTA_AirLowFareSearchRS.json`, JSON.stringify(result));
    }

    // const fs = require('fs');
    // let result = JSON.parse(fs.readFileSync('./test-data/flights/sabre/search_res.json', 'utf-8'))

    try {
      if (result['groupedItineraryResponse']['statistics']['itineraryCount'] != undefined && result['groupedItineraryResponse']['statistics']['itineraryCount'] > 0) {
        // console.log("Dataaaa" , result)
        const FlightDataList = await this.sabreTransformService.finalData(result, body);
        return FlightDataList;
        //return { result: FlightDataList, message: "" };
      } else {
        return { result: {}, message: "No flights found." };
      }

    } catch (error) {
      console.log(error);
    }


  }

  async fareQuoteRequest(body: any) {
    const flightDetails = body;
    const segment_details: any = flightDetails['FlightInfo']['FlightDetails']['Details'];
    const searchData: any = flightDetails['SearchData'];
    const OriginDestinationInformation: any = [];
    for (let s: number = 0; s < searchData['Segments'].length; s++) {
      let seg: any = {};
      const Flight: any = [];
      for (let i = 0; i < segment_details[s].length; i++) {
        let single_seg: any = segment_details[s][i];

        let o_dates = single_seg['Origin']['DateTime'].split(' ');
        let DepartureDateTime = o_dates[0] + 'T' + o_dates[1].slice(0, 8);
        let d_dates = single_seg['Destination']['DateTime'].split(' ');
        let ArrivalDateTime = d_dates[0] + 'T' + d_dates[1].slice(0, 8);
        let Type = single_seg['Attr']['Type'];
        let flight_details: any = {

          ClassOfService: single_seg['CabinClass'],
          Number: single_seg['FlightNumber'],
          DepartureDateTime: DepartureDateTime,
          ArrivalDateTime: ArrivalDateTime,
          Type: Type,
          OriginLocation: {
            LocationCode: single_seg['Origin']['AirportCode'],
          },
          DestinationLocation: {
            LocationCode: single_seg['Destination']['AirportCode'],
          },
          Airline: {
            Operating: single_seg['DisplayOperatorCode'],
            Marketing: single_seg['OperatorCode'],
          },
        };
        Flight.push(flight_details);
      }
      seg = {
        DepartureDateTime: searchData['Segments'][s].DepartureDate,
        DestinationLocation: {
          LocationCode: searchData['Segments'][s].Destination
        },
        OriginLocation: {
          LocationCode: searchData['Segments'][s].Origin
        },
        RPH: String(s),
        TPA_Extensions: {
          Flight: Flight
        }
      }
      OriginDestinationInformation.push(seg);
    }

    if (searchData['JourneyType'] == "Return") {
      let seg: any = {};
      const Flight: any = [];
      for (let i = 0; i < segment_details[1].length; i++) {
        let single_seg: any = segment_details[1][i];
        let o_dates = single_seg['Origin']['DateTime'].split(' ');
        let DepartureDateTime = o_dates[0] + 'T' + o_dates[1].slice(0, 8);
        let d_dates = single_seg['Destination']['DateTime'].split(' ');
        let ArrivalDateTime = d_dates[0] + 'T' + d_dates[1].slice(0, 8);
        let Type = single_seg['Attr']['Type'];
        let flight_details: any = {
          ClassOfService: single_seg['CabinClass'],
          Number: single_seg['FlightNumber'],
          DepartureDateTime: DepartureDateTime,
          ArrivalDateTime: ArrivalDateTime,
          Type: Type,
          OriginLocation: {
            LocationCode: single_seg['Origin']['AirportCode'],
          },
          DestinationLocation: {
            LocationCode: single_seg['Destination']['AirportCode'],
          },
          Airline: {
            Operating: single_seg['DisplayOperatorCode'],
            Marketing: single_seg['OperatorCode'],
          },
        };
        Flight.push(flight_details);
      }
      seg = {
        DepartureDateTime: searchData['Segments'][0].ReturnDate,
        DestinationLocation: {
          LocationCode: searchData['Segments'][0].Origin
        },
        OriginLocation: {
          LocationCode: searchData['Segments'][0].Destination
        },
        RPH: "1",
        TPA_Extensions: {
          Flight: Flight
        }
      }
      OriginDestinationInformation.push(seg);
    }

    let PassengerTypeQuantity: any = [];
    if (searchData.AdultCount > 0) {
      let pax_count: any = {
        Code: "ADT",
        Quantity: Number(searchData.AdultCount)
      }
      PassengerTypeQuantity.push(pax_count);
    }
    if (searchData.ChildCount > 0) {
      if (searchData.childDOB) {
        for (let c = 0; c < searchData.ChildCount; c++) {
          const Age = ('' + this.getPassengeTypeByDOB(searchData.childDOB[c]).age).padStart(2, '0');
          let pax_count: any = {
            Code: `C${Age}`,
            Quantity: 1
          }
          PassengerTypeQuantity.push(pax_count);
        }
      } else {
        let pax_count: any = {
          Code: "CNN",
          Quantity: Number(searchData.ChildCount)
        }
        PassengerTypeQuantity.push(pax_count);
      }

    }
    if (searchData.InfantCount > 0) {
      if (0) {
        for (let i = 0; i < searchData.InfantCount; i++) {
          const Age = ('' + this.getMonthsByDOB(searchData.infantDOB[i]).age).padStart(2, '0');
          let pax_count: any = {
            Code: `I${Age}`,
            Quantity: 1
          }
          PassengerTypeQuantity.push(pax_count);
        }
      } else {
        let pax_count: any = {
          Code: "INF",
          Quantity: Number(searchData.InfantCount)
        }
        PassengerTypeQuantity.push(pax_count);
      }
    }
    // if (searchData.ChildCount > 0) {
    //   let pax_count: any = {
    //     Code: "CNN",
    //     Quantity: Number(searchData.ChildCount)
    //   }
    //   PassengerTypeQuantity.push(pax_count);
    // }
    // if (searchData.InfantCount > 0) {
    //   let pax_count: any = {
    //     Code: "INF",
    //     Quantity: Number(searchData.InfantCount)
    //   }
    //   PassengerTypeQuantity.push(pax_count);
    // }
    const fareQuoteRequest: any = {
      OTA_AirLowFareSearchRQ: {
        POS: {
          Source: [
            {
              PseudoCityCode: PseudoCityCode,
              RequestorID: {
                CompanyName: {
                  Code: CompanyCode,
                },
                ID: "1",
                Type: "1",
              },
            },
          ],
        },
        OriginDestinationInformation: OriginDestinationInformation,
        TravelerInfoSummary: {
          AirTravelerAvail: [
            {
              PassengerTypeQuantity: PassengerTypeQuantity,
            },
          ],
        },
        TPA_Extensions: {
          IntelliSellTransaction: {
            RequestType: {
              Name: RequestType,
            },
            ServiceTag: {
              Name: "REVALIDATE",
            },
          },
        },
        Version: "4",
      },
    };
    return fareQuoteRequest;
  }



  async fareQuote(body: any): Promise<any> {
    const FlightDetail = await this.redisServerService.read_list(body["ResultToken"]);

    const FlightDetailParsed = JSON.parse(FlightDetail);
    const tokenData = await this.createToken('pricing');
    const SearchData = FlightDetailParsed['SearchData'];

    let url = SABER_API_URL + "v4/shop/flights/revalidate";
    const fareQuoteRequest: any = await this.fareQuoteRequest(FlightDetailParsed);



    // let options = {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: "Bearer " + tokenData.access_token
    //   },
    //   body: JSON.stringify(fareQuoteRequest),
    // };

    let result: any = {};
    // const fs = require('fs');
    // result = JSON.parse(fs.readFileSync('./test-data/flights/sabre/farequote_res.json', 'utf-8'))
    result = await this.httpService.post(url, JSON.stringify(fareQuoteRequest), {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + tokenData.access_token
      }
    }).toPromise();
    // result = await fetch(url, options)
    //   .then((res: { json: () => void; }) => res.json())
    //   .then((json: any) => {
    //     return json;
    //   })
    //   .catch((err: string) => console.error("error:" + err));

    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/PRICING_RQ.json`, JSON.stringify(fareQuoteRequest));
      fs.writeFileSync(`${logStoragePath}/flights/sabre/PRICING_RS.json`, JSON.stringify(result));
    }



    if (result['groupedItineraryResponse']['statistics']['itineraryCount'] != undefined && result['groupedItineraryResponse']['statistics']['itineraryCount'] > 0) {
      const fareQuoteDetail = await this.sabreTransformService.finalData(result, SearchData);
      return { result: { UpdateFareQuote: { FareQuoteDetails: { JourneyList: fareQuoteDetail[0], SearchData } } }, message: "" };
    } else {
      return { result: {}, message: "No price available." };
    }
  }

  async seatAvailability(body: any): Promise<any> {
    try {
      const FlightDetail = await this.redisServerService.read_list(body['ResultToken']);
      const FlightDetailParsed = JSON.parse(FlightDetail[0]);
      //let data = this.xmlToJson(FlightDetailParsed.KeyData.key.price_xml);
      console.log(FlightDetailParsed);

      if (FlightDetailParsed) {
        let flight_data = FlightDetailParsed.FlightInfo.FlightDetails.Details;

        let searchData = FlightDetailParsed.SearchData;


        const CabinClass = getPropValue(searchData.Segments[0], 'CabinClass') || getPropValue(searchData.Segments[0], 'CabinClassOnward');

        let CabinClassCode = 'Y';
        if (CabinClass == 'PremiumEconomy') {
          CabinClassCode = 'S';
        } else if (CabinClass == 'Business') {
          CabinClassCode = 'C';
        } else if (CabinClass == 'First') {
          CabinClassCode = 'F';
        }


        const pax = [];
        let pax_number = 1;

        if (searchData.AdultCount > 0) {
          for (let p = 0; p < searchData.AdultCount; p++) {
            let pax_count: any = {
              ptc: "ADT",
              paxID: `passenger${pax_number}`
            }
            pax.push(pax_count);
            pax_number++;
          }
        }
        if (searchData.ChildCount > 0) {
          for (let p = 0; p < searchData.ChildCount; p++) {
            let pax_count: any = {
              ptc: "CNN",
              paxID: `passenger${pax_number}`
            }
            pax.push(pax_count);
            pax_number++;
          }
        }

        if (searchData.InfantCount > 0) {
          for (let p = 0; p < searchData.InfantCount; p++) {
            let pax_count: any = {
              ptc: "INF",
              paxID: `passenger${pax_number}`
            }
            pax.push(pax_count);
            pax_number++;
          }
        }

        const segment_info = [];
        const seat_data = [];
        let segment_count = 1;
        for (let s = 0; s < flight_data.length; s++) {
          for (let t = 0; t < flight_data[s].length; t++) {
            const info = flight_data[s][t];
            console.log(JSON.stringify(info))
            segment_info.push(`segment${segment_count}`);

            let o_dates = info['Origin']['DateTime'].split(' ');
            let DepartureDateTime = o_dates[0] + 'T' + o_dates[1].slice(0, 8);
            let d_dates = info['Destination']['DateTime'].split(' ');
            let ArrivalDateTime = d_dates[0] + 'T' + d_dates[1].slice(0, 8);

            seat_data.push({
              paxSegmentId: `segment${segment_count}`,
              departure: {
                locationCode: info.Origin.AirportCode,
                aircraftScheduledDate: {
                  date: DepartureDateTime
                }
              },
              arrival: {
                locationCode: info.Destination.AirportCode,
                aircraftScheduledDate: {
                  date: ArrivalDateTime
                }
              },
              marketingCarrierInfo: {
                bookingCode: info.CabinClass,
                carrierCode: info.OperatorCode,
                carrierFlightNumber: info.FlightNumber
              },
              operatingCarrierInfo: {
                bookingCode: info.CabinClass,
                carrierCode: info.Operatedby,
                carrierFlightNumber: info.FlightNumber
              },
              cabinType: {
                cabinTypeCode: CabinClassCode,
                cabinTypeName: CabinClass
              }
            });
            segment_count++;
          }
        }

        const Air_SeatmapRQ = {
          requestType: 'payload',
          party: {
            sender: {
              travelAgency: {
                pseudoCityID: PseudoCityCode,
                agencyID: CompanyCode
              }
            }
          },
          request: {
            paxSegmentRefIds: segment_info,
            originDest: {
              paxJourney: {
                paxSegments: seat_data
              }
            },
            paxes: pax
          }
        };

        console.log(JSON.stringify(Air_SeatmapRQ));
        const tokenData = await this.createToken('seatAvailability');
        let url: string = SABER_API_URL + "v1/offers/getseats";

        let result: any = {};
        result = await this.httpService.post(url, JSON.stringify(Air_SeatmapRQ), {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + tokenData.access_token
          }
        }).toPromise();
        if (this.isLogXml) {
          fs.writeFileSync(`${logStoragePath}/flights/sabre/seatAvailability_RQ.json`, JSON.stringify(Air_SeatmapRQ));
          fs.writeFileSync(`${logStoragePath}/flights/sabre/seatAvailability_RS.json`, JSON.stringify(result));
        }
        let response = await this.sabreTransformService.seatAvailabilityDataFormat(result);
        return response;
      }
      else {
        throw new Error(`FlightDetails Data not Found`)
      }
    } catch (error) {
      console.log(error);
    }

  }

  async commitBooking(body: any): Promise<any> {

    const flightBookings = await this.getGraphData(`query{flightBookings(where:{app_reference:{eq:"${body['AppReference']}"}}){app_reference}}`, 'flightBookings');
    if (flightBookings.length) {
      return { result: [], message: 'AppReference already exist!' };
    }
    const fareQuoteData = await this.redisServerService.read_list(body["ResultToken"]);

    const LeadPax = body["Passengers"].find((t) => t.IsLeadPax) || {};
    const fareQuoteDataParsed = JSON.parse(fareQuoteData[0]);

    const Price = fareQuoteDataParsed['FlightInfo']['Price'];

    const JourneyList = fareQuoteDataParsed["FlightInfo"];

    const flight_booking_transactions = [];
    const CabinClass = getPropValue(fareQuoteDataParsed["SearchData"]["Segments"][0], 'CabinClass') || getPropValue(fareQuoteDataParsed["SearchData"]["Segments"][0], 'CabinClassOnward');
    const flightDetail = {
      domain_origin: "Sabre",
      app_reference: body["AppReference"],
      booking_source: body["BookingSource"],
      api_code: body['booking_source'],
      subagent_id: body["subagent_id"],
      trip_type: fareQuoteDataParsed["SearchData"]["JourneyType"],
      phone_code: LeadPax["PhoneCode"],
      phone: LeadPax["ContactNo"],
      alternate_number: LeadPax["ContactNo"],
      email: LeadPax["Email"] || LeadPax["email"],
      journey_start:
        fareQuoteDataParsed["SearchData"]["Segments"][0]["DepartureDate"],
      journey_end:
        fareQuoteDataParsed["SearchData"]["Segments"][
        fareQuoteDataParsed["SearchData"]["Segments"].length - 1
        ]["DepartureDate"],
      journey_from: fareQuoteDataParsed["SearchData"]["Segments"][0]["Origin"],
      journey_to:
        fareQuoteDataParsed["SearchData"]["Segments"][
        fareQuoteDataParsed["SearchData"]["Segments"].length - 1
        ]["Destination"],
      from_loc: "",
      to_loc: "",
      cabin_class: CabinClass,
      is_lcc: 0,
      payment_mode: "online",
      convinence_value: 0,
      convinence_value_type: "plus",
      convinence_per_pax: 0,
      convinence_amount: 0,
      discount: 0,
      promo_code: "",
      currency: Price["Currency"],
      currency_conversion_rate: 1,
      version: 1,
      attributes: body["Remark"] || " ",
      gst_details: "",
      created_by_id: body['UserId'] ? body['UserId'] : 0,
      booking_status: "BOOKING_INPROGRESS",
    };
    // for (let i = 0; i < JourneyList.length; i++) {
    // for (let j = 0; j < JourneyListTemp.length; j++) {
    const flight_booking_transaction_data = {
      app_reference: body["AppReference"],
      pnr: "",
      // status: "BOOKING_INPROGRESS",
      status_description: "",
      gds_pnr: "",
      source: "",
      ref_id: "",
      total_fare: Price["TotalDisplayFare"],
      admin_commission: (Price['PriceBreakup']["CommissionDetails"]['AdminCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AdminCommission'] : 0,
      agent_commission: (Price['PriceBreakup']["CommissionDetails"]['AgentCommission']) ? Price['PriceBreakup']["CommissionDetails"]['AgentCommission'] : 0,
      admin_tds: 0,
      agent_tds: 0,
      admin_markup: (Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AdminMarkup'] : 0,
      agent_markup: (Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup']) ? Price['PriceBreakup']["MarkUpDetails"]['AgentMarkup'] : 0,
      currency: Price["Currency"],
      getbooking_StatusCode: "",
      getbooking_Description: "",
      getbooking_Category: "",
      attributes: JSON.stringify(Price).replace(/'/g, '"'),
      sequence_number: "0",
      hold_ticket_req_status: "0",
      created_by_id: body['UserId'] ? body['UserId'] : 0,
    };
    const passengersArray = [];
    const Passengers = body["Passengers"];
    const itineraries = [];
    let PassengerContactDetails = {};
    for (let m = 0; m < Passengers.length; m++) {
      if (!moment(Passengers[m]["DateOfBirth"]).isValid() || !moment(Passengers[m]["PassportExpiryDate"]).isValid()) {
        throw new BadRequestException('DateOfBirth or PassportExpiryDate is Invalid Date');
      }
      if (Passengers[m]["IsLeadPax"] == 1) {
        PassengerContactDetails = {
          Email: Passengers[m]["Email"],
          Phone: Passengers[m]["ContactNo"],
          PhoneExtension: Passengers[m]["PhoneCode"]
        }
      };
      const PassengerType =
        Passengers[m]["PaxType"] == 1
          ? "Adult"
          : Passengers[m]["PaxType"] == 2
            ? "Child"
            : "Infant";
      const GenderType = ["Mr", "Mstr"].includes(Passengers[m]["Title"])
        ? "Male"
        : "Female";


      let full_name = '';
      full_name = Passengers[m]['FirstName'].toUpperCase() + " " + Passengers[m]['Title'].toUpperCase();

      const passenger = {
        app_reference: body["AppReference"],
        passenger_type: PassengerType,
        is_lead: Passengers[m]["IsLeadPax"],
        title: Passengers[m]["Title"],
        first_name: Passengers[m]["FirstName"],
        middle_name: Passengers[m]["MiddleName"] || "",
        last_name: Passengers[m]["LastName"],
        date_of_birth: Passengers[m]["DateOfBirth"],
        gender: GenderType,
        passenger_nationality: Passengers[m]["CountryCode"],
        passport_number: Passengers[m]["PassportNumber"] || "",
        passport_issuing_country: Passengers[m]["PassportIssuingCountry"] || "",
        passport_expiry_date: Passengers[m]["PassportExpiryDate"] || "",
        // status: "BOOKING_INPROGRESS",
        created_by_id: body['UserId'] ? body['UserId'] : 0,
        full_name,
        attributes: "[]",
      };
      passengersArray.push(passenger);

      Passengers[m]["PaxType"] = PassengerType;
      Passengers[m]["Gender"] = GenderType;
      // allPassengers.push(Passengers[m]);
    }
    for (
      let k = 0;
      k < JourneyList["FlightDetails"]["Details"].length;
      k++
    ) {
      const FlightDetails = JourneyList["FlightDetails"]["Details"][k];

      for (let l = 0; l < FlightDetails.length; l++) {
        let att = {
          Duration: FlightDetails[l]['Duration']
        };
        const itinerary = {
          app_reference: body["AppReference"],
          airline_pnr: "",
          segment_indicator: 0,
          airline_code: FlightDetails[l]["OperatorCode"],
          airline_name: FlightDetails[l]["OperatorName"],
          flight_number: FlightDetails[l]["FlightNumber"],
          fare_class: Price["PriceBreakup"]["RBD"],
          from_airport_code: FlightDetails[l]["Origin"]["AirportCode"],
          from_airport_name: FlightDetails[l]["Origin"]["AirportName"],
          to_airport_code: FlightDetails[l]["Destination"]["AirportCode"],
          to_airport_name: FlightDetails[l]["Destination"]["AirportName"],
          departure_datetime: FlightDetails[l]["Origin"]["DateTime"],
          arrival_datetime: FlightDetails[l]["Destination"]["DateTime"],
          cabin_baggage: FlightDetails[l]["Attr"]["CabinBaggage"],
          checkin_baggage: FlightDetails[l]["Attr"]["Baggage"],
          is_refundable: "0",
          // status: "",
          operating_carrier: FlightDetails[l]["OperatorCode"],
          FareRestriction: 0,
          FareBasisCode: 0,
          FareRuleDetail: 0,
          created_by_id: body['UserId'] ? body['UserId'] : 0,
          attributes: JSON.stringify(att),
        };
        itineraries.push(itinerary);
      }
    }
    // }
    // }

    const booking = {
      ...flightDetail,
      flightBookingTransactions: [
        {
          ...flight_booking_transaction_data,
          flightBookingTransactionItineraries: itineraries,
          flightBookingTransactionPassengers: passengersArray,
        },
      ],
    };

    const flight_booking_itineraries = await this.setGraphData(
      "FlightBookings",
      booking
    );

    const allPassengers = await this.getGraphData(`
        query {
            flightBookingTransactionPassengers(
                where: {
                    app_reference: {
                        eq: "${body['AppReference']}"
                    }
                }
            ) {
                PassengerId: id,
                PassengerType: passenger_type,
                Title: title,
                FirstName: first_name,
                MiddleName: middle_name,
                LastName: last_name,
                DateOfBirth: date_of_birth,
                Gender: gender,
                PassportNumber: passport_number,
                PassportIssuingCountry: passport_issuing_country,
                PassportExpiryDate: passport_expiry_date
            }
        }
    `, 'flightBookingTransactionPassengers');
    const result = {
      CommitBooking: {
        BookingDetails: {
          BookingId: "",
          PNR: "",
          GDSPNR: "",
          PassengerContactDetails,
          PassengerDetails: allPassengers,
          JourneyList: {
            FlightDetails: fareQuoteDataParsed["FlightInfo"]["FlightDetails"],
          },
          Price: Price,
          Attr: "",
          ResultToken: body['ResultToken'],
          AppReference: body['AppReference'],
          booking_source: SABRE_FLIGHT_BOOKING_SOURCE
        },
      },
    };
    return { result, message: "" };
  }

  async reservationRequest(flightData: any, body: any) {


    const flightBookings = await this.getGraphData(
      `query {
          flightBookings(
              where: {
                  app_reference: {
                      eq: "${body["AppReference"]}"
                  }
              }
          ){
              email
              phone
              attributes
          }
      }
      `, "flightBookings"
    );

    const flightBookingTransactionPassengers = await this.getGraphData(
      `query {flightBookingTransactionPassengers(where:{
              app_reference:{eq:"${body["AppReference"]}"}
            }){
                  id
                  app_reference
                  first_name
                  middle_name
                  last_name
                  title
                  gender
                  date_of_birth
                  passenger_type
                  passport_number
                  passport_expiry_date
                  passport_issuing_country
                  passenger_nationality
                  
      }}`,
      "flightBookingTransactionPassengers"
    );

    let PersonName: any = [];
    for (let p = 0; p < flightBookingTransactionPassengers.length; p++) {

      let pax_type: any;
      if (flightBookingTransactionPassengers[p]['passenger_type'] == "Adult") {
        pax_type = "ADT";
      } else if (flightBookingTransactionPassengers[p]['passenger_type'] == "Child") {
        pax_type = "C09";
      } else {
        pax_type = "INF";
      }
      let PersonDetails = {
        NameNumber: (p + 1) + ".1",
        NameReference: '',
        PassengerType: pax_type,
        GivenName: flightBookingTransactionPassengers[p]['first_name'].toUpperCase() + " " + flightBookingTransactionPassengers[p]['title'].toUpperCase(),
        // MiddleName: flightBookingTransactionPassengers[p]['middle_name'] ? flightBookingTransactionPassengers[p]['middle_name'] : "",
        Surname: flightBookingTransactionPassengers[p]['last_name'].toUpperCase(),
        Infant: false
      };
      if (pax_type == "INF") {
        PersonDetails['Infant'] = true
        const Age = ('' + this.getMonthsByDOB(flightBookingTransactionPassengers[p]['date_of_birth']).age).padStart(2, '0');
        // PersonDetails['NameReference'] = `I06`;
        PersonDetails['NameReference'] = `I${Age}`;
      }
      if (pax_type == "C09") {
        const Age = ('' + this.getPassengeTypeByDOB(flightBookingTransactionPassengers[p]['date_of_birth']).age).padStart(2, '0');
        PersonDetails['NameReference'] = `C${Age}`;
        PersonDetails['PassengerType'] = `C${Age}`;
      }
      PersonName.push(PersonDetails);
    }
    const SearchData = flightData['SearchData'];



    const FlightInfo = flightData['FlightInfo']['FlightDetails']['Details'];
    let FlightSegment: any = [];
    for (let f: number = 0; f < FlightInfo.length; f++) {
      for (let s: number = 0; s < FlightInfo[f].length; s++) {
        let f_data: any = FlightInfo[f][s];
        let flightDetails: any = {
          ArrivalDateTime: f_data['Destination']['DateTime'].replace(' ', 'T'),
          DepartureDateTime: f_data['Origin']['DateTime'].replace(' ', 'T'),
          FlightNumber: JSON.stringify(f_data['FlightNumber']),
          NumberInParty: JSON.stringify((parseInt(SearchData['AdultCount']) + parseInt(SearchData['ChildCount']))),
          ResBookDesigCode: f_data['CabinClass'],
          Status: "NN",
          DestinationLocation: {
            LocationCode: f_data['Destination']['AirportCode'],
          },
          MarketingAirline: {
            Code: f_data['OperatorCode'],
            FlightNumber: JSON.stringify(f_data['FlightNumber']),
          },
          OriginLocation: {
            LocationCode: f_data['Origin']['AirportCode'],
          },
        };
        FlightSegment.push(flightDetails);
      }
    }

    let PassengerTypeQuantity: any = [];
    if (SearchData.AdultCount > 0) {
      let pax_count: any = {
        Code: "ADT",
        Quantity: SearchData.AdultCount.toString()
      }
      PassengerTypeQuantity.push(pax_count);
    }
    if (SearchData.ChildCount > 0) {
      for(let i=0 ;i<flightBookingTransactionPassengers.length; i++){
        if(flightBookingTransactionPassengers[i]['passenger_type'] == "Child"){
      const Age = ('' + this.getPassengeTypeByDOB(flightBookingTransactionPassengers[i]['date_of_birth']).age).padStart(2, '0');
      let pax_count: any = {
        Code: `C${Age}`,
        Quantity: "1"
      }
      PassengerTypeQuantity.push(pax_count);
    }
    }
    }
    if (SearchData.InfantCount > 0) {
      let pax_count: any = {
        Code: "INF",
        Quantity: SearchData.InfantCount.toString()
      }
      PassengerTypeQuantity.push(pax_count);
    }
    let AdvancePassenger: any = [];
    let SecureFlight: any = [];
    let k=1;
    for (let p = 0; p < flightBookingTransactionPassengers.length; p++) {

      let dob = flightBookingTransactionPassengers[p]['date_of_birth'];

      if (flightBookingTransactionPassengers[p]['passenger_type'] == "Infant" || flightBookingTransactionPassengers[p]['passenger_type'] == "Child") {
        //dob = await this.getDOBFormat(flightBookingTransactionPassengers[p]['date_of_birth']);
      }
      let gender = "";
      let NameNumber = "";
      if (flightBookingTransactionPassengers[p]['passenger_type'] == "Infant") {
        gender = "FI"
        NameNumber = `${k}.1`
        k++;
      } else {
        gender = flightBookingTransactionPassengers[p]['gender'][0]
      }
      let PersonDetails = {
        NameNumber: flightBookingTransactionPassengers[p]['passenger_type'] == "Infant" ? NameNumber : (p + 1) + ".1",
        DateOfBirth: dob,
        GivenName: flightBookingTransactionPassengers[p]['first_name'],
        // MiddleName: flightBookingTransactionPassengers[p]['middle_name'] ? flightBookingTransactionPassengers[p]['middle_name'] : "",
        Surname: flightBookingTransactionPassengers[p]['last_name'],
        Gender: gender,
      };
      let DocumentDetails = {
        ExpirationDate: flightBookingTransactionPassengers[p]['passport_expiry_date'],
        IssueCountry: flightBookingTransactionPassengers[p]['passport_issuing_country'],
        NationalityCountry: flightBookingTransactionPassengers[p]['passenger_nationality'],
        Number: flightBookingTransactionPassengers[p]['passport_number'],
        Type: "P"
      }

      AdvancePassenger.push({
        PersonName: PersonDetails,
        Document: DocumentDetails,
        SegmentNumber: "1"
      })
    }
    let j=1;
    for (let p = 0; p < flightBookingTransactionPassengers.length; p++) {


      let gender = ""
      let NameNumber = ""
      if (flightBookingTransactionPassengers[p]['passenger_type'] == "Infant") {
        gender = "FI"
        NameNumber = `${j}.1`
        j++;
      } else {
        gender = flightBookingTransactionPassengers[p]['gender'][0]
      }
      let dob = flightBookingTransactionPassengers[p]['date_of_birth'];
      if (flightBookingTransactionPassengers[p]['passenger_type'] == "Infant" || flightBookingTransactionPassengers[p]['passenger_type'] == "Child") {
        // dob = await this.getDOBFormat(flightBookingTransactionPassengers[p]['date_of_birth']);
      }
      let PersonDetails = {
        NameNumber: flightBookingTransactionPassengers[p]['passenger_type'] == "Infant" ? NameNumber : (p + 1) + ".1",
        DateOfBirth: dob,
        GivenName: flightBookingTransactionPassengers[p]['first_name'],
        // MiddleName: flightBookingTransactionPassengers[p]['middle_name'] ? flightBookingTransactionPassengers[p]['middle_name'] : "",
        Surname: flightBookingTransactionPassengers[p]['last_name'],
        Gender: gender,
      };
      SecureFlight.push({
        PersonName: PersonDetails,
        SegmentNumber: "1",
        "VendorPrefs": {
          "Airline": {
            "Hosted": false
          }
        }
      })
    }
    const mobile_no = '880' + flightBookings[0]['phone'];


    let Service: any = [];
    flightBookingTransactionPassengers.forEach((element, index) => {
      let SSR_Code = "";
      let Text = "";
      let NameNumber = ""
      let date_of_birth = formatStringtDateNoSpace(element.date_of_birth)
      SSR_Code = "CTCM",
        Text = "01252366977";
      NameNumber = "1.1"
      if (element.passenger_type == "Infant") {
        SSR_Code = "INFT",
          Text = (element.last_name + "/" + element.first_name + " " + element.title).toUpperCase() + "/" + date_of_birth,
          NameNumber = "1.1"
      }
      if (element.passenger_type == "Child") {
        SSR_Code = "CHLD"
        Text = date_of_birth,
          NameNumber = (index + 1) + ".1"
      }
      if (element.passenger_type == "Adult") {
        SSR_Code = "OTHS",
          Text = (element.first_name + " " + element.last_name).toUpperCase()
        NameNumber = (index + 1) + ".1"
      }
      Service.push({
        SSR_Code,
        Text,
        PersonName: { NameNumber },
        SegmentNumber: "1"
      });
      Service.push({
        SSR_Code: "CTCM",
        Text: mobile_no,
        PersonName: { NameNumber },
        SegmentNumber: "1"
      });
      Service.push({
        SSR_Code: "CTCE",
        Text: flightBookings[0]['email'].replace('@', '//').replace('_', '..'),
        PersonName: { NameNumber },
        SegmentNumber: "1"
      });
    });


    const reservationRequest: any = {
      CreatePassengerNameRecordRQ: {
        targetCity: PseudoCityCode,
        haltOnAirPriceError: true,
        TravelItineraryAddInfo: {
          AgencyInfo: {
            "Address": {
              "AddressLine": "Nosafer",
              "CityName": "Dhaka",
              "CountryCode": "BGD",
              "PostalCode": "1215",
              "StateCountyProv": {
                "StateCode": "BGD"
              },
              "StreetNmbr": "House 130 Road 11/B Gulshan1"
            },
            Ticketing: {
              TicketType: "7TAW",
            },
          },
          CustomerInfo: {
            ContactNumbers: {
              ContactNumber: [
                {
                  NameNumber: "1.1",
                  Phone: flightBookings[0]['phone'],
                  PhoneUseType: "P",
                },
              ],
            },
            "Email": [
              {
                "NameNumber": "1.1",
                "Address": flightBookings[0]['email']
              }
            ],
            PersonName: PersonName,
          },
        },
        AirBook: {
          HaltOnStatus: [
            { Code: "HL" },
            { Code: "KK" },
            { Code: "LL" },
            { Code: "NN" },
            { Code: "NO" },
            { Code: "UC" },
            { Code: "US" }
            // { Code: "HN" },
            // { Code: "UN" }
          ],
          OriginDestinationInformation: {
            FlightSegment: FlightSegment,
          },
          RedisplayReservation: {
            NumAttempts: 10,
            WaitInterval: 1000,
          },
        },
        AirPrice: [{
          PriceRequestInformation: {
            Retain: true,
            OptionalQualifiers: {
              FOP_Qualifiers: {
                BasicFOP: {
                  Type: "CASH",
                },
              },
              PricingQualifiers: {
                PassengerType: PassengerTypeQuantity,
              },
            },
          },
        }],
        SpecialReqDetails: {
          SpecialService: {
            SpecialServiceInfo: {
              AdvancePassenger: AdvancePassenger,
              SecureFlight: SecureFlight,
              Service: Service
            }
          }, 
          AddRemark: {
            RemarkInfo: {
              Remark: [{
                Text: flightBookings[0]['attributes'],
                Code: "H",
                Type: "Itinerary"
              }]
            }
          }
        },
        PostProcessing: {
          EndTransaction: {
            Source: {
              ReceivedFrom: "SABRE WEB",
            },
          },
          RedisplayReservation: {
            waitInterval: 3000,
          },
        }
      }
    };
    return reservationRequest;
  }

  async getDOBFormat(DOB) {
    let d = new Date(DOB),
      month_list = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear().toString().substr(-2);

    month = '' + month_list[d.getMonth()];
    if (day.length < 2)
      day = '0' + day;
    let dob = [day, month, year].join('');
    return dob;
  }
  async reservation(body: any): Promise<any> {
    const commitBookingData = await this.redisServerService.read_list(body["ResultToken"]);
    const commitBookingDataParsed = JSON.parse(commitBookingData[0]);

    const tokenData = await this.createToken('create')
    let url = SABER_API_URL + "v2.4.0/passenger/records?mode=create";

    const reservationRequest: any = await this.reservationRequest(commitBookingDataParsed, body);

    //    console.log(JSON.stringify(reservationRequest));
    // return false;
    let result: any = {};
    // result = await this.httpService.post(url, JSON.stringify(reservationRequest), {
    //   headers: {
    //     Accept: '*/*',
    //     "Content-Type": "application/json",
    //     Authorization: "Bearer " + tokenData.access_token
    //   }
    // }).toPromise();

    result = JSON.parse(fs.readFileSync(`${logStoragePath}/flights/sabre/AWTF180624-015-CreatePassengerNameRecordRS.json`, 'utf-8'));
    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body["AppReference"]}-CreatePassengerNameRecordRQ.json`, JSON.stringify(reservationRequest));
      // fs.writeFileSync(`${logStoragePath}/flights/sabre/${body["AppReference"]}-CreatePassengerNameRecordRS.json`, JSON.stringify(result));
    }
    result = this.sabreTransformService.reservationResponseFormat(result, body, commitBookingDataParsed)
    return result;
  }

  async ticketRequestFormat(app_reference) {

    const flightBookings = await this.getGraphData(`query {
      flightBookings(where: {app_reference: {eq:"${app_reference}"}}) {
        BookingTravelerRefObj
        UniversalRecordLocatorCode
        AirReservationLocatorCode
      }
    }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }
    let Record: any = [];
    const flightBookingTransactionPassengers = await this.getGraphData(
      `query {flightBookingTransactionPassengers(where:{
            app_reference:{eq:"${app_reference}"}
          }){
                id
                app_reference
                first_name
                last_name
                title
                gender
                date_of_birth
                passenger_type
                passport_expiry_date
                passport_issuing_country
                passenger_nationality
                
    }}`,
      "flightBookingTransactionPassengers"
    )
    let InfantCount = 0;
    let ChildCount = 0;
    let AdultCount = 0;
    let InfantCountFlag = 0;
    let ChildCountFlag = 0;
    let AdultCountFlag = 0;
    flightBookingTransactionPassengers.forEach((element, index) => {
      if (element.passenger_type == "Infant" && InfantCountFlag == 0) {
        InfantCount = 3;
        InfantCountFlag = 1;
        Record.push({ "Number": InfantCount });
      }
      if (element.passenger_type == "Child" && ChildCountFlag == 0) {
        ChildCount = 2;
        ChildCountFlag = 1;
        Record.push({ "Number": ChildCount });
      }
      if (element.passenger_type == "Adult" && AdultCountFlag == 0) {
        AdultCount = 1;
        AdultCountFlag = 1;
        Record.push({ "Number": AdultCount });
      }
    })
    // ,
    //         "Hardcopy": {
    //           "LNIATA": ""
    //         },
    //         "InvoiceItinerary": {
    //           "LNIATA": ""
    //         }
    const requestFormat = {
      "AirTicketRQ": {
        "version": "1.3.0",
        "targetCity": PseudoCityCode,
        "DesignatePrinter": {
          "Printers": {
            "Ticket": {
              "CountryCode": "BD"
            }
          }
        },
        "Itinerary": {
          "ID": flightBookings[0]['UniversalRecordLocatorCode']
        },
        "Ticketing": [
          {
            "MiscQualifiers": {
              "Commission": {
                "Percent": 7
              }
            },
            "PricingQualifiers": {
              "PriceQuote": [
                {
                  "Record": Record
                }
              ]
            }
          }
        ],
        "PostProcessing": {
          "EndTransaction": {
            "Source": {
              "ReceivedFrom": "CERT"
            },
            "Email": {
              "eTicket": {
                "PDF": {
                  "Ind": true
                },
                "Ind": true
              },
              "PersonName": {
                "NameNumber": "1.1"
              },
              "Ind": true
            }
          }
        }
      }
    }
    return requestFormat
  }

  async pnrRetrieve(body: any) {
    let jsonResponse = '';
    if (this.isDevelopment) {
      const response = fs.readFileSync(`${logStoragePath}/flights/sabre/${body.AppReference}:AirTicketingRes.json`, 'utf-8');
    } else {
      // const reservation = await this.redisServerService.read_list(body["ResultToken"]);

      const tokenData = await this.createToken('create')
      let url = SABER_API_URL + "v1.3.0/air/ticket";
      ;
   
      const ticketRequest: any = await this.ticketRequestFormat(body.AppReference);
      let result: any = {};
      result = await this.httpService.post(url, JSON.stringify(ticketRequest), {
        headers: {
          Accept: '*/*',
          "Content-Type": "application/json",
          Authorization: "Bearer " + tokenData.access_token
        }
      }).toPromise();
      if (this.isLogXml) {
        fs.writeFileSync(`${logStoragePath}/flights/sabre/${body["AppReference"]}-AirTicketingRQ.json`, JSON.stringify(ticketRequest));
        fs.writeFileSync(`${logStoragePath}/flights/sabre/${body["AppReference"]}-AirTicketingRS.json`, JSON.stringify(result));
      }
      result = await this.sabreTransformService.ticketingResponseFormat(result, body)
      return result;

    }

  }

  async cancellation(body: any): Promise<any> {
    let jsonResponse: any = '';
    let result: any = {}

    const tokenData = await this.createToken('cancellation')
    let url = `${SABER_API_URL}v1/trip/orders/cancelBooking`

    const flightBookings = await this.getGraphData(`query {
            flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
              BookingTravelerRefObj
              UniversalRecordLocatorCode
              AirReservationLocatorCode
            }
          }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }

    const cancellationRequest = {
      "confirmationId": flightBookings[0]['UniversalRecordLocatorCode'],
      "retrieveBooking": true,
      "cancelAll": true,
      "errorHandlingPolicy": "ALLOW_PARTIAL_CANCEL"
    }
    jsonResponse = await this.httpService.post(url, JSON.stringify(cancellationRequest), {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + tokenData.access_token
      }
    }).toPromise();
    if (jsonResponse == undefined) {
      return [];
    }
    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-CancelReq.json`, JSON.stringify(cancellationRequest));
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-CancelRes.json`, JSON.stringify(jsonResponse));
    }
    if (jsonResponse.errors) {
      const errorClass: any = getExceptionClassByCode(JSON.stringify("500 " + jsonResponse.errors));
      throw new errorClass(jsonResponse.errors);
    }
    if (jsonResponse.booking.travelers.length) {
      return this.sabreTransformService.updateReservationCancellation(body['AppReference'], jsonResponse)
    }
  }

  //  async voidAll(body: any): Promise<any> {
  //   let jsonResponse:any = '';
  //   let result : any = {}
  //   let tickets :any =[]

  //   const tokenData = await this.createToken('cancellation')
  //   let url = `https://api-crt.cert.havail.sabre.com/v1/trip/orders/voidFlightTickets`
  //       const flightBookings = await this.getGraphData(`query {
  //           flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
  //             BookingTravelerRefObj
  //             UniversalRecordLocatorCode
  //             AirReservationLocatorCode
  //           }
  //         }`, 'flightBookings');
  //       if (!flightBookings[0]['UniversalRecordLocatorCode']) {
  //           console.log('need to throw error');
  //       }

  //       const voidRequest = {
  //         "confirmationId": flightBookings[0]['UniversalRecordLocatorCode'],
  //         "retrieveBooking": true,
  //         "cancelAll": true,
  //         "flightTicketOperation": "VOID",
  //         "errorHandlingPolicy": "HALT_ON_ERROR"

  //       }
  //           jsonResponse = await this.httpService.post(url, JSON.stringify(voidRequest), {
  //             headers: {
  //               "Content-Type": "application/json",
  //               Authorization: "Bearer " + tokenData.access_token
  //             }
  //           }).toPromise();
  //           if (jsonResponse == undefined) {
  //               return [];
  //           }

  //       if (this.isLogXml) {
  //           fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-VoidReq.json`, JSON.stringify(voidRequest));
  //           fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-VoidRes.json`, JSON.stringify(jsonResponse));
  //       }
  //   return jsonResponse;
  //   }

  async void(body: any): Promise<any> {
    let jsonResponse: any = '';
    let result: any = {}
    let tickets: any = []

    const tokenData = await this.createToken('void')
    let url = `${SABER_API_URL}v1/trip/orders/voidFlightTickets`
    const flightBookings = await this.getGraphData(`query {
          flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
            BookingTravelerRefObj
            UniversalRecordLocatorCode
            AirReservationLocatorCode
          }
        }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }
    const flightPassengersDetails = await this.getGraphData(`query {
        flightBookingTransactionPassengers(where:{app_reference:{eq:"${body['AppReference']}"}}){
            ticket_no
      }
    }`, 'flightBookingTransactionPassengers')
    flightPassengersDetails.forEach(element => {
      tickets.push(element.ticket_no)
    });

    const voidRequest = {
      "tickets": tickets,
      "errorHandlingPolicy": "ALLOW_PARTIAL_CANCEL"

    }
    jsonResponse = await this.httpService.post(url, JSON.stringify(voidRequest), {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + tokenData.access_token
      }
    }).toPromise();
    if (jsonResponse == undefined) {
      return [];
    }

    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-VoidReq.json`, JSON.stringify(voidRequest));
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-VoidRes.json`, JSON.stringify(jsonResponse));
    }
    if (jsonResponse.errors) {
      const errorClass: any = getExceptionClassByCode(JSON.stringify("500 " + jsonResponse.errors));
      throw new errorClass(jsonResponse.errors);
    }
    if (jsonResponse.voidedTickets && jsonResponse.voidedTickets.length > 0) {
      return this.sabreTransformService.updateReservationVoid(body['AppReference'], jsonResponse)
    }


  }



  async importPNR(body: any): Promise<any> {

    let jsonResponse: any = '';
    let result: any = {}
    let tickets: any = []

    const tokenData = await this.createToken('RetrievePNR')
    let url = `${SABER_API_URL}v1/trip/orders/getBooking`
    const flightBookings = await this.getGraphData(`query {
          flightBookings(where: {app_reference: {eq:"${body['AppReference']}"}}) {
            BookingTravelerRefObj
            UniversalRecordLocatorCode
            AirReservationLocatorCode
            LastDateToTicket
          }
        }`, 'flightBookings');
    if (!flightBookings[0]['UniversalRecordLocatorCode']) {
      console.log('need to throw error');
    }


    const retrievePNRRequest = {
      "confirmationId": flightBookings[0]['UniversalRecordLocatorCode']
    }
    jsonResponse = await this.httpService.post(url, JSON.stringify(retrievePNRRequest), {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + tokenData.access_token
      }
    }).toPromise();

    const specialServices = jsonResponse['specialServices'];
    let flag: number = 0;
    let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    let months_num = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    let last_ticketing_date = '';
    const d = new Date();
    let current_year: any = '';
    current_year = d.getFullYear() + '';
    specialServices.forEach(element => {
      if (element.code == "OTHS" && flag == 0) {
        let split_msg = element.message.split(' ');
        split_msg.forEach((word, w) => {
          months.forEach((mon, m) => {
            if (word.includes(mon)) {
              let split_word = word.split(mon);
              let year: any;
              if (split_word[1] != undefined) {
                if (split_word[1].length < 4) {
                  year = current_year.substring(0, 2) + split_word[1];
                } else {
                  year = split_word[1];
                }
              }
              last_ticketing_date = split_word[0] + '/' + months_num[m] + '/' + year + ' ' + split_msg[w + 1].substring(0, 2) + ":" + split_msg[w + 1].substring(2, 4);
              flag = 1;
            }
          });
        });
      }
    });
    // console.log(JSON.stringify(jsonResponse));
    if (last_ticketing_date != '') {
      await this.updateGraphDataByField(
        { app_reference: body["AppReference"] },
        "FlightBooking",
        { LastDateToTicket: last_ticketing_date }
      );
    }


    if (jsonResponse == undefined) {
      return [];
    }
    if (this.isLogXml) {
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-RetrievePNRReq.json`, JSON.stringify(retrievePNRRequest));
      fs.writeFileSync(`${logStoragePath}/flights/sabre/${body['AppReference']}-RetrievePNRRes.json`, JSON.stringify(jsonResponse));
    }
    if (jsonResponse.errors) {
      const errorClass: any = getExceptionClassByCode(JSON.stringify("500 " + jsonResponse.errors));
      throw new errorClass(jsonResponse.errors);
    }
    return jsonResponse;
  }
}
