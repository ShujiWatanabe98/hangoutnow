import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: (process.env.CORS_ORIGINS||'http://localhost:4173,http://127.0.0.1:4173').split(',').map(value=>value.trim()) } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}
  handleConnection(client: Socket) {
    try {
      const token=String(client.handshake.auth?.token||'');
      const payload=this.jwt.verify<{sub:string}>(token);
      void client.join(`user:${payload.sub}`);
    } catch { client.disconnect(true); }
  }
  send(userId:string,event:string,payload:unknown){this.server?.to(`user:${userId}`).emit(event,payload)}
}
