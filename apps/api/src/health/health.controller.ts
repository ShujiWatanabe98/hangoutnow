import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok';
  service: 'hangout-now-api';
  database: {
    connected: boolean;
    schema: string | null;
    serverVersionMajor: number | null;
  };
}

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    const [database] = await this.db.$queryRawUnsafe<Array<{ schema: string; version: number }>>(
      "SELECT current_schema() AS schema, (current_setting('server_version_num')::integer / 10000) AS version",
    );
    return {
      status: 'ok',
      service: 'hangout-now-api',
      database: {
        connected: true,
        schema: database?.schema ?? null,
        serverVersionMajor: database?.version ?? null,
      },
    };
  }
}
