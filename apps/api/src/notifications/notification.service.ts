import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class NotificationService implements OnModuleInit,OnModuleDestroy{
  private timer?:NodeJS.Timeout;
  constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(RealtimeGateway)private readonly realtime:RealtimeGateway){}
  onModuleInit(){this.timer=setInterval(()=>void this.createReminders(),60_000);void this.createReminders()}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
  async list(uid:string){const [items,unreadCount,user]=await Promise.all([this.db.notification.findMany({where:{userId:uid},orderBy:{createdAt:'desc'},take:100}),this.db.notification.count({where:{userId:uid,readAt:null}}),this.db.user.findUnique({where:{id:uid},select:{notificationsEnabled:true}})]);return{items,unreadCount,enabled:user?.notificationsEnabled??true}}
  async markRead(uid:string,id:string){await this.db.notification.updateMany({where:{id,userId:uid},data:{readAt:new Date()}});this.realtime.send(uid,'notifications:changed',{})}
  async markAllRead(uid:string){await this.db.notification.updateMany({where:{userId:uid,readAt:null},data:{readAt:new Date()}});this.realtime.send(uid,'notifications:changed',{})}
  async settings(uid:string,enabled:boolean){await this.db.user.update({where:{id:uid},data:{notificationsEnabled:enabled}});return{enabled}}
  async notify(userId:string,type:string,title:string,body:string,link?:string,eventKey?:string){const user=await this.db.user.findUnique({where:{id:userId},select:{notificationsEnabled:true}});if(!user?.notificationsEnabled)return null;try{const item=await this.db.notification.create({data:{id:uuidv7(),userId,type,title,body,link,eventKey}});this.realtime.send(userId,'notification',item);return item}catch{return null}}
  private async createReminders(){const now=new Date();const until=new Date(now.getTime()+16*60_000);const rows=await this.db.hangout.findMany({where:{startAt:{gt:now,lte:until},status:{in:['OPEN','FULL']}},include:{joinRequests:{where:{status:'ACCEPTED'},select:{userId:true}}}});for(const h of rows){for(const uid of [h.hostUserId,...h.joinRequests.map(j=>j.userId)])await this.notify(uid,'REMINDER','開始15分前です',`${h.title}の集合時間が近づいています。`,`hangout:${h.id}`,`reminder:${h.id}:${uid}`)}}
}
