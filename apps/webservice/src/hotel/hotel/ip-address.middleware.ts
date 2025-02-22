import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpMiddleware implements NestMiddleware {
  use(req: any, res: Response, next: NextFunction) {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    req['clientIp'] = ip;
    console.log('Client IP:', ip);
    next();
  }
}
