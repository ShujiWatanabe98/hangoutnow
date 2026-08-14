import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoService } from '../src/demo/demo.service';
import { PrismaService } from '../src/prisma/prisma.service';

function setup(requesterIsDemo = true) {
  const host = { id: '019ffb00-0000-7000-8000-000000000001', email: 'demo-host@hangoutnow.example' };
  const guest = { id: '019ffb00-0000-7000-8000-000000000002', email: 'demo-guest@hangoutnow.example' };
  const masaya = { id: '019ffb00-0000-7000-8000-000000000003', email: 'demo-masaya@hangoutnow.example' };
  const transaction = {
    directChat: { deleteMany: vi.fn() }, hangout: { deleteMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'new-hangout' }) },
    notification: { deleteMany: vi.fn() }, joinRequest: { create: vi.fn() }, chatRoom: { create: vi.fn() },
  };
  const database = {
    user: { findMany: vi.fn().mockResolvedValue([host, guest, masaya]) },
    $transaction: vi.fn().mockImplementation((operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction)),
  };
  return { service: new DemoService(database as unknown as PrismaService), transaction, requesterId: requesterIsDemo ? host.id : 'real-user' };
}

describe('public demo reset boundary', () => {
  const previous = process.env.DEMO_MODE;
  afterEach(() => { if (previous === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = previous; });

  it('rejects reset outside explicit demo mode', async () => {
    delete process.env.DEMO_MODE;
    const { service, requesterId } = setup();
    await expect(service.reset(requesterId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resets only identified demo-account data and creates a fresh journey', async () => {
    process.env.DEMO_MODE = 'true';
    const { service, transaction, requesterId } = setup();
    const result = await service.reset(requesterId);
    expect(result).toMatchObject({ ok: true, hangoutId: 'new-hangout', status: 'READY' });
    expect(transaction.hangout.deleteMany).toHaveBeenCalledWith({ where: { hostUserId: requesterId } });
    expect(transaction.hangout.create).toHaveBeenCalledOnce();
    expect(transaction.joinRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: '019ffb00-0000-7000-8000-000000000003', status: 'ACCEPTED' }) });
  });

  it('rejects a real user even when demo mode is enabled', async () => {
    process.env.DEMO_MODE = 'true';
    const { service, requesterId } = setup(false);
    await expect(service.reset(requesterId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
