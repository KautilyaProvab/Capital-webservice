import { MailerModule } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisModule } from "nestjs-redis";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { CoreModule } from "./core/core.module";
import { FlightModule } from "./flight/flight.module";
import { GlobalModule } from "./global/global.module";
import { HomeModule } from "./home/home.module";
import { HotelModule } from "./hotel/hotel.module";
import { InsuranceModule } from "./insurance/insurance.module";
import { PaymentGatewayModule } from "./payment-gateway/payment-gateway.module";
import { UserModule } from "./user/user.module";
import { environment } from "./environment/environment.prod";
import { SupplierModule } from './supplier/supplier.module';
import { TransportConfigModule } from "./transport-config.module";
import { TransportConfigService } from "./transport-config.service";



const RedisPassword = process.env.redisPassword ? `:${process.env.redisPassword}@` : ''; /* qD22LQfp7C3qkGc9 */

@Module({
	imports: [
		SupplierModule,
		AuthModule,
		CommonModule,
		GlobalModule,
		RedisModule.register({ url: `redis://${RedisPassword}localhost:6379` }),
		FlightModule,
		HomeModule,
		HotelModule,
		UserModule,
		CoreModule,
		InsuranceModule,
		PaymentGatewayModule,
		TypeOrmModule.forRoot({
			type: "mysql",
            host: "54.198.46.240",
            port: 3306,
			username: "root",
			password: "ryJHPHXDdnnKgVaEFDbQg",
			database: "capital_sky",
			autoLoadEntities: true,
			logging: true,
			multipleStatements: true
		}),
		// MailerModule.forRoot({
		// 	transport: {
		// 		host: 'smtp.gmail.com',
		// 		port: 587,
		// 		secure: false, // upgrade later with STARTTLS
		// 		auth: {
        //             user: 'bookings@booking247.com',
        //             pass: 'pcof nuqd vhnz pjsm',
		// 		},
		// 	},
		// 	defaults: {
		// 		from: '"nest-modules" <modules@nestjs.com>',
		// 	},
		// 	template: {
		// 		dir: process.cwd() + '/templates/',
		// 		adapter: new HandlebarsAdapter(), // or new PugAdapter()
		// 		options: {
		// 			strict: true,
		// 		},
		// 	},
		// })
		MailerModule.forRootAsync({
			imports: [TransportConfigModule],
            useFactory: (transportConfigService: TransportConfigService) => ({
                transport: transportConfigService.getTransportConfig('default'), // Set default transport config
                defaults: {
                    from: '"nest-modules" <modules@nestjs.com>',
                },
                template: {
                    dir: process.cwd() + '/templates/',
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                },
            }),
            inject: [TransportConfigService], // Inject the transport config service
        })
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
