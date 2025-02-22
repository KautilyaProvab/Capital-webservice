import { Injectable } from "@nestjs/common";
import { RedisServerService } from "../../../shared/redis-server.service";
import { FlightApi } from "../../flight.api";
import { debug, duration, formatSearchDate, formatVoucherDate, getPropValue, getDuration } from "apps/webservice/src/app.helper";
import { logStoragePath, ADVANCE_TAX_PERCENT, TMX_USER_NAME, TMX_PASSWORD, TMX_URL, TMX_SYSTEM, TMX_DOMAINKEY, TMX_FLIGHT_BOOKING_SOURCE, ExchangeRate_1_INR_to_BDT } from "apps/webservice/src/constants";
import { FlightDbService } from "../flight-db.service";

@Injectable()
export class TmxTransformService extends FlightApi {

    constructor(private readonly redisServerService: RedisServerService,
        private readonly flightDbService: FlightDbService) {
        super();
    }

    async finalData(apiResponse: any, body: any): Promise<any> {
        const FlightParameters = { FlightList: [] };

        const searchData: any = body;
        // Markup and Commission Start
        const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(searchData);
        //Add Commission Start
        let airlineMarkupAndCommission = {};

        if (markupAndCommission) {
            airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(searchData, markupAndCommission);
        }
        if (apiResponse['Status'] == 1 && apiResponse['Search'] != undefined) {
            this.airport_codes = await this.getSearchAirports();
            const token = this.redisServerService.geneateResultToken(searchData);
            const flight_data = apiResponse["Search"]["FlightDataList"]["JourneyList"];
            for (const [key1, value1] of flight_data.entries()) {
                for (const [key2, value2] of value1.entries()) {
                    let duration_list = [];
                    const flight_details = value2["FlightDetails"]["Details"];
                    for (const [key3, value3] of flight_details.entries()) {
                        let total_duration: number = 0;
                        for (const [key4, value4] of value3.entries()) {

                            total_duration += parseInt(value4['Duration']);

                            const tempAirportOrigin = this.airport_codes.find((t) => t.code === apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Origin"]["AirportCode"]) || {};
                            apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Origin"]["AirportName"] = tempAirportOrigin['name'] || apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Origin"]["AirportName"];

                            const tempAirportDestination = this.airport_codes.find((t) => t.code === apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Destination"]["AirportCode"]) || {};
                            apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Destination"]["AirportName"] = tempAirportDestination['name'] || apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Destination"]["AirportName"];
                            apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]['Duration'] = this.convertToHoursMins(value4['Duration']);
                            apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]['isFlightDetailsCollapsed'] = true;
                            let WaitingTime = 0;

                            if (key4 > 0) {
                                WaitingTime = getDuration(
                                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4 - 1]["Destination"]["DateTime"],
                                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["Origin"]["DateTime"]
                                );
                                if (WaitingTime > 0) {
                                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]["FlightDetails"]["Details"][key3][key4]["LayoverTime"] = this.convertToHoursMins(WaitingTime);
                                }
                            }

                        }
                        duration_list.push(this.convertToHoursMins(total_duration));
                    }
                    FlightParameters["SearchData"] = searchData;
                    let price = value2["Price"];
                    // console.log(price);

                    // price = await this.formatPriceDetailCurrencyChange('BDT', price.TotalDisplayFare, price.PriceBreakup.BasicFare, price.PriceBreakup.Tax, price.PriceBreakup.AgentCommission, price.PriceBreakup.AgentTdsOnCommision, price.PassengerBreakup);
                    // return false;
                    //Add Commission End
                    const PriceInfo = await this.flightDbService.formatPriceDetail(
                        searchData.UserId,
                        searchData.UserType,
                        price.Currency,
                        price.TotalDisplayFare,
                        price.PriceBreakup.BasicFare,
                        price.PriceBreakup.Tax,
                        0,
                        0,
                        [],
                        [],
                        '',
                        price.PassengerBreakup,
                        airlineMarkupAndCommission,
                        ''
                    );
                    let SelectedCurrencyPriceDetails = {};
                    if (body.Currency) {
                        if (body.Currency != 'USD') {
                            SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(body.Currency, PriceInfo);
                        } else {
                            SelectedCurrencyPriceDetails = PriceInfo;
                        }
                    }
                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['Price'] = PriceInfo;
                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['Exchange_Price'] = SelectedCurrencyPriceDetails;
                    if (apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['Attr']['IsRefundable'] == true) {
                        apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['Attr']['IsRefundable'] = 1;
                    } else {
                        apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['Attr']['IsRefundable'] = 0;
                    }
                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['Attr']['DurationList'] = duration_list;
                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['booking_source'] = TMX_FLIGHT_BOOKING_SOURCE;
                    FlightParameters["FlightList"][0] = apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2];
                    const ResultToken = await this.redisServerService.insert_record(
                        token,
                        JSON.stringify(FlightParameters)
                    );
                    apiResponse["Search"]["FlightDataList"]["JourneyList"][key1][key2]['ResultToken'] = ResultToken["access_key"];
                }
            }
            return apiResponse["Search"]["FlightDataList"]["JourneyList"];
        } else {
            return [];
        }

    }
    tax_breakup(tax_details) {
        const display_tax_list = ["YQ", "YR", "K3"];
        const return_tax_list = {};
        return_tax_list["Other_Tax"] = 0;
        for (const [key, value] of Object.entries(tax_details)) {
            if (display_tax_list.includes(key)) {
                return_tax_list[key] = value;
            } else {
                return_tax_list["Other_Tax"] += value;
            }
        }
        return return_tax_list;
    }


    async priceSummation(priceObj11, priceObj22, searchData, airlineMarkupAndCommission) {

        let priceObj1 = { Price: priceObj11 };

        let priceObj2 = { Price: priceObj22 };

        let newPriceObject = {
            Currency: priceObj1.Price.Currency,
            "PriceBreakup": {
            },
            "PassengerBreakup": {
            }

        }
        let Currency: any = priceObj1.Price.Currency;
        let TotalDisplayFare: any = '';
        let BasicFare: any = '';
        let Tax: any = '';
        let RBD: any = '';
        let FareType: any = '';
        let TaxDetails: any = {}
        let MarkUpDetails: any = {};
        let CommissionDetails: any = {};
        let PassengerBreakup: any = {};
        if (priceObj1.Price.TotalDisplayFare && priceObj2.Price.TotalDisplayFare) {
            TotalDisplayFare = parseFloat(priceObj1.Price.TotalDisplayFare) + parseFloat(priceObj2.Price.TotalDisplayFare)
        } else {
            TotalDisplayFare = priceObj1.Price["TotalDisplayFare"] ? priceObj1.Price["TotalDisplayFare"] : priceObj2.Price["TotalDisplayFare"] ? priceObj2.Price["TotalDisplayFare"] : ""

        }
        if (priceObj1.Price.PriceBreakup.BasicFare && priceObj2.Price.PriceBreakup.BasicFare) {
            BasicFare = parseFloat(priceObj1.Price.PriceBreakup.BasicFare) + parseFloat(priceObj2.Price.PriceBreakup.BasicFare)
        } else {
            BasicFare = priceObj1.Price.PriceBreakup["BasicFare"] ? priceObj1.Price.PriceBreakup["BasicFare"] : priceObj2.Price.PriceBreakup["BasicFare"] ? priceObj2.Price.PriceBreakup["BasicFare"] : ""

        }
        if (priceObj1.Price.PriceBreakup.Tax && priceObj2.Price.PriceBreakup.Tax) {
            Tax = parseFloat(priceObj1.Price.PriceBreakup.Tax) + parseFloat(priceObj2.Price.PriceBreakup.Tax);
        } else {
            Tax = priceObj1.Price.PriceBreakup["Tax"] ? priceObj1.Price.PriceBreakup["Tax"] : priceObj2.Price.PriceBreakup["Tax"] ? priceObj2.Price.PriceBreakup["Tax"] : "";
        }

        if (priceObj1.Price.PriceBreakup.RBD && priceObj2.Price.PriceBreakup.RBD) {
            RBD = priceObj1.Price.PriceBreakup["RBD"] + " " + priceObj2.Price.PriceBreakup["RBD"]
        } else {
            RBD = priceObj1.Price.PriceBreakup["RBD"] ? priceObj1.Price.PriceBreakup["RBD"] : priceObj2.Price.PriceBreakup["RBD"] ? priceObj2.Price.PriceBreakup["RBD"] : ""
        }

        if (priceObj1.Price.PriceBreakup.FareType && priceObj2.Price.PriceBreakup.FareType) {
            FareType = priceObj1.Price.PriceBreakup["FareType"] + " " + priceObj2.Price.PriceBreakup["FareType"]
        } else {
            FareType = priceObj1.Price.PriceBreakup["FareType"] ? priceObj1.Price.PriceBreakup["FareType"] : priceObj2.Price.PriceBreakup["FareType"] ? priceObj2.Price.PriceBreakup["FareType"] : ""
        }
        if (priceObj1.Price.PriceBreakup["TaxDetails"] && priceObj2.Price.PriceBreakup["TaxDetails"]) {
            if (priceObj1.Price.PriceBreakup["TaxDetails"]["Other_Tax"] && priceObj2.Price.PriceBreakup["TaxDetails"]["Other_Tax"]) {
                TaxDetails["Other_Tax"] = priceObj1.Price.PriceBreakup["TaxDetails"]["Other_Tax"] + priceObj2.Price.PriceBreakup["TaxDetails"]["Other_Tax"]
            } else {
                TaxDetails["Other_Tax"] = priceObj1.Price.PriceBreakup["TaxDetails"]["Other_Tax"] ? priceObj1.Price.PriceBreakup["TaxDetails"]["Other_Tax"] : priceObj2.Price.PriceBreakup["TaxDetails"]["Other_Tax"] ? priceObj2.Price.PriceBreakup["TaxDetails"]["Other_Tax"] : ""

            }
        } else {
            TaxDetails = priceObj1.Price.PriceBreakup["TaxDetails"] ? priceObj1.Price.PriceBreakup["TaxDetails"] : priceObj2.Price.PriceBreakup["TaxDetails"] ? priceObj2.Price.PriceBreakup["TaxDetails"] : {}

        }
        // if (priceObj1.Price.PriceBreakup["MarkUpDetails"] && priceObj2.Price.PriceBreakup["MarkUpDetails"]) {
        //     if (priceObj1.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"] && priceObj2.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"]) {
        //         MarkUpDetails["AgentMarkup"] = priceObj1.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"] + priceObj2.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"]
        //     } else {
        //         MarkUpDetails["AgentMarkup"] = priceObj1.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"] ? priceObj1.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"] : priceObj2.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"] ? priceObj2.Price.PriceBreakup["MarkUpDetails"]["AgentMarkup"] : ""
        //     }
        //     if (priceObj1.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"] && priceObj2.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"]) {
        //         MarkUpDetails["AdminMarkup"] = priceObj1.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"] + priceObj2.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"]
        //     } else {
        //         MarkUpDetails["AdminMarkup"] = priceObj1.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"] ? priceObj1.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"] : priceObj2.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"] ? priceObj2.Price.PriceBreakup["MarkUpDetails"]["AdminMarkup"] : ""
        //     }
        // }

        // if (priceObj1.Price.PriceBreakup["CommissionDetails"] && priceObj2.Price.PriceBreakup["CommissionDetails"]) {
        //     if (priceObj1.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"] && priceObj2.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"]) {
        //         CommissionDetails["AgentMarkup"] = priceObj1.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"] + priceObj2.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"]
        //     } else {
        //         CommissionDetails["AgentMarkup"] = priceObj1.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"] ? priceObj1.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"] : priceObj2.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"] ? priceObj2.Price.PriceBreakup["CommissionDetails"]["AgentMarkup"] : ""
        //     }
        //     if (priceObj1.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"] && priceObj2.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"]) {
        //         CommissionDetails["AdminMarkup"] = priceObj1.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"] + priceObj2.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"]
        //     } else {
        //         CommissionDetails["AdminMarkup"] = priceObj1.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"] ? priceObj1.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"] : priceObj2.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"] ? priceObj2.Price.PriceBreakup["CommissionDetails"]["AdminMarkup"] : ""
        //     }
        // }

        if (priceObj1.Price.PassengerBreakup && priceObj2.Price.PassengerBreakup) {
            if (priceObj1.Price.PassengerBreakup.ADT && priceObj2.Price.PassengerBreakup.ADT) {
                PassengerBreakup["ADT"] = {}
                if (priceObj1.Price.PassengerBreakup["ADT"].BasePrice && priceObj2.Price.PassengerBreakup["ADT"].BasePrice) {
                    PassengerBreakup["ADT"]['BasePrice'] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["ADT"].BasePrice) + parseFloat(priceObj1.Price.PassengerBreakup["ADT"].BasePrice))
                } else {
                    PassengerBreakup["ADT"]['BasePrice'] = priceObj1.Price.PassengerBreakup["ADT"].BasePrice ? priceObj1.Price.PassengerBreakup["ADT"].BasePrice : priceObj2.Price.PassengerBreakup["ADT"].BasePrice ? priceObj2.Price.PassengerBreakup["ADT"].BasePrice : ""
                }
                if (priceObj1.Price.PassengerBreakup.ADT.Tax && priceObj2.Price.PassengerBreakup.ADT.Tax) {
                    PassengerBreakup["ADT"]['Tax'] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["ADT"].Tax) + parseFloat(priceObj1.Price.PassengerBreakup["ADT"].Tax))
                } else {
                    PassengerBreakup["ADT"]['Tax'] = priceObj1.Price.PassengerBreakup["ADT"].Tax ? priceObj1.Price.PassengerBreakup["ADT"].Tax : priceObj2.Price.PassengerBreakup["ADT"].Tax ? priceObj2.Price.PassengerBreakup["ADT"].Tax : ""
                }
                if (priceObj1.Price.PassengerBreakup.ADT.TotalPrice && priceObj2.Price.PassengerBreakup.ADT.TotalPrice) {
                    PassengerBreakup["ADT"]["TotalPrice"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["ADT"].TotalPrice) + parseFloat(priceObj1.Price.PassengerBreakup["ADT"].TotalPrice))
                } else {
                    PassengerBreakup["ADT"]['TotalPrice'] = priceObj1.Price.PassengerBreakup["ADT"].TotalPrice ? priceObj1.Price.PassengerBreakup["ADT"].TotalPrice : priceObj2.Price.PassengerBreakup["ADT"].TotalPrice ? priceObj2.Price.PassengerBreakup["ADT"].TotalPrice : ""
                }
                PassengerBreakup["ADT"]['PassengerCount'] = priceObj1.Price.PassengerBreakup["ADT"].PassengerCount ? priceObj1.Price.PassengerBreakup["ADT"].PassengerCount : priceObj2.Price.PassengerBreakup["ADT"].PassengerCount ? priceObj2.Price.PassengerBreakup["ADT"].PassengerCount : ""
            } else {
                PassengerBreakup["ADT"] = priceObj1.Price.PassengerBreakup["ADT"] ? priceObj1.Price.PassengerBreakup["ADT"] : priceObj2.Price.PassengerBreakup["ADT"] ? priceObj2.Price.PassengerBreakup["ADT"] : {}
            }
            if (priceObj1.Price.PassengerBreakup.CHD && priceObj2.Price.PassengerBreakup.CHD) {
                PassengerBreakup["CHD"] = {}
                if (priceObj1.Price.PassengerBreakup.CHD.BasePrice && priceObj2.Price.PassengerBreakup.CHD.BasePrice) {
                    PassengerBreakup["CHD"]["BasePrice"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["CHD"].BasePrice) + parseFloat(priceObj1.Price.PassengerBreakup["CHD"].BasePrice))
                } else {
                    PassengerBreakup["CHD"]['BasePrice'] = priceObj1.Price.PassengerBreakup["CHD"].BasePrice ? priceObj1.Price.PassengerBreakup["CHD"].BasePrice : priceObj2.Price.PassengerBreakup["CHD"].BasePrice ? priceObj2.Price.PassengerBreakup["CHD"].BasePrice : ""
                }
                if (priceObj1.Price.PassengerBreakup.CHD.Tax && priceObj2.Price.PassengerBreakup["CHD"].Tax) {
                    PassengerBreakup["CHD"]["Tax"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["CHD"].Tax) + parseFloat(priceObj1.Price.PassengerBreakup["CHD"].Tax))
                } else {
                    PassengerBreakup["CHD"]['Tax'] = priceObj1.Price.PassengerBreakup["CHD"].Tax ? priceObj1.Price.PassengerBreakup["CHD"].Tax : priceObj2.Price.PassengerBreakup["CHD"].Tax ? priceObj2.Price.PassengerBreakup["CHD"].Tax : ""
                }
                if (priceObj1.Price.PassengerBreakup["CHD"].TotalPrice && priceObj2.Price.PassengerBreakup["CHD"].TotalPrice) {
                    PassengerBreakup["CHD"]["TotalPrice"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["CHD"].TotalPrice) + parseFloat(priceObj1.Price.PassengerBreakup["CHD"].TotalPrice))
                } else {
                    PassengerBreakup["CHD"]['TotalPrice'] = priceObj1.Price.PassengerBreakup["CHD"].TotalPrice ? priceObj1.Price.PassengerBreakup["CHD"].TotalPrice : priceObj2.Price.PassengerBreakup["CHD"].TotalPrice ? priceObj2.Price.PassengerBreakup["CHD"].TotalPrice : ""
                }
                PassengerBreakup["CHD"]['PassengerCount'] = priceObj1.Price.PassengerBreakup["CHD"].PassengerCount ? priceObj1.Price.PassengerBreakup["CHD"].PassengerCount : priceObj2.Price.PassengerBreakup["CHD"].PassengerCount ? priceObj2.Price.PassengerBreakup["CHD"].PassengerCount : ""

            }
            if (priceObj1.Price.PassengerBreakup['INF'] && priceObj2.Price.PassengerBreakup["INF"]) {
                PassengerBreakup["INF"] = {}
                if (priceObj1.Price.PassengerBreakup["INF"].BasePrice && priceObj2.Price.PassengerBreakup["INF"].BasePrice) {
                    PassengerBreakup["INF"]["BasePrice"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["INF"].BasePrice) + parseFloat(priceObj1.Price.PassengerBreakup["INF"].BasePrice))
                } else {
                    PassengerBreakup["INF"]['BasePrice'] = priceObj1.Price.PassengerBreakup["INF"].BasePrice ? priceObj1.Price.PassengerBreakup["INF"].BasePrice : priceObj2.Price.PassengerBreakup["INF"].BasePrice ? priceObj2.Price.PassengerBreakup["INF"].BasePrice : ""
                }
                if (priceObj1.Price.PassengerBreakup["INF"].Tax && priceObj2.Price.PassengerBreakup["INF"].Tax) {
                    PassengerBreakup["INF"]["Tax"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["INF"].Tax) + parseFloat(priceObj1.Price.PassengerBreakup["INF"].Tax))
                } else {
                    PassengerBreakup["INF"]['Tax'] = priceObj1.Price.PassengerBreakup["INF"].Tax ? priceObj1.Price.PassengerBreakup["INF"].Tax : priceObj2.Price.PassengerBreakup["INF"].Tax ? priceObj2.Price.PassengerBreakup["ADT"].Tax : ""
                }
                if (priceObj1.Price.PassengerBreakup["INF"].TotalPrice && priceObj2.Price.PassengerBreakup["INF"].TotalPrice) {
                    PassengerBreakup["INF"]["TotalPrice"] = JSON.stringify(parseFloat(priceObj1.Price.PassengerBreakup["INF"].TotalPrice) + parseFloat(priceObj1.Price.PassengerBreakup["INF"].TotalPrice))
                } else {
                    PassengerBreakup["INF"]['TotalPrice'] = priceObj1.Price.PassengerBreakup["INF"].TotalPrice ? priceObj1.Price.PassengerBreakup["INF"].TotalPrice : priceObj2.Price.PassengerBreakup["INF"].TotalPrice ? priceObj2.Price.PassengerBreakup["INF"].TotalPrice : ""
                }
                PassengerBreakup["INF"]['PassengerCount'] = priceObj1.Price.PassengerBreakup["INF"].PassengerCount ? priceObj1.Price.PassengerBreakup["INF"].PassengerCount : priceObj2.Price.PassengerBreakup["INF"].PassengerCount ? priceObj2.Price.PassengerBreakup["INF"].PassengerCount : ""

            }
        }

        const PriceInfo = await this.flightDbService.formatPriceDetail(
            searchData.UserId,
            searchData.UserType,
            Currency,
            TotalDisplayFare,
            BasicFare,
            Tax,
            0,
            0,
            RBD,
            TaxDetails,
            FareType,
            PassengerBreakup,
            airlineMarkupAndCommission,
            'VQ'
        );
        return PriceInfo;
    }

    async formatPriceDetailCurrencyChange(
        Currency,
        TotalDisplayFare,
        PriceBreakupBasicFare,
        PriceBreakupTax,
        PriceBreakupAgentCommission,
        PriceBreakupAgentTdsOnCommision,
        PassengerBreakup
    ) {
        if (PassengerBreakup) {
            if (PassengerBreakup.ADT) {
                PassengerBreakup.ADT.BasePrice = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.ADT.BasePrice / PassengerBreakup.ADT.PassengerCount).toFixed(2));
                PassengerBreakup.ADT.TotalPrice = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.ADT.TotalPrice / PassengerBreakup.ADT.PassengerCount).toFixed(2));
                PassengerBreakup.ADT.Tax = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.ADT.Tax / PassengerBreakup.ADT.PassengerCount).toFixed(2));
                PassengerBreakup.ADT.PassengerCount = Number(PassengerBreakup.ADT.PassengerCount);
            }
            if (PassengerBreakup.CHD) {
                PassengerBreakup.CHD.BasePrice = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.CHD.BasePrice / PassengerBreakup.CHD.PassengerCount).toFixed(2));
                PassengerBreakup.CHD.TotalPrice = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.CHD.TotalPrice / PassengerBreakup.CHD.PassengerCount).toFixed(2));
                PassengerBreakup.CHD.Tax = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.CHD.Tax / PassengerBreakup.CHD.PassengerCount).toFixed(2));
                PassengerBreakup.CHD.PassengerCount = Number(PassengerBreakup.CHD.PassengerCount);
            }
            if (PassengerBreakup.INF) {
                PassengerBreakup.INF.BasePrice = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.INF.BasePrice / PassengerBreakup.INF.PassengerCount).toFixed(2));
                PassengerBreakup.INF.TotalPrice = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.INF.TotalPrice / PassengerBreakup.INF.PassengerCount).toFixed(2));
                PassengerBreakup.INF.Tax = Number((ExchangeRate_1_INR_to_BDT * PassengerBreakup.INF.Tax / PassengerBreakup.INF.PassengerCount).toFixed(2));
                PassengerBreakup.INF.PassengerCount = Number(PassengerBreakup.INF.PassengerCount);
            }
        }

        return {
            Currency: Currency,
            TotalDisplayFare: Number((ExchangeRate_1_INR_to_BDT * TotalDisplayFare).toFixed(2)),
            PriceBreakup: {
                BasicFare: Number((ExchangeRate_1_INR_to_BDT * PriceBreakupBasicFare).toFixed(2)),
                Tax: Number((ExchangeRate_1_INR_to_BDT * PriceBreakupTax).toFixed(2)),
                AgentCommission: Number((ExchangeRate_1_INR_to_BDT * PriceBreakupAgentCommission).toFixed(2)) ? Number(ExchangeRate_1_INR_to_BDT * PriceBreakupAgentCommission.toFixed(2)) : 0,
                AgentTdsOnCommision: Number((ExchangeRate_1_INR_to_BDT * PriceBreakupAgentTdsOnCommision).toFixed(2))
            },
            PassengerBreakup: PassengerBreakup,
        };
    }
    async formatFareRule(body: any): Promise<any> {
        let fareRuleArr = [];
        const FareRule = { Description: body }
        fareRuleArr.push(FareRule);
        return fareRuleArr;
    }


    async formatFareQuote(apiResponse: any, body: any, previousData: any, markup: any, specific_markup: any, commission: any): Promise<any> {
        // console.log(JSON.stringify(apiResponse));
        // return false;
        let FlightInfo: any = {};
        let searchData: any = body;

        searchData = previousData[0]['SearchData'];

        // const is_domestic = await this.flightDbService.flightType(previousData['SearchData'])
        let advanceTax: any = 0

        let FlightDetails: any = [];
        let tmx_resultToken: any = [];
        if (apiResponse[0]['Status'] != 1) {
            return {};
        }
        // Markup and Commission Start
        const markupAndCommission = await this.flightDbService.markupAndCommissionDetails(searchData);
        //Add Commission Start
        let airlineMarkupAndCommission = {};

        if (markupAndCommission) {
            airlineMarkupAndCommission = await this.flightDbService.specificMarkupAndCommissionDetails(searchData, markupAndCommission);
        }
        if (previousData.length > 1) {
            for (let i = 0; i < previousData.length; i++) {
                FlightDetails.push(previousData[i]['FlightList'][0]['FlightDetails']['Details'][0]);
                tmx_resultToken.push(apiResponse[i]['UpdateFareQuote']['FareQuoteDetails']['JourneyList']['ResultToken']);
            }
            let price_onward = apiResponse[0]['UpdateFareQuote']['FareQuoteDetails']['JourneyList']["Price"];
            let price_return = apiResponse[1]['UpdateFareQuote']['FareQuoteDetails']['JourneyList']["Price"];

            // price_onward = await this.formatPriceDetailCurrencyChange('BDT', price_onward.TotalDisplayFare, price_onward.PriceBreakup.BasicFare, price_onward.PriceBreakup.Tax, price_onward.PriceBreakup.AgentCommission, price_onward.PriceBreakup.AgentTdsOnCommision, price_onward.PassengerBreakup);
            // price_return = await this.formatPriceDetailCurrencyChange('BDT', price_return.TotalDisplayFare, price_return.PriceBreakup.BasicFare, price_return.PriceBreakup.Tax, price_return.PriceBreakup.AgentCommission, price_return.PriceBreakup.AgentTdsOnCommision, price_return.PassengerBreakup);

            previousData[0]['FlightList'][0]['Price'] = price_onward;
            previousData[1]['FlightList'][0]['Price'] = price_return;

            FlightInfo["FlightDetails"] = {};
            FlightInfo["FlightDetails"]['Details'] = FlightDetails;
            FlightInfo["Price"] = (previousData[0]['FlightList'][0]['Price'] && previousData[1]['FlightList'][0]['Price']) ? await this.priceSummation(previousData[0]['FlightList'][0]['Price'], previousData[1]['FlightList'][0]['Price'], searchData, '') : previousData[0]['FlightList'][0]['Price'] ? previousData[0]['FlightList'][0]['Price'] : previousData[1]['FlightList'][0]['Price'];
            
            const PriceInfo = (previousData[0]['FlightList'][0]['Price'] && previousData[1]['FlightList'][0]['Price']) ? await this.priceSummation(previousData[0]['FlightList'][0]['Price'], previousData[1]['FlightList'][0]['Price'], searchData, '') : previousData[0]['FlightList'][0]['Price'] ? previousData[0]['FlightList'][0]['Price'] : previousData[1]['FlightList'][0]['Price'];
            let SelectedCurrencyPriceDetails = {};
            if (searchData.Currency) {
                if (searchData.Currency != 'USD') {
                    SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(searchData.Currency, PriceInfo);
                } else {
                    SelectedCurrencyPriceDetails = PriceInfo;
                }
            }
            FlightInfo["Exchange_Price"] = SelectedCurrencyPriceDetails;
        } else {
            let price = apiResponse[0]['UpdateFareQuote']['FareQuoteDetails']['JourneyList']["Price"];

            // price = await this.formatPriceDetailCurrencyChange('BDT', price.TotalDisplayFare, price.PriceBreakup.BasicFare, price.PriceBreakup.Tax, price.PriceBreakup.AgentCommission, price.PriceBreakup.AgentTdsOnCommision, price.PassengerBreakup);
            const PriceInfo = await this.flightDbService.formatPriceDetail(
                searchData.UserId,
                searchData.UserType,
                price.Currency,
                price.TotalDisplayFare,
                price.PriceBreakup.BasicFare,
                price.PriceBreakup.Tax,
                0,
                0,
                [],
                [],
                '',
                price.PassengerBreakup,
                airlineMarkupAndCommission,
                ''
            );

            let SelectedCurrencyPriceDetails = {};
            if (searchData.Currency) {
                if (searchData.Currency != 'USD') {
                    SelectedCurrencyPriceDetails = await this.flightDbService.formatPriceDetailToSelectedCurrency(searchData.Currency, PriceInfo);
                } else {
                    SelectedCurrencyPriceDetails = PriceInfo;
                }
            }
            FlightInfo["FlightDetails"] = previousData[0]['FlightList'][0]['FlightDetails'];
            FlightInfo["Price"] = PriceInfo;
            FlightInfo["Exchange_Price"] = SelectedCurrencyPriceDetails;
            previousData[0]['FlightList'][0]['Price'] = PriceInfo;
            previousData[0]['FlightList'][0]['Exchange_Price'] = SelectedCurrencyPriceDetails;
            tmx_resultToken.push(apiResponse[0]['UpdateFareQuote']['FareQuoteDetails']['JourneyList']['ResultToken']);

        }

        FlightInfo["Attr"] = previousData[0]['FlightList'][0]['Attr'];

        const CabinClass = getPropValue(previousData[0]["SearchData"]["Segments"][0], 'CabinClass') || getPropValue(previousData[0]["SearchData"]["Segments"][0], 'CabinClassOnward');
        FlightInfo["JourneyType"] = previousData[0]["SearchData"]["JourneyType"];
        FlightInfo["CabinClass"] = CabinClass;

        FlightInfo["HoldTicket"] = apiResponse[0]['UpdateFareQuote']['FareQuoteDetails']['JourneyList']['HoldTicket'];

        const FlightParameters = {
            FlightInfo: FlightInfo, Tmx_ResultToken: tmx_resultToken, SearchData: previousData[0]["SearchData"], FlightData: previousData[0]['FlightList']
        };


        // advanceTax = (ADVANCE_TAX_PERCENT * parseFloat(FlightInfo["Price"]['TotalDisplayFare'])).toFixed(2);
        // FlightInfo["Price"].TotalDisplayFare = Number((parseFloat(advanceTax) + parseFloat(FlightInfo["Price"]['TotalDisplayFare'])).toFixed(2))
        // if (FlightInfo["Price"].AgentNetFare) {
        //     FlightInfo["Price"].AgentNetFare = Number((parseFloat(advanceTax) + parseFloat(FlightInfo["Price"].AgentNetFare)).toFixed(2))

        // advanceTax = parseFloat(advanceTax);
        // FlightInfo["Price"]['PriceBreakup'].AdvanceTax = Number(parseFloat(advanceTax).toFixed(2));


        const token = this.redisServerService.geneateResultToken(searchData);


        const ResultToken = await this.redisServerService.insert_record(
            token,
            JSON.stringify(FlightParameters)
        );

        FlightInfo["ResultToken"] = ResultToken["access_key"];
        FlightInfo["booking_source"] = TMX_FLIGHT_BOOKING_SOURCE;
        return { UpdateFareQuote: { FareQuoteDetails: { JourneyList: FlightInfo } } };
    }

    async reservationRequest(flightData: any, body: any, index: any) {

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
              }
          }
          `, "flightBookings"
        );

        const flightBookingTransactionPassengers = await this.getGraphData(
            `query {flightBookingTransactionPassengers(where:{
                  app_reference:{eq:"${body["AppReference"]}"}
                }){
                      app_reference
                      first_name
                      middle_name
                      last_name
                      title
                      gender
                      date_of_birth
                      passenger_type
                      passenger_nationality
                      passport_number
                      passport_issuing_country
                      passport_expiry_date
                      
          }}`,
            "flightBookingTransactionPassengers"
        );
        const reservationRequest = {};
        reservationRequest['AppReference'] = body["AppReference"];
        reservationRequest['SequenceNumber'] = index;
        reservationRequest['ResultToken'] = flightData['Tmx_ResultToken'];

        let PersonName: any = [];
        for (let p = 0; p < flightBookingTransactionPassengers.length; p++) {

            let pax_type: any;
            if (flightBookingTransactionPassengers[p]['passenger_type'] == "Adult") {
                pax_type = 1;
            } else if (flightBookingTransactionPassengers[p]['passenger_type'] == "Child") {
                pax_type = 2;
            } else {
                pax_type = 3;
            }
            let gender: any;
            if (flightBookingTransactionPassengers[p]['gender'] == "Male") {
                gender = 1;
            } else {
                gender = 2;
            }
            const query = `SELECT * FROM core_countries cc where cc.code="${flightBookingTransactionPassengers[p]['passenger_nationality']}"`;
            let country = await this.manager.query(query);
            let tow_country_code = JSON.parse(JSON.stringify(country));

            let PersonDetails = {
                IsLeadPax: 1,
                Title: flightBookingTransactionPassengers[p]['title'],
                PaxType: pax_type,
                FirstName: flightBookingTransactionPassengers[p]['first_name'].toUpperCase(),
                LastName: flightBookingTransactionPassengers[p]['last_name'].toUpperCase(),
                Gender: gender,
                DateOfBirth: flightBookingTransactionPassengers[p]['date_of_birth'],
                CountryCode: tow_country_code[0]['two_code'] ? tow_country_code[0]['two_code'] : flightBookingTransactionPassengers[p]['passenger_nationality'],
                CountryName: tow_country_code[0]['two_code'] ? tow_country_code[0]['two_code'] : flightBookingTransactionPassengers[p]['passenger_nationality'],
                ContactNo: '880' + flightBookings[0]['phone'],
                City: 'Dhaka',
                PinCode: '1215',
                AddressLine1: 'House 130 Road 11/B Gulshan1',
                Email: flightBookings[0]['email']
            };

            PersonName.push(PersonDetails);
        }

        reservationRequest['Passengers'] = PersonName;
        return reservationRequest;
    }

    async formatCommitBooking(apiResponse: any, searchData: any, commitBookingDataParsed: any): Promise<any> {
        commitBookingDataParsed = JSON.parse(commitBookingDataParsed[0]['BookingTravelerRefObj']);

        const graphQuery = `{
            flightBookingTransactionPassengers(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
              PassengerId:id
              PassengerType:passenger_type
              Title:title
              FirstName:first_name
              MiddleName:middle_name
              LastName:last_name
              PassportNumber:passport_number
              TicketNumber:ticket_no
              RoundtripTicketNumber:round_trip_ticket_no
            }
          }`;
        const PassengerDetails = await this.getGraphData(
            graphQuery,
            "flightBookingTransactionPassengers"
        );

        const graphQuery2 = `{
                flightBookings(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
            email
            phone
            phone_code
            }
          }`;
        const Passenger = await this.getGraphData(
            graphQuery2,
            "flightBookings"
        );
        if (PassengerDetails.length) {
            for (let i = 0; i < PassengerDetails.length; i++) {
                PassengerDetails[i]['Email'] = Passenger[0]['email'];
            }
        }

        if (apiResponse[0]['Status'] != undefined && apiResponse[0]['Status'] == 1) {

            const PnrInformation = apiResponse[0]['CommitBooking']['BookingDetails'];
            let roundtrip_gds_pnr = '';
            let roundtrip_pnr = '';
            if (apiResponse[1]) {
                if (apiResponse[1]['CommitBooking']['BookingDetails']) {
                    const RoundtripPnrInformation = apiResponse[1]['CommitBooking']['BookingDetails'];
                    roundtrip_gds_pnr = RoundtripPnrInformation["GDSPNR"];
                    roundtrip_pnr = RoundtripPnrInformation["PNR"];
                    if (roundtrip_gds_pnr == null) {
                        roundtrip_gds_pnr = roundtrip_pnr;
                    }
                    const query33 = `UPDATE flight_booking_transaction_itineraries SET 
                    booking_status = "BOOKING_CONFIRMED" ,
                    airline_pnr = "${roundtrip_pnr}"
                    WHERE segment_indicator="1" and app_reference = "${searchData["AppReference"]}"`;
                    await this.manager.query(query33);
                    const query44 = `UPDATE flight_booking_transactions SET 
                    getbooking_StatusCode = "${roundtrip_gds_pnr}"
                    WHERE app_reference = "${searchData["AppReference"]}"`;
                    await this.manager.query(query44);
                    let roundtrip_ticker_res = RoundtripPnrInformation['PassengerDetails'];
                    for (let ii = 0; ii < roundtrip_ticker_res.length; ii++) {
                        const query11 = `UPDATE flight_booking_transaction_passengers SET 
                        booking_status = "BOOKING_CONFIRMED" ,
                        round_trip_ticket_no = "${roundtrip_ticker_res[ii]['TicketNumber']}" 
                        WHERE first_name="${roundtrip_ticker_res[ii]['FirstName']}" 
                        and last_name="${roundtrip_ticker_res[ii]['LastName']}" 
                        and app_reference = "${searchData["AppReference"]}"`;
                        await this.manager.query(query11);
                    }
                }
            }
            const TicketTimeLimit = '';

            let pnr = PnrInformation["PNR"];
            const airline_pnr = PnrInformation["PNR"];
            let gds_pnr = PnrInformation["GDSPNR"];

            if (gds_pnr == null) {
                gds_pnr = pnr;
            }

            const BookingId = PnrInformation["BookingId"];
            const booking_status = "BOOKING_CONFIRMED";

            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_CONFIRMED" ,
			AirReservationLocatorCode = "${pnr}" ,
			UniversalRecordLocatorCode = "${BookingId}" ,
            LastDateToTicket = "${TicketTimeLimit}"
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_CONFIRMED" ,
			pnr = "${pnr}",
			gds_pnr = "${gds_pnr}" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_CONFIRMED" ,
			airline_pnr = "${airline_pnr}"
			WHERE segment_indicator="0" and app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);
            let ticker_res = apiResponse[0]['CommitBooking']['BookingDetails']['PassengerDetails'];
            for (let i = 0; i < ticker_res.length; i++) {
                const query1 = `UPDATE flight_booking_transaction_passengers SET 
              booking_status = "BOOKING_CONFIRMED" ,
              ticket_no = "${ticker_res[i]['TicketNumber']}" 
              WHERE first_name="${ticker_res[i]['FirstName']}" 
              and last_name="${ticker_res[i]['LastName']}" 
              and app_reference = "${searchData["AppReference"]}"`;
                await this.manager.query(query1);
            }
            const PassengerDetails = await this.getGraphData(
                graphQuery,
                "flightBookingTransactionPassengers"
            );
            if (PassengerDetails.length) {
                for (let i = 0; i < PassengerDetails.length; i++) {
                    PassengerDetails[i]['Email'] = Passenger[0]['email'];
                }
            }

            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_CONFIRMED",
                        BookingAppReference: searchData["AppReference"],
                        BookingId: BookingId,
                        PNR: pnr,
                        GDSPNR: gds_pnr,
                        RoundtripPNR: roundtrip_pnr,
                        RoundtripGDSPNR: roundtrip_gds_pnr,
                        LastDateToTicket: TicketTimeLimit,
                        AirReservationLocatorCode: pnr,
                        UniversalRecordLocatorCode: pnr,
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code

                        },
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: commitBookingDataParsed['FlightInfo']['FlightDetails'],
                        },
                        Price: commitBookingDataParsed['FlightInfo']['Price'],
                        Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: TMX_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
        } else {
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBooking",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransaction",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransactionItinerary",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransactionPassenger",
                { booking_status: "BOOKING_FAILED" }
            );
            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_FAILED",
                        BookingAppReference: searchData["AppReference"],
                        BookingId: searchData["AppReference"],
                        PNR: '',
                        GDSPNR: '',
                        AirReservationLocatorCode: '',
                        UniversalRecordLocatorCode: '',
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code

                        },
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: commitBookingDataParsed['FlightInfo']['FlightDetails'],
                        },
                        Price: commitBookingDataParsed['FlightInfo']['Price'],
                        Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: TMX_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
        }
    }
    async formatReservation(apiResponse: any, searchData: any, commitBookingDataParsed: any): Promise<any> {
        const graphQuery = `{
            flightBookingTransactionPassengers(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
              PassengerId:id
              PassengerType:passenger_type
              Title:title
              FirstName:first_name
              MiddleName:middle_name
              LastName:last_name
              PassportNumber:passport_number
              # TicketNumber:""
            }
          }`;
        const PassengerDetails = await this.getGraphData(
            graphQuery,
            "flightBookingTransactionPassengers"
        );

        const graphQuery2 = `{
                flightBookings(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
            email
            phone
            phone_code
            }
          }`;
        const Passenger = await this.getGraphData(
            graphQuery2,
            "flightBookings"
        );
        if (PassengerDetails.length) {
            for (let i = 0; i < PassengerDetails.length; i++) {
                PassengerDetails[i]['Email'] = Passenger[0]['email'];
            }
        }

        if (apiResponse[0]['Status'] != undefined && apiResponse[0]['Status'] == 2) {

            let roundtrip_gds_pnr = '';
            let roundtrip_pnr = '';
            if (apiResponse[1]) {
                if (apiResponse[1]['HoldTicket']['BookingDetails']) {
                    const RoundtripPnrInformation = apiResponse[1]['HoldTicket']['BookingDetails'];
                    roundtrip_gds_pnr = RoundtripPnrInformation["PNR"];
                    roundtrip_pnr = RoundtripPnrInformation["PNR"];
                    if (roundtrip_gds_pnr == null) {
                        roundtrip_gds_pnr = roundtrip_pnr;
                    }
                    const query33 = `UPDATE flight_booking_transaction_itineraries SET 
                    booking_status = "BOOKING_CONFIRMED" ,
                    airline_pnr = "${roundtrip_pnr}"
                    WHERE segment_indicator="1" and app_reference = "${searchData["AppReference"]}"`;
                    await this.manager.query(query33);
                    const query44 = `UPDATE flight_booking_transactions SET 
                    getbooking_StatusCode = "${roundtrip_gds_pnr}"
                    WHERE app_reference = "${searchData["AppReference"]}"`;
                    await this.manager.query(query44);
                }
            }
            const PnrInformation = apiResponse[0]['HoldTicket']['BookingDetails'];

            const TicketTimeLimit = '';

            const pnr = PnrInformation["PNR"];
            const airline_pnr = PnrInformation["PNR"];
            const gds_pnr = PnrInformation["PNR"];
            const BookingId = PnrInformation["BookingId"];
            const booking_status = "BOOKING_HOLD";

            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_HOLD" ,
			AirReservationLocatorCode = "${pnr}" ,
			UniversalRecordLocatorCode = "${BookingId}" ,
            LastDateToTicket = "${TicketTimeLimit}"
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_HOLD" ,
			pnr = "${pnr}",
			gds_pnr = "${gds_pnr}" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_HOLD" ,
			airline_pnr = "${airline_pnr}"
			WHERE segment_indicator="0" and app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);
            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_HOLD",
                        BookingAppReference: searchData["AppReference"],
                        BookingId: BookingId,
                        PNR: pnr,
                        GDSPNR: gds_pnr,
                        RoundtripPNR: roundtrip_pnr,
                        RoundtripGDSPNR: roundtrip_gds_pnr,
                        LastDateToTicket: TicketTimeLimit,
                        AirReservationLocatorCode: pnr,
                        UniversalRecordLocatorCode: pnr,
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code

                        },
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: commitBookingDataParsed['FlightInfo']['FlightDetails'],
                        },
                        Price: commitBookingDataParsed['FlightInfo']['Price'],
                        Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: TMX_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
        } else {
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBooking",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransaction",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransactionItinerary",
                { booking_status: "BOOKING_FAILED" }
            );
            await this.updateGraphDataByField(
                { app_reference: searchData["AppReference"] },
                "FlightBookingTransactionPassenger",
                { booking_status: "BOOKING_FAILED" }
            );
            return {
                FinalBooking: {
                    BookingDetails: {
                        BookingStatus: "BOOKING_FAILED",
                        BookingAppReference: searchData["AppReference"],
                        BookingId: searchData["AppReference"],
                        PNR: '',
                        GDSPNR: '',
                        AirReservationLocatorCode: '',
                        UniversalRecordLocatorCode: '',
                        PassengerContactDetails: {
                            Email: Passenger[0].email,
                            Phone: Passenger[0].phone,
                            PhoneExtension: Passenger[0].phone_code

                        },
                        PassengerDetails,
                        JourneyList: {
                            FlightDetails: commitBookingDataParsed['FlightInfo']['FlightDetails'],
                        },
                        Price: commitBookingDataParsed['FlightInfo']['Price'],
                        Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                        booking_source: TMX_FLIGHT_BOOKING_SOURCE
                    },
                },
            };
        }
    }


    async pnrRetrieveResponse(result: any, searchData: any, flightBookings: any): Promise<any> {
        let commitBookingDataParsed = JSON.parse(flightBookings[0]['BookingTravelerRefObj']);


        const graphQuery = `{
                    flightBookingTransactionPassengers(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
                    PassengerId:id
                    PassengerType:passenger_type
                    Title:title
                    FirstName:first_name
                    MiddleName:middle_name
                    LastName:last_name
                    PassportNumber:passport_number
                    TicketNumber:ticket_no
                    }
                }`;

        const transactionDetails = await this.getGraphData(`{
                    flightBookingTransactions( where:{
                    app_reference:{
                        eq:"${searchData["AppReference"]}"
                    }
                    }){
                    attributes
                    }
                }`, `flightBookingTransactions`)
        let transactionDetailsParsed = JSON.parse(transactionDetails[0].attributes.replace(/'/g, '"'))

        const PassengerDetails = await this.getGraphData(
            graphQuery,
            "flightBookingTransactionPassengers"
        );

        const graphQuery2 = `{
                    flightBookings(where:{app_reference:{eq:"${searchData["AppReference"]}"}}){
                email
                phone
                phone_code
                cabin_class
                }
            }`;
        const Passenger = await this.getGraphData(
            graphQuery2,
            "flightBookings"
        );
        if (PassengerDetails.length) {
            for (let i = 0; i < PassengerDetails.length; i++) {
                PassengerDetails[i]['Email'] = Passenger[0]['email'];
            }
        }
        let booking_status = "";
        if (result["Status"] == 1) {
            booking_status = "BOOKING_CONFIRMED";
            const query1 = `UPDATE flight_bookings SET 
            booking_status = "BOOKING_CONFIRMED" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_CONFIRMED" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_CONFIRMED" 
			WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);
        } else {
            booking_status = "BOOKING_FAILED";
        }
        return {
            FinalBooking: {
                BookingDetails: {
                    BookingStatus: booking_status,
                    BookingAppReference: searchData["AppReference"],
                    BookingId: searchData["AppReference"],
                    PNR: '',
                    GDSPNR: '',
                    LastDateToTicket: '',
                    AirReservationLocatorCode: '',
                    UniversalRecordLocatorCode: '',
                    PassengerContactDetails: {
                        Email: Passenger[0].email,
                        Phone: Passenger[0].phone,
                        PhoneExtension: Passenger[0].phone_code

                    },
                    PassengerDetails,
                    JourneyList: {
                        FlightDetails: commitBookingDataParsed['FlightInfo']['FlightDetails'],
                    },
                    Price: commitBookingDataParsed['FlightInfo']['Price'],
                    Attr: commitBookingDataParsed['FlightInfo']['Attr'],
                    booking_source: TMX_FLIGHT_BOOKING_SOURCE
                }
            },
            TicketParam: {
            }
        };

    }

    async formatGetBookingDetails(result: any, searchData: any, flightBookings: any): Promise<any> {

        if (result['Status'] == 1) {
            const BoookingTransaction = result['BookingDetails']['BoookingTransaction'][0];
            const BookingItineraryDetails = result['BookingDetails']['BookingItineraryDetails'];
            const query1 = `UPDATE flight_bookings SET 
                booking_status = "BOOKING_CONFIRMED" ,
                AirReservationLocatorCode = "${BoookingTransaction['PNR']}" ,
                UniversalRecordLocatorCode = "${BoookingTransaction['BookingID']}" 
                WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE flight_booking_transactions SET 
            booking_status = "BOOKING_CONFIRMED" ,
            pnr = "${BoookingTransaction['PNR']}",
            gds_pnr = "${BoookingTransaction['PNR']}" 
            WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query2);
            const query3 = `UPDATE flight_booking_transaction_itineraries SET 
            booking_status = "BOOKING_CONFIRMED" ,
            airline_pnr = "${BookingItineraryDetails[0]['AirlinePNR']}"
            WHERE app_reference = "${searchData["AppReference"]}"`;
            await this.manager.query(query3);
            let ticker_res = BoookingTransaction['BookingCustomer'];
            for (let i = 0; i < ticker_res.length; i++) {
                const query1 = `UPDATE flight_booking_transaction_passengers SET 
                booking_status = "BOOKING_CONFIRMED" ,
                ticket_no = "${ticker_res[i]['TicketNumber']}" 
                WHERE first_name="${ticker_res[i]['first_name']}" 
                and last_name="${ticker_res[i]['last_name']}" 
                and app_reference = "${searchData["AppReference"]}"`;
                await this.manager.query(query1);
            }

            if (result['BookingDetails']['BoookingTransaction'][1]) {
                const RoundtripPnrInformation = result['BookingDetails']['BoookingTransaction'][1];

                const query33 = `UPDATE flight_booking_transaction_itineraries SET 
                    booking_status = "BOOKING_CONFIRMED" ,
                    airline_pnr = "${BookingItineraryDetails[(BookingItineraryDetails.length - 1)]['AirlinePNR']}"
                    WHERE segment_indicator="1" and app_reference = "${searchData["AppReference"]}"`;
                await this.manager.query(query33);
                const query44 = `UPDATE flight_booking_transactions SET 
                    getbooking_StatusCode = "${RoundtripPnrInformation['PNR']}"
                    WHERE app_reference = "${searchData["AppReference"]}"`;
                await this.manager.query(query44);
                let roundtrip_ticker_res = RoundtripPnrInformation['BookingCustomer'];
                for (let ii = 0; ii < roundtrip_ticker_res.length; ii++) {
                    const query11 = `UPDATE flight_booking_transaction_passengers SET 
                        round_trip_ticket_no = "${roundtrip_ticker_res[ii]['TicketNumber']}" 
                        WHERE first_name="${roundtrip_ticker_res[ii]['FirstName']}" 
                        and last_name="${roundtrip_ticker_res[ii]['LastName']}" 
                        and app_reference = "${searchData["AppReference"]}"`;
                    await this.manager.query(query11);
                }
            }
        }
    }

}