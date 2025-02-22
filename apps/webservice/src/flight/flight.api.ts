import { BaseApi, client, gql, omitDeep } from "../base.api";
import { BaseCountry } from "../constants";
import * as moment from 'moment';
export abstract class FlightApi extends BaseApi {

    protected airline_codes: any = [];
	protected airport_codes: any = [];
	protected AirportCodeList = [];
	protected AirlineCodeList = [];

    constructor() {
        super();
    }

    
	async getAirlines(): Promise<any> {
		const codes = this.AirlineCodeList.join(",");
		const flightAirlines = await this.getGraphData(
			`query {
            flightAirlines(where: {
                code:{in: "${codes}"}
              },take:10000) {
                id
                name
                code
                weight
            }
        }`,
			"flightAirlines"
		);
		return flightAirlines;
	}

    async getSearchAirlines(): Promise<any> {
		// const codes = this.AirlineCodeList.join(",");
        
		// const flightAirlines = await this.getGraphData(
		// 	`query {
        //         flightAirlines(take:895) {
        //         id
        //         name
        //         code
        //         weight
        //     }
        // }`,
		// 	"flightAirlines"
		// );
		// return flightAirlines;

        const query = `SELECT id,name,code,weight FROM flight_airlines`
        this.airline_codes = this.manager.query(query)
		return this.airline_codes;
	}

	async getAirports(): Promise<any> {
		const codes = this.AirportCodeList.join(",");
		this.airport_codes = await this.getGraphData(
			`query {
            flightAirports(where: {
                code:{in: "${codes}"}
              }, take:10000) {
                id
                name
                code
                city
            }
        }`,
			"flightAirports"
		);
		return this.airport_codes;
	}
    async getSearchAirports(): Promise<any> {

        const query = `SELECT id,name,code,city FROM flight_airports`
        this.airport_codes = this.manager.query(query)
		return this.airport_codes;
	}
	getPrice(str: string) {
		if (!str) {
			return 0;
		}
		return Number(str.slice(3));
	}

	getCurrencyCode(str: string) {
		if (!str) {
			return 0;
		}
		return str.slice(0, 3);
    }
    
    
    filterArrayColumns(
        arrayName,
        keyFieldColumnName,
        columnList,
        RequiredArray = []
    ) {
        for (let j = 0; j < columnList.length; j++) {
            if (arrayName[columnList[j]]) {
                RequiredArray[arrayName[keyFieldColumnName]][columnList[j]] =
                    arrayName[columnList[j]];
            }
        }
        return RequiredArray;
    }

    airlineWiseBlockRBD(airlineCode: any, rbdList: any) {
        return true;
    }

    getKeyByValue(object: any, value: any) {
        return Object.keys(object).find((key) => object[key] === value);
    }

    convertToHoursMins(TotalMinutes: number) {
        let Days = 0;
        let Hours = Math.floor(TotalMinutes / 60);
        if (Hours > 23) {
            Days = Math.floor(Hours / 24);
            Hours = Hours - Days * 24;
        }
        const Minutes = TotalMinutes % 60;
        let label = "";
        let dur = "";
        if (Days > 0) {
            if (Days > 1) {
                label = " Days ";
            } else {
                label = " Day ";
            }
            dur += Days + label;
        }
        if (Hours > 0) {
            if (Hours > 1) {
                label = " Hrs ";
            } else {
                label = " Hr ";
            }
            dur += Hours + label;
        }
        if (Minutes > 0) {
            if (Minutes > 1) {
                label = " Mins ";
            } else {
                label = " Min ";
            }
            dur += Minutes + label;
        }
        return dur;
    }

    getCityUniversal(body: any): any {
        return {
            city_name: body.city_name,
            source: body.source
        }
    }

    getSearchUniversal(body: any): any {
        return {
            ...body
        }
    }

    getDetailsUniversal(body: any): any {
        return {

        }
    }

    submitBookUniversal(body: any): any {
        return {

        }
    }

    getApiCredentialsUniversal(body: any): any {
        return body.config;
    }
    getUniversalRecentSearch(body:any):any{
        let segments = ""
        let patch_value=""
        if(body.segments){
            segments = JSON.parse(body.segments.replace(/'/g,'"'))
        }
        if(body.patch_value){
            patch_value = JSON.parse(body.patch_value.replace(/'/g,'"'))
        }
            return {
            id:body.id,
            created_at:body.created_at,
            created_by_id:body.created_by_id,
            status:body.status,
            booking_source:body.booking_source,
            adult:body.adult,
            child:body.child,
            infant:body.infant,
            preferred_airlines:body.preferred_airlines,
            trip_type:body.journey_type,
            segments,
            patch_value
        }
    }
    async saveFlightDetails(body: any): Promise<any> {
        const result = await client.mutate({
            mutation: gql`
            mutation {
                createFlightBooking(flightBooking:{${body}}){
                    id
                }
            }`
        });
        return result.data['createFlightBooking']['id'];
    }

    async is_domestic_flight(from_loc: string | [], to_loc: any | []) {
        let query = '';
		if(Array.isArray(from_loc) || Array.isArray(to_loc)) {//Multicity
            const airport_cities: any = from_loc.concat(to_loc);
			const airport_cities_unique = airport_cities.filter((item, pos) => airport_cities.indexOf(item)== pos);
            const airport_city_codes = airport_cities_unique.join('","');
			query = `SELECT count(*) total FROM flight_airports WHERE code IN ("${airport_city_codes}") AND country != "${BaseCountry}"`;
		} else {//Oneway/RoundWay
			query = `SELECT count(*) total FROM flight_airports WHERE code IN ("${from_loc}","${to_loc}") AND country != "${BaseCountry}"`;
		}
        const data = await this.manager.query(query);
        return !Number(data[0]['total']);
    }
    

    getPassengeTypeByDOB(dob: string, adultAgeStartFrom: number = 13, childAgeStartFrom: number = 3) {
        const AGE = moment().diff(dob, 'years');
        let result = {};
        if (AGE >= adultAgeStartFrom) {
            result = { text: 'Adult', id: 1};
        } else if(AGE >= childAgeStartFrom) {
            result = { text: 'Child', id: 2 };
        } else {
            result = { text: 'Infant', id: 3 };
        }
        return { ...result, age: AGE };
    }

    getMonthsByDOB(dob: string, adultAgeStartFrom: number = 13, childAgeStartFrom: number = 3) {
        const AGE = moment().diff(dob, 'months');
        let result = {};
        if (AGE >= adultAgeStartFrom) {
            result = { text: 'Adult', id: 1};
        } else if(AGE >= childAgeStartFrom) {
            result = { text: 'Child', id: 2 };
        } else {
            result = { text: 'Infant', id: 3 };
        }
        return { ...result, age: AGE };
    }

}