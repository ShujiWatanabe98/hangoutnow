import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { ImageStorageService } from '../src/storage/image-storage.service';
import { StampService } from '../src/stamps/stamp.service';

function setup(){const stamp={id:'019ffb00-0000-7000-8000-000000000099',userId:'user-1',imageUrl:'https://images.example/stamp.jpg',text:'向かってます',createdAt:new Date()};const db={user:{findUnique:vi.fn().mockResolvedValue({profilePhoto:'https://images.example/profile.jpg'})},userStamp:{findMany:vi.fn().mockResolvedValue([stamp]),create:vi.fn().mockImplementation(({data}:{data:typeof stamp})=>data),findFirst:vi.fn().mockImplementation(({where}:{where:{id:string;userId:string}})=>where.userId==='user-1'?stamp:null),delete:vi.fn()}};const images={storeStampPhoto:vi.fn()};return{service:new StampService(db as unknown as PrismaService,images as unknown as ImageStorageService),db}}

describe('personal stamps',()=>{
  it('creates a private stamp from the user profile photo',async()=>{const{service,db}=setup();const created=await service.create('user-1',{text:'向かってます'});expect(created.userId).toBe('user-1');expect(db.userStamp.create).toHaveBeenCalledOnce()});
  it('does not expose another user stamp as a sendable payload',async()=>{const{service}=setup();await expect(service.payload('user-2','019ffb00-0000-7000-8000-000000000099')).rejects.toBeInstanceOf(NotFoundException)});
});
