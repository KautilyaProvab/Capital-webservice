import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GqlContextType } from '@nestjs/graphql';
import { getPropValue, getPropValueOrEmpty } from './app.helper';

export interface Response<T> {
    data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
        if (context.getType<GqlContextType>() === 'graphql') {
            return next.handle().pipe(map(data => data));
        } else {
            return next
                .handle()
                .pipe(
                    map(data => {
                        if (context.getClass().name == 'AppController') {
                            return data;
                        }
                        const statusCode = context.switchToHttp().getResponse().statusCode;
                        let result = {
                            data: getPropValue(data, 'result') || data,
                            DeDuToken: "",
                            HideList: {},
                            statusCode,
                            Message: getPropValueOrEmpty(data, 'message'),
                            Status: [200, 201].includes(+statusCode)
                        };

                        if(data != undefined){
                        if (data['DeDuToken'] != undefined) {
                            result.DeDuToken = data['DeDuToken']
                        }

                        if (data['HideList'] != undefined) {
                            result.HideList = data['HideList']
                        }
                    }
                        // return {
                        //     data: getPropValue(data,'result') || data,
                        //     DeDuToken:data['DeDuToken'] || "",
                        //     HideList:data['HideList'] || {},
                        //     statusCode,
                        //     Message: getPropValueOrEmpty(data,'message'),
                        //     Status: [200,201].includes(+statusCode)
                        // }
                        return result;
                    })
                );
        }
    }
}