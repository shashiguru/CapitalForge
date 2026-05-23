import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [];
  const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix for API
  app.setGlobalPrefix('api');

  // Simple health check for Render's health probe
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/api/health', (_req: unknown, res: { json: (body: object) => void }) => {
    res.json({ status: 'ok' });
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
