import { Body, HttpService, Injectable } from "@nestjs/common";
import * as moment from "moment";
import { getExceptionClassByCode } from "../../all-exception.filter";
import { BaseApi } from "../../base.api";
import { RedisServerService } from "../../shared/redis-server.service";
import { TourApi } from "../tour.api";
import { META_SIGHTSEEING_COURSE, TR_SIGHTSEEING_BOOKING_SOURCE, TMX_SIGHTSEEING_BOOKING_SOURCE, SUPPORT_EMAIL } from "../../constants";
import { formatHotelDateTime } from "../../app.helper";
import { MailerService } from "@nestjs-modules/mailer";
import { InjectPdf, PDF } from "nestjs-pdf";

@Injectable()
export class TourDbService extends TourApi {

    constructor(
        private redisServerService: RedisServerService,
        private readonly mailerService: MailerService,
        @InjectPdf() private readonly pdf: PDF,
    ) {
        super()
    }
    async autoComplete(body: any): Promise<any> {
        try {
            let query1 = `SELECT CityName, id as CityId,"BGTAPINO00001,BGTAPINO00002" as  booking_source
            FROM tours_city
            WHERE CityName LIKE '${body.Name}%'
            `;
            // let query2 = `SELECT name as CityName, city_id as CityId,"BGTAPINO00002" as  booking_source  
            // FROM tour_radar_city
            // WHERE name LIKE '${body.Name}%'
            // `;
            const result1 = await this.manager.query(query1);
            // const result2 = await this.manager.query(query2);

            const result = result1;
            // const result = result1;
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async countryList(body: any): Promise<any> {
        try {
            let query = `SELECT name,isocode as code
            FROM tours_country ORDER BY tours_country.name ASC
            `;
            const result = await this.manager.query(query);
            // const result = result1;
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async search(body: any): Promise<any> {
        try {
            let query = `SELECT
                            t.id,
                            t.package_name,
                            t.duration,
                            t.banner_image,
                            t.start_date,
                            t.expire_date,
                            t.package_description,
                            t.status,
                            t.module_type,
                            t.inclusions,
                            t.exclusions,
                            t.optional_tours,
                            t.terms,
                            t.gallery,
                            t.highlights,
                            t.canc_policy,
                            t.trending,
                            tc.name AS tours_country,
                            tcont.name AS tours_continent,
                            GROUP_CONCAT(DISTINCT ts.tour_subtheme) AS theme
                        FROM
                            tours t
                        LEFT JOIN
                            tour_dep_dates td ON t.id = td.tour_id
                        LEFT JOIN
                            tours_country tc ON t.tours_country = tc.id
                        LEFT JOIN
                            tours_continent tcont ON t.tours_continent = tcont.id
                        LEFT JOIN
                            tour_subtheme ts ON FIND_IN_SET(ts.id, t.theme)
                        WHERE
                            t.tours_city LIKE '%${body.CityId}%' AND
                            t.status = 1
                        GROUP BY
                            t.id,t.package_name, t.duration, t.banner_image, t.start_date, t.expire_date, t.package_description, t.status, t.module_type, t.inclusions, t.exclusions, t.optional_tours, t.terms, t.gallery, t.highlights, t.canc_policy, tc.name, tcont.name`;
            const toursData = await this.manager.query(query);
            if (toursData.length) {
                let currencyDetails: any
                if (body.Currency && body.Currency != "GBP") {
                    currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.Currency)
                } else {
                    currencyDetails = {
                        value: 1,
                        currency: "GBP"
                    }
                }
                currencyDetails.UserType=body.UserType


                let result = await this.searchFormat(toursData, currencyDetails);
                return result;
            }
            else {
                throw new Error(`500 No Tour Found!!`);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
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

    async homePublishsearch(body: any): Promise<any> {
        try {
            let query = ` SELECT
                            t.id,
                            t.package_name,
                            t.duration,
                            t.banner_image,
                            t.package_description,
                            t.home_status, 
                            t.module_type,
                            t.inclusions,
                            t.exclusions,
                            t.optional_tours,
                            t.terms,
                            t.canc_policy,
                            tc.name AS country_name
                        FROM
                            tours t
                        LEFT JOIN
                            tours_country tc ON t.tours_country = tc.id
                        WHERE
                            t.home_status = 1`;
            const toursData = await this.manager.query(query);
            let result = await this.searchFormat(toursData);
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    // async searchFormat(body: any, currencyDetails?: any): Promise<any> {
    //     const publishedData = await Promise.all(
    //         body.map(async (element: any) => {
    //             const [tourPrice, tours_itinerary_dw] = await Promise.all([
    //             this.manager.query(`
    //             select
    //             tp.id,
    //             tp.from_date,
    //             tp.to_date,
    //             tp.adult_airliner_price,
    //             tp.child_airliner_price,
    //             td.dep_date
    //             from tour_price_management tp
    //             JOIN tour_dep_dates td
    //             ON tp.tour_id = td.tour_id
    //             WHERE tp.tour_id = ${element.id}`),
    //             this.manager.query(`
    //             SELECT
    //               tid.id,
    //               tid.inclusions_checks,
    //               tid.visited_city_day,
    //               COALESCE(tc.CityName, 'Unknown') AS CityName
    //             FROM
    //               tours_itinerary_dw tid
    //             LEFT JOIN
    //               tours_city tc ON tid.visited_city = tc.id
    //             WHERE
    //               tid.tour_id = ${element.id}
    //               AND tc.id IS NOT NULL;
    //           `)
    //             ]);

    //             const ExchangeRate = currencyDetails.value;

    //             tourPrice.forEach(el => {
    //                 el.Currency = currencyDetails.currency
    //                 el.ex_adult_airliner_price = Number((ExchangeRate * el.adult_airliner_price).toFixed(2))
    //                 el.ex_child_airliner_price = Number((ExchangeRate * el.child_airliner_price).toFixed(2))
    //             });

    //             const uniqueInclusionsChecks = [...new Set(tours_itinerary_dw.map((item: any) => item.inclusions_checks))] as string[];
    //             const visitedCityIds = tours_itinerary_dw.map((item: any) => parseInt(item.visited_city_day));
    //             const minVisitedCityId = Math.min(...visitedCityIds);
    //             const maxVisitedCityId = Math.max(...visitedCityIds);
    //             const firstDayCity = tours_itinerary_dw.find((item: any) => parseInt(item.visited_city_day) === minVisitedCityId).CityName;
    //             const lastDayCity = tours_itinerary_dw.find((item: any) => parseInt(item.visited_city_day) === maxVisitedCityId).CityName;
    //             const uniqueCityNames = [...new Set(tours_itinerary_dw.map((item: any) => item.CityName))];
    //             element["startCity"] = firstDayCity;
    //             element["endCity"] = lastDayCity;
    //             element["placesCovered"] = uniqueCityNames;
    //             element["inclusionsChecks"] = uniqueInclusionsChecks[0] ? uniqueInclusionsChecks[0].split(',') : "null";
    //             element["tourPrice"] = tourPrice ? tourPrice : [];
    //             element["theme"] = element.theme ? element.theme.split(",").filter((theme: string) => theme.trim() !== "") : [];
    //             const token = await this.redisServerService.geneateResultToken(element);
    //             const response = await this.redisServerService.insert_record(token, JSON.stringify(element));
    //             element["ResultIndex"] = response["access_key"];
    //             return element;
    //         })
    //     );

    //     return publishedData;
    // }


    async searchFormat(body: any, currencyDetails?: any): Promise<any> {
        const markupDetail: any = await this.markupDetails(body);
        const publishedData = await Promise.all(
            body.map(async (element: any) => {
                try {
                    const [tourPrice, tours_itinerary_dw] = await Promise.all([
                        this.manager.query(`
                            SELECT
                                tp.id,
                                tp.from_date,
                                tp.to_date,
                                tp.adult_airliner_price,
                                tp.child_airliner_price,
                                td.dep_date
                            FROM tour_price_management tp
                            LEFT JOIN tour_dep_dates td
                            ON tp.tour_id = td.tour_id
                            WHERE tp.tour_id = ${element.id}`),
                        this.manager.query(`
                            SELECT
                                tid.id,
                                tid.inclusions_checks,
                                tid.visited_city_day,
                                COALESCE(tc.CityName, 'Unknown') AS CityName
                            FROM tours_itinerary_dw tid
                            LEFT JOIN tours_city tc ON tid.visited_city = tc.id
                            WHERE tid.tour_id = ${element.id}
                              AND tc.id IS NOT NULL;
                        `)
                    ]);

                    // Process tour prices
                    const ExchangeRate = parseFloat(currencyDetails.value);

                    

                    // tourPrice.forEach(el => {
                    //     el.Currency = currencyDetails.currency;
                    //     el.ex_adult_airliner_price = Number((ExchangeRate * el.adult_airliner_price).toFixed(2));
                    //     el.ex_child_airliner_price = Number((ExchangeRate * el.child_airliner_price).toFixed(2));
                    // });
                    for (let i = 0; i < tourPrice.length; i++) {
                        const el = tourPrice[i];
                        if(el.price_total==undefined){
                            el.price_total=el.adult_airliner_price;
                        }
                        const markupAndCommission = JSON.parse(JSON.stringify(markupDetail));
                        const markupDetails = await this.markupDetail(markupAndCommission, el?.price_total, ExchangeRate);
                   
                    if (currencyDetails.UserType === "B2B") {
                        el.markupDetails = JSON.parse(JSON.stringify(markupDetails));

             
                        el.adult_airliner_price = Number((el?.price_total + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2));
                        
                        el.AgentNetFare = Number((el?.price_total + markupDetails.AdminMarkup ).toFixed(2));
                        el.Amount = el?.price_total;
                       
                    } 
                    else if (currencyDetails.UserType === "B2C") 
                    {
                        el.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        el.adult_airliner_price = Number(parseFloat(Number(el?.price_total) + markupDetails.AdminMarkup).toFixed(2));
                        el.child_airliner_price = Number(parseFloat((el?.child_airliner_price) + markupDetails.AdminMarkup).toFixed(2));
                        el.AgentNetFare = Number(parseFloat(el?.price_total + markupDetails.AdminMarkup).toFixed(2));
                    
                        el.Amount = el?.price_total;
                        
                    }
                        el.Currency = currencyDetails.currency;
                        el.ex_adult_airliner_price = Number((ExchangeRate * el.adult_airliner_price).toFixed(2));
                        el.ex_child_airliner_price = Number((ExchangeRate * el.child_airliner_price).toFixed(2));
                    }

                    if (!tours_itinerary_dw || tours_itinerary_dw.length === 0) {
                        element["startCity"] = 'Unknown';
                        element["endCity"] = 'Unknown';
                        element["placesCovered"] = [];
                        element["inclusionsChecks"] = [];
                    } else {
                        const uniqueInclusionsChecks = [...new Set(tours_itinerary_dw.map((item: any) => item.inclusions_checks))] as string[];
                        const visitedCityIds = tours_itinerary_dw.map((item: any) => parseInt(item.visited_city_day, 10));
                        const minVisitedCityId = Math.min(...visitedCityIds);
                        const maxVisitedCityId = Math.max(...visitedCityIds);

                        const firstDayCity = tours_itinerary_dw.find((item: any) => parseInt(item.visited_city_day, 10) === minVisitedCityId)?.CityName || 'Unknown';
                        const lastDayCity = tours_itinerary_dw.find((item: any) => parseInt(item.visited_city_day, 10) === maxVisitedCityId)?.CityName || 'Unknown';

                        const uniqueCityNames = [...new Set(tours_itinerary_dw.map((item: any) => item.CityName))];

                        element["startCity"] = firstDayCity;
                        element["endCity"] = lastDayCity;
                        element["placesCovered"] = uniqueCityNames;
                        element["inclusionsChecks"] = uniqueInclusionsChecks[0] ? uniqueInclusionsChecks[0].split(',') : [];
                    }

                    element["tourPrice"] = tourPrice || [];
                    element["theme"] = element.theme ? element.theme.split(",").filter((theme: string) => theme.trim() !== "") : [];

                    const token = await this.redisServerService.geneateResultToken(element);
                    const response = await this.redisServerService.insert_record(token, JSON.stringify(element));
                    element["ResultIndex"] = response["access_key"];
                    element["BookingSource"]=TMX_SIGHTSEEING_BOOKING_SOURCE;

                    return element;
                } catch (err) {
                    console.error(`Error processing element with ID ${element.id}:`, err);
                    throw new Error(`Error processing element with ID ${element.id}: ${err.message}`);
                }
            })
        );

        return publishedData;
    }


    async tourDetail(body: any): Promise<any> {
        try {
            let tourData = await this.redisServerService.read_list(body.ResultToken);
            tourData = JSON.parse(tourData);
            let query = `SELECT tid.id, tid.visited_city_day, tid.program_title, tid.program_des, tc.CityName
                             FROM tours_itinerary_dw tid
                             LEFT JOIN tours_city tc ON tid.visited_city = tc.id
                             WHERE tid.tour_id =${tourData.id}`;
            const itinerary = await this.manager.query(query);
            let query2 = `SELECT t.id,t.enquiry_form_status,t.book_now_status FROM tours t WHERE t.id =${tourData.id}`;
            const form_status = await this.manager.query(query2);
            tourData.EnquiryForm = form_status[0].enquiry_form_status;
            tourData.BookNow = form_status[0].book_now_status;
            tourData["itinerary"] = itinerary;
            const token = await this.redisServerService.geneateResultToken(tourData);
            const response = await this.redisServerService.insert_record(token, JSON.stringify(tourData));
            tourData["ResultIndex"] = response["access_key"];
            tourData["BookingSource"]=TMX_SIGHTSEEING_BOOKING_SOURCE;
            tourData["paxPriceDetails"]=[
                {
                    "age_max":0,
                    "age_min":0
                },
                {
                    "age_max":17,
                    "age_min":5
                }
            ];
            return tourData;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async tourValuation(body: any): Promise<any> {
        try {
            let response: any = {};
            const tourData = JSON.parse(await this.redisServerService.read_list(body.ResultToken));
            const markupDetail: any = await this.markupDetails(body);
            const result = await this.getGraphData(
                `mutation {
                                updateTour(
                                    id:${tourData.id}
                                    tourPartial:{
                                    adult_twin_sharing:${body.NoOfAdults}
                                    child_with_bed:${body.NoOfChild}
                                    date:"${body.Date}"
                                    }
                                )
                                }`,
                "updateTour"
            );
            if (tourData) {
                const numberOfDays = parseInt(tourData.duration.match(/\d+/)[0]);

                let GrandTotal=(body.NoOfChild * (tourData.tourPrice && tourData.tourPrice[0] && tourData.tourPrice[0].child_airliner_price ? tourData.tourPrice[0].child_airliner_price : 0)) + (body.NoOfAdults * (tourData.tourPrice && tourData.tourPrice[0] && tourData.tourPrice[0].adult_airliner_price ? tourData.tourPrice[0].adult_airliner_price : 0));
                let adult_airliner_price=tourData.tourPrice && tourData.tourPrice[0] && tourData.tourPrice[0].adult_airliner_price
                ? tourData.tourPrice[0].adult_airliner_price : 0;
                let currencyDetails: any
                if (body.Currency && body.Currency != "GBP") {
                    currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.Currency)
                } else {
                    currencyDetails = {
                        value: 1,
                        currency: "GBP"
                    }
                }
                let ExchangeRate=currencyDetails.value;

                const markupAndCommission = JSON.parse(JSON.stringify(markupDetail));
                const markupDetails = await this.markupDetail(markupAndCommission, GrandTotal, ExchangeRate);
                const markupDetailsForBaseFare = await this.markupDetail(markupAndCommission, adult_airliner_price, ExchangeRate);
               let markupDetailsData:any={};
                let AgentNetFare:any=0;
                let Amount:any=0;
                let GrandTotalWithMarkup=0;
                if (body.UserType === "B2B") {
                    markupDetailsData = JSON.parse(JSON.stringify(markupDetailsData));

         
                    GrandTotalWithMarkup = Number(((GrandTotal * ExchangeRate) + markupDetailsData.AdminMarkup + markupDetailsData.AgentMarkup ).toFixed(2));
                    adult_airliner_price = Number(((adult_airliner_price * ExchangeRate) + markupDetailsData.AdminMarkup + markupDetailsData.AgentMarkup ).toFixed(2));

                    AgentNetFare = Number(((GrandTotal * ExchangeRate) + markupDetailsData.AdminMarkup ).toFixed(2));
                    Amount = Number(GrandTotal * ExchangeRate ).toFixed(2);
                   
                } else if (body.UserType === "B2C") {
                    markupDetailsData = JSON.parse(JSON.stringify(markupDetailsData));
                    GrandTotalWithMarkup = Number(parseFloat(Number(GrandTotal * ExchangeRate) + markupDetailsData.AdminMarkup).toFixed(2));
                    adult_airliner_price = Number(parseFloat(Number(adult_airliner_price * ExchangeRate) + markupDetailsData.AdminMarkup).toFixed(2));
                    AgentNetFare = Number(parseFloat((GrandTotal * ExchangeRate) + markupDetailsData.AdminMarkup).toFixed(2));
                
                    Amount = Number(GrandTotal * ExchangeRate ).toFixed(2);
                    
                }

                response = {
                    TotalPrice: adult_airliner_price,
                    NoOfAdults: body.NoOfAdults,
                    NoOfChild: body.NoOfChild,
                    NoOfGuest: body.NoOfChild + body.NoOfAdults,
                    CheckInDate: body.Date,
                    checkoutDate: moment(body.Date).add(numberOfDays, 'days').format('YYYY-MM-DD'),
                    TaxesAndServiceFee: 0,
                    ConvenienceFee: 0,
                    GrandTotal: GrandTotalWithMarkup,
                    Duration: tourData.duration,
                    BannerImage: tourData.banner_image,
                    TourName: tourData.package_name
                };
            }
            return response;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async broucher(body: any): Promise<any> {
        try {
            let result: any = {};
            const toursData = await this.getGraphData(
                `query {                   
                    tours(
                        where:{
                            id:{
                                eq:"${body.ToursId}"
                            }
                        }
                    ){
                        id
                        created_at
                        package_id
                        supplier_id
                        package_name
                        package_description
                        destination
                        tour_type
                        module_type
                        theme
                        duration
                        highlights
                        inclusions
                        exclusions
                        optional_tours
                        terms
                        canc_policy
                        banner_image
                        gallery
                        video
                        supplier_name
                        trip_notes
                    }
                  }`,
                "tours"
            );
            let toursPriceManagementData = await this.getGraphData(
                `query {
                            tourPriceManagements(
                                where:{
                                    tour_id:{
                                        eq:"${body.ToursId}"
                                    }
                                }
                                    ){
                                        id
                                        created_at
                                        tour_id
                                        from_date
                                        to_date
                                        adult_airliner_price
                                        child_airliner_price
                                        
                                        
                                    }
                                }`,
                "tourPriceManagements"
            );
            const query = `SELECT tid.id, tid.tour_id, tc.CityName, tid.visited_city , tid.visited_city_day, tid.program_title, tid.program_des, tid.inclusions_checks
                FROM tours_itinerary_dw tid
                INNER JOIN tours_city tc ON tid.visited_city = tc.id
                WHERE tid.tour_id = ${body.ToursId}`
            const TourItinerary = await this.manager.query(query);
            result['toursPriceManagementData'] = toursPriceManagementData;
            result['toursData'] = toursData[0];
            result['TourItinerary'] = TourItinerary;
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async sendEnquiry(body: any): Promise<any> {
        try {
            const result = await this.getGraphData(
                `mutation {
                        createToursEnquiry(
                                    toursEnquiry:{
                                       tour_id: "${body.TourId}"
                                       name: "${body.Name}"
                                       email:"${body.Email}"
                                       phone:"${body.ContactNumber}"
                                       departure_date:"${body.DepartureDate}"
                                       departure_place:"${body.DeparturePlace}"
                                       message:"${body.Message}"
                                       Booking_Source:"${body.UserType}"
                                       enquiry_reference_no: 0
                                       status: 1
                                       title:"0"
                                       lname:"0"
                                       created_by_id: 0
                                    }
                                ){
                                    id
                                    tour_id
                                    name
                                    phone
                                    email
                                    departure_place
                                    message
                                }
                            }`,
                "createToursEnquiry"
            );
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async addPaxDetails(body: any): Promise<any> {
        try {
            let data = await this.redisServerService.read_list(body.ResultToken);
            let parsedData = await JSON.parse(data);

            let query1 = `SELECT app_reference FROM tour_pax_details WHERE app_reference = '${body.AppReference}'`
            let appRefInDb = await this.manager.query(query1);
            if (appRefInDb.length > 0) {
                const errorClass: any = getExceptionClassByCode("409 Duplicate entry for AppReference");
                throw new errorClass("409 Duplicate entry for AppReference");
            } else {
                let paxDetails: any = [];
                paxDetails.push(body.TourDetails[0].PassengerDetails);
                paxDetails.push(body.TourDetails[0].AddressDetails);
                if (Array.isArray(paxDetails) && paxDetails.length > 0) {
                    paxDetails[0][0].LeadPassenger = !paxDetails.some(passenger => 'LeadPassenger' in passenger) ? true : false;
                }
                const selectedDate = new Date(body.TourDetails[0].selectedDate).toISOString().split('T')[0];

                let tourPrice = parsedData.tourPrice;
                let adultPrice = 0;
                let childPrice = 0;
                if (parsedData.BookingSource == TR_SIGHTSEEING_BOOKING_SOURCE) {
                   
                    paxDetails.push(parsedData.ValuationRequest);

                   
                    let newTourPrice = [];
                    
                    tourPrice.forEach(datePrice => {
                        if (datePrice.dep_date == selectedDate) {
                            adultPrice = datePrice.adult_airliner_price;
                            childPrice = datePrice.child_airliner_price;


                            let startDate = new Date(datePrice.dep_date);
                            
                            // Add the duration to the start date
                            let endDate = new Date(startDate);
                            let pacDuration:number =parsedData.duration.replace(" Days", "");
                           
                            endDate.setDate(endDate.getDate() + pacDuration);

                            // Format the end date in 'YYYY-MM-DD'
                            let year = endDate.getFullYear();
                            let month = String(endDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
                            let day = String(endDate.getDate()).padStart(2, '0');

                            let endDateString = `${year}-${month}-${day}`;

                            datePrice.from_date = datePrice.dep_date;
                            datePrice.end_date = endDateString;
                            newTourPrice.push(datePrice);
                        }
                    });
                    parsedData.tourPrice = newTourPrice;
                } else {
                    const matchingTours: any = [];
                    tourPrice.forEach(tour => {
                        const fromDate = new Date(tour.from_date).toISOString().split('T')[0];
                        const toDate = new Date(tour.to_date).toISOString().split('T')[0];
                        if (selectedDate >= fromDate && selectedDate <= toDate) {
                            matchingTours.push({
                                    adult_airliner_price: tour.ex_adult_airliner_price,
                                    child_airliner_price: tour.ex_child_airliner_price,
                                    from_date: tour.from_date,
                                    to_date: tour.to_date,
                            });
                        }
                    });
                    adultPrice = matchingTours[0].adult_airliner_price;
                    childPrice = matchingTours[0].child_airliner_price;
                }
                const email = body.TourDetails[0].AddressDetails.Email;
                const mobile = body.TourDetails[0].AddressDetails.Contact;
                parsedData["appRef"] = body.AppReference;
                parsedData["usertype"] = body.UserType;
                parsedData["remarks"] = body.Remarks;
                parsedData["adultcount"] = body.AdultCount;
                parsedData["childcount"] = body.ChildCount;
                parsedData["PromoCode"] = body.PromoCode;
                parsedData.baseFare = adultPrice;
                parsedData.childFare = childPrice;
                parsedData.email = email;
                parsedData.contact = mobile;
                parsedData.UserId = body.UserId;
                const fromDate = new Date();
                const formattedDate = fromDate.toISOString().slice(0, 19).replace('T', ' ');
                
                const tourDetailRes = await this.addTourDetails(parsedData, paxDetails);
                parsedData.discount = tourDetailRes.discountAmount;
                parsedData.PromoCode = tourDetailRes.PromoCode;
                parsedData.convinenceFee=tourDetailRes.convinenceFee;
             
                for (const details of paxDetails[0]) {
                    let query = `INSERT INTO tour_pax_details (
                                app_reference,
                                pax_type,
                                pax_title,
                                pax_first_name,
                                pax_middle_name,
                                pax_last_name,
                                pax_dob,
                                gender,
                                nationality,
                                created_at,
                                adress,
                                adress2,
                                city,
                                state,
                                postal_code,
                                email,
                                country_code,
                                mobile_number,
                                country,
                                tour_booking_detail_id,
                                created_by_id) VALUES (
                                '${body.AppReference}',
                                '${details.PaxType === '0' ? 'child' : 'adult'}',
                                '${details.Title}',
                                '${details.FirstName}',
                                '${details.MiddleName}',
                                '${details.LastName}',
                                '${details.Dob}',
                                '${details.Gender}',
                                '${details.Nationality}',
                                '${formattedDate}',
                                '${paxDetails[1].Address}',
                                '${paxDetails[1].Address2}',
                                '${paxDetails[1].City}',
                                '${paxDetails[1].State}',
                                '${paxDetails[1].PostalCode}',
                                '${email}',
                                '${paxDetails[1].PhoneCode}',
                                '${mobile}',
                                '${paxDetails[1].Country}',
                                '${parsedData.id}',
                                '0'
                                )`
                    let bookingPaxDetailsResp = await this.manager.query(query);
                    if (bookingPaxDetailsResp.affectedRows > 0) {
                        console.log("Data inserted successfully");
                    }
                    else {
                        throw new Error("Please provide valid passanger details");
                    }
                }
                
                return this.getTourPaxDetailsUniversal(paxDetails, parsedData);
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
    async convinenceFees(totalFare: any, flag = 'Tour',passengerCount:any): Promise<any> {
        let ConvinenceFee: any = 0;

        const query = `select * from core_payment_charges WHERE module = "${flag}";`
        const queryResponse = await this.manager.query(query);
        
        if (Array.isArray(queryResponse) && queryResponse.length > 0 && queryResponse[0].status == 1) {

            if (queryResponse[0].fees_type === 'percentage') {
                const percentageAdvanceTax = (totalFare * queryResponse[0].fees) / 100;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));

            } else if (queryResponse[0].fees_type === 'plus') {
                const percentageAdvanceTax = queryResponse[0].fees;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));
            }

            if (queryResponse[0].added_per_pax === "Yes") {
                ConvinenceFee = Number((ConvinenceFee * passengerCount).toFixed(2));
            }
        }

        return ConvinenceFee;
    }


    async addTourDetails(body: any, pax: any): Promise<any> {
        try {
            
            const fromDate = new Date();
            const formattedDate = fromDate.toISOString().slice(0, 19).replace('T', ' ');
            const jsonData = JSON.stringify(pax);
            let datePart: string = ``;
            let End_datePart: string = ``;
            let departureId = 0;
            let currency : string = `GBP`; // As per Tour CRS
            if(body.BookingSource==TR_SIGHTSEEING_BOOKING_SOURCE){
                datePart=body.tourPrice[0].from_date;
                End_datePart=body.tourPrice[0].end_date;
                departureId=body.tourPrice[0].id;
                currency = body.tourPrice[0].Currency;
            }else{
            const departure_date = body.tourPrice[0].from_date;
            datePart = departure_date.substring(0, 10);
            const End_date = body.tourPrice[0].to_date;
            End_datePart = End_date.substring(0, 10);
            }
            const baseFare = body.baseFare * body.adultcount;
            const childFare = body.childFare * body.childcount;
            
            let promoCode: any = [];
            if (body.PromoCode) {
                promoCode = await this.getGraphData(
                    `{
                    corePromocodes(where:{
                        promo_code:{
                            eq: "${body.PromoCode}"
                        }
                        }){
                            id
                            promo_code
                            discount_type
                            discount_value
                            use_type
                        }
                    }`,
                    "corePromocodes"
                );
            }

            // let totalFare = ((body.adultcount * baseFare) + (body.childcount * childFare)) ;
            let totalFare = baseFare + childFare
            // let totalFare = ((body.adultcount * baseFare) + (body.childcount * childFare)+body.tourPrice[0].markupDetails.AdminMarkup+body.tourPrice[0].markupDetails.AgentMarkup) ;
           
            if(body.usertype){
            body.UserType=body.usertype;
            }
            let convinenceFee: any = 0;
            let passengerCount=body.adultcount + body.childcount;
            // if (body.usertype === "B2C") {
                convinenceFee = await this.convinenceFees(body["totalfare"], "Tour",passengerCount);

                let currencyDetail: any
                
                if(body.Currency && body.Currency != "GBP"){
                    currencyDetail = await this.formatPriceDetailToSelectedCurrency(body.Currency)  
                } else {
                    currencyDetail = {
                        value: 1,
                        currency: "GBP"
                    }
                }

                convinenceFee = Number(convinenceFee * currencyDetail.value)
            // }
            let currencyDetails :any ; 
            if(body.tourPrice[0].Currency && body.tourPrice[0].Currency != "GBP"){
                currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.tourPrice[0].Currency)  
            }

            convinenceFee = parseFloat((convinenceFee * currencyDetails.value).toFixed(2))

            if (body.usertype === "B2C" && convinenceFee != 0) {
                body["totalfare"] += convinenceFee
                body["convinenceFee"] = convinenceFee
                 totalFare += convinenceFee
            }

            let discountAmount: any = 0;
            let firstPromo: any = "";
            if (promoCode.length > 0 && body.usertype === "B2C") {
                firstPromo = promoCode[0];

                if (firstPromo.discount_type === "percentage") {
                    // let totalPrice: any;
                    // if (data.Price.Currency != "GBP") {
                    //     totalPrice = parseFloat((data?.Price?.TotalDisplayFare/data.exchangeRate).toFixed(2))
                    // }

                    // discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

                    // if (data.Price.Currency != "GBP") {
                    //     discountAmount = parseFloat((discountAmount *data.exchangeRate).toFixed(2))
                    // }
                    // data.Price.TotalDisplayFare -= discountAmount;
                    let totalPrice = totalFare;

                    discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

                    totalFare -= discountAmount;

                } else if (firstPromo.discount_type === "plus") {
                    let currencyDetails
                    if(body.Currency && body.Currency != "GBP"){
                        currencyDetails = await this.formatPriceDetailToSelectedCurrency(body.Currency)  
                    } else {
                        currencyDetails = {
                            value: 1,
                            currency: "GBP"
                        }
                    }
                    
                    discountAmount = Number((firstPromo.discount_value * currencyDetails.value).toFixed(2));
                    totalFare -= discountAmount;
                }
            }
          
            if (firstPromo != "" && firstPromo.use_type === "Single") {
                const query = `UPDATE core_promocodes SET status = 0 WHERE id = ${firstPromo.id}`;
                await this.manager.query(query);
            }

            

            // let banner_image=body?.banner_image??"";
            // const BannerImageUrl = "http://54.198.46.240/booking247/node/dist/apps/supervision/uploads/tour/tour-banner-images/" ;
            const BannerImageUrl = "https://booking247.com/booking247/node/dist/apps/supervision/uploads/tour/tour-banner-images/";
            let banner_image=BannerImageUrl +body?.banner_image??"";
            let terms=body?.terms??"";
            let canc_policy=body?.canc_policy??"";
            
            let query_booking = `INSERT INTO tour_booking_details (
                            app_reference,
                            status,
                            tour_module_type,
                            basic_fare,
                            child_fare,
                            currency_code,
                            payment_status,
                            tours_id,
                            created_at,
                            attributes,
                            departure_date,
                            end_date,
                            remarks,
                            markup,
                            agent_markup,
                            gst_value,
                            service_tax,
                            discount,
                            promocode,
                            email,
                            created_by_id,
                            AdultCount,
                            ChildCount,
                            start_city,
                            end_city,
                            package_name,
                            mobile_number,
                            Booking_Source,
                            TotalFare,
                            DepartureId,
                            Api_id,
                            banner_image,
                            terms,
                            convenience_fee,
                            canc_policy) VALUES (
                            '${body.appRef}',
                            'PROCESSING',
                            '${body.module_type}',
                            '${baseFare}',
                            '${childFare}',
                            '${currency}',
                            'UNPAID',
                            '${body.id}',
                            '${formattedDate}',
                            '${jsonData}',
                            '${datePart}',
                            '${End_datePart}',
                            '${body.remarks}',
                            '${body.tourPrice[0].markupDetails.AdminMarkup}',
                            '${body.tourPrice[0].markupDetails.AgentMarkup}',
                            '0.0',
                            '${convinenceFee ?? 0}',
                            '${discountAmount}',
                            '${body.PromoCode ?? ''}',
                            '${pax[1].Email}',
                            '${body.UserId ?? 0}',
                            '${body.adultcount}',
                            '${body.childcount}',
                            '${body.startCity}',
                            '${body.endCity}',
                            '${body.package_name}',
                            '${body.contact}',
                            '${body.usertype}',
                            '${totalFare}',
                            '${departureId}',
                            '${body.BookingSource}',
                            '${banner_image}',
                            '${terms}',
                            ${convinenceFee ?? 0},
                            '${canc_policy}'
                            
                            ) `
            let booking_details_db = await this.manager.query(query_booking);
            if (booking_details_db.affectedRows > 0) {
                console.log("Data inserted succesfully");
                return {
                    PromoCode: body.PromoCode,
                    discountAmount,
                    convinenceFee:convinenceFee
                }
            }
            else {
                throw new Error("Please provide valid booking details")
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Voucher(body: any): Promise<any> {
        try {
            const query1 = `SELECT 
                            pax_title,
                            pax_first_name,
                            pax_middle_name,
                            pax_last_name,
                            pax_type,
                            pax_dob,
                            pax_age,
                            created_at
                            from tour_pax_details 
                            where app_reference = '${body.AppReference}'`
            const query2 = `SELECT 
                            app_reference,
                            tours_id,
                            tour_module_type,
                            basic_fare,
                            child_fare,
                            TotalFare,
                            currency_code,
                            mobile_number,
                            email,
                            departure_date,
                            end_date,
                            AdultCount,
                            ChildCount,
                            remarks,
                            markup,
                            gst_value,
                            Booking_Id,
                            status,
                            start_city,
                            end_city,
                            package_name,
                            Api_id,
                            banner_image,
                            terms,
                            canc_policy,
                            discount,
                            convenience_fee
                            from tour_booking_details 
                            where app_reference = '${body.AppReference}'`;
                            const VoucherDetails1 = await this.manager.query(query1);
                            const VoucherDetails2 = await this.manager.query(query2); 

                            if (VoucherDetails1.length < 0 && VoucherDetails2.length < 0 ) {
                                const errorClass: any = getExceptionClassByCode("403 please provide the valid app_reference!");
                                throw new errorClass("403 Given Appreference not exist!");
                            }                
                            const passangerDetails = []; 
                            const bookingDetails = [];

                                 
            for (const row of VoucherDetails1) {
                const passanger = {
                    Title: row.pax_title,
                    FirstName: row.pax_first_name,
                    MiddleName: row.pax_middle_name,
                    LastName: row.pax_last_name,
                    PaxType: row.pax_type,
                    DateofBirth: row.pax_dob.toISOString().slice(0, 10),
                    Age: row.pax_age,
                    Created: row.created_at
                }
                passangerDetails.push(passanger);
            }
            if (Array.isArray(passangerDetails) && passangerDetails.length > 0) {
                !passangerDetails.some(passenger => 'LeadPassenger' in passenger) ? passangerDetails[0].LeadPassenger = true : false;
            }

            if(VoucherDetails2[0].Api_id==TR_SIGHTSEEING_BOOKING_SOURCE){
               const row1=VoucherDetails2[0];
               
                const booking = {
                    AppReference: row1.app_reference,
                    id: row1.tours_id,
                    from_date: row1.departure_date,
                    to_date: row1.end_date,
                    TourType: row1.tour_module_type,
                    Basicfare: row1.basic_fare,
                    Childfare: row1.child_fare,
                    TotalFare: row1.TotalFare,
                    CurrencyCode: row1.currency_code,
                    Mobile_Number: row1.mobile_number,
                    Email: row1.email,
                    AdultCount: row1.AdultCount,
                    ChildCount: row1.ChildCount,
                    Remarks: row1.remarks,
                    Markup: row1.markup,
                    Discount:row1.discount,
                    Convenience_fee:row1.convenience_fee,
                    Gst_Value: row1.gst_value,
                    Booking_Id: row1.Booking_Id,
                    BookingSource : row1.Api_id, 
                    Booking_Status: row1.status,
                    Start_City: row1.start_city,
                    End_City: row1.end_city,
                    Package_Name: row1?.package_name??"",
                    banner_image: row1?.banner_image??"",
                    terms: row1?.terms??"",
                    canc_policy: row1?.canc_policy??"",
                    tours_country: row1?.tours_country??""
                };
                bookingDetails.push(booking);
            }else{
                const query3 = `SELECT 
                            t.id,
                            t.banner_image,
                            t.terms,
                            t.canc_policy,
                            tc.name AS tours_country 
                            from tours t 
                            JOIN tour_booking_details 
                            ON t.id = tour_booking_details.tours_id 
                            LEFT JOIN tours_country tc ON t.tours_country = tc.id
                            where app_reference = '${body.AppReference}'`;

            
            const VoucherDetails3 = await this.manager.query(query3);

            if (VoucherDetails1.length < 0 && VoucherDetails2.length < 0 && VoucherDetails3.length < 0) {
                const errorClass: any = getExceptionClassByCode("403 please provide the valid app_reference!");
                throw new errorClass("403 Given Appreference not exist!");
            }

       
            
            const maxLength = Math.max(VoucherDetails2.length, VoucherDetails3.length);
            for (let i = 0; i < maxLength; i++) {
                const row1 = VoucherDetails2[i];
                const row2 = VoucherDetails3[i];
                const booking = {
                    AppReference: row1.app_reference,
                    id: row1.tours_id,
                    from_date: row1.departure_date,
                    to_date: row1.end_date,
                    TourType: row1.tour_module_type,
                    Basicfare: row1.basic_fare,
                    Childfare: row1.child_fare,
                    TotalFare: row1.TotalFare,
                    CurrencyCode: row1.currency_code,
                    Mobile_Number: row1.mobile_number,
                    Email: row1.email,
                    AdultCount: row1.AdultCount,
                    ChildCount: row1.ChildCount,
                    Remarks: row1.remarks,
                    Markup: row1.markup,
                    Discount:row1.discount,
                    Convenience_fee:row1.convenience_fee,
                    Gst_Value: row1.gst_value,
                    Booking_Id: row1.Booking_Id,
                    Booking_Status: row1.status,
                    Start_City: row1.start_city,
                    End_City: row1.end_city,
                    Package_Name: row1.package_name,
                    banner_image: row2.banner_image,
                    terms: row2.terms,
                    canc_policy: row2.canc_policy,
                    tours_country: row2.tours_country
                };
                bookingDetails.push(booking);
            }

            }
            
           
            const response = {
                PassangerDetails: passangerDetails,
                BookingDeatils: bookingDetails
            }
            return response;
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }
    async paymentConfirmation(body: any): Promise<any> {
        const tour_booking_query = `SELECT status from payment_gateway_details WHERE app_reference = '${body.app_reference}' AND order_id = '${body.order_id}'`
        let booking_info = await this.manager.query(tour_booking_query);
        if (booking_info[0]) {
            if (booking_info[0].status === 'completed') {
                return true;
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 Invalid  `);
                throw new errorClass(`Your payment is still pending. To ensure your booking is confirmed, please complete the payment process`);
            }
        }
        const errorClass: any = getExceptionClassByCode(`400 Invalid OrederId.`);
        throw new errorClass(`Invalid OrederId`);
    }
    async generatebookingId(body: any): Promise<any> {
        try {
            let booking_status_query = `UPDATE tour_booking_details SET status = 'BOOKING_CONFIRMED' where app_reference = '${body.AppReference}'`;
            const Booking_status_query = await this.manager.query(booking_status_query);
            if (Booking_status_query.affectedRows > 0) {
                console.log("Data inserted successfully");
            } else {
                throw new Error("Invalid AppReference");
            }
            let response:any  =0;
            if(body.bookingId){
                response=body.bookingId;
            }else{
            const randomNumber = Math.floor(Math.random() * 1000);
            const processId = process.pid;

            response = randomNumber.toString() + processId.toString();
            }

            let query = `UPDATE tour_booking_details SET Booking_Id='${response}' where app_reference = '${body.AppReference}'`;

            this.manager.query(query)
                .then((result: any[]) => {
                    console.log("Query executed successfully:", result);
                })
                .catch((error: any) => {
                    console.error("Error executing query:", error);
                })
            return response
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(`400 Invalid BookingId `);
            throw new errorClass('Invalid BookingId')
        }
    }

    async getOperatorsBookingField(operator_id: any): Promise<any> {
        try {
            let query = `SELECT booking_fields
            FROM tour_radar_operator_details WHERE id = ${operator_id}
            `;
            const result = await this.manager.query(query);
            // const result = result1;
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }

    }

    async markupDetails(body: any, Totalfare: any = "") {
        let admin_markup: any = [], agent_markup: any = [], markupDetails: any = {}, commission: any = [], commissionDetails: any = {};

        if (body['UserType']) {
            if (body['UserType'] == "B2B") {

                admin_markup = await this.getTourMarkupDetails(body, "b2b_tour", "b2b_admin");
                markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];

                agent_markup = await this.getTourMarkupDetails(body, "b2b_tour", "b2b_own");
                markupDetails.agentMarkup = agent_markup.length > 0 ? agent_markup : [];

                // commission = await this.getTourCommissionDetails(body, "b2b_tour");
                // commissionDetails.commission = commission.length > 0 ? commission : [];

            } else {
                body["UserId"] = 0;
                admin_markup = await this.getTourMarkupDetails(body, "b2c_tour", "b2c_admin");
                markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
            }
        } else {
            body["UserId"] = 0;
            admin_markup = await this.getTourMarkupDetails(body, "b2c_tour", "b2c_admin");
            markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
        }

        return {
            markupDetails,
            commissionDetails
        }
    }

    async getTourMarkupDetails(
        searchData: any,
        module_type: any,
        markup_level: any
    ): Promise<any> {
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
                            auth_user_id: {
                                in: "0,${searchData["UserId"]}"
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

    async markupDetail(body: any, totalFare: any, exchangeRate: any = 1): Promise<any> {
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

    async emailTourDetails(body) {
        const query1 = `SELECT 
                            pax_title,
                            pax_first_name,
                            pax_middle_name,
                            pax_last_name,
                            pax_type,
                            pax_dob,
                            pax_age,
                            created_at
                            from tour_pax_details 
                            where app_reference = '${body.AppReference}'`
            const query2 = `SELECT 
                            app_reference,
                            tours_id,
                            tour_module_type,
                            basic_fare,
                            child_fare,
                            TotalFare,
                            currency_code,
                            mobile_number,
                            email,
                            departure_date,
                            end_date,
                            AdultCount,
                            ChildCount,
                            remarks,
                            markup,
                            gst_value,
                            Booking_Id,
                            status,
                            banner_image,
                            start_city,
                            end_city,
                            created_at,
                            package_name,
                            attributes
                            from tour_booking_details 
                            where app_reference = '${body.AppReference}'`

            const query3 = `SELECT 
                            t.id,
                            t.banner_image,
                            t.terms,
                            t.canc_policy,
                            tc.name AS tours_country 
                            from tours t 
                            JOIN tour_booking_details 
                            ON t.id = tour_booking_details.tours_id 
                            LEFT JOIN tours_country tc ON t.tours_country = tc.id
                            where app_reference = '${body.AppReference}'`;

            const resultPassengers = await this.manager.query(query1);
            const result = await this.manager.query(query2);
            const bannerInfo = await this.manager.query(query3);
        // let result = await this.getHotelBookingDetails(body);
        // let resultPassengers = await this.getHotelBookingPaxDetails(body);
        // let itineraries = await this.getHotelBookingItineraryDetails(body);

        let subjectString = ""
        let mailObject: any
        let attchment: any;
        const filename = result[0].app_reference;
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
        
        // let PassengerContactInfo = PassengerDetails.pop()
        PassengerDetails.forEach((element, index) => {
            passengerDataHtml = passengerDataHtml + `
            <tr>
            <td style="font-size: 15px; line-height: 25px;"><span>${element.pax_first_name} ${element.pax_last_name}</span>
                                </td>
                                <!-- <td style="font-size: 15px; line-height: 25px;"><span>${formatHotelDateTime(element.pax_dob)}</span>
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

        // await this.pdf({
        //     filename: "./voucher/hotel/" + filename + ".pdf",
        //     template: "hotel",
        //     viewportSize: {
        //         width: 1500
        //     },
        //     locals: {
        //         hotelInfo: result[0],
        //         app_reference: result[0].app_reference,
        //         passengerDetails: PassengerData,
        //         business_name: (agencyResult.business_name)?agencyResult.business_name:'',
        //         business_number: (agencyResult.business_number)?agencyResult.business_number:'',
        //         booked_on: bookedOn
        //     },
        // });
        const { cc } = await this.getEmailConfig()
        if (result[0].status === "BOOKING_CONFIRMED" || result[0].status === "BOOKING_HOLD") {

            subjectString = `TOUR BOOKING DETAILS : ${result[0].app_reference}`
            
            // await this.pdf({
            //     filename: "./voucher/tour/" + filename + ".pdf",
            //     template: "tour",
            //     viewportSize: {
            //         width: 1500
            //     },
            //     locals: {
            //         tourInfo: result[0],
            //         app_reference: result[0].app_reference,
            //         PassengerDetails,
            //         booked_on: result[0].created_at.toLocaleDateString(),
            //         images: result[0].banner_image,
            //         totalFareSum: result[0].TotalFare,
            //         currency: result[0].currency_code,
            //         location: `${result[0].start_city} ${bannerInfo[0]?.tours_country ? bannerInfo[0]?.tours_country : ''}`,
            //     },
            // });
    
    
            // attchment = {
            //     filename: `${result[0].app_reference}.pdf`,
            //     contentType: "application/pdf",
            //     path:
            //         process.cwd() +
            //         "/voucher/tour/" + filename +
            //         ".pdf",
            // }

            mailObject = {
                // to: `${result[0].email}`,
                to: `${result[0].email}`,
                cc,
                from: `"Booking247" <${SUPPORT_EMAIL}>`,
                subject: subjectString,
                // attachments: [
                //     attchment
                // ],

            }
        }

        if (result[0].status === "CANCELLED") {
            subjectString = `TOUR BOOKING CANCELLED : ${result[0].app_reference}`

            mailObject = {
                to: `${result[0].email}`,
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
                            <span>Booking Reference: ${result[0].app_reference}</span>
                            <br>
                            <span>Booked Date : ${result[0].created_at.toLocaleDateString()}</span>
                            <br>
                            <span>Booking Status : ${result[0].status}</span>
                        </td>
                       </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding:10px 0; width:240px;">
                    <img style="width:220px; height: 140px;" src="${result[0].banner_image}">
                </td>
                <td style="padding:10px 0; line-height:25px;">
                    <span style="display: block;">
                        <span
                            style="font-size:22px; font-weight:600;">${result[0].package_name}</span>
                            <br>
                        <span style="font-size:14px;">${result[0].start_city} ${bannerInfo[0]?.tours_country ? bannerInfo[0]?.tours_country : ''}</span>
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
                                                        style="font-size:14px; color: #fff;">Amount (${result[0].currency_code})</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td><span>Base Price</span>
                                                </td>
                                                <td><span>${result[0].TotalFare}</span>
                                                </td>
                                            </tr>
                                            
                                            <tr>
                                                <td style="border-top:1px solid #ccc"><span
                                                        style="font-size:15px; font-weight: bold;">Total Fare</span>
                                                </td>
                                                <td style="border-top:1px solid #ccc"><span
                                                        style="font-size:15px; font-weight: bold;">${result[0].TotalFare}</span>
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
        // let msg = ""
        // var travelDate = await formatHotelDateTime(result[0].departure_date)
        // console.log(travelDate, "travelDate")
        // if (result[0].booking_source === "B2B") {
        //     msg = `
        //     Dear ${PassengerDetails[0].first_name} ${PassengerDetails[0].middle_name} ${PassengerDetails[0].last_name} 
        //     Thank you for chooshing Tripoflight. 
        //     Holiday Name : ${result[0].package_name}
        //     City : ${result[0].city}
        //     Booking ID: ${result[0].Booking_Id}
        //     Booking Status: ${result[0].status}
        //     Your Tripoflight Ref No : ${result[0].app_reference}.
        //     Travel Date : ${travelDate}
        //     Tripoflight Help Line : ${TLNTRIP_HELPLINE_NUMBER}`
        // } else if (result[0].booking_source === "B2C") {
        //     msg = `
        //     Dear ${PassengerDetails[0].first_name ? PassengerDetails[0].first_name : ''} ${PassengerDetails[0].middle_name ? PassengerDetails[0].middle_name : ''} ${PassengerDetails[0].last_name ? PassengerDetails[0].last_name : ''} 
        //     Thank you for chooshing Tripoflight. 
        //     Holiday Name : ${result[0].package_name}
        //     City : ${result[0].city}
        //     Booking ID: ${result[0].Booking_Id}
        //     Booking Status: ${result[0].status}
        //     Your Tripoflight Ref No : ${result[0].app_reference}.
        //     Travel Date : ${travelDate}
        //     Tripoflight Help Line : ${TLNTRIP_HELPLINE_NUMBER}`
        // }
        // console.log(msg)
        // // const sendSmsResponse = this.commonService.sendSMS(msg , PassengerContactInfo.phone_code+PassengerContactInfo.phone)
        // // if(sendSmsResponse)
        // // const udh_content = btoa("HeaderTEST")
        // const username = `${SMS_USERNAME}`
        // const password = `${SMS_PASSWORD}`
        // const contactInfo = JSON.parse(result[0].attributes)[1];
        // const to = contactInfo.PhoneCode + contactInfo.Contact;
        // // const from = `${SMS_FROM}`
        // // var url = `https://http.myvfirst.com/smpp/sendsms?username=${username}&password=${password}&to=${to}&udh=${udh_content}&from=${from}&text=${msg}&dlr-url=http://54.198.46.240:4008/b2b/common/dlrurl`
        // var givenUrl = `${SMS_URL}?username=${username}&pass=${password}&sender=${SMS_FROM}&gsm=${to}&smstext=${msg}&int=1`
        // await this.httpService.get(givenUrl, {
        //     headers: {
        //         'Accept': 'application/json',
        //         'Accept-Language': 'en',
        //     }
        // }).toPromise();
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
}
