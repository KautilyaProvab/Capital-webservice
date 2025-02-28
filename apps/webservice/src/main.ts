declare const module: any;

import { NestFactory, Reflector } from "@nestjs/core";
import { HttpService, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { swaggerDefinition } from "./swagger";
import { TransformInterceptor } from "./transform.interceptor";
import { AllExceptionsFilter } from "./all-exception.filter";
import * as compression from "compression";
import * as fs from "fs";
import * as path from "path";
import { CERT_PATH, KEY_PATH } from "./constants";

async function bootstrap() {
  // const httpsOptions = {
  //   key: fs.readFileSync(path.join(__dirname, KEY_PATH)),
  //   cert: fs.readFileSync(path.join(__dirname, CERT_PATH)),
  // };
  const app = await NestFactory.create(AppModule
    ,
  //    {
  //   httpsOptions,
  // }
  );

  // const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix("webservice");
  /* const reflector = app.get(Reflector);
    app.useGlobalGuards(new AuthGuard(reflector)); */
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.use(compression());
  app.useGlobalFilters(new AllExceptionsFilter(new HttpService()));
  swaggerDefinition(app);
  await app.listen(4012);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
