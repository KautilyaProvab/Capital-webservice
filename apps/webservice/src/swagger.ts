import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { CommonModule } from "./common/common.module";
import { FlightModule } from "./flight/flight.module";
import { HotelModule } from "./hotel/hotel.module";

export function swaggerDefinition(app) {
	const options = new DocumentBuilder().addBearerAuth().build();
	SwaggerModule.setup('ws-flight-docs', app, SwaggerModule.createDocument(app, options, {include: [FlightModule]}));
	SwaggerModule.setup('ws-hotel-docs', app, SwaggerModule.createDocument(app, options, { include: [HotelModule] }));
	SwaggerModule.setup('ws-common-docs', app, SwaggerModule.createDocument(app, options, { include: [CommonModule] }));
	SwaggerModule.setup('ws-home-docs', app, SwaggerModule.createDocument(app, options, { include: []}))
}