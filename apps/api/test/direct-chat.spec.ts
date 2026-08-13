import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/chat/chat.service';
import { NotificationService } from '../src/notifications/notification.service';
import { PrismaService } from '../src/prisma/prisma.service';

function service(options: { matched: boolean; blocked?: boolean }) {
  const room = {
    id: '019ffb00-0000-7000-8000-000000000001',
    userOneId: '019ffb00-0000-7000-8000-000000000010',
    userTwoId: '019ffb00-0000-7000-8000-000000000020',
    createdAt: new Date(), updatedAt: new Date(), messages: [],
    userOne: { id: '019ffb00-0000-7000-8000-000000000010', displayName: 'A', profilePhoto: null, verification: 'PHONE_VERIFIED' },
    userTwo: { id: '019ffb00-0000-7000-8000-000000000020', displayName: 'B', profilePhoto: null, verification: 'PHONE_VERIFIED' },
  };
  const database = {
    block: { findFirst: vi.fn().mockResolvedValue(options.blocked ? { id: 'blocked' } : null) },
    hangout: { findFirst: vi.fn().mockResolvedValue(options.matched ? { id: 'shared-hangout' } : null) },
    directChat: { upsert: vi.fn().mockResolvedValue(room) },
  };
  return { chat: new ChatService(database as unknown as PrismaService, {} as NotificationService), database };
}

describe('direct chat safety', () => {
  const userId = '019ffb00-0000-7000-8000-000000000010';
  const targetUserId = '019ffb00-0000-7000-8000-000000000020';

  it('allows one direct room for users accepted into a shared Hangout', async () => {
    const { chat, database } = service({ matched: true });
    const room = await chat.createDirect(userId, targetUserId);
    expect(room.type).toBe('DIRECT');
    expect(room.otherUser.id).toBe(targetUserId);
    expect(database.directChat.upsert).toHaveBeenCalledOnce();
  });

  it('rejects an unsolicited direct chat without an accepted match', async () => {
    const { chat, database } = service({ matched: false });
    await expect(chat.createDirect(userId, targetUserId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.directChat.upsert).not.toHaveBeenCalled();
  });

  it('rejects a direct chat when either user has blocked the other', async () => {
    const { chat, database } = service({ matched: true, blocked: true });
    await expect(chat.createDirect(userId, targetUserId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.hangout.findFirst).not.toHaveBeenCalled();
  });
});
