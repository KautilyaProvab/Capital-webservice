import { Injectable, HttpService } from "@nestjs/common";
import { SearchDao, SearchDto, DetailsDto, DetailsDao, AvailabilityDto, AvailabilityDao, BlockDto, BlockDao, BookDto, BookDao } from "../swagger";
import { viatorUrl, viatorApiKey, logStoragePath, activityApiKey, secret, activityApiKeyB2B, secretB2B, BASE_CURRENCY, HB_ACTIVITY_URL, HB_ACTIVITY_CONTENT_URL } from "../../../constants";
import { ActivityApi } from "../../activity.api";
import * as moment from "moment";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import * as  CryptoJS from 'crypto-js';
import { ActivityDbService } from "../activity-db.service";
import { getExceptionClassByCode } from "../../../all-exception.filter";



@Injectable()
export class HotelBedsActivity extends ActivityApi {

    constructor(
        private httpService: HttpService,
        private redisServerService: RedisServerService,
        private ActivityDbService: ActivityDbService,

    ) {
        super()
    }



    async generateSignature(publicKey, privateKey) {
        const utcDate = Math.floor(new Date().getTime() / 1000);
        const assemble = publicKey + privateKey + utcDate;
        const hash = CryptoJS.SHA256(assemble).toString(CryptoJS.enc.Hex);
        return hash;
    };

    async activityHeader(publicKey, signature) {
        const headers = {
            'Api-key': publicKey,
            'X-Signature': signature,
            'Content-Type': 'application/json',
        };
        return headers
    }


    async getCountryCode(): Promise<any> {
        let arr = []
        const url = `${HB_ACTIVITY_CONTENT_URL}/languages`;


        let signature = await this.generateSignature(activityApiKey, secret);
        let headers = await this.activityHeader(activityApiKey, signature)
        const languageData: any = await this.httpService.get(url, { headers }).toPromise()

        if (languageData.languages) {
            await Promise.all(languageData.languages.map(async (ln) => {
                let languageData = await this.manager.query(`Select * from hb_activity_languages_list where language_code = "en"`);
                if (Array.isArray(languageData) && languageData.length === 0) {
                    let obj = {
                        language_code: ln.code,
                        language: ln.name
                    }
                    await this.manager.query(`INSERT INTO hb_activity_languages_list SET ?`, [obj]);
                }

                const url = `${HB_ACTIVITY_CONTENT_URL}/countries/en`
                let signature = await this.generateSignature(activityApiKey, secret);
                let headers = await this.activityHeader(activityApiKey, signature)
                const CountryData: any = await this.httpService.get(url, { headers }).toPromise();

                if (!CountryData.error) {
                    if (CountryData.countries && CountryData.countries.length) {
                        CountryData.countries.map(async (e) => {
                            let countryData = await this.manager.query(`Select * from hb_activity_countries where country_code = "${e.code}"`);
                            if (Array.isArray(countryData) && countryData.length === 0) {
                                let countryObj = {
                                    country_code: e.code,
                                    country_name: e.name.toUpperCase()
                                }

                                await this.manager.query(`INSERT INTO hb_activity_countries SET ?`, [countryObj]);

                            }

                        })
                    }
                    arr.push(CountryData)
                }
            }))
        }

        return arr
    }

    async InsertDestination(body: any): Promise<any> {
        try {
            let result = await this.manager.query(`Select country_code from hb_activity_countries  `);
            result.map(async (e) => {
                const destination_url = `${HB_ACTIVITY_CONTENT_URL}/destinations/en/${e.country_code}`
                let signature = await this.generateSignature(activityApiKey, secret);
                let headers = await this.activityHeader(activityApiKey, signature)
                const DestinationData: any = await this.httpService.get(destination_url, { headers }).toPromise();

                if (this.isLogXml) {
                    const fs = require('fs');
                    fs.writeFileSync(`${logStoragePath}/hotels/activity/activityDestinationRS.json`, JSON.stringify(DestinationData));
                }


                if (!DestinationData.error) {
                    if (DestinationData.country) {
                        await Promise.all(DestinationData.country.destinations.map(async (destination) => {
                            let InsertDataObj = {
                                country_code: DestinationData.country?.code ?? '',
                                destination_code: destination?.code ?? '',
                                destination_name: destination?.name ?? '',
                                hb_activity_count: null
                            }

                            let destinationData = await this.manager.query(`Select * from hb_activity_destination where  destination_code = "${destination.code}" `);
                            if (destinationData && !destinationData.length) {
                                await this.manager.query(`INSERT INTO hb_activity_destination SET ?`, [InsertDataObj]);
                            }
                        }))
                    }
                    else {
                        throw new Error('DestinationData Country is not available');
                    }
                }
                else {
                    return DestinationData.error
                }

            })
        }
        catch (err) {
            return err
        }



    }

    async getDestByName(body: any): Promise<any> {
        const query1 = `SELECT DISTINCT  origin , destination_name , destination_code , "ZBAPINO00003" as  booking_source  FROM hb_activity_destination WHERE destination_name LIKE('${body.Name}%') order by destination_name asc `;
        const result = await this.manager.query(query1);
        return result.map(t => {

            let data = {
                origin: t?.origin ?? '',
                destination_name: t.destination_name,
                destination_id: '',
                destination_type: 'CITY',
                timeZone: '',
                iataCode: t?.destination_code ?? '',
                lat: '',
                lng: '',
                BookingSource: t?.booking_source ?? ''
            }
            return data

        });
    }


    getAllDates(from, to) {
        const startDate = new Date(from);
        const endDate = new Date(to);
        const dateArray = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dateArray.push(moment(new Date(d).toISOString().split('T')[0]).format('DD-MM-YYYY'));
        }
        return dateArray;
    }

    // async search(body: any): Promise<any> {
    //     // try {
    //     const url = `${HB_ACTIVITY_URL}/activities/?activateMigration=True`;
    //     let signature = await this.generateSignature(activityApiKey, secret);
    //     let headers = await this.activityHeader(activityApiKey, signature)

    //     const reqData = {
    //         filters: [
    //             {
    //                 searchFilterItems: [
    //                     {
    //                         type: "destination",
    //                         value: body.destination
    //                     }
    //                 ]
    //             }
    //         ],
    //         from: body.from,
    //         to: body.to,
    //         language: 'en',
    //         pagination: {
    //             itemsPerPage: 99,
    //             page: 1
    //         },
    //         order: 'DEFAULT'
    //     };

    //     let search: any = await this.httpService.post(url, reqData, { headers }).toPromise();

    //     if (this.isLogXml) {
    //         const fs = require('fs');
    //         fs.writeFileSync(`${logStoragePath}/activity/activitySearchREQ.json`, JSON.stringify(reqData));
    //         fs.writeFileSync(`${logStoragePath}/activity/activitySearchRS.json`, JSON.stringify(search));
    //     }

    //     let paxes = [];
    //     if (body.paxes[0].adultCount > 0) {
    //         for (let i = 1; i <= body.paxes[0].adultCount; i++) {
    //             let age = Math.floor(Math.random() * 70) + 30;
    //             let obj = { age };
    //             paxes.push(obj);
    //         }
    //     }


    //     if (body.paxes[0].childCount > 0) {
    //         for (let i = 1; i <= body.paxes[0].childCount; i++) {
    //             let age = Math.floor(Math.random() * 12) + 1;
    //             let obj = { age };
    //             paxes.push(obj);
    //         }
    //     }



    //     let markup: any;
    //     if (body['UserType'] && body['UserId']) {
    //         markup = await this.ActivityDbService.getMarkupDetails(body['UserType'], body['UserId']);
    //     }

    //     let Conversion_Rate = 1
    //     let currencyDetails;
    //     if (body.Currency && body.Currency != BASE_CURRENCY) {
    //         currencyDetails = await this.ActivityDbService.formatPriceDetailToSelectedCurrency(body.Currency)
    //         Conversion_Rate = currencyDetails['value']

    //     }



    //     if (!search.errors) {
    //         let dataFormat = []
    //         search.activities.map((activity) => {

    //             let price = activity.amountsFrom[0].amount * body.paxes[0].adultCount

    //             let obj = {
    //                 ProductName: activity.name,
    //                 ProductCode: activity.code,
    //                 ImageUrl: activity.content.media.images[0].urls[0].resource,
    //                 ImageHisUrl: activity.content.media.images[0].urls[3].resource,
    //                 BookingEngineId: '',
    //                 Promotion: false,
    //                 PromotionAmount: 0,
    //                 ReviewCount: '',
    //                 countryCode: activity?.countryCode ?? '',
    //                 DestinationName: activity.country.destinations[0].name,
    //                 Price: {
    //                     TotalDisplayFare: price * Conversion_Rate,
    //                     GSTPrice: 0,
    //                     PriceBreakup: {
    //                         AgentCommission: '',
    //                         AgentTdsOnCommision: ''
    //                     },
    //                     // Currency: activity.currency
    //                     Currency: body.Currency,
    //                     markupDetails: {
    //                         AdminMarkup: 0,
    //                         AgentMarkup: 0
    //                     }

    //                 },
    //                 Description: activity.content.description,
    //                 Cancellation_available: activity.modalities[0].freeCancellation,
    //                 Cat_Ids: [],
    //                 Sub_Cat_Ids: [],
    //                 Supplier_Code: "",
    //                 StarRating: '',
    //                 Duration: activity.content.scheduling.duration ? `${activity.content.scheduling.duration.value} ${activity.content.scheduling.duration.metric} ${activity.content.scheduling.duration.type} ` : '',
    //                 ResultToken: "",
    //                 BookingSource: body.booking_source,
    //                 paxes: paxes,
    //                 from: body.from,
    //                 to: body.to,
    //                 CheckInDates : this.getAllDates(body.from , body.to ) ,
    //                 language: 'en',
    //                 userId: body?.UserId ?? 0,
    //                 userType: body?.UserType ?? ''
    //             }
    //             if (markup && markup.markup_currency == obj['Price']['Currency']) {
    //                 if (markup.value_type == 'percentage') {
    //                     let percentVal = (obj['Price']['TotalDisplayFare'] * markup['value']) / 100;
    //                     obj['Price']['markupDetails']['AdminMarkup']=percentVal;
    //                     obj['Price']['TotalDisplayFare'] += percentVal;
    //                     obj['Price']['TotalDisplayFare'] = parseFloat(obj['Price']['TotalDisplayFare'].toFixed(2));
    //                 } else if (markup.value_type == 'plus') {
    //                     obj['Price']['markupDetails']['AdminMarkup']=markup['value'];
    //                     obj['Price']['TotalDisplayFare'] += markup['value'];
    //                 }
    //             }
    //             dataFormat.push(obj)
    //             console.log('====================================');
    //             console.log(obj);
    //             console.log('====================================');
    //         })

    //         const token = this.redisServerService.geneateResultToken(body);
    //         const resultData = Promise.all(
    //             dataFormat.map(async (x) => {
    //                 const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
    //                 delete x.CheckInDates
    //                 return {
    //                     ...x,
    //                     ResultIndex: response["access_key"]
    //                 }
    //             })
    //         )
    //         if ((await resultData).length > 0) {
    //             return await resultData;
    //         }
    //         else {
    //             return [];
    //         }

    //     }


    // }

    async search(body: any): Promise<any> {
        try {
            const url = `${HB_ACTIVITY_URL}/activities/availability`;
            // ?activateMigration=True
            if (body.UserType === 'b2c') {
                body.UserType = 'B2C'
            }

            let activityKey = '';
            let activitySecret = '';
            if (body.UserType == 'B2B') {
                activityKey = activityApiKeyB2B;
                activitySecret = secretB2B;
            } else {
                activityKey = activityApiKey;
                activitySecret = secret;
            }
            let signature = await this.generateSignature(activityKey, activitySecret);
            let headers = await this.activityHeader(activityKey, signature);
            let Adultage = [];
            if (body.paxes[0].adultCount > 0) {
                for (let i = 1; i <= body.paxes[0].adultCount; i++) {
                    let age = Math.floor(Math.random() * 23) + 18;
                    Adultage.push({ age });
                }
            }
            let childAgeArr = []
            if (body.paxes[0].childCount > 0) {
                body.paxes[0].ChildAge.forEach((child) => {
                    let obj = {
                        age: child
                    }
                    childAgeArr.push(obj)
                })
            }
            let AddPaxes = Adultage.concat(childAgeArr)   
            console.log("AddPaxes-",AddPaxes);
            const reqData = {
                filters: [
                    {
                        searchFilterItems: [
                            {
                                type: "destination",
                                value: body.destination
                            }
                        ]
                    }
                ],
                from: body.from,
                to: body.to,
                paxes: AddPaxes,
                language: 'en',
                pagination: {
                    itemsPerPage: 99,
                    page: 1
                },
                order: 'DEFAULT'
            };

            let search: any = await this.httpService.post(url, reqData, { headers }).toPromise();
            console.log("search-",search);
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/activity/activitySearchREQ.json`, JSON.stringify(reqData));
                fs.writeFileSync(`${logStoragePath}/activity/activitySearchRS.json`, JSON.stringify(search));
            }

           

            let createdById
            if (body.UserId) {
                createdById = body.UserId
            }

            let markup: any;
            if (body['UserType']) {
                markup = await this.ActivityDbService.getMarkupDetails(body['UserType'], body['UserId'], body);
            }

            let Conversion_Rate = 1;
            let currencyDetails;
            if (body.Currency && body.Currency != BASE_CURRENCY) {
                currencyDetails = await this.ActivityDbService.formatPriceDetailToSelectedCurrency(body.Currency);
                Conversion_Rate = currencyDetails['value'];
            }

            let totalPaxCount = body.paxes[0].adultCount +  body.paxes[0].childCount
         
 
            if (!search.errors) {
                let dataFormat = [];
                for (const activity of search.activities) {

                    //  let Price = 0
                    //     body.paxes[0].ChildAge.forEach((childage)=>{
                    //           activity.amountsFrom.forEach((age)=>{
                    //             if (age.ageFrom <= childage && childage <= age.ageTo   ) {
                    //                 Price += age.amount 
                    //             }               
                    //       })
                    //     })
                    //     Adultage.forEach((adultAge)=>{
                    //         activity.amountsFrom.forEach((age)=>{
                    //           if (age.ageFrom <= adultAge.age && adultAge.age <= age.ageTo) {
                    //               Price += age.amount    
                    //           }               
                    //     })
                    //   })


                    let Price = 0;
                    // body.paxes[0].ChildAge.forEach((childage) => {
                    //     let applicableRanges = activity.amountsFrom.filter(
                    //         age => age.ageFrom <= childage && childage <= age.ageTo
                    //     );

                    //     let childRange = applicableRanges.find(age => age.paxType === "CHILD");
                    //     if (childRange) {
                    //         Price += childRange.amount;
                    //     } else {
                    //         let adultRange = applicableRanges.find(age => age.paxType === "ADULT");
                    //         if (adultRange) {
                    //             Price += adultRange.amount;
                    //         }
                    //     }
                    // });

                    // Adultage.forEach((adultAge) => {
                    //     activity.amountsFrom.forEach((age) => {
                    //         if (age.ageFrom <= adultAge.age && adultAge.age <= age.ageTo) {
                    //             Price += age.amount
                    //         }
                    //     })
                    // })

                    // let price = activity.amountsFrom[0].amount * body.paxes[0].adultCount;

                    let Category: any = []
                    let Services: any = []
                    let Recommendedactivity: any = []
                    let EndPoints: any = []
                    let StartingPoints: any = []
                    let DurationFilter: any = []
                    let groupMap: any = {}

                    if (activity?.content?.segmentationGroups && activity?.content?.segmentationGroups.length) {
                        activity?.content?.segmentationGroups.map((segment) => {
                            if (segment.segments && segment.segments.length) {
                                segment.segments.map((data) => {
                                    if (segment.name === 'Services') {
                                        Services.push(data.name);
                                    }

                                    if (segment.name === 'Categories') {
                                        Category.push(data.name);
                                    }

                                    if (segment.name === 'Recommended activity for') {
                                        Recommendedactivity.push(data.name);
                                    }

                                    if (segment.name === 'Daytime') {
                                        DurationFilter.push(data.name);
                                    }
                                });
                            }
                        });
                    }

                    if (activity?.content?.featureGroups && activity?.content?.featureGroups.length) {
                        const Drinks: any = { included: [], excluded: [] };
                        const Unknown: any = { included: [], excluded: [] };
                        const Transport: any = { included: [], excluded: [] };
                        const Meal: any = { included: [], excluded: [] };
                        const TICKET: any = { included: [], excluded: [] };
                        const MATERIAL: any = { included: [], excluded: [] };

                        groupMap = {
                            DRINKS: Drinks,
                            UNKNOWN: Unknown,
                            TRANSPORT: Transport,
                            MEAL: Meal,
                            TICKET: TICKET,
                            MATERIAL: MATERIAL
                        };

                        activity.content.featureGroups.forEach((group) => {
                            const currentGroup = groupMap[group.groupCode];

                            if (currentGroup) {
                                if (group.excluded?.length) {
                                    currentGroup.excluded = group.excluded.map((exclude) => exclude.description ? exclude.description.replace(/\//g, '') : '');
                                }
                                if (group.included?.length) {
                                    currentGroup.included = group.included.map((include) => include.description ? include.description.replace(/\//g, '') : '');
                                }
                            }
                        });
                    }

                    if (activity?.content?.location) {
                        if (activity?.content?.location?.endPoints && activity?.content?.location?.endPoints.length) {
                            activity?.content?.location?.endPoints.map((endpoint) => {
                                EndPoints.push(endpoint.description ? endpoint.description.replace(/\//g, '') : '');
                            });
                        }

                        if (activity?.content?.location?.startingPoints && activity?.content?.location?.startingPoints.length) {
                            activity?.content?.location.startingPoints.map((startingpoints) => {
                                if (startingpoints.pickupInstructions && startingpoints.pickupInstructions.length) {
                                    startingpoints.pickupInstructions.map((points) => {
                                        StartingPoints.push(points.description ? points.description.replace(/\//g, '') : '');
                                    });
                                }
                            });
                        }
                    }

                    const getMinTotalAmount = (data) => {
                        let minAmount = Infinity;
                    
                        // Iterate over each item in the data array
                        data.forEach(item => {
                            item.rates.forEach(rate => {
                                rate.rateDetails.forEach(detail => {
                                    const totalAmount = detail.totalAmount.amount;
                                    if (totalAmount < minAmount) {
                                        minAmount = totalAmount;
                                    }
                                });
                            });
                        });
                    
                        return minAmount;
                    };
                    
                    Price = getMinTotalAmount(activity.modalities);
                    console.log("totalAmount-",Price);
                  
                    let obj = {
                        ProductName: activity.name,
                        ProductCode: activity.code,
                        ImageUrl: activity?.content?.media?.images[0]?.urls[0]?.resource ?? '',
                        ImageHisUrl: activity?.content?.media?.images[0]?.urls[3]?.resource ?? '',
                        BookingEngineId: '',
                        Promotion: false,
                        PromotionAmount: 0,
                        ReviewCount: '',
                        countryCode: activity?.countryCode ?? '',
                        DestinationName: activity?.country?.destinations[0]?.name ?? '',
                        Price: {
                            TotalDisplayFare: parseFloat((Price * Conversion_Rate).toFixed(2)),
                            GSTPrice: 0,
                            PriceBreakup: {
                                AgentCommission: '',
                                AgentTdsOnCommision: ''
                            },
                            Currency: body.Currency,
                            markupDetails: {
                                AdminMarkup: 0,
                                AgentMarkup: 0
                            }
                        },
                        Description: activity?.content?.description.replace(/\//g, '') ?? '',
                        Cancellation_available: activity?.modalities[0]?.freeCancellation ?? '',
                        Cat_Ids: [],
                        Sub_Cat_Ids: [],
                        Supplier_Code: "",
                        StarRating: '',
                        Duration: activity.content.scheduling.duration ? `${activity?.content?.scheduling?.duration.value} ${activity?.content?.scheduling?.duration.metric}` : '',
                        ResultToken: "",
                        BookingSource: body.booking_source,
                        paxes: AddPaxes,
                        from: body.from,
                        to: body.to,
                        Category: Category ? Category : [],
                        Services: Services ? Services : [],
                        Recommendedactivity: Recommendedactivity ? Recommendedactivity : [],
                        DurationFilter: DurationFilter ? DurationFilter : [],
                        StartingPoints: StartingPoints ? StartingPoints : [],
                        EndPoints: EndPoints ? EndPoints : [],
                        CheckInDates: this.getAllDates(body.from, body.to),
                        language: activity?.content?.language ?? 'en',
                        userId: createdById ? createdById : '',
                        GroupService: groupMap,
                        userType: body?.UserType ?? '',
                        totalPaxCount : totalPaxCount,
                        body,
                    };
                    // if (markup && markup.markup_currency === obj['Price']['Currency']) {

                    //     if (markup.value_type === 'percentage') {
                    //         let percentVal = parseFloat(((obj['Price']['TotalDisplayFare'] * markup['value']) / 100).toFixed(2));
                    //         obj['Price']['markupDetails']['AdminMarkup'] = percentVal;
                    //         obj['Price']['TotalDisplayFare'] = parseFloat((obj['Price']['TotalDisplayFare'] + percentVal).toFixed(2));
                    //     } else if (markup.value_type === 'plus') {
                    //         obj['Price']['markupDetails']['AdminMarkup'] = parseFloat((markup['value']).toFixed(2));
                    //         obj['Price']['TotalDisplayFare'] = parseFloat((obj['Price']['TotalDisplayFare'] + markup['value']).toFixed(2));
                    //     }
                    // }

                    let markupAndCommissionDetails = await this.ActivityDbService.markupAndCommissionDetails(body);

                    let markupDetails = await this.markupDetails(markupAndCommissionDetails, obj['Price']['TotalDisplayFare'], Conversion_Rate);
                    search.activities.forEach(activity => {
                        if (activity.modalities) {
                            activity.modalities.forEach(modality => {
                                modality.amountsFrom.forEach(priceInfo => {
                                    if (!priceInfo.hasOwnProperty('markupApplied') || priceInfo.markupApplied === false) {
                                        priceInfo.amount += markupDetails.AdminMarkup;
                                        priceInfo.markupApplied = true;
                                        console.log(`Updated Amount for ${priceInfo.paxType}:`, priceInfo.amount);
                                    }
                                });
                            });
                        }
                    });

                    if (body.UserType === "B2B") {
                        obj['Price']['markupDetails']['AdminMarkup'] += markupDetails.AdminMarkup;
                        obj['Price']['markupDetails']['AgentMarkup'] += markupDetails.AgentMarkup;
                        obj['Price']['TotalDisplayFare'] = parseFloat((obj['Price']['TotalDisplayFare'] + markupDetails.AdminMarkup + markupDetails.AgentMarkup).toFixed(2));
                        obj['Price']['AgentNetFare'] = parseFloat((obj['Price']['TotalDisplayFare'] - markupDetails.AgentMarkup).toFixed(2));
                        obj['Price']['PriceBreakup']['AgentCommission'] = markupAndCommissionDetails.commissionDetails.commission || 0;
                    } else if (body.UserType === "B2C") {
                        obj['Price']['markupDetails']['AdminMarkup'] += markupDetails.AdminMarkup;
                        obj['Price']['TotalDisplayFare'] = parseFloat((obj['Price']['TotalDisplayFare'] + markupDetails.AdminMarkup).toFixed(2));
                        obj['Price']['TotalDisplayFare'] = parseFloat((obj['Price']['TotalDisplayFare']).toFixed(2));
                    }
                    dataFormat.push(obj);
                }


                const token = this.redisServerService.geneateResultToken(body);
                const resultData = await Promise.all(
                    dataFormat.map(async (x) => {
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
                        delete x.CheckInDates;
                        return {
                            ...x,
                            ResultIndex: response["access_key"]
                        }
                    })
                );

                if (resultData.length > 0) {
                    return resultData;
                } else {
                    return [];
                }
            }

        } catch (error) {
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
                markup.value = parseFloat((markup.value).toFixed(2));
                if (markup.value_type === "plus") {
                    AdminMarkup += markup.value;
                } else if (markup.value_type === "percentage") {
                    AdminMarkup += (totalFare * markup.value) / 100
                }
            });
        }

        if (markupDetails.agentMarkup && markupDetails.agentMarkup.length > 0) {
            markupDetails.agentMarkup.forEach((markup: any) => {
                markup.value = parseFloat((markup.value).toFixed(2));
                if (markup.value_type === "plus") {
                    AgentMarkup += (markup.value + AdminMarkup);
                } else if (markup.value_type === "percentage") {
                    AgentMarkup += ((totalFare + AdminMarkup) * markup.value) / 100
                }
            });
        }

        return {
            AdminMarkup,
            AgentMarkup
        }
    }

    // async ProductDetails(body: any): Promise<any> {
    //     try {

    //         let data = await this.redisServerService.read_list(body.ResultToken);
    //         data = JSON.parse(data[0]);
    //         let activityKey = ``;
    //         let activitySecret = ``;
    //         if (body.UserType == 'B2B') {
    //             activityKey = activityApiKeyB2B;
    //             activitySecret = secretB2B;
    //         } else {
    //             activityKey = activityApiKey;
    //             activitySecret = secret;
    //         }
    //         const url = `${HB_ACTIVITY_URL}/activities/details/full`;
    //         const signature = await this.generateSignature(activityKey, activitySecret);
    //         const headers = await this.activityHeader(activityKey, signature);
   

    //         if(data.paxes.length !== data.totalPaxCount ){
    //            throw Error (`totalPaxCount is not matching `)
    //         }

            
          
    //         const reqData = {
    //             code: data.ProductCode,
    //             from: data.from,
    //             to: data.to,
    //             language: "en",
    //             paxes: data.paxes
    //         };

    //         let result: any;
    //         try {
    //             result = await this.httpService.post(url, reqData, { headers }).toPromise();
    //         } catch (apiError) {
    //             console.error('Error calling activity API:', apiError);
    //             throw new Error('Error fetching activity details');
    //         }


    //         if (this.isLogXml) {
    //             const fs = require('fs');
    //             fs.writeFileSync(`${logStoragePath}/activity/activityDetailsRQ.json`, JSON.stringify(reqData));
    //             fs.writeFileSync(`${logStoragePath}/activity/activityDetailsRS.json`, JSON.stringify(result));
    //         }

    //         if (result.activity) {
    //             let ContentImage = result.activity.content.media.images
    //             let rateDetails = result?.activity?.modalities[0]?.rates[0]?.rateDetails ?? ''
    //             let rateClass = result?.activity?.modalities[0]?.rates[0]?.rateClass ?? ''
    //             let Refundable =`false`;
    //             if(rateClass == 'NOR'){
    //                 Refundable ='true';
    //             }else{
    //                 Refundable ='false';
    //             }
    //             let language = data?.language ?? 'en';

    //             let questions = result.activity.modalities[0].questions

    //             let ProductPhoto = []
    //             let userImg = []
    //             ContentImage.map((e) => {
    //                 let ProductImg = {
    //                     productTitle: result.activity.content?.name ?? '',
    //                     ImageTitle: "",
    //                     ImageCaption: "",
    //                     photoHiResURL: e.urls[3]?.resource  ?? '',
    //                     photoURL: e.urls[0]?.resource ?? ''
    //                 }
    //                 ProductPhoto.push(ProductImg)

    //                 let userPhoto = {
    //                     caption: "",
    //                     editorsPick: '',
    //                     ownerAvatarURL: "",
    //                     ownerCountry: "",
    //                     ownerId: "",
    //                     ownerName: "",
    //                     photoHiResURL: "",
    //                     photoId: "",
    //                     photoMediumResURL: e.urls[1]?.resource ?? '',
    //                     photoURL: e.urls[3]?.resource ?? '',
    //                     productCode: data.ProductCode ? data.ProductCode : '',
    //                     productTitle: data.ProductName ? data.ProductName : '',
    //                     productUrlName: data.ProductName ? data.ProductName : '',
    //                     sortOrder: '',
    //                     sslSupported: '',
    //                     thumbnailURL: e.urls[0]?.resource ?? '',
    //                     timeUploaded: "",
    //                     title: result.activity.content?.name ?? ''
    //                 }

    //                 userImg.push(userPhoto)
    //             })

    //             let Product_Tourgrade = []
    //             let rate_langauges = []
    //             let Cancellation__Policy: any
    //             rateDetails.map(async (rate) => {
    //             rate.languages.map((language)=>{
    //                 rate_langauges.push(language.description)
    //             })
                       
    //                 // Cancellation__Policy = `If you cancel at least ${rate.operationDates.length}(s) in advance of the scheduled departure, there is no cancellation fee. If you cancel within ${rate.operationDates.length} day(s) of the scheduled departure, there is a 100 percent cancellation fee.`
    //                 const cancelPolicy = rate.operationDates.flatMap(operation =>
    //                     operation.cancellationPolicies.map(policy => {
    //                         const cancellationDates = new Date(policy.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    //                         const amounts = policy.amount;
    //                         return `If cancelled on or after ${cancellationDates}, an amount of ${amounts} is chargeable.`;
    //                     })
    //                 ).join(' ');
    //                 console.log("cancelPolicy",cancelPolicy);

    //                 //- days for cancellatiion_policy

    //                 const daysQuery = `SELECT days FROM cancellation_capping WHERE module = 'activity'`;
    //                 const daysResponse = await this.manager.query(daysQuery);

    //                 function subtractDays(dateString, days) {
    //                     let date = new Date(dateString);
    //                     date.setDate(date.getDate() - days);
    //                     return date.toISOString().split('T')[0]; 
    //                 }

    //                 let new_cancellation_policy = rate.operationDates.map(item => {
    //                     item.from = subtractDays(item.from, daysResponse[0].days);
    //                     item.to = subtractDays(item.to, daysResponse[0].days);
                    
    //                     item.cancellationPolicies.forEach(policy => {
    //                         policy.dateFrom = subtractDays(policy.dateFrom, daysResponse[0].days);
    //                     });
    //                     return item
    //                 });
    //                 Cancellation__Policy = new_cancellation_policy.flatMap(operation =>
    //                     operation.cancellationPolicies.map(policy => {
    //                         const cancellationDate = new Date(policy.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    //                         const amount = policy.amount;
    //                         return `If cancelled on or after ${cancellationDate}, an amount of ${amount} is chargeable.`;
    //                     })
    //                 ).join(' ');
    //                 console.log("Cancellation__Policy",Cancellation__Policy);

    //                 let Conversion_Rate = 1
    //                 let currencyDetails;
    //                 if (data['Price']['Currency'] && data['Price']['Currency'] != BASE_CURRENCY) {
    //                     currencyDetails = await this.ActivityDbService.formatPriceDetailToSelectedCurrency(data['Price']['Currency'])
    //                     Conversion_Rate = currencyDetails['value']
    //                 }
    //                 let tourGrade = {
    //                     sortOrder: '',
    //                     currencyCode: data.countryCode ? data.countryCode : '',
    //                     gradeTitle: rate.sessions && rate.sessions.length ? `${result.activity?.name} ${rate.sessions[0].name}` : '',
    //                     gradeCode: rate.sessions && rate.sessions.length ? `DEFAULT~${rate.sessions[0]?.code ?? ''} ` : '',
    //                     gdradeDescription: result.activity?.name ?? '',
    //                     langServices: {
    //                         [`${language.code}/${language.description}_ONLY`]: language.description
    //                     },
    //                     gradeDepartureTime: rate.sessions && rate.sessions.length ? rate.sessions[0]?.code ?? '' : '',
    //                     priceFrom: "",
    //                     priceFromFormatted: "",
    //                     merchantNetPriceFrom: "",
    //                     merchantNetPriceFromFormatted: "",
    //                     defaultLanguageCode: "en",
    //                     Price: data.Price

    //                 }

    //                 Product_Tourgrade.push(tourGrade)
    //             })

    //             let questionsArr = []
    //             if (questions && questions.length) {
    //                 questions.map((que) => {
    //                     let question = {
    //                         sortOrder: '',
    //                         stringQuestionId: "",
    //                         questionId: que?.code ?? '',
    //                         subTitle: que?.text ?? '',
    //                         message: que?.text ?? '',
    //                         required: que?.required ?? null
    //                     }
    //                     questionsArr.push(question)
    //                 })
    //             }
    //             else {
    //                 questionsArr
    //             }

    //             let productDetails = {
    //                 ProductName: data.ProductName ? data.ProductName : '',
    //                 ReviewCount: data.ReviewCount ? data.ReviewCount : '',
    //                 product_image: data.ImageUrl ? data.ImageUrl : '',
    //                 StarRating: data.Promotion ? data.Promotion : '',
    //                 Promotion: false,
    //                 Duration: data.Duration ? data.Duration : '',
    //                 ProductCode: data.ProductCode ? data.ProductCode : '',
    //                 ProductPhotos: ProductPhoto,
    //                 Product_Video: "",
    //                 Product_Reviews: [],
    //                 Product_Tourgrade: Product_Tourgrade,
    //                 Product_available_date: data?.CheckInDates ?? [],
    //                 Cancellation_available: data.Cancellation_available ? data.Cancellation_available : false,
    //                 Cancellation_day: '',
    //                 Cancellation_Policy: Cancellation__Policy,
    //                 Refundable:Refundable,
    //                 BookingEngineId: "",
    //                 Voucher_req: "",
    //                 Tourgrade_available: "",
    //                 UserPhotos: userImg,
    //                 Product_AgeBands: [],
    //                 rate_langauges ,
    //                 BookingQuestions: questionsArr,
    //                 Highlights: result.activity.content.highligths,
    //                 SalesPoints: [],
    //                 TermsAndConditions: null,
    //                 MaxTravellerCount: '',
    //                 Itinerary: "",
    //                 VoucherOption: "",
    //                 VoucherOption_List: "",
    //                 AdditionalInfo: [],
    //                 Inclusions: [],
    //                 DepartureTime: "",
    //                 DeparturePoint: "",
    //                 DepartureTimeComments: "",
    //                 ReturnDetails: "",
    //                 Exclusions: [],
    //                 Category: data?.Category ?? [],
    //                 Services: data?.Services ?? [],
    //                 Recommendedactivity: data?.Recommendedactivity ?? [],
    //                 DurationFilter: data?.DurationFilter ?? [],
    //                 StartingPoints: data?.StartingPoints ?? [],
    //                 EndPoints: data?.EndPoints ?? [],
    //                 ShortDescription: data.Description ? data.Description : '',
    //                 Description: data.Description ? data.Description : '',
    //                 GroupService: data.GroupService ? data.GroupService : {},
    //                 AllTravellerNamesRequired: '',
    //                 Country: result.activity.country?.name ?? '',
    //                 Region: result.activity.country.destinations[0].name,
    //                 ResultIndex: "",
    //                 UserId: data?.userId ?? '',
    //                 ResultToken: body.ResultToken,
    //                 BookingSource: data.BookingSource ? data.BookingSource : 'ZBAPINO00003',
    //                 body: data.body,
    //             }

    //             // const token = this.redisServerService.geneateResultToken(body);
    //             // const response = await this.redisServerService.insert_record(token, JSON.stringify(productDetails));
    //             // productDetails.ResultToken = response.access_key;
    //             const activities = Array.isArray(result.activity) ? result.activity : [result.activity];
    //             console.log("activities.modalities:", activities[0].modalities)
    //             activities.forEach(activity => {
    //                 if (activity.modalities && Array.isArray(activity.modalities)) {
    //                     activity.modalities.forEach(modality => {
    //                         if (modality.rates && Array.isArray(modality.rates)) {
    //                             modality.rates.forEach(rate => {
    //                                 if (rate.rateDetails && rate.rateDetails[0].operationDates && Array.isArray(rate.rateDetails[0].operationDates)) {
    //                                     rate.rateDetails[0].operationDates.forEach(operationDate => {
    //                                         if (operationDate.cancellationPolicies && Array.isArray(operationDate.cancellationPolicies)) {
    //                                             operationDate.cancellationPolicies.forEach(cancellationPolicy => {
    //                                                 cancellationPolicy.amount += data.Price.markupDetails.AdminMarkup + data.Price.markupDetails.AgentMarkup;
    //                                                 console.log(`Updated Cancellation Policy Amount:`, cancellationPolicy.amount);
    //                                             });
    //                                         }
    //                                     });
    //                                 }
    //                             });
    //                         }
    //                     });
    //                 }
    //             });

    //             return productDetails
    //         } else {
    //             throw Error(`We Don't have any experiences for your request`)
    //         }


    //     }
    //     catch (err) {
    //         const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
    //         throw new errorClass(`400 ${err.message}`);
    //     }
    // }

    async ProductDetails(body: any): Promise<any> {
        try {

            let data = await this.redisServerService.read_list(body.ResultToken);
            data = JSON.parse(data[0]);
            let activityKey = ``;
            let activitySecret = ``;
            if (body.UserType == 'B2B') {
                activityKey = activityApiKeyB2B;
                activitySecret = secretB2B;
            } else {
                activityKey = activityApiKey;
                activitySecret = secret;
            }
            const url = `${HB_ACTIVITY_URL}/activities/details/full`;
            const signature = await this.generateSignature(activityKey, activitySecret);
            const headers = await this.activityHeader(activityKey, signature);


            if (data.paxes.length !== data.totalPaxCount) {
                throw Error(`totalPaxCount is not matching `)
            }

            const reqData = {
                code: data.ProductCode,
                from: data.from,
                to: data.to,
                language: "en",
                paxes: data.paxes
            };

            let result: any;
            try {
                result = await this.httpService.post(url, reqData, { headers }).toPromise();
            } catch (apiError) {
                console.error('Error calling activity API:', apiError);
                throw new Error('Error fetching activity details');
            }

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/activity/activityDetailsRQ.json`, JSON.stringify(reqData));
                fs.writeFileSync(`${logStoragePath}/activity/activityDetailsRS.json`, JSON.stringify(result));
            }

            if (result.activity) {
                let ContentImage = result.activity.content.media.images;
                let rateDetails = result?.activity?.modalities[0]?.rates[0]?.rateDetails ?? '';
                let rateClass = result?.activity?.modalities[0]?.rates[0]?.rateClass ?? '';
                let Refundable = `false`;
                if (rateClass == 'NOR') {
                    Refundable = 'true';
                } else {
                    Refundable = 'false';
                }
                let language = data?.language ?? 'en';

                let questions = result.activity.modalities[0].questions;

                let ProductPhoto = [];
                let userImg = [];
                ContentImage.map((e) => {
                    let ProductImg = {
                        productTitle: result.activity.content?.name ?? '',
                        ImageTitle: "",
                        ImageCaption: "",
                        photoHiResURL: e.urls[3]?.resource ?? '',
                        photoURL: e.urls[0]?.resource ?? ''
                    };
                    ProductPhoto.push(ProductImg);

                    let userPhoto = {
                        caption: "",
                        editorsPick: '',
                        ownerAvatarURL: "",
                        ownerCountry: "",
                        ownerId: "",
                        ownerName: "",
                        photoHiResURL: "",
                        photoId: "",
                        photoMediumResURL: e.urls[1]?.resource ?? '',
                        photoURL: e.urls[3]?.resource ?? '',
                        productCode: data.ProductCode ? data.ProductCode : '',
                        productTitle: data.ProductName ? data.ProductName : '',
                        productUrlName: data.ProductName ? data.ProductName : '',
                        sortOrder: '',
                        sslSupported: '',
                        thumbnailURL: e.urls[0]?.resource ?? '',
                        timeUploaded: "",
                        title: result.activity.content?.name ?? ''
                    };

                    userImg.push(userPhoto);
                });

                let Product_Tourgrade = [];
                let rate_langauges = [];
                let Cancellation__Policy: any;

                // Fetch days for cancellation_policy only once
                const daysQuery = `SELECT days FROM cancellation_capping WHERE module = 'activity'`;
                const daysResponse = await this.manager.query(daysQuery);

                function subtractDays(dateString, days) {
                    let date = new Date(dateString);
                    date.setDate(date.getDate() - days);
                    return date.toISOString().split('T')[0];
                }

                rateDetails.map(async (rate) => {
                    rate.languages.map((language) => {
                        rate_langauges.push(language.description);
                    });

                    const cancelPolicy = rate.operationDates.flatMap(operation =>
                        operation.cancellationPolicies.map(policy => {
                            const cancellationDates = new Date(policy.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const amounts = policy.amount;
                            return `If cancelled on or after ${cancellationDates}, an amount of ${amounts} is chargeable.`;
                        })
                    ).join(' ');
                    console.log("cancelPolicy", cancelPolicy);

                    const activities = Array.isArray(rate.operationDates) ? rate.operationDates : [rate.operationDates];
                    activities.forEach(activity => {
                    if (activity.cancellationPolicies && Array.isArray(activity.cancellationPolicies)) {
                        activity.cancellationPolicies.forEach(cancellationPolicy => {
                            if (cancellationPolicy.amount) {
                                cancellationPolicy.amount += data.Price.markupDetails.AdminMarkup + data.Price.markupDetails.AgentMarkup;
                            }
                        });
                    }
                });

                    //- days for cancellatiion_policy
                    let new_cancellation_policy = rate.operationDates.map(item => {
                        item.from = subtractDays(item.from, daysResponse[0].days);
                        item.to = subtractDays(item.to, daysResponse[0].days);

                        item.cancellationPolicies.forEach(policy => {
                            policy.dateFrom = subtractDays(policy.dateFrom, daysResponse[0].days);
                        });
                        return item;
                    });
                    const today_date = new Date();
                    const from_date = new Date(data.from)
                    const timeDifference:any = +from_date - +today_date;
                    const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

                    if (timeDifference < oneDayInMilliseconds) {
                        Cancellation__Policy = "This booking is Non-Refundable"
                    } else {
                        Cancellation__Policy = new_cancellation_policy.flatMap(operation =>
                            operation.cancellationPolicies.map(policy => {
                                const cancellationDate = new Date(policy.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const amount = policy.amount;
                                return `If cancelled on or after ${cancellationDate}, an amount of ${amount} is chargeable.`;
                            })
                        ).join(' ');
                    }
                    console.log("Cancellation__Policy", Cancellation__Policy);

                    let Conversion_Rate = 1;
                    let currencyDetails;
                    if (data['Price']['Currency'] && data['Price']['Currency'] != BASE_CURRENCY) {
                        currencyDetails = await this.ActivityDbService.formatPriceDetailToSelectedCurrency(data['Price']['Currency']);
                        Conversion_Rate = currencyDetails['value'];
                    }
                    let tourGrade = {
                        sortOrder: '',
                        currencyCode: data.countryCode ? data.countryCode : '',
                        gradeTitle: rate.sessions && rate.sessions.length ? `${result.activity?.name} ${rate.sessions[0].name}` : '',
                        gradeCode: rate.sessions && rate.sessions.length ? `DEFAULT~${rate.sessions[0]?.code ?? ''} ` : '',
                        gdradeDescription: result.activity?.name ?? '',
                        langServices: {
                            [`${language.code}/${language.description}_ONLY`]: language.description
                        },
                        gradeDepartureTime: rate.sessions && rate.sessions.length ? rate.sessions[0]?.code ?? '' : '',
                        priceFrom: "",
                        priceFromFormatted: "",
                        merchantNetPriceFrom: "",
                        merchantNetPriceFromFormatted: "",
                        defaultLanguageCode: "en",
                        Price: data.Price
                    };

                    Product_Tourgrade.push(tourGrade);
                });

                let questionsArr = [];
                if (questions && questions.length) {
                    questions.map((que) => {
                        let question = {
                            sortOrder: '',
                            stringQuestionId: "",
                            questionId: que?.code ?? '',
                            subTitle: que?.text ?? '',
                            message: que?.text ?? '',
                            required: que?.required ?? null
                        };
                        questionsArr.push(question);
                    });
                } else {
                    questionsArr;
                }

                let productDetails = {
                    ProductName: data.ProductName ? data.ProductName : '',
                    ReviewCount: data.ReviewCount ? data.ReviewCount : '',
                    product_image: data.ImageUrl ? data.ImageUrl : '',
                    StarRating: data.Promotion ? data.Promotion : '',
                    Promotion: false,
                    Duration: data.Duration ? data.Duration : '',
                    ProductCode: data.ProductCode ? data.ProductCode : '',
                    ProductPhotos: ProductPhoto,
                    Product_Video: "",
                    Product_Reviews: [],
                    Product_Tourgrade: Product_Tourgrade,
                    Product_available_date: data?.CheckInDates ?? [],
                    Cancellation_available: data.Cancellation_available ? data.Cancellation_available : false,
                    Cancellation_day: '',
                    Cancellation_Policy: Cancellation__Policy,
                    Refundable:Refundable,
                    BookingEngineId: "",
                    Voucher_req: "",
                    Tourgrade_available: "",
                    UserPhotos: userImg,
                    Product_AgeBands: [],
                    rate_langauges ,
                    BookingQuestions: questionsArr,
                    Highlights: result.activity.content.highligths,
                    SalesPoints: [],
                    TermsAndConditions: null,
                    MaxTravellerCount: '',
                    Itinerary: "",
                    VoucherOption: "",
                    VoucherOption_List: "",
                    AdditionalInfo: [],
                    Inclusions: [],
                    DepartureTime: "",
                    DeparturePoint: "",
                    DepartureTimeComments: "",
                    ReturnDetails: "",
                    Exclusions: [],
                    Category: data?.Category ?? [],
                    Services: data?.Services ?? [],
                    Recommendedactivity: data?.Recommendedactivity ?? [],
                    DurationFilter: data?.DurationFilter ?? [],
                    StartingPoints: data?.StartingPoints ?? [],
                    EndPoints: data?.EndPoints ?? [],
                    ShortDescription: data.Description ? data.Description : '',
                    Description: data.Description ? data.Description : '',
                    GroupService: data.GroupService ? data.GroupService : {},
                    AllTravellerNamesRequired: '',
                    Country: result.activity.country?.name ?? '',
                    Region: result.activity.country.destinations[0].name,
                    ResultIndex: "",
                    UserId: data?.userId ?? '',
                    ResultToken: body.ResultToken,
                    BookingSource: data.BookingSource ? data.BookingSource : 'ZBAPINO00003',
                    body: data.body,
                };
                // const activities = Array.isArray(result.activity) ? result.activity : [result.activity];
                // console.log("activities.modalities:", activities[0].modalities)
                // activities.forEach(activity => {
                //     if (activity.modalities && Array.isArray(activity.modalities)) {
                //         activity.modalities.forEach(modality => {
                //             if (modality.rates && Array.isArray(modality.rates)) {
                //                 modality.rates.forEach(rate => {
                //                     if (rate.rateDetails && rate.rateDetails[0].operationDates && Array.isArray(rate.rateDetails[0].operationDates)) {
                //                         rate.rateDetails[0].operationDates.forEach(operationDate => {
                //                             if (operationDate.cancellationPolicies && Array.isArray(operationDate.cancellationPolicies)) {
                //                                 operationDate.cancellationPolicies.forEach(cancellationPolicy => {
                //                                     cancellationPolicy.amount += data.Price.markupDetails.AdminMarkup + data.Price.markupDetails.AgentMarkup;
                //                                     console.log(`Updated Cancellation Policy Amount:`, cancellationPolicy.amount);
                //                                 });
                //                             }
                //                         });
                //                     }
                //                 });
                //             }
                //         });
                //     }
                // });
                

                return productDetails;
        } else {
            throw Error(`We Don't have any experiences for your request`);
        }

        }catch (err) {
            const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
            throw new errorClass(`400 ${err.message}`);
        }
    }

    async tripList(body: any): Promise<any> {
        try {
            let data = await this.redisServerService.read_list(body.ResultToken);
            data = JSON.parse(data[0]);

            let activityKey = body.UserType === 'B2B' ? activityApiKeyB2B : activityApiKey;
            let activitySecret = body.UserType === 'B2B' ? secretB2B : secret;

            const url = `${HB_ACTIVITY_URL}/activities/details/full`;
            const signature = await this.generateSignature(activityKey, activitySecret);
            const headers = await this.activityHeader(activityKey, signature);

            const reqData = {
                code: data.ProductCode,
                from: data.from,
                to: data.to,
                language: "en",
                paxes: data.paxes
            };

            let result: any;
            try {
                result = await this.httpService.post(url, reqData, { headers }).toPromise();
            } catch (apiError) {
                console.error('Error calling activity API:', apiError);
                throw new Error('Error fetching activity details');
            }
            let rateClass = result?.activity?.modalities[0]?.rates[0]?.rateClass ?? '';
            let Refundable ='false';
           
            if(rateClass == 'NOR'){
                Refundable ='true';
            }else{
                Refundable ='false';
            }
            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/activity/activityDetailsREQ2.json`, JSON.stringify(reqData));
                fs.writeFileSync(`${logStoragePath}/activity/activityDetailsRS2.json`, JSON.stringify(result));
            }

            let arr = [];

            if (!result.errors) {
                let rateDetailsArr = [];
                await Promise.all(result.activity.modalities.map(async (mode) => {
                    await Promise.all(mode.rates[0].rateDetails.map(async (rate) => {
                        let Conversion_Rate = 1
                        let currencyDetails;


                        if (data['Price']['Currency'] && data['Price']['Currency'] != BASE_CURRENCY) {
                            currencyDetails = await this.ActivityDbService.formatPriceDetailToSelectedCurrency(data['Price']['Currency'])
                            Conversion_Rate = currencyDetails['value']

                        }

                        console.log(mode);

                        const langServices = {
                            [`${data.language}/${rate.languages[0]?.description.toUpperCase() ?? ''}_ONLY`]: `${rate.languages[0]?.description ?? ''}`
                        };



                        const baseAmount = rate.totalAmount.amount * Conversion_Rate


                        const adminMarkup = data.Price.markupDetails.AdminMarkup || 0;
                        const agentMarkup = data.Price.markupDetails.AgentMarkup || 0;
                        // const totalAmountWithMarkup = Number(baseAmount + adminMarkup + agentMarkup);   
                        console.log(baseAmount, adminMarkup, agentMarkup, '===============before');

                        const totalDisplayFare = Number((baseAmount + adminMarkup + agentMarkup).toFixed(2));

                        console.log(totalDisplayFare, '==============after ===============');



                        let questionsArr = []
                        if (mode?.questions && mode?.questions.length ) {
                            mode.questions.map((que) => {
                                 let subtitle =  que?.text ?? ''
                                if(que.text == "Please advise the name of your hotel"){
                                  subtitle  = "Hotel Name - For Pick Up"
                                }

                                if(que.text == "Please, indicate the language you want to make the excursion, according to the available languages in the description file"){
                                  subtitle  = "Select Guide Language(Subject to availaility)"
                                }


                                let question = {
                                    sortOrder: '',
                                    stringQuestionId: "",
                                    questionId: que?.code ?? '',
                                    subTitle: subtitle.replace(/\//g, '') ?? '',
                                    message: que?.text.replace(/\//g, '') ?? '',
                                    required: que?.required ?? null
                                }
                                questionsArr.push(question)
                            })
                        }
                        else {
                            questionsArr
                        }
                        data.questions = questionsArr
                        // const activities = Array.isArray(result.activity) ? result.activity : [result.activity];
                        // activities.forEach(activity => {
                        //     if (activity.modalities && Array.isArray(activity.modalities)) {
                        //         activity.modalities.forEach(modality => {
                        //             if (modality.rates && Array.isArray(modality.rates)) {
                        //                 modality.rates.forEach(rate => {
                        //                     if (rate.rateDetails && rate.rateDetails[0].operationDates && Array.isArray(rate.rateDetails[0].operationDates)) {
                        //                         rate.rateDetails[0].operationDates.forEach(operationDate => {
                        //                             if (operationDate.cancellationPolicies && Array.isArray(operationDate.cancellationPolicies)) {
                        //                                 operationDate.cancellationPolicies.forEach(cancellationPolicy => {
                        //                                     if (!cancellationPolicy.amountHasBeenUpdated) {
                        //                                         cancellationPolicy.amount *= Conversion_Rate
                        //                                         cancellationPolicy.amount += (data.Price.markupDetails.AdminMarkup + data.Price.markupDetails.AgentMarkup);
                        //                                         cancellationPolicy.amountHasBeenUpdated = true;
                        //                                         console.log(`Updated Cancellation Policy Amount:`, cancellationPolicy.amount);
                        //                                     }
                        //                                 });
                        //                             }
                        //                         });
                        //                     }
                        //                 });
                        //             }
                        //         });
                        //     }
                        // });

                        // let Cancellation_Policy = `If you cancel at least ${rate.operationDates.length}(s) in advance of the scheduled departure, there is no cancellation fee. If you cancel within ${rate.operationDates.length} day(s) of the scheduled departure, there is a 100 percent cancellation fee.`;
                        const activities = Array.isArray(rate.operationDates) ? rate.operationDates : [rate.operationDates];
                        activities.forEach(activity => {
                        if (activity.cancellationPolicies && Array.isArray(activity.cancellationPolicies)) {
                            activity.cancellationPolicies.forEach(cancellationPolicy => {
                                if (cancellationPolicy.amount) {
                                    cancellationPolicy.amount += data.Price.markupDetails.AdminMarkup + data.Price.markupDetails.AgentMarkup;
                                }
                            });
                        }
                        });
                        let Old_Cancellation_Policy = rate.operationDates.flatMap(operation =>
                            operation.cancellationPolicies.map(policy => {
                                const cancellationDates = new Date(policy.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                const amounts = policy.amount;
                                return `If cancelled on or after ${cancellationDates}, an amount of ${amounts} is chargeable.`;
                            })
                        ).join(' ');

                        const daysQuery = `SELECT days FROM cancellation_capping WHERE module = 'activity'`;
                        const daysResponse = await this.manager.query(daysQuery);
            
                        function subtractDays(dateString, days) {
                            let date = new Date(dateString);
                            date.setDate(date.getDate() - days);
                            return date.toISOString().split('T')[0];
                        }

                        let new_cancellation_policy = rate.operationDates.map(item => {
                            // item.from = subtractDays(item.from, daysResponse[0].days);
                            // item.to = subtractDays(item.to, daysResponse[0].days);
                        
                            item.cancellationPolicies.forEach(policy => {
                                policy.dateFrom = subtractDays(policy.dateFrom, daysResponse[0].days);
                            });
                            return item;
                        });
                        let Cancellation__Policy:any

                        const today_date = new Date();
                        const from_date = new Date(data.from)
                        const timeDifference:any = +from_date - +today_date;
                        const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
    
                        if (timeDifference < oneDayInMilliseconds) {
                            Cancellation__Policy = "This booking is Non-Refundable"
                        } else {
                            Cancellation__Policy = new_cancellation_policy.flatMap(operation =>
                            operation.cancellationPolicies.map(policy => {
                            const cancellationDate = new Date(policy.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const amount = policy.amount;
                            return `If cancelled on or after ${cancellationDate}, an amount of ${amount} is chargeable.`;
                            })
                        ).join(' ');
                        }
                        console.log("Cancellation__Policy", Cancellation__Policy);

                        let PolicyArr = []
                        if (rate?.operationDates && rate?.operationDates.length) {
                            rate?.operationDates.map((addPolicy) => {
                                let addPolicyObj = {
                                    from: addPolicy?.from ?? '',
                                    to: addPolicy?.to ?? '',
                                    policy: `If cancelled on or after ${addPolicy.cancellationPolicies[0].dateFrom.split('T')[0]}, an amount of ${addPolicy.cancellationPolicies[0].amount.toFixed(2)} is chargeable.`,
                                    cancellationPolicies: addPolicy?.cancellationPolicies
                                }
                                PolicyArr.push(addPolicyObj)
                            })
                        }
                        new_cancellation_policy = new_cancellation_policy.map(day=>{
                            const cancellationDate = new Date(day.cancellationPolicies[0].dateFrom);
                            const today = new Date();
                            const timeDifference = +cancellationDate - +today;
                            if (timeDifference < oneDayInMilliseconds) {
                                day.policy = "This booking is Non-Refundable";
                            }else{
                                day.policy = day.cancellationPolicies.map(policy => {
                                    const cancellationDateFormatted = `${String(cancellationDate.getDate()).padStart(2, '0')}-${String(cancellationDate.getMonth() + 1).padStart(2, '0')}-${cancellationDate.getFullYear()}`;
                                    const amount = policy.amount;
                                    return `If cancelled on or after ${cancellationDateFormatted}, an amount of ${amount} is chargeable.`;
                                }).join(' ');  
                            }
                            return day;
                        })
                        // console.log(rate?.operationDates , '==============rate?{}.operationDates');

                        let rateData = {
                            ResultIndex: '',
                            rateKey: rate?.rateKey ?? '',
                            rateCode: mode.rates[0].rateCode,
                            rateClass: mode.rates[0].rateClass,
                            freeCancelation: mode.rates[0].freeCancelation,
                            bookingDate: moment(result.auditData.time).format('YYYY-MM-DD'),
                            AgeBandsRequired: null,
                            langServices: langServices,
                            ProductCode: result.activity.activityCode,
                            gradeCode: rate.sessions && rate.sessions.length ? `DEFAULT~${rate.sessions[0]?.code ?? ''} ` : '',
                            // grade_Title: rate.sessions && rate.sessions.length ? `${result.activity?.name} ${rate.sessions[0].name}` : '',
                            grade_Title: mode?.name ?? "",
                            gradeDescription: result.activity?.name ?? '',
                            gradeDepartureTime: rate.sessions && rate.sessions.length ? rate.sessions[0]?.code ?? '' : '',
                            language_code: data?.language ?? '',
                            available: true,
                            Agebands: [],
                            TotalPax: rate.paxAmounts.length,
                            Price: {
                                TotalDisplayFare: totalDisplayFare,
                                GSTPrice: 0,
                                PriceBreakup: {
                                    AgentCommission: 0,
                                    AgentTdsOnCommision: 0
                                },
                                Currency: data['Price']['Currency'],
                                markupDetails: {
                                    AdminMarkup: adminMarkup,
                                    AgentMarkup: agentMarkup
                                }
                            },
                            questions: data?.questions ?? [],
                            TourUniqueId: mode?.uniqueIdentifier ?? '',
                            totalAmount: rate?.totalAmount ?? '',
                            paxAmounts: rate?.paxAmounts ?? '',
                            Cancellation_Policy: Cancellation__Policy,
                            Old_Cancellation_Policy: Old_Cancellation_Policy,
                            Refundable:Refundable,
                            TermsAndConditions: null,
                            Inclusions: result.activity.content?.highligths ?? [],
                            location: '',
                            language: data?.language ?? 'en',
                            userId: data?.userId ?? '',
                            userType: data?.userType,
                            destination: data?.DestinationName ?? '',
                            from: new_cancellation_policy ?? [],
                            Oldfrom: PolicyArr ?? [],
                            activityRemark: mode?.comments ?? [],
                            Category: data?.Category ?? [],
                            Services: data?.Services ?? [],
                            Recommendedactivity: data?.Recommendedactivity ?? [],
                            DurationFilter: data?.DurationFilter ?? [],
                            StartingPoints: data?.StartingPoints ?? [],
                            EndPoints: data?.EndPoints ?? [],
                            GroupService: data.GroupService ? data.GroupService : {},
                            ProductDetails: {
                                ProductCode: result.activity?.activityCode ?? '',
                                ProductName: result.activity?.name ?? '',
                                ProductImage: data?.ImageHisUrl ?? '',
                                StarRating: '',
                                Duration: data?.Duration ?? '',
                            },
                            body: data.body,

                        };
                        const token = this.redisServerService.geneateResultToken(body);
                        const response = await this.redisServerService.insert_record(token, JSON.stringify(rateData));
                        rateData.ResultIndex = response.access_key;
                        delete rateData.ProductDetails;
                        // delete rateData.destination
                        rateDetailsArr.push(rateData);
                    }));
                }));

                const tempData = {
                    BookingSource: body.BookingSource,
                    ActivityList: rateDetailsArr,
                    ProductDetails: {
                        ProductCode: result.activity?.activityCode ?? '',
                        ProductName: result.activity?.name ?? '',
                        ProductImage: data?.ImageUrl ?? '',
                        StarRating: '',
                        Duration: data?.Duration ?? '',
                    },
                    ResultToken: '',
                    body: data.body,

                };

                const token = this.redisServerService.geneateResultToken(body);
                const response = await this.redisServerService.insert_record(token, JSON.stringify(tempData));
                tempData.ResultToken = response.access_key;
                arr.push(tempData);
            } else {
                throw new Error('API response give errors');
            }

            return arr;
        }
        catch (err) {
            const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
            throw new errorClass(`400 ${err.message}`);
        }
    }

    // async addPreviousDatesToOperationDates(result: any) {
    //     const getPreviousDates = (startDate: string, numDates: number) => {
    //         const dates = [];
    //         let currentDate = new Date(startDate);

    //         for (let i = 0; i < numDates; i++) {
    //             currentDate.setDate(currentDate.getDate() - 1);
    //             dates.push(new Date(currentDate).toISOString());
    //         }
    //         return dates;
    //     };

    //     result.activity.modalities.forEach((mode: any) => {
    //         mode.rates.forEach((rate: any) => {
    //             rate.rateDetails.forEach((rateDetail: any) => {
    //                 // Initialize arr1 and arr2 for each rateDetail
    //                 const arr1 = [...rateDetail.operationDates];
    //                 const arr2 = [];

    //                 const firstOperationDate = rateDetail.operationDates[0];
    //                 const firstCancellationPolicy = firstOperationDate.cancellationPolicies[0];

    //                 const previousDates = getPreviousDates(firstCancellationPolicy.dateFrom, 3);

    //                 previousDates.forEach((prevDate) => {
    //                     const clonedOperationDate = JSON.parse(JSON.stringify(firstOperationDate));
    //                     clonedOperationDate.from = prevDate.split('T')[0];
    //                     clonedOperationDate.to = prevDate.split('T')[0];
    //                     clonedOperationDate.cancellationPolicies[0].dateFrom = prevDate;

    //                     // Add the new operation date to arr2
    //                     arr2.push(clonedOperationDate);
    //                     // Also push the new operation date to rateDetail.operationDates
    //                     rateDetail.operationDates.push(clonedOperationDate);
    //                 });

    //                 // Attach arr1 and arr2 to rateDetail
    //                 rateDetail.arr1 = arr1;
    //                 rateDetail.arr2 = arr2;
    //             });
    //         });
    //     });

    //     return result;
    // }


    // async addPreviousDatesToOperationDates(result: any) {
    //     const getPreviousDates = (startDate: string, numDates: number) => {
    //         const dates = [];
    //         let currentDate = new Date(startDate);

    //         for (let i = 0; i < numDates; i++) {
    //             currentDate.setDate(currentDate.getDate() - 1);
    //             dates.push(new Date(currentDate).toISOString());
    //         }
    //         return dates;
    //     };

    //     result.activity.modalities.forEach((mode: any) => {
    //         mode.rates.forEach((rate: any) => {
    //             rate.rateDetails.forEach((rateDetail: any) => {
    //                 // arr1 will contain original operationDates
    //                 const arr1 = [...rateDetail.operationDates];

    //                 const firstOperationDate = rateDetail.operationDates[0];
    //                 const firstCancellationPolicy = firstOperationDate.cancellationPolicies[0];

    //                 // arr2 will store the newly created dates
    //                 const arr2 = getPreviousDates(firstCancellationPolicy.dateFrom, 3).map((prevDate) => {
    //                     const clonedOperationDate = JSON.parse(JSON.stringify(firstOperationDate));
    //                     clonedOperationDate.from = prevDate.split('T')[0];
    //                     clonedOperationDate.to = prevDate.split('T')[0];
    //                     clonedOperationDate.cancellationPolicies[0].dateFrom = prevDate;
    //                     return clonedOperationDate;
    //                 });

    //                 // Replace operationDates with arr1 and arr2 as separate properties
    //                 rateDetail.operationDates = { arr1, arr2 };
    //             });
    //         });
    //     });

    //     return result;
    // }

    async addPreviousDatesToOperationDates(result: any) {
        const getPreviousDates = (startDate: string, numDates: number) => {
            const dates = [];
            let currentDate = new Date(startDate);

            for (let i = 0; i < numDates; i++) {
                currentDate.setDate(currentDate.getDate() - 1);
                dates.push(new Date(currentDate).toISOString());
            }
            return dates;
        };

        result.activity.modalities.forEach((mode: any) => {
            mode.rates.forEach((rate: any) => {
                rate.rateDetails.forEach((rateDetail: any) => {
                    const firstOperationDate = rateDetail.operationDates[0];
                    const firstCancellationPolicy = firstOperationDate.cancellationPolicies[0];

                    // Add previous dates directly to operationDates
                    getPreviousDates(firstCancellationPolicy.dateFrom, 3).forEach((prevDate) => {
                        const clonedOperationDate = JSON.parse(JSON.stringify(firstOperationDate));
                        clonedOperationDate.from = prevDate.split('T')[0];
                        clonedOperationDate.to = prevDate.split('T')[0];
                        clonedOperationDate.cancellationPolicies[0].dateFrom = prevDate;

                        // Add the cloned operation date to the operationDates array
                        rateDetail.operationDates.push(clonedOperationDate);
                    });
                });
            });
        });

        return result;
    }



    async blockTrip(body: any): Promise<any> {
        try {
            let data = await this.redisServerService.read_list(body.ResultToken);
            data = JSON.parse(data[0]);
            
            let arr = []

            let productDatails = data.ProductDetails
            delete data.ProductDetails

            if (body.from == undefined) {
                throw Error('from is Required(YYYY-MM-DD)')
            }

            let cancellationPolicyForDate
            console.log('====================================');
            console.log("data.from:",data.from);
            console.log('====================================');
            if (data.from && data.from.length) {
                cancellationPolicyForDate = data.from.find(policy => policy.from <= body.from);
            }
            let questionArr = []
            let alreadyAnswers = []
            if (data.questions && data?.questions.length) {
                data.questions.map((question) => {
                    if (question.questionId == 'MOBILE') {
                        alreadyAnswers.push(question)
                    } else if (question.questionId == 'PHONENUMBER') {
                        alreadyAnswers.push(question)
                    } else if (question.questionId == 'EMAIL') {
                        alreadyAnswers.push(question)
                    } else {
                        questionArr.push(question)
                    }

                })
            }


            const blockData = {
                ProductName: productDatails?.ProductName ?? '',
                ProductCode: productDatails?.ProductCode ?? '',
                ProductImage: productDatails?.ProductImage ?? '',
                StarRating: productDatails?.StarRating ?? '',
                Duration: productDatails?.Duration ?? '',
                Destination: data?.destination ?? '',
                GradeCode: data?.gradeCode ?? '',
                GradeDescription: data?.gradeDescription ?? '',
                DeparturePoint: "",
                DeparturePointAddress: "",
                // BookingQuestions: data?.questions ?? [],
                BookingQuestions: questionArr ? questionArr : [],
                NoneedAnswers: alreadyAnswers ? alreadyAnswers : [],
                SupplierName: "",
                SupplierPhoneNumber: "",
                Cancellation_available: "",
                Price: data?.Price ?? {},
                TM_Cancellation_Charge: "",
                HotelPickup: "",
                hotel_pikcup_option: {},
                BlockTourId: data.rateKey,
                Cancellation_Policy: cancellationPolicyForDate.policy ?? '',
                TermsAndConditions: null,
                Category: data?.Category ?? [],
                Services: data?.Services ?? [],
                Recommendedactivity: data?.Recommendedactivity ?? [],
                DurationFilter: data?.DurationFilter ?? [],
                StartingPoints: data?.StartingPoints ?? [],
                EndPoints: data?.EndPoints ?? [],
                GroupService: data.GroupService ? data.GroupService : {},
                Inclusions: data.Inclusion,
                from: cancellationPolicyForDate ?? [],
                UserId: data?.userId ?? 0,
                BookingDate: body.from,
                Refundable:data?.Refundable ?? 'false',
                RateClass:data?.rateClass ?? '',
                BookingSource: "ZBAPINO00003",
                ResultToken: "",
                body: data.body
            };
            const token = this.redisServerService.geneateResultToken(body);
            const response = await this.redisServerService.insert_record(token, JSON.stringify(blockData));
            blockData.ResultToken = response.access_key;

            arr.push(blockData);
            return arr
        }
        catch (err) {
            const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
            throw new errorClass(`400 ${err.message}`);
        }


    }

    async ConfirmBooking(body: any): Promise<any> {
        try {
            let bookingDetails = await this.ActivityDbService.getHotelBookingDetails(body);
            let paxDetails = await this.ActivityDbService.getHotelBookingPaxDetails(body);

            let formattedRequest = this.formatReservationRequest(bookingDetails, paxDetails, body,);
            return formattedRequest
        }
        catch (err) {
            const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
            throw new errorClass(`400 ${err.message}`);
        }

    }

    async formatReservationRequest(bookingDetails: any, paxdetails: any, body: any): Promise<any> {
        try {

            let attributesData = bookingDetails.attributes.replace(/'/g, '"');
            attributesData = JSON.parse(attributesData);

            let paxArr = []
            paxdetails.map((pax) => {
                const getAge = moment().diff(moment(pax.Dob, 'YYYYMMDD'), 'years')
                let paxObj = {
                    name: pax?.first_name ?? '',
                    age: pax.Dob ? getAge : '',
                    type: pax ? pax.travellerType.toUpperCase() : '',
                    surname: pax?.last_name ?? ''
                }
                paxArr.push(paxObj)
            })
            let activityKey = ``;
            let activitySecret = ``;
            if (body.UserType == 'B2B') {
                activityKey = activityApiKeyB2B;
                activitySecret = secretB2B;
            } else {
                activityKey = activityApiKey;
                activitySecret = secret;
            }
            const AddressDetails = attributesData.ItenaryData.attributes.AddressDetails
            const rateDetails = attributesData.ItenaryData.attributes.body

            let num = Math.floor(Math.random() * 100000).toString();

            const url = `${HB_ACTIVITY_URL}/bookings`;
            const signature = await this.generateSignature(activityKey, activitySecret);
            const headers = await this.activityHeader(activityKey, signature);

            let answersArr = [];
            if (attributesData.answers?.length) {
                attributesData.answers.forEach((ans) => {
                    answersArr.push({
                        question: {
                            code: ans.questionId || '',
                            text: ans.message || ans.subTitle,
                            required: ans.required ?? null
                        },
                        answer: ans.answer
                    });
                });
            }

            let newAnswersArr = [];
            if (attributesData.NoneedAnswers?.length) {
                attributesData.NoneedAnswers.forEach((ans) => {
                    if (ans.questionId == 'MOBILE' || ans.questionId == 'PHONENUMBER') {
                        newAnswersArr.push({
                            question: {
                                code: ans.questionId || '',
                                text: ans.message || ans.subTitle,
                                required: ans.required ?? null
                            },
                            answer: AddressDetails.Contact
                        });
                    } else if (ans.questionId == 'EMAIL') {
                        newAnswersArr.push({
                            question: {
                                code: ans.questionId || '',
                                text: ans.message || ans.subTitle,
                                required: ans.required ?? null
                            },
                            answer: AddressDetails.Email
                        });
                    }
                });
            }

            let combinedAnswersArr = [...answersArr, ...newAnswersArr];



            const reqData = {
                language: "en",
                clientReference: `${rateDetails.ProductCode} -ES`,
                holder: {
                    name: AddressDetails.FirstName,
                    title: AddressDetails.Title,
                    email: AddressDetails.Email,
                    address: AddressDetails.Address,
                    zipCode: num.padStart(5, '0'),
                    mailing: true,
                    mailUpdDate: rateDetails.BookingDate,
                    country: "ES",
                    surname: AddressDetails.LastName,
                    telephones: [AddressDetails.Contact]
                },
                activities: [
                    {
                        answers: combinedAnswersArr,
                        rateKey: rateDetails.BlockTourId,
                        // from: rateDetails.from.arr1.from,
                        // from: rateDetails.from.arr1[0].from,
                        from: rateDetails.BookingDate,
                        to: rateDetails.BookingDate,
                        // to: rateDetails.from.arr1[0].to,
                        paxes: paxArr
                    }
                ]
            };

            let result: any;
            try {
                let ConfirmBookingCheck = await this.manager.query(`select status from activity_booking_details where app_reference = "${body.AppReference}"`)
                ConfirmBookingCheck = ConfirmBookingCheck[0]

                
                
                 if(ConfirmBookingCheck.status !== 'BOOKING_CONFIRMED'){
                    result = await this.httpService.put(url, reqData, { headers }).toPromise();
                 
                 if (this.isLogXml) {
                     const fs = require('fs');
                     fs.writeFileSync(`${logStoragePath}/activity/${body.AppReference}_activityConfirmBookingREQ.json`, JSON.stringify(reqData));
                     fs.writeFileSync(`${logStoragePath}/activity/${body.AppReference}_activityConfirmBookingRS.json`, JSON.stringify(result));
                 }
 
                 if (result.booking) {
                     let BookingData = result.booking
                     const bookReferenceId = BookingData.reference ? BookingData.reference : ''
 
                     const url = `${HB_ACTIVITY_URL}/bookings/en/${bookReferenceId}`;
                     const signature = await this.generateSignature(activityKey, activitySecret);
                     const headers = await this.activityHeader(activityKey, signature);
 
                     let details: any = await this.httpService.get(url, { headers }).toPromise();
 
                     if (this.isLogXml) {
                         const fs = require('fs');
                         fs.writeFileSync(`${logStoragePath}/activity/${body.AppReference}_activityBookingDetails.json`, JSON.stringify(url));
                         fs.writeFileSync(`${logStoragePath}/activity/${body.AppReference}_activityBookingDetailsRS.json`, JSON.stringify(details));
                     }
 
                     let ConfirmBookingDetails = details.booking
 
                     let updateItenary = await this.ActivityDbService.updateData(ConfirmBookingDetails, bookingDetails, body, attributesData)
                     let formatedData = await this.ActivityDbService.formatBookingRes(updateItenary, body)
 
                     return formatedData
                 }
                 else {
                     throw Error(result.errors[0].text)
                 }            
                 }else{
                    return `Booking already exist with this app_refrence ${body.AppReference}, Don't hit again `
                 }

            } catch (err) {
                const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
                throw new errorClass(` ${err.message}`);
            }

        } catch (err) {
            const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
            throw new errorClass(`${err.message}`);
        }

    }

    async bookingCancellation(body: any): Promise<any> {
        try {
            let getRefrence = await this.manager.query(`Select booking_reference,booking_source from  activity_booking_details where app_reference= "${body.AppReference}" `);
            getRefrence = getRefrence[0]
            let userType = getRefrence.booking_source;

            let activityKey = ``;
            let activitySecret = ``;
            if (userType == 'B2B') {
                activityKey = activityApiKeyB2B;
                activitySecret = secretB2B;
            } else {
                activityKey = activityApiKey;
                activitySecret = secret;
            }

            const url = `${HB_ACTIVITY_URL}/bookings/en/${getRefrence.booking_reference}?cancellationFlag=CANCELLATION`;
            const signature = await this.generateSignature(activityKey, activitySecret);
            const headers = await this.activityHeader(activityKey, signature);

            let result: any = await this.httpService.delete(url, { headers }).toPromise();

            if (this.isLogXml) {
                const fs = require('fs');
                fs.writeFileSync(`${logStoragePath}/activity/activityCancellationRQ.json`, JSON.stringify(url));
                fs.writeFileSync(`${logStoragePath}/activity/activityCancellationRS.json`, JSON.stringify(result));
            }

            if (!result.errors) {
                let ItenaryData = await this.ActivityDbService.updateCancellation(body.AppReference)
                let updatedData = await this.ActivityDbService.formatBookingRes(ItenaryData, body)
                return updatedData
            }
            else {
                const errorClass: any = getExceptionClassByCode(`400 ${result.errors[0].text}`);
                throw new errorClass(`${result.errors[0].text}`);
            }
        }
        catch (err) {
            const errorClass: any = getExceptionClassByCode(`400 ${err.message}`);
            throw new errorClass(`${err.message}`);
        }

    }
}


