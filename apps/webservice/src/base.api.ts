import { client, gql, omitDeep } from "./apollo-connection";

export { client, gql, omitDeep };

import { getManager } from "typeorm";
import { BadRequestException } from "@nestjs/common";

export class BaseApi {
	protected config: any;

	protected manager = getManager();

	protected readonly isDevelopment = false;
	protected readonly isNotHitApi = false;
	protected readonly isLogXml = true;

	constructor() { }

	async getConfig(module: string, api: string): Promise<any> {
		const result = await this.getGraphData(
			`query {
					coreApiConfigs(where: {active: true}) {
						config
						remarks
					}
				}`,
			"coreApiConfigs"
		);
		return result;
	}

	async getGraphData(queryString: string, queryType: string): Promise<any> {
		console.log(queryString)
		const result = await client.query({ query: gql`${queryString}` });
		omitDeep(result.data[queryType], ["__typename"]);
		return result.data[queryType];
	}

	async setGraphData(entityNameSingle: string, body: any): Promise<any> {
		const entityNameSingleCamelcase = entityNameSingle.charAt(0).toLowerCase() + entityNameSingle.slice(1);
		const create = `create${entityNameSingle}`;
		const mutationData = JSON.stringify(body).replace(/"(\w+)"\s*:/g, '$1:');
		const mutation = gql`mutation {
			${create}(${entityNameSingleCamelcase}:${mutationData}){
				id
			}
		}`;
		const result = await client.mutate({ mutation });
		omitDeep(result.data[create], ["__typename"]);
		return result.data[create];
	}

	async updateGraphData(id: any, entityNameSingle: string, body: any): Promise<any> {
		const entityNameSingleCamelcase = entityNameSingle.charAt(0).toLowerCase() + entityNameSingle.slice(1);
		const update = `update${entityNameSingle}`;
		const mutationData = JSON.stringify(body).replace(/"(\w+)"\s*:/g, '$1:');
		const mutation = gql`mutation {
			${update}(id: ${id}, ${entityNameSingleCamelcase}Partial:${mutationData})
		}`;
		const result = await client.mutate({ mutation });
		return result.data[update];
	}

	async updateGraphDataByField(criteria: any, entityNameSingle: string, body: any): Promise<any> {
		const entityNameSingleCamelcase = entityNameSingle.charAt(0).toLowerCase() + entityNameSingle.slice(1);
		const update = `update${entityNameSingle}ByField`;
		const mutationCriteria = JSON.stringify(criteria).replace(/"(\w+)"\s*:/g, '$1:');
		const mutationData = JSON.stringify(body).replace(/"(\w+)"\s*:/g, '$1:');
		const mutation = gql`mutation {
			${update}(where: ${mutationCriteria}, ${entityNameSingleCamelcase}Partial:${mutationData})
		}`;
		const result = await client.mutate({ mutation });
		return result.data[update];
	}

	// jsonToXml(json: any, versionTag = '') {
	// 	console.log("json-",json);
	// 	const parser = require('xml2json');
	// 	let xml = parser.toXml(JSON.stringify(json));
	// 	if (versionTag != '') {
	// 		xml = '<?xml version="1.0" encoding="utf-8"?>' + xml;
	// 	}
	// 	return xml;
	// }

	jsonToXml(json: any, versionTag = '') {
		console.log("json-",json);
		const xml2js = require('xml2js');

		const builder = new xml2js.Builder({ headless: true, xmldec: { version: '1.0', encoding: 'UTF-8' } });
		const xml = builder.buildObject(json);
		return xml;
	}

	 jsonToXml2(json) {
		function parseObject(obj, rootElement) {
		  let xml = '';
	  
		  for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
			  const value = obj[key];
	  
			  if (typeof value === 'object') {
				if (Array.isArray(value)) {
				  value.forEach((item, index) => {
					xml += `<${key}>` + parseObject(item, `${key}${index}`) + `</${key}>`;
				  });
				} else {
				  xml += `<${key}>` + parseObject(value, key) + `</${key}>`;
				}
			  } else {
				xml += `<${key}>${value}</${key}>`;
			  }
			}
		  }
	  
		  return xml;
		}
	  
		// Start parsing from the root element
		return parseObject(json, 'root');
	  }


	  async removeDollarT(obj) {
		if (Array.isArray(obj)) {
		  // If the current item is an array, process each item
		  for (let i = 0; i < obj.length; i++) {
			this.removeDollarT(obj[i]);
		  }
		} else if (typeof obj === 'object' && obj !== null) {
		  // If the current item is an object, process its properties
		  for (let key in obj) {
			if (obj.hasOwnProperty(key)) {
			  if (key === '$t') {
				// Delete the $t property
				delete obj[key];
			  } else {
				// Recursively process nested objects and arrays
				this.removeDollarT(obj[key]);
			  }
			}
		  }
		}
	  }

	   async replaceTWithParent(obj) {
		if (obj === null || typeof obj !== 'object') {
			return obj;
		}
	
		if (Array.isArray(obj)) {
			return obj.map(this.replaceTWithParent);
		}
	
		return Object.keys(obj).reduce((acc, key) => {
			const newKey = key === '$t' ? 'parent' : key;
			acc[newKey] = this.replaceTWithParent(obj[key]);
			return acc;
		}, {});
	}
	  
	//   // Sample JSON
	//   const json = {
	// 	AirPricingSolution: {
	// 	  xmlns: 'http://www.travelport.com/schema/air_v52_0',
	// 	  Key: 'ZicDdBMEuDKAm4b3c0BAAA==',
	// 	  TotalPrice: 'GBP494.59',
	// 	  BasePrice: 'AED1380',
	// 	  ApproximateTotalPrice: 'GBP494.59',
	// 	  ApproximateBasePrice: 'GBP292.00',
	// 	  EquivalentBasePrice: 'GBP292.00',
	// 	  Taxes: 'GBP202.59',
	// 	  ApproximateTaxes: 'GBP202.59',
	// 	  QuoteDate: '2024-07-31',
	// 	  AirSegment: [
	// 		{ Segment1: 'Value1' },
	// 		{ Segment2: 'Value2' },
	// 		{ Segment3: 'Value3' },
	// 		{ Segment4: 'Value4' }
	// 	  ],
	// 	  AirPricingInfo: [{ Info1: 'Value1' }],
	// 	  HostToken: [
	// 		{ Token1: 'Value1' },
	// 		{ Token2: 'Value2' }
	// 	  ]
	// 	}
	//   };
	  
	//   // Convert JSON to XML
	//   const xml = jsonToXml(json);
	//   console.log(xml);
	  

	// xmlToJson(xml: any) {
	// 	const parser = require('xml2json');
	// 	const xmlData = xml.replace(/<\$t>/g, '').replace(/<\/\$t>/g, '');
	// 	console.log("xmlData-",xmlData);
	// 	const json = parser.toJson(xmlData, { object: true, reversible: true });
	// 	return json;
	// }


	async xmlToJson(xml) {
		const xml2js = require("xml2js");
		return new Promise((resolve, reject) => {
			const parser = new xml2js.Parser({
				mergeAttrs: true, 
				explicitArray: false, 
				explicitCharkey: true, 
				charkey: '_' 
			});
	
			parser.parseString(xml, (err, result) => {
				if (err) {
					reject(err);
				} else {
					function replaceCharKey(obj) {
						if (typeof obj !== 'object' || obj === null) {
							return obj;
						}
						for (const key in obj) {
							if (key === '_') {
								obj['$t'] = obj[key];
								delete obj[key];
							} else if (typeof obj[key] === 'object') {
								replaceCharKey(obj[key]);
							}
						}
					}
	
					// Replace '_' with '$t' in the parsed JSON object
					replaceCharKey(result);
					resolve(result);
				}
			});
		});
	}

	async xmlToJson3(xml) {
		const xml2js = require("xml2js");
		return new Promise((resolve, reject) => {
			const parser = new xml2js.Parser({
				mergeAttrs: true, 
				explicitArray: false, 
				explicitCharkey: true, 
				charkey: '_' 
			});
	
			parser.parseString(xml, (err, result) => {
				if (err) {
					reject(err);
				} else {
					function replaceCharKey(obj) {
						if (typeof obj !== 'object' || obj === null) {
							return obj;
						}
						for (const key in obj) {
							if (typeof obj[key] === 'object') {
								replaceCharKey(obj[key]);
							}
						}
					}
	
					// Replace '_' with '$t' in the parsed JSON object
					replaceCharKey(result);
					resolve(result);
				}
			});
		});
	}

	 xmlToJson2(xml) {
		const xml2js = require("xml2js");
		return new Promise((resolve, reject) => {
			const parser = new xml2js.Parser({
				mergeAttrs: true, 
				explicitArray: false, 
				explicitCharkey: true, 
				charkey: '_' 
			});
	
			parser.parseString(xml, (err, result) => {
				if (err) {
					reject(err);
				} else {
					function replaceCharKey(obj) {
						if (typeof obj !== 'object' || obj === null) {
							return obj;
						}
						for (const key in obj) {
							if (key === '_') {
								obj['$t'] = obj[key];
								delete obj[key];
							} else if (typeof obj[key] === 'object') {
								replaceCharKey(obj[key]);
							}
						}
					}
	
					// Replace '_' with '$t' in the parsed JSON object
					replaceCharKey(result);
					resolve(result);
				}
			});
		});
	}

	forceObjectToArray(objectOrArray = []) {
		return Array.isArray(objectOrArray) ? objectOrArray : [objectOrArray];
	}

	getCabinClassCode(cabinClass: string) {
		cabinClass = cabinClass.toLowerCase();
		let cabinCode: string;
		switch (cabinClass) {
			case 'economy':
				cabinCode = 'Y';
				break;
			case 'premiumeconomy':
				cabinCode = 'S';
				break;
			case 'business':
				cabinCode = 'C';
				break;
			case 'premiumbusiness':
				cabinCode = 'J';
				break;
			case 'first':
				cabinCode = 'F';
				break;
			case 'premiumfirst':
				cabinCode = 'P';
				break;
			default:
				cabinCode = 'Y';
				break;
		}
		return cabinCode;
	}


	async usdToAnyCurrencyBaseApi(currency_code: string): Promise<any> {
        const query = `SELECT currency_value FROM tlntrip_currency_converter WHERE country = "${currency_code}"`;
        const result = await this.manager.query(query);
        if(!result.length) {
            throw new BadRequestException(`Our system is not supported ${currency_code}`);
        }
        return result[0]['currency_value'];
    }

    async anyCurrencyToUSDBaseApi(currency_code: string): Promise<any> {
        const USD_2_ANY = await this.usdToAnyCurrencyBaseApi(currency_code);
        const ANY_2_USD = 1/USD_2_ANY['result'];
        return ANY_2_USD;
	}

}