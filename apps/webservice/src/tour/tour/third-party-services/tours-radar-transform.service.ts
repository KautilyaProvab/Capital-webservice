import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT, ExchangeRate_1_GBP_to_USD, ExchangeRate_1_EUR_to_USD, TR_SIGHTSEEING_BOOKING_SOURCE } from "apps/webservice/src/constants";
import { RedisServerService } from "../../../shared/redis-server.service";
import { TourApi } from "../../tour.api";
import { TourDbService } from "../tour-db.service";
import { getExceptionClassByCode } from "../../../all-exception.filter";

@Injectable()
export class ToursRadarTransformService extends TourApi {

    constructor(private readonly redisServerService: RedisServerService,
        private tourDbService: TourDbService) {
        super();
    }

    async SearchResponseFormat(data: any, body: any, exchangeRate:any, apiCurrencyExchangeRate:any ): Promise<any> {


        const markupDetail: any = await this.tourDbService.markupDetails(body);

        
        //  const tourList = JSON.parse(data);   
        const publishedData = await Promise.all(
            data.map(async (element: any) => {


                let imgString: string = '';
                element.images.forEach((img, key) => {
                    if (key != 0) {
                        imgString += ',';
                    }

                    imgString += img.url;
                });
                let cityList = [];
                element.destinations.cities.forEach(city => {
                    cityList.push(city.city_name);
                });

                if (element.prices != null) {

                    const markupAndCommission = JSON.parse(JSON.stringify(markupDetail));
                    //Converting USD to GBP
                    element.prices.price_total = Number((element.prices.price_total*apiCurrencyExchangeRate).toFixed(2));
                    //Converting GBP to User Currency
                    element.prices.price_total = Number((element.prices.price_total*exchangeRate).toFixed(2));
                    
                    const markupDetails = await this.markupDetails(markupAndCommission, element.prices.price_total, exchangeRate);
                   
                    if (body.UserType === "B2B") {
                        element.prices.markupDetails = JSON.parse(JSON.stringify(markupDetails));

             
                        element.prices.ex_adult_airliner_price = Number((element.prices.price_total + markupDetails.AdminMarkup + markupDetails.AgentMarkup ).toFixed(2));
                        
                        element.prices.AgentNetFare = Number((element.prices.price_total + markupDetails.AdminMarkup ).toFixed(2));
                        element.prices.Amount = element.prices.price_total;
                        element.prices.Currency = body.Currency;
                    } else if (body.UserType === "B2C") {
                        element.prices.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                        element.prices.ex_adult_airliner_price = Number(parseFloat(Number(element.prices.price_total) + markupDetails.AdminMarkup).toFixed(2));
                        element.prices.AgentNetFare = Number(parseFloat(element.prices.price_total + markupDetails.AdminMarkup).toFixed(2));
                    
                        element.prices.Amount = element.prices.price_total;
                        element.prices.Currency = body.Currency;
                    }
                    // element.prices.ex_adult_airliner_price = element.prices.price_total;
                    // element.prices.Currency = element.prices.currency;



                    let formatedPrice = [];

                    formatedPrice.push(element.prices);
                    let res = {
                        "id": element.tour_id,
                        "package_name": element.tour_name,
                        "duration": element.tour_length_days+' Days',
                        "banner_image": element.images[0].thumbnail_url,
                        "package_description": element.description,
                        "status": 1,
                        "module_type": "Holiday",
                        "inclusions": "",
                        "exclusions": "",
                        "optional_tours": "",
                        "terms": "",
                        "gallery": imgString,
                        "highlights": "",
                        "canc_policy": "",
                        "trending": 0,
                        "tours_country": element.destinations.countries[0].country_name,
                        "tours_country_list": element.destinations.countries,
                        "tours_continent": "",
                        "theme": [],
                        "startCity": element.start_city.city_name,
                        "endCity": element.end_city.city_name,
                        "placesCovered": cityList,
                        "inclusionsChecks": [],
                        "tourPrice": formatedPrice,
                        "BookingSource": TR_SIGHTSEEING_BOOKING_SOURCE
                    }

                    const token = await this.redisServerService.geneateResultToken(body);
                    const response = await this.redisServerService.insert_record(token, JSON.stringify(res));
                    res["ResultIndex"] = response["access_key"];
                    return res;
                }
            })
        );

        return publishedData;
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

    async TourDetailsFormat(data: any, body: any): Promise<any> {

        
        let imgString: string = '';
        data.images.forEach((img, key) => {
            if (key != 0) {
                imgString += ',';
            }

            imgString += img.url;
        });
        let cityList = [];

        data.destinations.cities.forEach(city => {
            cityList.push(city.city_name);
        });

        let itineraryList = [];
        let visitingDay = 0;
        data.itinerary.forEach(ele => {
            let itinerary_cityname = '';
            if (ele.locations[0]) {
                itinerary_cityname = ele.locations[0].city_name;
            }
            visitingDay += ele.duration;
            const itinerary = {
                "id": ele.order,
                "visited_city_day": visitingDay,
                "program_title": ele.title,
                "program_des": ele.description,
                "CityName": itinerary_cityname
            };
            itineraryList.push(itinerary)
        });

        let inclusion = ``;
        let exclusion = ``;
        let inclusionsChecks = [];
        let is_instant_confirmable = data.is_instant_confirmable;

        if (data.services.guide) {

            data.services.guide.forEach(guide => {
                if (guide.is_included) {
                    inclusion += guide.description;
                    inclusionsChecks.push('guide');
                } else {
                    exclusion += guide.description;
                }
            });

        }
        let food_options = [];
        if (data.services.meals) {

            data.services.meals.forEach(meals => {
                if (meals.is_included) {
                    inclusion += meals.description;
                    inclusionsChecks.push('meals');
                } else {
                    exclusion += meals.description;
                }

                food_options.push(meals.food_options)
            });

        }

        if (data.services.others) {

            data.services.others.forEach(others => {
                if (others.is_included) {
                    inclusion += others.description;
                    inclusionsChecks.push('others');
                } else {
                    exclusion += others.description;
                }
            });

        }

        if (data.services.flights) {

            data.services.flights.forEach(flights => {
                if (flights.is_included) {
                    inclusion += flights.description;
                    inclusionsChecks.push('flights');
                } else {
                    exclusion += flights.description;
                }
            });

        }

        if (data.services.optional) {

            data.services.optional.forEach(optional => {
                if (optional.is_included) {
                    inclusion += optional.description;
                    inclusionsChecks.push('optional');
                } else {
                    exclusion += optional.description;
                }
            });

        }

        if (data.services.insurance) {

            data.services.insurance.forEach(insurance => {
                if (insurance.is_included) {
                    inclusion += insurance.description;
                    inclusionsChecks.push('insurance');
                } else {
                    exclusion += insurance.description;
                }
            });

        }

        if (data.services.transport) {

            data.services.transport.forEach(transport => {
                if (transport.is_included) {
                    inclusion += transport.description;
                    inclusionsChecks.push('transport');
                } else {
                    exclusion += transport.description;
                }
            });

        }

        if (data.services.accommodation) {

            data.services.accommodation.forEach(accommodation => {
                if (accommodation.is_included) {
                    inclusion += accommodation.description;
                    inclusionsChecks.push('accommodation');
                } else {
                    exclusion += accommodation.description;
                }
            });

        }


        let tourDetails = {
            "id": data.tour_id,
            "package_name": data.tour_name,
            "duration": data.tour_length_days+' Days',
            "banner_image": data.images[0].thumbnail_url,
            "package_description": data.description,
            "operator_id":data.operator.id,
            "operator_name":data.operator.name,
            "status": 1,
            "module_type": "Holiday",
            "inclusions": inclusion,
            "exclusions": exclusion,
            "optional_tours": "",
            "terms": "",
            "gallery": imgString,
            "highlights": "",
            "canc_policy": "",
            "trending": 0,
            "age_range":data.age_range,
            "tours_country": data.destinations.countries[0].country_name,
            "tours_country_list": data.destinations.countries,
            "tours_continent": "",
            "theme": [],
            "startCity": data.start_city.city_name,
            "endCity": data.end_city.city_name,
            "placesCovered": cityList,
            "inclusionsChecks": inclusionsChecks,
            "tourPrice": data.departure_dates,
            "BookingSource": TR_SIGHTSEEING_BOOKING_SOURCE,
            "EnquiryForm": 0,
            "BookNow": 1,
            "departure_months": data.departure_months,
            "itinerary": itineraryList,
            "is_instant_confirmable": is_instant_confirmable,
            "food_options": food_options,
            "paxPriceDetails":data.paxPriceDetails.price_categories

        }
        const token = await this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(tourDetails));
        tourDetails["ResultIndex"] = response["access_key"];

        return tourDetails;
    }

    async ValuationFormat(data: any, parseData: any, body:any , ValuationRequest:any): Promise<any>{
        let valuatedPrice = [];
        const markupDetail: any = await this.tourDbService.markupDetails(body);
        const markupAndCommission = JSON.parse(JSON.stringify(markupDetail));
        let currencyDetails: any
        if (body.Currency && body.Currency != "GBP") {
            currencyDetails = await this.tourDbService.formatPriceDetailToSelectedCurrency(body.Currency)
        } else {
            currencyDetails = {
                value: 1,
                currency: "GBP"
            }
        }
        let ApicurrencyDetails = await this.tourDbService.formatPriceDetailToSelectedCurrency(data.prices.currency);
        const apiCurrencyExchangeRate = ApicurrencyDetails.value;
        const exchangeRate=currencyDetails.value;
         //Converting USD to GBP
         data.prices.price_total = Number((data.prices.price_total*apiCurrencyExchangeRate).toFixed(2));
         //Converting GBP to User Currency
         data.prices.price_total = Number((data.prices.price_total*exchangeRate).toFixed(2));

        const markupDetails = await this.markupDetails(markupAndCommission, data.prices.price_total, exchangeRate);

        if (body.UserType === "B2B") {
            data.prices.markupDetails = JSON.parse(JSON.stringify(markupDetails));

            data.prices.adult_airliner_price = Number((data.prices.price_total + markupDetails.AdminMarkup + markupDetails.AgentMarkup).toFixed(2));
            data.prices.AgentNetFare = Number((data.prices.price_total + markupDetails.AdminMarkup).toFixed(2));
            data.prices.Amount = data.prices.price_total;
            data.prices.Currency = body.Currency;
        } else if (body.UserType === "B2C") {
            data.prices.markupDetails = JSON.parse(JSON.stringify(markupDetails));
            data.prices.adult_airliner_price = Number(parseFloat(Number(data.prices.price_total) + markupDetails.AdminMarkup).toFixed(2));
            data.prices.AgentNetFare = Number(parseFloat(data.prices.price_total + markupDetails.AdminMarkup).toFixed(2));

            data.prices.Amount = data.prices.price_total;
            data.prices.Currency = body.Currency;
        }
            valuatedPrice.push({
                id: data.id,
                adult_airliner_price: data.prices.adult_airliner_price,
                child_airliner_price: 0,
                departure_type: data.departure_type,
                is_instant_confirmable:data.is_instant_confirmable,
                dep_date: data.date,
                ApiCurrency: data.prices.currency,
                Currency: data.prices.Currency,
                markupDetails: data.prices.markupDetails,
                AgentNetFare : data.prices.AgentNetFare,
                Amount : data.prices.Amount
              });
              console.log("operator_id-",parseData.operator_id);
        let bookingField = await this.tourDbService.getOperatorsBookingField(parseData.operator_id);

        parseData.tourPrice=valuatedPrice;
        parseData.accommodations=data.prices.accommodations;
        parseData.ValuationRequest= ValuationRequest;
        parseData.bookingField= JSON.parse(bookingField[0].booking_fields);     
        const token = await this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(parseData));
        parseData["ResultIndex"] = response["access_key"];
        delete(parseData.ValuationRequest);
              return parseData;
    }

    async departureDatesFormat(data: any, body: any): Promise<any> {

        let departure_date_list = [];
        const markupDetail: any = await this.tourDbService.markupDetails(body);
        let currencyDetails: any
            if (body.Currency && body.Currency != "GBP") {
                currencyDetails = await this.tourDbService.formatPriceDetailToSelectedCurrency(body.Currency)
            } else {
                currencyDetails = {
                    value: 1,
                    currency: "GBP"
                }
            }

            const exchangeRate=currencyDetails.value;
            let ApicurrencyDetails = await this.tourDbService.formatPriceDetailToSelectedCurrency(data[0][0].prices.currency);
            const apiCurrencyExchangeRate = ApicurrencyDetails.value;
        
            for (let i = 0; i < data.length; i++) {
            const dateData = data[i];
            
            for (let j = 0; j < dateData.length; j++) {
                const element = dateData[j];
        
                const markupAndCommission = JSON.parse(JSON.stringify(markupDetail));
                 //Converting USD to GBP
                 element.prices.price_total = Number((element.prices.price_total*apiCurrencyExchangeRate).toFixed(2));
                 //Converting GBP to User Currency
                 element.prices.price_total = Number((element.prices.price_total*exchangeRate).toFixed(2));

                const markupDetails = await this.markupDetails(markupAndCommission, element.prices.price_total, exchangeRate);
        
                if (body.UserType === "B2B") {
                    element.prices.markupDetails = JSON.parse(JSON.stringify(markupDetails));
        
                    element.prices.ex_adult_airliner_price = Number((element.prices.price_total + markupDetails.AdminMarkup + markupDetails.AgentMarkup).toFixed(2));
                    element.prices.AgentNetFare = Number((element.prices.price_total + markupDetails.AdminMarkup).toFixed(2));
                    element.prices.Amount = element.prices.price_total;
                    element.prices.Currency = body.Currency;
                } else if (body.UserType === "B2C") {
                    element.prices.markupDetails = JSON.parse(JSON.stringify(markupDetails));
                    element.prices.ex_adult_airliner_price = Number(parseFloat(Number(element.prices.price_total) + markupDetails.AdminMarkup).toFixed(2));
                    element.prices.AgentNetFare = Number(parseFloat(element.prices.price_total + markupDetails.AdminMarkup).toFixed(2));
        
                    element.prices.Amount = element.prices.price_total;
                    element.prices.Currency = body.Currency;
                }
        
                if (element.prices) {
                    let departure_date = {
                        "id": element.id,
                        "adult_airliner_price": element.prices.ex_adult_airliner_price,
                        "child_airliner_price": 0,
                        "departure_type": element.departure_type,
                        "is_instant_confirmable": element.is_instant_confirmable,
                        "dep_date": element.date,
                        "ApiCurrency": element.prices.currency,
                        "Currency": body.Currency,
                        "markupDetails": element.prices.markupDetails,
                        "AgentNetFare": element.prices.AgentNetFare,
                        "Amount": element.prices.Amount,
                    };
                    departure_date_list.push(departure_date);
                }
            }
        }
        
        
        return departure_date_list;
    }

    


}