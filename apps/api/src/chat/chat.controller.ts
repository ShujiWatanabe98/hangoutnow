import{Body,Controller,Get,Inject,Param,Post,Req,UseGuards}from'@nestjs/common';import{AccessTokenGuard,AuthenticatedRequest}from'../auth/access-token.guard';import{CreateDirectChatDto,SendMessageDto}from'./chat.dto';import{ChatService}from'./chat.service';
@Controller('chat-rooms')@UseGuards(AccessTokenGuard)export class ChatController{constructor(@Inject(ChatService)private readonly s:ChatService){}@Get()rooms(@Req()r:AuthenticatedRequest){return this.s.rooms(r.userId)}@Get(':id/messages')messages(@Req()r:AuthenticatedRequest,@Param('id')id:string){return this.s.messages(r.userId,id)}@Post(':id/messages')send(@Req()r:AuthenticatedRequest,@Param('id')id:string,@Body()b:SendMessageDto){return this.s.send(r.userId,id,b.body)}}

@Controller('direct-chats')@UseGuards(AccessTokenGuard)export class DirectChatController{
 constructor(@Inject(ChatService)private readonly s:ChatService){}
 @Get() rooms(@Req()r:AuthenticatedRequest){return this.s.directRooms(r.userId)}
 @Post() create(@Req()r:AuthenticatedRequest,@Body()b:CreateDirectChatDto){return this.s.createDirect(r.userId,b.userId)}
 @Get(':id/messages') messages(@Req()r:AuthenticatedRequest,@Param('id')id:string){return this.s.directMessages(r.userId,id)}
 @Post(':id/messages') send(@Req()r:AuthenticatedRequest,@Param('id')id:string,@Body()b:SendMessageDto){return this.s.sendDirect(r.userId,id,b.body)}
}
