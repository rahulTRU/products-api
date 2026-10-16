import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule, ObserveInstrument } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    logger: ['error', 'warn', 'log'],
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Products API')
      .setDescription('Products API with user authentication')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth(
        'accessToken',
        { type: 'apiKey', in: 'cookie' },
        'accessToken',
      )
      .addCookieAuth(
        'refreshToken',
        { type: 'apiKey', in: 'cookie' },
        'refreshToken',
      )
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
  const port = app.get(ConfigService).getOrThrow<number>('app.port');
  await app.listen(port);
  logger.log(`Application is running at http://localhost:${port}`);
}
await bootstrap();
