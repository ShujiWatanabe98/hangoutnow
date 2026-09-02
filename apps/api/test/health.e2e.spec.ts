import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('reports that the API is healthy', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{
        provide: PrismaService,
        useValue: {
          $queryRawUnsafe: async () => [{ schema: 'hangoutnow', version: 18 }],
        },
      }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'methodmore-platform',
      database: { connected: true, schema: 'hangoutnow', serverVersionMajor: 18 },
    });
  });
});
