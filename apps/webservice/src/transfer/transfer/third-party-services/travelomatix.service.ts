import { Body, HttpException, HttpService, Injectable } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { HOPPA_B2C_USERNAME, HOPPA_TRANSFER_URL, logStoragePath, TMX_DOMAINKEY, TMX_PASSWORD, TMX_SYSTEM, TMX_USER_NAME } from "../../../constants";
import { TransferApi } from "../../transfer.api";
import { TransferDbService } from "../transfer-db.service";
import { TravelomatixTransformService } from "./travelomatix-transform.service";
import * as moment from "moment";
const fs = require('fs');

@Injectable()
export class TravelomatixService extends TransferApi {
    Url = "http://test.services.travelomatix.com/webservices/transferv1/service/"
    constructor(
        private readonly httpService: HttpService,
        private transferDbService: TransferDbService,
        private travelomatixTransformService: TravelomatixTransformService,
        private redisServerService: RedisServerService) {
        super()
    }

    async Availability(@Body() body: any): Promise<any> {
        try {
            const givenUrl = `${this.Url}Search`;
            const result: any = await this.httpService.post(givenUrl, {
                city_id: body.CityId
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'x-username': TMX_USER_NAME,
                    'x-password': TMX_PASSWORD,
                    'x-domainkey': TMX_DOMAINKEY,
                    'x-system': TMX_SYSTEM
                }
            }).toPromise();
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/transfer/tmx/SearchRQ.json`, JSON.stringify(body));
                fs.writeFileSync(`${logStoragePath}/transfer/tmx/SearchRS.json`, JSON.stringify(result));
            }

            if (result.Status == 1) {
                const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(body);
                let currencyDetails: any = [];
                if (body.Currency != "USD") {
                    currencyDetails = await this.getGraphData(`query {
                                                                        cmsCurrencyConversions(where: {
                                                                            currency: {
                                                                                eq:"${body.Currency}"
                                                                            } 
                                                                        }
                                                                        ) {
                                                                            id
                                                                            currency
                                                                            value
                                                                            status
                                                                        }
                                                                    }
                                                                `, "cmsCurrencyConversions");
                }

                for (const transfer of result.Search.TransferSearchResult.TransferResults) {
                    let exchangeRate: any = 1;
                    const token = this.redisServerService.geneateResultToken(body);
                    const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...transfer, body }));
                    let totalFare: any = transfer.Price.TotalDisplayFare;
                    let totalCommission: any = transfer.Price.PriceBreakup.AgentCommission;
                    let tdsOnCommission: any = transfer.Price.PriceBreakup.AgentTdsOnCommision;
                    if (currencyDetails.length > 0) {
                        exchangeRate = Number(currencyDetails[0].value);
                        totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                        // totalCommission = totalCommission* exchangeRate;
                        tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                    }
                    const markupAndCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails));
                    const markupDetails = await this.markupDetails(markupAndCommission, totalFare, exchangeRate);

                    if (body.UserType === "B2B") {
                        transfer.Price.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        let specificCommission = markupAndCommissionDetails.commissionDetails.commission;
                        // transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                        if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                            if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            }
                        }
                        transfer.Price.PriceBreakup.AgentCommission = totalCommission;
                        transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        transfer.Price.Amount = totalFare;
                        transfer.Price.Currency = body.Currency;
                    } else if (body.UserType === "B2C") {
                        transfer.Price.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                        transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                        transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                        transfer.Price.Amount = totalFare;
                        transfer.Price.Currency = body.Currency;
                    }
                    transfer.ResultIndex = redis["access_key"];
                    transfer.BookingSource = body.BookingSource;
                }
                return result.Search.TransferSearchResult.TransferResults;
            } else {
                throw new Error(`400 Response Not Found`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async markupDetails(body: any, totalFare: any, exchangeRate: any = 1): Promise<any> {
        let AdminMarkup = 0;
        let AgentMarkup = 0;
        const markupDetails: any = body.markupDetails;
        if (markupDetails.adminMarkup && markupDetails.adminMarkup.length > 0) {
            markupDetails.adminMarkup.forEach((markup: any) => {
                markup.value = parseFloat((markup.value * exchangeRate).toFixed(2));
                if (markup.value_type === "plus") {
                    AdminMarkup += markup.value;
                } else if (markup.value_type === "percentage") {
                    AdminMarkup += (totalFare * markup.value) / 100
                }
            });
        }

        if (markupDetails.agentMarkup && markupDetails.agentMarkup.length > 0) {
            markupDetails.agentMarkup.forEach((markup: any) => {
                markup.value = parseFloat((markup.value * exchangeRate).toFixed(2));
                if (markup.value_type === "plus") {
                    AgentMarkup += markup.value;
                } else if (markup.value_type === "percentage") {
                    AgentMarkup += (totalFare * markup.value) / 100
                }
            });
        }

        return {
            AdminMarkup,
            AgentMarkup
        }
    }

    async ProductDetails(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data: any = await this.redisServerService.read_list(body.ResultToken)
                let parsedData: any = JSON.parse(data[0]);

                let format = {
                    ProductCode: parsedData.ProductCode,
                    ResultToken: parsedData.ResultToken
                }
                const givenUrl = `${this.Url}ProductDetails`;
                const result: any = await this.httpService.post(givenUrl, format, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': TMX_USER_NAME,
                        'x-password': TMX_PASSWORD,
                        'x-domainkey': TMX_DOMAINKEY,
                        'x-system': TMX_SYSTEM
                    }
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/ProductDetailsRQ.json`, JSON.stringify(format));
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/ProductDetailsRS.json`, JSON.stringify(result));
                }

                if (result.Status == 1) {
                    const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(parsedData.body);
                    let currencyDetails: any = [];
                    if (parsedData.body.Currency != "USD") {
                        currencyDetails = await this.getGraphData(`query {
                                                                            cmsCurrencyConversions(where: {
                                                                                currency: {
                                                                                    eq:"${parsedData.body.Currency}"
                                                                                } 
                                                                            }
                                                                            ) {
                                                                                id
                                                                                currency
                                                                                value
                                                                                status
                                                                            }
                                                                        }
                                                                    `, "cmsCurrencyConversions");
                    }

                    const token = this.redisServerService.geneateResultToken(body);
                    result.ProductDetails.TransferInfoResult.SearchIndex = body.ResultToken;
                    const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...result.ProductDetails.TransferInfoResult, body: parsedData.body }));

                    let exchangeRate: any = 1;
                    let totalFare: any = result.ProductDetails.TransferInfoResult.Price.TotalDisplayFare;
                    let totalCommission: any = result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentCommission;
                    let tdsOnCommission: any = result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentTdsOnCommision;
                    if (currencyDetails.length > 0) {
                        exchangeRate = Number(currencyDetails[0].value);
                        totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                        // totalCommission = totalCommission* exchangeRate;
                        tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                    }

                    const markupDetails = await this.markupDetails(markupAndCommissionDetails, totalFare, exchangeRate);

                    if (parsedData.body.UserType === "B2B") {
                        result.ProductDetails.TransferInfoResult.Price.markupDetails = markupDetails;
                        let specificCommission = markupAndCommissionDetails.commissionDetails.commission;
                        // result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                        if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                            if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            }
                        }
                        result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentCommission = totalCommission;
                        result.ProductDetails.TransferInfoResult.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        result.ProductDetails.TransferInfoResult.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        result.ProductDetails.TransferInfoResult.Price.Amount = totalFare;
                        result.ProductDetails.TransferInfoResult.Price.Currency = parsedData.body.Currency;
                    } else if (parsedData.body.UserType === "B2C") {
                        result.ProductDetails.TransferInfoResult.Price.markupDetails = markupDetails;
                        result.ProductDetails.TransferInfoResult.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                        result.ProductDetails.TransferInfoResult.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                        result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        result.ProductDetails.TransferInfoResult.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                        result.ProductDetails.TransferInfoResult.Price.Amount = totalFare;
                        result.ProductDetails.TransferInfoResult.Price.Currency = parsedData.body.Currency;
                    }
                    result.ProductDetails.TransferInfoResult.ResultIndex = redis["access_key"];
                    result.ProductDetails.TransferInfoResult.BookingSource = body.BookingSource;

                    delete result.ProductDetails.TransferInfoResult.SearchIndex;

                    return result.ProductDetails.TransferInfoResult;
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async TripList(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data: any = await this.redisServerService.read_list(body.ResultToken)
                let parsedData: any = JSON.parse(data[0]);

                let format = {
                    "ProductCode": parsedData.ProductCode,
                    "BookingDate": body.BookingDate,
                    "ResultToken": parsedData.ResultToken,
                    "ageBands": []
                }

                const descriptionToBandIdMap = {};
                parsedData.Product_AgeBands.forEach((ageBand) => {
                    descriptionToBandIdMap[ageBand.description] = ageBand.bandId;
                });

                for (const ageBand of parsedData.Product_AgeBands) {
                    const description = ageBand.description;

                    if (body && body[description + "Count"] > 0) {
                        const bandId = descriptionToBandIdMap[description];
                        format.ageBands.push({ "bandId": bandId, "count": body[description + "Count"] });
                    }
                }
                const givenUrl = `${this.Url}TripList`;
                const result: any = await this.httpService.post(givenUrl, format, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': TMX_USER_NAME,
                        'x-password': TMX_PASSWORD,
                        'x-domainkey': TMX_DOMAINKEY,
                        'x-system': TMX_SYSTEM
                    }
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/TripListRQ.json`, JSON.stringify(format));
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/TripListRS.json`, JSON.stringify(result));
                }

                if (result.Status == 1) {
                    const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(parsedData.body);
                    let currencyDetails: any = [];
                    if (parsedData.body.Currency != "USD") {
                        currencyDetails = await this.getGraphData(`query {
                                                                            cmsCurrencyConversions(where: {
                                                                                currency: {
                                                                                    eq:"${parsedData.body.Currency}"
                                                                                } 
                                                                            }
                                                                            ) {
                                                                                id
                                                                                currency
                                                                                value
                                                                                status
                                                                            }
                                                                        }
                                                                    `, "cmsCurrencyConversions");
                    }
                    for (const transfer of result.TripList.Trip_list) {
                        transfer.BookingQuestions = parsedData.BookingQuestions;
                        transfer.Cancellation_Policy = parsedData.Cancellation_Policy
                        transfer.TermsAndConditions = parsedData.TermsAndConditions
                        transfer.Inclusions = parsedData.Inclusions
                        const token = this.redisServerService.geneateResultToken(body);
                        const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...transfer, body: parsedData.body }));
                        // transfer.Price.TotalDisplayFare = transfer.Price.TotalDisplayFare + markupAndCommission.AdminMarkup + markupAndCommission.AgentMarkup;

                        let exchangeRate: any = 1;
                        let totalFare: any = transfer.Price.TotalDisplayFare;
                        let totalCommission: any = transfer.Price.PriceBreakup.AgentCommission;
                        let tdsOnCommission: any = transfer.Price.PriceBreakup.AgentTdsOnCommision;
                        if (currencyDetails.length > 0) {
                            exchangeRate = Number(currencyDetails[0].value);
                            totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                            // totalCommission = totalCommission* exchangeRate;
                            tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                        }
                        const markupAndCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails));

                        const markupDetails = await this.markupDetails(markupAndCommission, totalFare, exchangeRate);

                        if (parsedData.body.UserType === "B2B") {
                            transfer.Price.markupDetails = markupDetails;
                            let specificCommission = JSON.parse(JSON.stringify(markupAndCommissionDetails.commissionDetails.commission));
                            // transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                                if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                    totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                    totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                                }
                            }
                            transfer.Price.PriceBreakup.AgentCommission = totalCommission;
                            transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                            transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                            transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                            transfer.Price.Amount = totalFare;
                            transfer.Price.Currency = parsedData.body.Currency;
                        } else if (parsedData.body.UserType === "B2C") {
                            transfer.Price.markupDetails = markupDetails;
                            transfer.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                            transfer.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                            transfer.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                            transfer.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                            transfer.Price.Amount = totalFare;
                            transfer.Price.Currency = parsedData.body.Currency;
                        }
                        transfer.ResultIndex = redis["access_key"];
                    }
                    let TransferList: any = {
                        BookingSource: body.BookingSource,
                        TransferList: result.TripList.Trip_list,
                        ProductDetails: result.TripList.ProductDetails
                    }
                    return TransferList;
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Blocktrip(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data: any = await this.redisServerService.read_list(body.ResultToken)
                let parsedData: any = JSON.parse(data[0]);

                let format = {
                    ProductCode: parsedData.productCode,
                    GradeCode: parsedData.gradeCode,
                    BookingDate: parsedData.bookingDate,
                    ResultToken: parsedData.TourUniqueId,
                    ageBands: parsedData.AgeBands
                }
                const givenUrl = `http://test.services.travelomatix.com/webservices/sightseeing/service/BlockTrip`;
                const result: any = await this.httpService.post(givenUrl, format, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': TMX_USER_NAME,
                        'x-password': TMX_PASSWORD,
                        'x-domainkey': TMX_DOMAINKEY,
                        'x-system': TMX_SYSTEM
                    }
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/BlocktripRQ.json`, JSON.stringify(format));
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/BlocktripRS.json`, JSON.stringify(result));
                }

                if (result.Status == 1) {
                    const markupAndCommissionDetails: any = await this.transferDbService.markupAndCommissionDetails(parsedData.body);
                    let currencyDetails: any = [];
                    if (parsedData.body.Currency != "USD") {
                        currencyDetails = await this.getGraphData(`query {
                                                                            cmsCurrencyConversions(where: {
                                                                                currency: {
                                                                                    eq:"${parsedData.body.Currency}"
                                                                                } 
                                                                            }
                                                                            ) {
                                                                                id
                                                                                currency
                                                                                value
                                                                                status
                                                                            }
                                                                        }
                                                                    `, "cmsCurrencyConversions");
                    }

                    result.BlockTrip.BlockTripResult.Cancellation_Policy = parsedData.Cancellation_Policy
                    result.BlockTrip.BlockTripResult.TermsAndConditions = parsedData.TermsAndConditions
                    result.BlockTrip.BlockTripResult.Inclusions = parsedData.Inclusions

                    let exchangeRate: any = 1;
                    let totalFare: any = result.BlockTrip.BlockTripResult.Price.TotalDisplayFare;
                    let totalCommission: any = result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentCommission;
                    let tdsOnCommission: any = result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentTdsOnCommision;
                    if (currencyDetails.length > 0) {
                        exchangeRate = Number(currencyDetails[0].value);
                        totalFare = parseFloat((totalFare * exchangeRate).toFixed(2));
                        // totalCommission = totalCommission* exchangeRate;
                        tdsOnCommission = parseFloat((tdsOnCommission * exchangeRate).toFixed(2));
                    }

                    const markupDetails = await this.markupDetails(markupAndCommissionDetails, totalFare, exchangeRate);

                    if (parsedData.body.UserType === "B2B") {
                        result.BlockTrip.BlockTripResult.Price.markupDetails = markupDetails;
                        let specificCommission = markupAndCommissionDetails.commissionDetails.commission;
                        // result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                        if (Array.isArray(specificCommission) && specificCommission.length > 0) {
                            if (specificCommission[0].value_type === "percentage" && specificCommission[0].value) {
                                totalCommission = Number(((totalCommission * specificCommission[0].value) / 100).toFixed(2));
                                totalCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));
                            }
                        }
                        result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentCommission = totalCommission;
                        result.BlockTrip.BlockTripResult.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup + markupDetails.AgentMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        result.BlockTrip.BlockTripResult.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup + totalCommission - tdsOnCommission).toFixed(2));
                        result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        result.BlockTrip.BlockTripResult.Price.Amount = totalFare;
                        result.BlockTrip.BlockTripResult.Price.Currency = parsedData.body.Currency;
                    } else if (parsedData.body.UserType === "B2C") {
                        result.BlockTrip.BlockTripResult.Price.markupDetails = markupDetails;
                        result.BlockTrip.BlockTripResult.Price.TotalDisplayFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                        result.BlockTrip.BlockTripResult.Price.AgentNetFare = Number((totalFare + markupDetails.AdminMarkup).toFixed(2));
                        result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentTdsOnCommision = tdsOnCommission;
                        result.BlockTrip.BlockTripResult.Price.PriceBreakup.AgentCommission = parseFloat((totalCommission * exchangeRate).toFixed(2));;
                        result.BlockTrip.BlockTripResult.Price.Amount = totalFare;
                        result.BlockTrip.BlockTripResult.Price.Currency = parsedData.body.Currency;
                    }
                    const token = this.redisServerService.geneateResultToken(body);
                    const redis = await this.redisServerService.insert_record(token, JSON.stringify({ ...result.BlockTrip.BlockTripResult, body: parsedData.body, exchangeRate}));
                    result.BlockTrip.BlockTripResult.ResultIndex = redis["access_key"];
                    result.BlockTrip.BlockTripResult.BookingSource = body.BookingSource;

                    return result.BlockTrip.BlockTripResult;
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async AddPax(@Body() body: any): Promise<any> {
        try {
            if (body.ResultToken) {
                let data = await this.redisServerService.read_list(body.ResultToken)
                let parsedData = JSON.parse(data[0]);
                // let convertedResp = resp["response"].replace(/'/g, '"');
                const appRefInDB = await this.getGraphData(
                    `query {
                                        transferBookingDetails (
                                            where: {
                                                app_reference: {
                                                    eq: "${body.AppReference}"
                                                }
                                            }
                                        ) {
                                            app_reference
                                        }
                                    }
                                    `,
                    "transferBookingDetails"
                );
                if (appRefInDB.length > 0) {
                    throw new Error("409 Duplicate entry for AppReference");
                }
                else {
                    const bookingDetails = await this.travelomatixTransformService.addTransferBookingDetails(parsedData, body);

                    const bookingItinerary = await this.travelomatixTransformService.addTransferBookingItineraryDetails(parsedData, body);

                    const paxDetails = await this.travelomatixTransformService.addTransferBookingPaxDetails(parsedData, body);

                    return this.travelomatixTransformService.getTransferBookingPaxDetailsUniversal(body,
                        bookingDetails,
                        bookingItinerary,
                        paxDetails);
                }
            }
            else {
                throw new Error(`400 Result Token is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async ConfirmBooking(@Body() body: any): Promise<any> {
        try {
            if (body.AppReference) {

                const paxDetails = await this.getGraphData(
                    `query {
                            transferBookingPaxDetails (
                                    where: {
                                        app_reference: {
                                            eq: "${body.AppReference}"
                                        }
                                    }
                                ) {
                                    id
                                    app_reference
                                    booking_reference
                                    title
                                    first_name
                                    middle_name
                                    last_name
                                    phone
                                    email
                                    pax_type
                                    age
                                    date_of_birth
                                    status
                                    attributes
                                    adult_count
                                    child_count
                                }
                            }
                            `,
                    "transferBookingPaxDetails"
                );

                const appRefInDB = await this.getGraphData(
                    `query {
                                transferBookingDetails (
                                    where: {
                                        app_reference: {
                                            eq: "${body.AppReference}"
                                        }
                                    }
                                ) {
                                    attributes
                                }
                            }
                            `,
                    "transferBookingDetails"
                );
                if (appRefInDB.length <= 0) {
                    throw new Error("400 No Data Found");
                }
                let parsedData = JSON.parse(appRefInDB[0].attributes.replace(/'/g, '"'));
                let bookingRequest = await this.travelomatixTransformService.bookingRequestFormat(parsedData, paxDetails[0], body);

                const givenUrl = `${this.Url}CommitBooking`;
                const result: any = await this.httpService.post(givenUrl, bookingRequest, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': TMX_USER_NAME,
                        'x-password': TMX_PASSWORD,
                        'x-domainkey': TMX_DOMAINKEY,
                        'x-system': TMX_SYSTEM
                    }
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/${body?.AppReference}-Booking_RQ.json`, JSON.stringify(bookingRequest));
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/${body?.AppReference}-Booking_RS.json`, JSON.stringify(result));
                }

                if (result.Status == 1) {
                    let bookingResponse: any = await this.travelomatixTransformService.bookingResponseFormat(parsedData, paxDetails[0], body, result);
                    bookingResponse.BookingSource = body.BookingSource;
                    return bookingResponse
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 AppReference is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async CancelBooking(@Body() body: any): Promise<any> {
        try {
            if (body.AppReference) {
                const bookingDetails = await this.getGraphData(
                    `query {
                            transferBookingDetails (
                                where: {
                                    app_reference: {
                                        eq: "${body.AppReference}"
                                    }
                                }
                            ) {
                                booking_id
                                booking_reference
                                attributes
                            }
                        }
                        `,
                    "transferBookingDetails"
                );
                let parsedData = JSON.parse(bookingDetails[0].attributes.replace(/'/g, '"'));
                parsedData.booking_id = bookingDetails[0].booking_id;
                parsedData.booking_reference = bookingDetails[0].booking_reference;

                let format: any = {
                    AppReference: body.AppReference,
                    CancelCode: 59,
                    CancelDescription: "remarks"
                }
                const givenUrl = `${this.Url}CancelBooking`;
                const result: any = await this.httpService.post(givenUrl, format, {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': TMX_USER_NAME,
                        'x-password': TMX_PASSWORD,
                        'x-domainkey': TMX_DOMAINKEY,
                        'x-system': TMX_SYSTEM
                    }
                }).toPromise();
                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/${body?.AppReference}-CancelBookingRQ.json`, JSON.stringify(format));
                    fs.writeFileSync(`${logStoragePath}/transfer/tmx/${body?.AppReference}-CancelBookingRS.json`, JSON.stringify(result));
                }
                if (result.Status == 1) {
                    let bookingResponse: any = await this.travelomatixTransformService.CancellationResponseFormat(parsedData, body, result.CancelBooking.CancellationDetails);
                    bookingResponse.BookingSource = body.BookingSource;
                    return bookingResponse
                } else {
                    throw new Error(`400 Response Not Found`)
                }
            }
            else {
                throw new Error(`400 AppReference is Missing`)
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

}

