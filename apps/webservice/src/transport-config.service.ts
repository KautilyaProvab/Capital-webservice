import { Injectable } from '@nestjs/common';

@Injectable()
export class TransportConfigService {
    private configs = {
        default: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // upgrade later with STARTTLS
            auth: {
                user: 'bookings@booking247.com',
                pass: 'pcof nuqd vhnz pjsm',
            },
        },
        noreply: {
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: 'noreply@booking247.com',
                pass: 'vwxj kbql yaoi bxfk',
            },
        },
    };

    getTransportConfig(service: string) {
        return this.configs[service] || this.configs.default;
    }
    
}