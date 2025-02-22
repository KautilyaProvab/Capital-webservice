import { HttpService } from "@nestjs/common";

export class RequestResponseLogService {
    constructor(
        private httpService: HttpService
    ) { }

    async storeRequestResponse(controller, method, xmlRequest, xmlResponse, jsonRequest, jsonResponse): Promise<any> {
        this.httpService.post('http://localhost:4002/static/logs/' + controller + '-thirdparty-logs/' + method, {
            search_request:  xmlRequest, 
            search_response: xmlResponse
        }, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        }).subscribe();
        this.httpService.post('http://localhost:4002/static/logs/' + controller + '-system-logs/create' + method, {
            search_request: jsonRequest, 
            search_response: jsonResponse
        }, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        }).subscribe();
    }
}