import { MailerService } from "@nestjs-modules/mailer";
import { Body, HttpService, Injectable } from "@nestjs/common";
import * as moment from 'moment';
import { InjectPdf, PDF } from "nestjs-pdf";
import { getExceptionClassByCode } from "../../all-exception.filter";
import { CommonService } from "../../common/common/common.service";
import { ExchangeRate_1_USD_to_BDT, HOPPA_B2C_USERNAME, HOPPA_B2C_PASSWORD, HOPPA_B2B_USERNAME, HOPPA_B2B_PASSWORD, HOPPA_TRANSFER_URL, HOPPA_TRANSFER_BOOKING_SOURCE, SUPPORT_EMAIL } from "../../constants";
import { PaymentGatewayService } from "../../payment-gateway/payment-gateway.service";
import { RedisServerService } from "../../shared/redis-server.service";
import { TransferApi } from "../transfer.api";
import { formatHotelDateTime } from "../../app.helper";
// const convertCurrency = require('nodejs-currency-converter');

@Injectable()
export class TransferDbService extends TransferApi {

    constructor(private redisServerService: RedisServerService,
        private readonly httpService: HttpService,
        private readonly mailerService: MailerService,
        private readonly commonService: CommonService,
        @InjectPdf() private readonly pdf: PDF
    ) {
        super();
    }

    async CityList(@Body() body: any): Promise<any> {

        let query = `SELECT *
        FROM hoppa_locations
        WHERE location_name LIKE '${body.Name}%'  ORDER BY location_type ;`

        const result = await this.manager.query(query);
        for (const res of result) {
            res.BookingSource = HOPPA_TRANSFER_BOOKING_SOURCE
        }
        return result;
    }

    async CityDetailsById(@Body() FromId: any, ToId:any ): Promise<any> {
        let result:any=[];
        let query = `SELECT *
        FROM hoppa_locations
        WHERE id = ${FromId};`

        result['From'] = await this.manager.query(query);

        let query2 = `SELECT *
        FROM hoppa_locations
        WHERE id = ${ToId};`

        result['To'] = await this.manager.query(query2);
     
        return result;
    }

    async CityDetailsByCode(@Body() FromCode: any, ToCode:any ): Promise<any> {
        let result:any=[];
        let query = `SELECT location_name
        FROM hoppa_locations
        WHERE code = '${FromCode}';`

        result['From'] = await this.manager.query(query);

        let query2 = `SELECT location_name
        FROM hoppa_locations
        WHERE code = '${ToCode}';`

        result['To'] = await this.manager.query(query2);
     
        return result;
    }

    async Categories(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/masters/categories?fields=ALL&language=en`;
            const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();
            if (data.length > 1) {
                let query = `DELETE FROM hotelbeds_transfer_categories;`
                const result = await this.manager.query(query);
            }
            let query = '';
            for (const item of data) {
                query += `INSERT INTO hotelbeds_transfer_categories (masterTransferTypeCode, masterCategoryCode, name, description) VALUES (
                    '${item.masterTransferTypeCode}',
                    '${item.masterCategoryCode}',
                    '${item.name}',
                    '${item.description}'
                );\n`;
            }
            const result = await this.manager.query(query);
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async TransferTypes(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/masters/transferTypes?fields=ALL&language=en`;
            const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();
            if (data.length > 1) {
                let query = `DELETE FROM hotelbeds_transfer_types;`
                const result = await this.manager.query(query);
            }
            let query = '';
            for (const item of data) {
                query += `INSERT INTO hotelbeds_transfer_types (code, name, description) VALUES (
                    '${item.code}',
                    '${item.name}',
                    '${item.description}'
                );\n`;
            }
            const result = await this.manager.query(query);
            return result;
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Vehicles(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/masters/vehicles?fields=ALL&language=en`;
            const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

            let query = '';
            if (data.length > 1) {
                let query = `DELETE FROM hotelbeds_transfer_vehicles;`
                const result = await this.manager.query(query);
            }

            for (const item of data) {
                query += `INSERT INTO hotelbeds_transfer_vehicles (masterTransferTypeCode, masterCategoryCode, masterVehicleCode, name, description) VALUES (
                    '${item.masterTransferTypeCode}',
                    '${item.masterCategoryCode}',
                    '${item.masterVehicleCode}',
                    '${item.name}',
                    '${item.description}'
                );\n`;
            }

            if (!(query === '')) {
                const result = await this.manager.query(query);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Currencies(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/currencies?fields=ALL&language=en`;
            const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

            let query = '';
            if (data.length > 1) {
                let query = `DELETE FROM hotelbeds_transfer_currencies;`
                const result = await this.manager.query(query);
            }
            for (const item of data) {
                query += `INSERT INTO hotelbeds_transfer_currencies (code, name) VALUES (
                    '${item.code}',
                    '${item.name}'
                );\n`;
            }

            if (!(query === '')) {
                const result = await this.manager.query(query);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Pickups(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/pickups?fields=ALL&language=en`;
            const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

            let query = '';
            if (data.length > 1) {
                let query = `DELETE FROM hotelbeds_transfer_pickups;`
                const result = await this.manager.query(query);
            }
            for (const item of data) {
                query += `INSERT INTO hotelbeds_transfer_pickups (
                    code, name, hotelCode, isTerminal, companyCode, officeCode, receptiveCode,
                    serviceType, countryCode, providerCode, address, city, postalCode, zoneCode,
                    latitude, longitude, webCheckpickup
                ) VALUES (
                    ${item.code},
                    '${item.name.replace(/'/g, '')}',
                    ${item.hotelCode === null ? 'NULL' : `'${item.hotelCode}'`},
                    '${item.isTerminal}',
                    '${item.companyCode}',
                    ${item.officeCode},
                    ${item.receptiveCode},
                    '${item.serviceType}',
                    ${item.countryCode === null ? 'NULL' : `'${item.countryCode}'`},
                    ${item.providerCode},
                    ${item.address === null || item.address === ' ' ? 'NULL' : `'${item.address}'`},
                    ${item.city === null ? 'NULL' : `'${item.city}'`},
                    ${item.postalCode === null ? 'NULL' : `'${item.postalCode}'`},
                    '${item.zoneCode}',
                    ${item.latitude === null ? 'NULL' : item.latitude},
                    ${item.longitude === null ? 'NULL' : item.longitude},
                    ${item.webCheckpickup ? 'TRUE' : 'FALSE'}
                );\n`;
            }

            if (!(query === '')) {
                const result = await this.manager.query(query);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Countries(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let Transfer_URL = `${HOPPA_TRANSFER_URL}/locations/countries?fields=ALL&language=en`;
            const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

            let query = '';
            if (data.length > 1) {
                let query = `DELETE FROM hotelbeds_transfer_countries;`
                const result = await this.manager.query(query);
            }

            for (const item of data) {
                query += `INSERT INTO hotelbeds_transfer_countries (code, name) VALUES (
                    '${item.code}',
                    '${item.name}'
                );\n`;
            }

            if (!(query === '')) {
                const result = await this.manager.query(query);
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Destinations(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let query1 = `select * from hotelbeds_transfer_countries`
            const result1 = await this.manager.query(query1);

            for (const country of result1) {
                let Transfer_URL = `${HOPPA_TRANSFER_URL}/locations/destinations?fields=ALL&language=es&countryCodes=${country.code}`;
                const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

                let query = '';
                if (data.length > 1) {
                    let query = `DELETE FROM hotelbeds_transfer_destinations where countryCode = '${country.code}'`
                    const result = await this.manager.query(query);
                }
                for (const item of data) {
                    query += `INSERT INTO hotelbeds_transfer_destinations (code, name, countryCode, language) VALUES (
                        '${item.code}',
                        '${item.name.replace(/'/g, '')}',
                        '${item.countryCode}',
                        '${item.language}'
                    );\n`;
                }

                if (!(query === '')) {
                    const result = await this.manager.query(query);
                }
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Hotels(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let query1 = `select * from hotelbeds_transfer_destinations`
            // let query1 = `SELECT * FROM hotelbeds_transfer_destinations WHERE id >= 10295;`

            const result1 = await this.manager.query(query1);
            // let destination:any ={};
            // destination.code ="DEL"
            for (const destination of result1) {
                let Transfer_URL = `${HOPPA_TRANSFER_URL}/hotels?fields=ALL&language=en&destinationCodes=${destination.code}`;
                const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

                let query = '';
                if (data.length > 1) {
                    let query = `DELETE FROM hotelbeds_transfer_hotels where destinationCode = '${destination.code}'`
                    const result = await this.manager.query(query);
                }
                for (const item of data) {
                    query += `INSERT INTO hotelbeds_transfer_hotels (code, name, category, description, countryCode, destinationCode, city, latitude, longitude, chainCode, address, postalCode) VALUES (
                        '${item.code}',
                        ${item.name ? `'${item.name.replace(/'/g, '')}'` : 'NULL'},
                        '${item.category}',
                        ${item.description ? `'${item.description.replace(/'|[^\x00-\x7F]+/g, '')}'` : 'NULL'},
                        '${item.countryCode}',
                        '${item.destinationCode}',
                        '${item.city ? item.city.replace(/'/g, '') : 'NULL'}',
                        ${item?.coordinates?.latitude ?? 0.00},
                        ${item?.coordinates?.longitude ?? 0.00},
                        '${item.chainCode}',
                        ${item.address ? `'${item.address.replace(/'/g, '')}'` : 'NULL'},
                        '${item.postalCode ? item.postalCode.replace(/'/g, '') : 'NULL'}'
                    );\n`;
                }

                if (!(query === '')) {
                    const result = await this.manager.query(query);
                }
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Terminals(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            let query1 = `select * from hotelbeds_transfer_countries`
            const result1 = await this.manager.query(query1);

            for (const country of result1) {
                let Transfer_URL = `${HOPPA_TRANSFER_URL}/locations/terminals?fields=ALL&language=es&countryCodes=${country.code}`;
                const data: any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

                let query = '';
                if (data.length > 1) {
                    let query = `DELETE FROM hotelbeds_transfer_terminals where countryCode = '${country.code}'`
                    const result = await this.manager.query(query);
                }
                for (const item of data) {
                    query += `INSERT INTO hotelbeds_transfer_terminals (code, content, countryCode, latitude, longitude, language) VALUES (
                        '${item.code}',
                        '${item.content ? JSON.stringify(item.content).replace(/(\\"|')/g, '') : 'NULL'}',
                        '${item.countryCode}',
                        ${item.coordinates.latitude},
                        ${item.coordinates.longitude},
                        '${item.language}'
                    );\n`;
                }
                if (!(query === '')) {
                    const result = await this.manager.query(query);
                }
            }
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async Routes(@Body() body: any): Promise<any> {
        try {
            const axiosConfig: any = {
                headers: {
                    'Api-key': HOPPA_B2C_USERNAME,
                },
            };

            // let query1= `select * from hotelbeds_transfer_destinations`
            // const result1 = await this.manager.query(query1);

            // for( const destination of result1){
            //     let Transfer_URL = `${HOPPA_TRANSFER_URL}/routes?fields=ALL&destinationCode=${destination.code}`;
            //     const data:any = await this.httpService.get(Transfer_URL, axiosConfig).toPromise();

            //     let query = '';
            //     if(data.length>1)
            //     {
            //         let query= `DELETE FROM hotelbeds_transfer_terminals where countryCode = '${destination.code}'`
            //         const result = await this.manager.query(query);

            //         for (const item of data) {
            //             const { code, from, to } = item;
            //             const fromType = from.type;
            //             const fromCode = from.code;
            //             const toType = to.type;
            //             const toCode = to.code;

            //             query += `INSERT INTO hotelbeds_transfer_routes (code, from_type, from_code, to_type, to_code) VALUES (
            //                 '${code}',
            //                 '${fromType}',
            //                 '${fromCode}',
            //                 '${toType}',
            //                 '${toCode}'
            //             );\n`;
            //         }
            //     }

            //     if(!(query === '')){
            //      const result = await this.manager.query(query);
            //     }
            // }

            throw new Error(`400 No Routes Found`);
        }
        catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    async markupAndCommissionDetails(body: any, Totalfare: any = "") {
        let admin_markup: any = [], agent_markup: any = [], markupDetails: any = {}, commission: any = [], commissionDetails: any = {};

        if (body['UserType']) {
            if (body['UserType'] == "B2B") {
                    
                // admin_markup = await this.getTransferMarkupDetails(body, "b2b_transfer", "b2b_admin");
                // markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];

                agent_markup = await this.getTransferMarkupDetails(body, "b2b_transfer", "b2b_own");
                markupDetails.agentMarkup = agent_markup.length > 0 ? agent_markup : [];

                commission = await this.getTransferCommissionDetails(body, "b2b_transfer");
                commissionDetails.commission = commission.length > 0 ? commission : [];

                if (body["BookingSource"] == "ZBAPINO00011") {
                    admin_markup = await this.getTransferMarkupDetails(body, "b2b_transfer", "b2b_admin");
                    markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
                } else {
                    admin_markup = await this.getTransferMarkupDetails(body, "b2b_transfer", "b2b_admin");
                    markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
                }
        

            } else {
                body["UserId"] = 0;
                admin_markup = await this.getTransferMarkupDetails(body, "b2c_transfer", "b2c_admin");
                markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
            }
        } else {
            body["UserId"] = 0;
            admin_markup = await this.getTransferMarkupDetails(body, "b2c_transfer", "b2c_admin");
            markupDetails.adminMarkup = admin_markup.length > 0 ? admin_markup : [];
        }
        
        return {
            markupDetails,
            commissionDetails
        }
    }

    async getTransferCommissionDetails(searchData: any, module_type: any): Promise<any> {
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

    async getTransferMarkupDetails(searchData: any, module_type: any, markup_level: any): Promise<any[]> {
        let response: any[] = []; 
        let type = `generic`;
    
        if (searchData.UserType === 'B2B' && searchData.UserId) {
            const query = `SELECT agent_group_id FROM auth_users WHERE id = ${searchData.UserId}`;
            const agent_group = await this.manager.query(query);
            
            let agent_group_id_condition = '';
            if (agent_group && agent_group.length > 0) {
                const agent_group_id = agent_group[0].agent_group_id;
                agent_group_id_condition = `group_id: { eq: ${agent_group_id} }`;
            }

            if(markup_level=='b2b_admin'){
                type = 'supplier';
            }
    
            const result1 = await this.getGraphData(
                `
                query {
                    coreMarkups (
                        where: {
                            module_type: {
                                 eq: "${module_type}"
                                 }
                            type: { 
                                eq: "${type}" 
                            }
                            markup_level: { 
                                eq: "${markup_level}" 
                            }
                            ${agent_group_id_condition}                            
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
    
            if (result1.length ) {
                // const api = searchData.BookingSource;
                // const supplier = result1[0].supplier;
                
                // if (supplier[api]) {
                //     let priceArray = supplier[api];
                //     if (priceArray.value && priceArray.value !== 0) {
                //         result1[0].value_type = priceArray.value_type;
                //         result1[0].value = Number(priceArray.value);
                //     }
                    
                //     if (supplier[api].country) {  
                //         const countryMarkup = supplier[api].country;
                //         const MarkupCountry = searchData.MarkupCountry;
    
                //         if (countryMarkup[MarkupCountry]) {
                //             priceArray = countryMarkup[MarkupCountry];
                //             if (priceArray.value && priceArray.value !== 0) {
                //                 result1[0].value_type = priceArray.value_type;
                //                 result1[0].value = Number(priceArray.value);
                //             }
                //         }
                //     }
    
                //     if (supplier[api].city) {
                //         const cityMarkup = supplier[api].city;
                //         const MarkupCity = searchData.MarkupCity;
    
                //         if (cityMarkup[MarkupCity]) {
                //             priceArray = cityMarkup[MarkupCity];
                //             if (priceArray.value && priceArray.value !== 0) {
                //                 result1[0].value_type = priceArray.value_type;
                //                 result1[0].value = Number(priceArray.value);
                //             }
                //         }
                //     }
                // }
    
                response = [result1[0]]; 
            } else {
                const result2 = await this.getGraphData(
                    `
                    query {
                        coreMarkups (
                            where: {
                                module_type: { 
                                    eq: "${module_type}"
                                 }
                                markup_level: { 
                                    eq: "${markup_level}" 
                                }
                                auth_user_id: {
                                     in: "0,${searchData.UserId}" 
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
                    `, 
                    'coreMarkups'
                );
                return result2; 
            }
            
            return response; 
        } else{    
        const result = await this.getGraphData(
            `
            query {
                coreMarkups (
                    where: {
                        module_type: { 
                            eq: "${module_type}" 
                        }
                        markup_level: { 
                            eq: "${markup_level}"
                         }
                        auth_user_id: { 
                            in: "1"
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
    }

    async Voucher(body: any) {
        const bookingDetails = await this.getGraphData(
            `query {
                    transferBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
                        payment_mode
                        payment_status
                        pay_later
                        paid_mode
                        convinence_value
                        convinence_value_type
                        convinence_per_pax
                        convinence_amount
                        promo_code
                        discount
                        currency
                        currency_conversion_rate
                        attributes
                        booking_details
                        outbound_notes
                        inbound_notes
                        created_by_id
                    }
                }
                `,
            "transferBookingDetails"
        );

        const query3 = `select * from transfer_booking_itinerary_details WHERE app_reference = "${body.AppReference}"`;
        const bookingItinerary = await this.manager.query(query3);

        const query4 = `select * from transfer_booking_pax_details WHERE app_reference = "${body.AppReference}"`;
        const paxDetails = await this.manager.query(query4);
        if(bookingDetails[0].booking_details != null){
        bookingDetails[0].booking_details=JSON.parse(bookingDetails[0].booking_details.replace(/'/g, '"'));
        }
        bookingDetails[0].NoOfPax = paxDetails.length;
        return {
            BookingDetails: bookingDetails[0],
            BookingItineraryDetails: bookingItinerary[0],
            BookingPaxDetails: paxDetails
        }
    }

    async emailTransferDetails(body) {
        const bookingDetails = await this.getGraphData(
            `query {
                    transferBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
                        payment_mode
                        convinence_value
                        convinence_value_type
                        convinence_per_pax
                        convinence_amount
                        promo_code
                        discount
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id
                        created_at
                    }
                }
                `,
            "transferBookingDetails"
        );

        const query1 = `select * from transfer_booking_itinerary_details WHERE app_reference = "${body.AppReference}"`;
        const query2 = `select * from transfer_booking_pax_details WHERE app_reference = "${body.AppReference}"`;
    
        const result = await this.manager.query(query1);
        const resultPassengers = await this.manager.query(query2);
    
        let subjectString = ""
        let mailObject: any
        let attchment: any;
        console.log("++++++++++++++++")
        console.log(result)
        console.log("++++++++++++++++")
        console.log(resultPassengers)
        console.log("++++++++++++++++")

        const attribute = bookingDetails[0].attributes.replace(/'/g, '"');
        const Bookattrribute = JSON.parse(attribute);
        // const priceDetails = JSON.parse(result[0].flightBookingTransactions[0].attributes)
        // const created_by_id = result[0].created_by_id
    
        // let itinerariesHtml = ""
        // itineraries.forEach((element, index) => {
        //     itinerariesHtml = itinerariesHtml + ` <span style="display:block; font-size: 13px; padding-left:0%">
        // ${element.room_type_name}
        // </span> `
        // })
        const filename = bookingDetails[0].app_reference;
        let PassengerDetails = resultPassengers;
        let passengerDataHtml = ""
        let PassengerData = []

        const booking247Logo = process.env.NODE_ENV == "LOCAL" || process.env.NODE_ENV == "UAT"
      ? "http://54.198.46.240/booking247/supervision/assets/images/login-images/l-logo.png"
      : "https://www.booking247.com/supervision/assets/images/login-images/l-logo.png";
        
        // let PassengerContactInfo = PassengerDetails.pop()
        PassengerDetails.forEach((element, index) => {
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

        const { cc } = await this.getEmailConfig();
    
        if (bookingDetails[0].status === "BOOKING_CONFIRMED" || bookingDetails[0].status === "BOOKING_HOLD") {
            subjectString = `TRANSFER BOOKING DETAILS : ${bookingDetails[0].app_reference}`
            
            // await this.pdf({
            //     filename: "./voucher/transfer/" + filename + ".pdf",
            //     template: "transfer",
            //     viewportSize: {
            //         width: 1500
            //     },
            //     locals: {
            //         transferInfo: bookingDetails[0],
            //         app_reference: bookingDetails[0].app_reference,
            //         PassengerDetails,
            //         booked_on: bookingDetails[0].created_at.split("T")[0],
            //         images: Bookattrribute.ProductImage,
            //         totalFareSum: result[0].total_fare,
            //         currency: bookingDetails[0].currency,
            //         location: result[0].location,
            //     },
            // });
    
    
            // attchment = {
            //     filename: `${bookingDetails[0].app_reference}.pdf`,
            //     contentType: "application/pdf",
            //     path:
            //         process.cwd() +
            //         "/voucher/transfer/" + filename +
            //         ".pdf",
            // }
            
            mailObject = {
                // to: `${result[0].email}`,
                to: `${bookingDetails[0].email}`,
                cc,
                from: `"Booking247" <${SUPPORT_EMAIL}>`,
                subject: subjectString,
                // attachments: [
                //     attchment
                // ],
    
            }
        }
    
        if (bookingDetails[0].status === "BOOKING_CANCELLED") {
            subjectString = `TRANSFER BOOKING CANCELLED : ${bookingDetails[0].app_reference}`
    
            mailObject = {
                to: `${bookingDetails[0].email}`,
                cc,
                from: `"Booking247" <${SUPPORT_EMAIL}>`,
                subject: subjectString,
            }
        }
        
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
                            <span>Booked Date : ${bookingDetails[0].created_at.split("T")[0]}</span>
                            <br>
                            <span>Booking Status : ${bookingDetails[0].status}</span>
                        </td>
                       </tr>
                    </table>
                </td>
            </tr>
    
            <tr>
                <td style="padding:10px 0; width:240px;">
                    <img style="width:220px; height: 140px;" src="${Bookattrribute.ProductImage}">
                </td>
                <td style="padding:10px 0; line-height:25px;">
                    <span style="display: block;">
                        <span
                            style="font-size:22px; font-weight:600;">${bookingDetails[0].product_name}</span>
                            <br>
                        <span style="font-size:14px;">${result[0].location}</span>
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
                                                <td><span>${result[0].total_fare}</span>
                                                </td>
                                            </tr>
                                            
                                            <tr>
                                                <td style="border-top:1px solid #ccc"><span
                                                        style="font-size:15px; font-weight: bold;">Total Fare</span>
                                                </td>
                                                <td style="border-top:1px solid #ccc"><span
                                                        style="font-size:15px; font-weight: bold;">${result[0].total_fare}</span>
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
            <!-- <tr>
                <td colspan="4" align="right"
                    style="padding-top:10px; font-weight: 600; line-height: 26px; font-size: 14px;">Tlntrip
                    <br>ContactNo : +880 1613080700
                </td>
            </tr>
            -->
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
          const TransferBookingDetails=await this.Voucher(body);
       
         if(TransferBookingDetails.BookingDetails.status != 'BOOKING_HOLD' || TransferBookingDetails.BookingDetails.booking_source != 'B2B' || TransferBookingDetails.BookingDetails.pay_later != 'true'){
          throw new Error("409 Pay later is not available for this Booking");  
         }else{
          const query = `UPDATE transfer_booking_details SET payment_mode = "pay_later" WHERE app_reference = "${body.AppReference}" `;
          this.manager.query(query);
         }
          
        } catch (error) {
          const errorClass: any = getExceptionClassByCode(error.message);
          throw new errorClass(error.message);
      }
       }
    
       async getPayLaterUnpaidTransferBookings(status: any, currentDate: any) {
        const query1 = `SELECT app_reference,Api_id  FROM transfer_booking_details WHERE cancel_deadline LIKE '${currentDate}%'  AND booking_source = 'B2B' AND payment_mode = 'pay_later' AND payment_status='Not Paid'  AND status='${status}' AND paid_mode IS NULL`

    const UnpaidBookingDetails = await this.manager.query(query1);
    const result = UnpaidBookingDetails[0];
        return result;
    }
}