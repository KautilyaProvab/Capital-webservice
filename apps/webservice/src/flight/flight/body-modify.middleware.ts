import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { getPropValue } from "../../app.helper";
import { TRAVELPORT_FLIGHT_BOOKING_SOURCE } from "../../constants";

@Injectable()
export class BodyModifyMiddleware implements NestMiddleware {
    use(req: any, res: Response, next: NextFunction) {
        req.body["booking_source"] = getPropValue(req.body, "booking_source") || TRAVELPORT_FLIGHT_BOOKING_SOURCE;
        next();
    }
}
