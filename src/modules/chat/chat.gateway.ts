import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';
import { RoomsService } from '../rooms/rooms.service';
import { REDIS_SUB_CLIENT } from '../redis/redis.module';

// Shape of events published over Redis pub/sub
interface PubSubEvent {
  type: 'message:new' | 'room:deleted';
  roomId?: string;
  message?: {
    id: string;
    username: string;
    content: string;
    createdAt: Date;
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly redis: RedisService,
    private readonly auth: AuthService,
    private readonly rooms: RoomsService,
    @Inject(REDIS_SUB_CLIENT) private readonly subClient: Redis,
  ) {}

  // ─── Init: attach Redis adapter and subscribe to pub/sub channel ──────────

afterInit(): void {
  this.logger.log('WebSocket Gateway initialized');

  // Wait for the connection to be ready before subscribing
  if (this.subClient.status === 'ready') {
    this.subscribeToChannel();
  } else {
    this.subClient.once('ready', () => this.subscribeToChannel());
  }
}

private subscribeToChannel(): void {
  this.subClient.subscribe(this.redis.pubSubChannel, (err) => {
    if (err) {
      this.logger.error('Redis subscribe error', err);
    } else {
      this.logger.log(`Subscribed to Redis channel: ${this.redis.pubSubChannel}`);
    }
  });

  this.subClient.on('message', (_channel: string, payload: string) => {
    this.handlePubSubMessage(payload);
  });
}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.query['token'] as string;
      const roomId = socket.handshake.query['roomId'] as string;

      // Validate session token
      if (!token) {
        this.disconnect(socket, 401, 'Missing session token');
        return;
      }

      const userId = await this.redis.getSession(token);
      if (!userId) {
        this.disconnect(socket, 401, 'Invalid or expired session token');
        return;
      }

      const user = await this.auth.findUserById(userId);
      if (!user) {
        this.disconnect(socket, 401, 'User not found');
        return;
      }

      // Validate room
      if (!roomId) {
        this.disconnect(socket, 404, 'roomId is required');
        return;
      }

      let room: Awaited<ReturnType<typeof this.rooms.findRoomById>>;
      try {
        room = await this.rooms.findRoomById(roomId);
      } catch {
        this.disconnect(socket, 404, `Room ${roomId} not found`);
        return;
      }

      // Persist socket ↔ user/room mapping in Redis (no in-memory maps)
      await this.redis.bindSocket(socket.id, user.username, room.id);

      // Add user to room's active-user set
      const isFirstSocketForUser = await this.redis.addUserToRoom(
        room.id,
        user.username,
        socket.id,
      );

      // Join the Socket.io room for targeted broadcasts
      socket.join(room.id);

      // Notify the connecting client of current active users
      const activeUsers = await this.redis.getRoomUsers(room.id);
      socket.emit('room:joined', { activeUsers });

      // Notify everyone else in the room
      if (isFirstSocketForUser) {
        socket.to(room.id).emit('room:user_joined', {
          username: user.username,
          activeUsers,
        });
      }

      this.logger.log(`[connect] ${user.username} → room ${room.id} (socket ${socket.id})`);
    } catch (err) {
      this.logger.error('handleConnection error', err);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const username = await this.redis.getSocketUser(socket.id);
      const roomId = await this.redis.getSocketRoom(socket.id);

      if (!username || !roomId) return; // Already cleaned up

      const wasLastSocketForUser = await this.redis.removeUserFromRoom(
        roomId,
        username,
        socket.id,
      );
      await this.redis.unbindSocket(socket.id);

      if (wasLastSocketForUser) {
        const activeUsers = await this.redis.getRoomUsers(roomId);
        this.server.to(roomId).emit('room:user_left', { username, activeUsers });
      }

      this.logger.log(`[disconnect] ${username} ← room ${roomId}`);
    } catch (err) {
      this.logger.error('handleDisconnect error', err);
    }
  }

  // ─── Client → Server events ───────────────────────────────────────────────

  /**
   * room:leave — graceful disconnect initiated by the client.
   * We simply disconnect the socket, which triggers handleDisconnect.
   */
  @SubscribeMessage('room:leave')
  async handleLeave(socket: Socket): Promise<void> {
    await this.handleDisconnect(socket);
    socket.disconnect(true);
  }

  // ─── Redis pub/sub fan-out ────────────────────────────────────────────────

  /**
   * Called whenever a message arrives on our Redis channel.
   * Routes the event to the correct Socket.io room so that clients connected
   * to ANY server instance receive the event.
   */
  private handlePubSubMessage(payload: string): void {
    let event: PubSubEvent;
    try {
      event = JSON.parse(payload) as PubSubEvent;
    } catch {
      this.logger.warn('Received malformed pub/sub payload', payload);
      return;
    }

    if (event.type === 'message:new' && event.roomId && event.message) {
      this.server.to(event.roomId).emit('message:new', event.message);
    } else if (event.type === 'room:deleted' && event.roomId) {
      this.server
        .to(event.roomId)
        .emit('room:deleted', { roomId: event.roomId });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private disconnect(socket: Socket, code: number, reason: string): void {
    socket.emit('error', { code, message: reason });
    socket.disconnect(true);
  }
}
