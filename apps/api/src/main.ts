import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  const origins=(process.env.CORS_ORIGINS||'http://localhost:4173,http://127.0.0.1:4173').split(',').map(value=>value.trim()).filter(Boolean);
  app.enableCors({ origin: origins, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
