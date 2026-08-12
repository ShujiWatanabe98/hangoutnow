import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JoinRequestStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
@Injectable() export class ChatService{
 constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(NotificationService)private readonly notifications:NotificationService){}
 async rooms(uid:string){const rows=await this.db.chatRoom.findMany({where:{OR:[{hangout:{hostUserId:uid}},{hangout:{joinRequests:{some:{userId:uid,status:JoinRequestStatus.ACCEPTED}}}}]},include:{hangout:{include:{host:{select:{displayName:true}}}},messages:{orderBy:{createdAt:'desc'},take:1}},orderBy:{createdAt:'desc'}});return rows.map(r=>({...r,lastMessage:r.messages[0]??null}))}
 async messages(uid:string,rid:string){await this.access(uid,rid);return this.db.message.findMany({where:{roomId:rid},include:{sender:{select:{id:true,displayName:true}}},orderBy:{createdAt:'asc'},take:200})}
 async send(uid:string,rid:string,body:string){const room=await this.access(uid,rid);const message=await this.db.message.create({data:{id:uuidv7(),roomId:rid,senderUserId:uid,body:body.trim()},include:{sender:{select:{id:true,displayName:true}}}});const recipients=new Set([room.hangout.hostUserId,...room.hangout.joinRequests.map(j=>j.userId)]);recipients.delete(uid);for(const recipient of recipients)await this.notifications.notify(recipient,'CHAT_MESSAGE',`${message.sender.displayName}さんからメッセージ`,message.body,`chat:${rid}`,`message:${message.id}:${recipient}`);return message}
 private async access(uid:string,rid:string){const room=await this.db.chatRoom.findUnique({where:{id:rid},include:{hangout:{include:{joinRequests:{where:{status:JoinRequestStatus.ACCEPTED}}}}}});if(!room)throw new NotFoundException();if(room.hangout.hostUserId!==uid&&!room.hangout.joinRequests.some(j=>j.userId===uid))throw new ForbiddenException();if(await this.db.block.findFirst({where:{OR:[{blockerId:uid,blockedId:room.hangout.hostUserId},{blockerId:room.hangout.hostUserId,blockedId:uid}]}}))throw new ForbiddenException('Blocked relationship');return room}
}
