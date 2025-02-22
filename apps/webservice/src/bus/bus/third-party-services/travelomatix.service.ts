import { Body, HttpService, Injectable } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import * as moment from "moment";
import { BusDbService } from "../bus-db.service";
import { BusApi } from "../../bus.api";
import { UserName, Password, DomainKey, System, BusUrl, logStoragePath } from "apps/webservice/src/constants";
import { getDuration } from "apps/webservice/src/app.helper";
import { FlightApi } from "apps/webservice/src/flight/flight.api";

@Injectable()
export class TravelomatixService extends FlightApi {

    constructor(
        private httpService: HttpService,
        private busDbService: BusDbService,
        private redisServerService: RedisServerService
    ) {
        super();
    }

    async getCityList(body: any): Promise<any> {
        try {
            let cityName = body.city_name;
            let query = `SELECT name as cityName,station_id as cityId FROM bus_stations_new_tbo WHERE name LIKE '${cityName}%'`;

            const result = await this.manager.query(query);
            for (const obj of result) {
                obj.Source = "db";
                obj.booking_source = body.booking_source;
            }
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getsearch(body: any): Promise<any> {
        try {
            const Url = `${BusUrl}Search`;
            let busList: any = await this.httpService.post(Url, {
                fromCityId: body.FromCityId,
                toCityId: body.ToCityId,
                journeyDate: body.JourneyDate
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'x-username': UserName,
                    'x-password': Password,
                    'x-domainkey': DomainKey,
                    'x-system': System
                }

            }).toPromise();
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/busListRequest.json`, JSON.stringify(body));
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/busListResponse.json`, JSON.stringify(busList));
            if (busList.Status == 1) {
                const token = this.redisServerService.geneateResultToken(body);
                const resultData = Promise.all(
                    busList.Search.map(async (x: { [x: string]: any; }) => {
                        let waitingTime = getDuration(x.DepartureTime, x.ArrivalTime)
                        let duration = this.convertToHoursMins(waitingTime)
                        let dataFormat = {
                            ...x,
                            duration,
                            "fromCityId": body.FromCityId,
                            "toCityId": body.ToCityId,
                            "journeyDate": body.JourneyDate
                        }
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(dataFormat));
                        delete x["ResultToken"];
                        return {
                            ResultIndex: response["access_key"],
                            ...x,
                            duration
                        }
                    })
                )
                if ((await resultData).length > 0) {
                    return resultData;
                }
                else {
                    return [];
                }
            }
            else {

                const errorClass: any = getExceptionClassByCode(`404 ${busList.Message}`);
                throw new errorClass(`404 ${busList.Message}`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }


    async getseatLayout(body: any): Promise<any> {
        try {
            let searchData = await this.redisServerService.read_list(body.ResultToken)
            searchData = JSON.parse(searchData);
            const Url = `${BusUrl}SeatLayout`;
            let seatLayout: any = await this.httpService.post(Url, {
                RouteScheduleId: searchData.RouteScheduleId,
                JourneyDate: searchData.journeyDate,
                ChartCode: searchData.RouteCode,
                ResultToken: searchData.ResultToken
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en',
                    'x-username': UserName,
                    'x-password': Password,
                    'x-domainkey': DomainKey,
                    'x-system': System
                }
            }).toPromise();

            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/seatLayoutRequest.json`, JSON.stringify(body));
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/seatLayoutResponse.json`, JSON.stringify(seatLayout));

            if (seatLayout.Status == 1) {
                const token = this.redisServerService.geneateResultToken(body);
                const response = await this.redisServerService.insert_record(token, JSON.stringify(seatLayout.SeatLayout.result));


                seatLayout.SeatLayout.result["resultIndex"] = response["access_key"];
                const seatDetails = seatLayout.SeatLayout.result.layout.SeatDetails;

                let newSeatDetails = [];
                // Loop through pairs of arrays
                for (let i = 0; i < seatDetails.length; i += 2) {
                    const pairOfArrays = seatDetails.slice(i, i + 2);

                    // Convert RowNo and ColumnNo to strings
                    pairOfArrays.forEach((seatRow: any[]) => {
                        seatRow.forEach((seatObj: { RowNo: string; ColumnNo: string; }) => {
                            seatObj.RowNo = parseInt(seatObj.RowNo).toString();
                            seatObj.ColumnNo = parseInt(seatObj.ColumnNo).toString();
                        });
                    });

                    let numRows = Math.max(...pairOfArrays.map((row: string | any[]) => parseInt(row[row.length - 1].RowNo))) + 1;
                    let numCols = Math.max(...pairOfArrays.map((row: string | any[]) => parseInt(row[row.length - 1].ColumnNo))) + 1;

                    let seatMap = {};
                    pairOfArrays.forEach((seatRow: any[]) => {
                        seatRow.forEach((seatObj: { RowNo: any; ColumnNo: any; }) => {
                            seatMap[`${seatObj.RowNo}-${seatObj.ColumnNo}`] = seatObj;
                        });
                    });

                    for (let i = 0; i < numRows; i++) {
                        let newRow = [];
                        for (let j = 0; j < numCols; j++) {
                            let seat = seatMap[`${i}-${j}`];
                            if (seat) {
                                var upper = seat.IsUpper;
                                var height = seat.Height;
                                var width = seat.Width;
                                seat.IsSpace = true;
                                newRow.push(seat);
                            } else {
                                newRow.push({
                                    ColumnNo: j.toString(),
                                    RowNo: i.toString(),
                                    IsSpace: false,
                                    IsUpper: upper,
                                    Height: height,
                                    Width: width,
                                    SeatStatus: false,
                                });
                            }
                        }
                        newSeatDetails.push(newRow);
                    }
                }

                // Add ResultIndex to each seat object in newSeatDetails array
                const seatDetailsWithResultIndex = newSeatDetails.map((seatArray: any[]) => {
                    return seatArray.map(async seat => {
                        const token = this.redisServerService.geneateResultToken(body);
                        const response = await this.redisServerService.insert_record(token, JSON.stringify({ ...seat, ResultToken: seatLayout.SeatLayout.result["ResultToken"] }));
                        return {
                            ...seat,
                            ResultIndex: response["access_key"]
                        };
                    });
                });

                // Wait for all promises to resolve
                const resolvedSeatDetails = await Promise.all(seatDetailsWithResultIndex.map(async (seatArray: any) => {
                    return Promise.all(seatArray);
                }));
                delete seatLayout.SeatLayout.result["ResultToken"];
                let seatLayoutFormat = {
                    ...seatLayout.SeatLayout.result,
                    layout: {
                        SeatDetails: resolvedSeatDetails
                    }
                };
                if (seatLayoutFormat) {
                    return seatLayoutFormat;
                } else {
                    return [];
                }
            }
            else {

                const errorClass: any = getExceptionClassByCode(`404`);
                throw new errorClass(`404`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async getseatBusInfo(body: any): Promise<any> {
        try {
            // Fetch busData and seatsData in parallel
            const [busData, ...seatsData] = await Promise.all([
                this.redisServerService.read_list(body.BusResultToken)
                    .then(JSON.parse),
                ...body.SeatsResultToken.map(async (seatToken: any) => {
                    const seatData = await this.redisServerService.read_list(seatToken);
                    return JSON.parse(seatData);
                })
            ]);
            // Calculate sum and count of PublishedPriceRoundedOff using reduce
            const { sum, count } = seatsData.reduce<{ sum: number, count: number }>((acc, seat: any) => {
                acc.sum += seat.Price.PublishedPriceRoundedOff;
                acc.count++;
                return acc;
            }, { sum: 0, count: 0 });

            const pickup = busData.Pickups.find((p: any) => p.PickupCode === Number(body.PickUpID));
            const dropoff = busData.Dropoffs.find((d: any) => d.PickupCode === Number(body.DropOffID));

            const resultData = { busData, seatsData, sum, count, pickup, dropoff };
            const token = this.redisServerService.geneateResultToken(body);
            const response = await this.redisServerService.insert_record(token, JSON.stringify(resultData));
            delete busData.ResultToken;
            const seatsDataWithoutToken = seatsData.map(({ ResultToken, ...rest }) => rest);
            const finalResultData = { ResultIndex: response["access_key"], BusData: busData, SeatsData: seatsDataWithoutToken, Totalfare: sum, SeatCount: count, PickUp: pickup, DropOff: dropoff };
            return finalResultData;

        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async getAddPaxDetails(body: any): Promise<any> {
        try {
            console.log(`11111111111111111111122`);
            
            const appRefInDB = await this.getGraphData(
                `query {
                    busBusBookingPaxDetails (
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
                "busBusBookingPaxDetails"
            );
            if (appRefInDB.length > 0) {
                const errorClass: any = getExceptionClassByCode(
                    "409 Duplicate entry for AppReference"
                );
                throw new errorClass("409 Duplicate entry for AppReference");
            } else {
                const busData = JSON.parse(await this.redisServerService.read_list(body.ResultToken));
                busData["ResultToken"] = body.ResultToken;
                const formatPaxDetails = await this.busDbService.formatPaxDetails(body, busData);
                const bookingDetailsResp = await this.busDbService.addBusBookingDetails(
                    body, busData
                );
                const bookingItineraryResp = await this.busDbService.addBusBookingItineraryDetails(
                    body, busData
                );
                const bookingPaxDetailsResp = await this.busDbService.addBusBookingCustomerDetails(formatPaxDetails, busData);
                const result = await this.busDbService.getBusBookingPaxDetailsUniversal(body, bookingDetailsResp, bookingItineraryResp, bookingPaxDetailsResp)
                return result;
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }


    async getholdSeats(body: any): Promise<any> {
        try {
            let bookingDetails = await this.busDbService.getBusBookingDetails(body);
            let paxDetails = await this.busDbService.getBusBookingPaxDetails(body);
            let busDetails = await this.busDbService.getBusBookingItineraryDetails(body);
            let formattedRequest = await this.busDbService.formatHoldeSeatsRequest(bookingDetails, paxDetails, busDetails, body);
            const Url = `${BusUrl}HoldSeatsForSchedule`;
            let holdSeats: any = await this.httpService.post(Url, formattedRequest,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': UserName,
                        'x-password': Password,
                        'x-domainkey': DomainKey,
                        'x-system': System
                    }
                }).toPromise();
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/${body["AppReference"]}-holdSeatsRequest.json`, JSON.stringify(formattedRequest));
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/${body["AppReference"]}-holdSeatsResponse.json`, JSON.stringify(holdSeats));
            if (holdSeats.Status == 1) {
                let updatedPaxDetails = await this.busDbService.updateBusBookingCustomerDetails(holdSeats, paxDetails);
                delete holdSeats.HoldSeatsForSchedule.HoldKey
                delete holdSeats.HoldSeatsForSchedule.ResultToken
                busDetails[0].departure_datetime = await this.busDbService.convertTimestampToISOString(busDetails[0].departure_datetime)
                busDetails[0].arrival_datetime = await this.busDbService.convertTimestampToISOString(busDetails[0].arrival_datetime)
                paxDetails.forEach((paxDetail: any) => {
                    delete paxDetail.attr;
                })
                delete busDetails[0].attributes;
                const result = await this.busDbService.getBusBookingPaxDetailsUniversal(body, bookingDetails, busDetails, paxDetails,)
                return result;
            }
            else {
                throw new Error(`400 ${holdSeats.Message}`)
            }


        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async getBookSeats(body: any): Promise<any> {
        try {
            let bookingDetails = await this.busDbService.getBusBookingDetails(body);
            let paxDetails = await this.busDbService.getBusBookingPaxDetails(body);
            let busDetails = await this.busDbService.getBusBookingItineraryDetails(body);
            let formattedRequest = await this.busDbService.formatBookSeatsRequest(bookingDetails, paxDetails, busDetails, body);

            const Url = `${BusUrl}BookSeats`;
            let bookSeats: any = await this.httpService.post(Url, formattedRequest,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'en',
                        'x-username': UserName,
                        'x-password': Password,
                        'x-domainkey': DomainKey,
                        'x-system': System
                    }
                }).toPromise();
            const fs = require('fs');
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/${body["AppReference"]}-bookSeatsRequest.json`, JSON.stringify(formattedRequest));
            fs.writeFileSync(`${logStoragePath}/bus/airwintravel/${body["AppReference"]}-bookSeatsResponse.json`, JSON.stringify(bookSeats));
            if (bookSeats.Status == 1) {
                let confirmBookingDetails = await this.busDbService.confirmBusBusBookingDetails(bookSeats, bookingDetails);
                let confirmBookingCustomerDetails = await this.busDbService.confirmBusBookingCustomerDetails(bookSeats, paxDetails);
                let bookingDetail = await this.busDbService.getBusBookingDetails(body);
                let paxDetail = await this.busDbService.getBusBookingPaxDetails(body);
                let busDetail = await this.busDbService.getBusBookingItineraryDetails(body);
                busDetail[0].departure_datetime = await this.busDbService.convertTimestampToISOString(busDetails[0].departure_datetime)
                busDetail[0].arrival_datetime = await this.busDbService.convertTimestampToISOString(busDetails[0].arrival_datetime)
                paxDetail.forEach((pax: any) => {
                    delete pax.attr;
                })
                delete busDetail[0].attributes;
                const result = await this.busDbService.getBusBookingPaxDetailsUniversal(body, bookingDetail, busDetail, paxDetail)
                return result;
            }
            else {
                throw new Error(`400 ${bookSeats.Message}`)
            }

        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async getVoucher(body: any): Promise<any> {
        try {
            let bookingDetails = await this.busDbService.getBusBookingDetails(body);
            let paxDetails = await this.busDbService.getBusBookingPaxDetails(body);
            paxDetails.forEach((paxDetail: any) => {
                delete paxDetail.attr;
            })
            let busDetails = await this.busDbService.getBusBookingItineraryDetails(body);
            delete busDetails[0].attributes;
            busDetails[0].departure_datetime = await this.busDbService.convertTimestampToISOString(busDetails[0].departure_datetime)
            busDetails[0].arrival_datetime = await this.busDbService.convertTimestampToISOString(busDetails[0].arrival_datetime)
            let waitingTime = getDuration(busDetails[0].departure_datetime, busDetails[0].arrival_datetime)
            busDetails[0].duration = this.convertToHoursMins(waitingTime)
            const result = await this.busDbService.getBusBookingPaxDetailsUniversal(body, bookingDetails, busDetails, paxDetails,)
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
}

