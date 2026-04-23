import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    // In production, restrict to known frontend domains.
    // In development, allow any origin so localhost:3000, :3001, etc. all work.
    origin: process.env.NODE_ENV === 'production'
      ? [
          'https://orientationapps.com',
          'https://www.orientationapps.com',
          'https://admin.orientationapps.com',
          process.env.FRONTEND_URL,
        ].filter(Boolean)
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    // Must include every custom header that fetchClient.ts sends
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-CSRF-Token',
      'X-Device-Id',
      'X-Reset-Token',
      'Origin',
      'X-Requested-With',
    ],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); // Listen on all network interfaces

  logger.log(`Application running on port ${port}`);
}
bootstrap();
