import { Global, HttpModule, HttpService, Module, OnModuleInit } from "@nestjs/common";
import { PDFModule } from "nestjs-pdf";
import { getPropValue } from "../app.helper";
import { AppGlobal } from "./app.global";

@Global()
@Module({
    imports: [
        HttpModule,
        PDFModule.register({
            view: {
                root: '/var/www/html/booking247/node/voucher/',
                engine: 'handlebars',
            },
        })
    ],
    exports: [
        HttpModule,
        PDFModule,
        AppGlobal
    ],
    providers: [AppGlobal]
})

export class GlobalModule implements OnModuleInit {

    constructor(private readonly httpService: HttpService) { }

    onModuleInit() {
        this.httpService.axiosRef.interceptors.request.use(
            (req) => { return req; },
            (err) => { console.log(err) },
        );

        this.httpService.axiosRef.interceptors.response.use(
            (res) => { return res.data; },
            (err) => {
                return getPropValue(err, 'response.data') || 'Thrid Party service error';
            },
        );
    }

}