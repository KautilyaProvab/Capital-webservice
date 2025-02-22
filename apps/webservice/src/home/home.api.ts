import { BaseApi } from "../base.api";

export class HomeApi extends BaseApi {

    constructor() {
        super()
    }

    getCoreCitiesUniversal(body: any): any {
        return {
            city_code: body.city_code,
            city_name: body.city_name,
            country_id: body.country_id
        }
    }
}