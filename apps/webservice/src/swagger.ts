import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ActivityModule } from "./activity/activity.module";
import { CommonModule } from "./common/common.module";
import { FlightModule } from "./flight/flight.module";
import { HotelModule } from "./hotel/hotel.module";
import { TransferModule } from "./transfer/transfer.module";

export function swaggerDefinition(app) {
	const options = new DocumentBuilder().addBearerAuth().build();
	SwaggerModule.setup('ws-flight-docs', app, SwaggerModule.createDocument(app, options, {include: [FlightModule]}));	SwaggerModule.setup('ws-activity-docs', app, SwaggerModule.createDocument(app, options, { include: [ActivityModule] }));
	SwaggerModule.setup('ws-hotel-docs', app, SwaggerModule.createDocument(app, options, { include: [HotelModule] }));
	SwaggerModule.setup('ws-transfer-docs', app, SwaggerModule.createDocument(app, options, { include: [TransferModule] }));
	SwaggerModule.setup('ws-common-docs', app, SwaggerModule.createDocument(app, options, { include: [CommonModule] }));
	SwaggerModule.setup('ws-home-docs', app, SwaggerModule.createDocument(app, options, { include: []}))
}