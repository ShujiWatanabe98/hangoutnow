import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { ImageStorageService } from '../storage/image-storage.service';
import { CreateStampDto } from './stamp.dto';
@Injectable()export class StampService{
 constructor(@Inject(PrismaService)private readonly db:PrismaService,@Inject(ImageStorageService)private readonly images:ImageStorageService){}
 list(userId:string){return this.db.userStamp.findMany({where:{userId},orderBy:{createdAt:'asc'}})}
 async create(userId:string,input:CreateStampDto){const user=await this.db.user.findUnique({where:{id:userId},select:{profilePhoto:true}});if(!user)throw new NotFoundException();const source=input.imageData??user.profilePhoto;if(!source)throw new BadRequestException('写真を選択してください');const imageUrl=source.startsWith('data:')?await this.images.storeStampPhoto(userId,source):source;return this.db.userStamp.create({data:{id:uuidv7(),userId,imageUrl,text:input.text.trim()}})}
 async remove(userId:string,id:string){const stamp=await this.db.userStamp.findFirst({where:{id,userId}});if(!stamp)throw new NotFoundException();await this.db.userStamp.delete({where:{id}})}
 async payload(userId:string,id:string){const stamp=await this.db.userStamp.findFirst({where:{id,userId}});if(!stamp)throw new NotFoundException();return `__STAMP__${JSON.stringify({imageUrl:stamp.imageUrl,text:stamp.text})}`}
}
