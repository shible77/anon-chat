import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

// Key helpers — centralised so a rename touches one place
const Keys = {
  session: (token: string) => `session:${token}`,
  roomUsers: (roomId: string) => `room:${roomId}:users`,
  socketUser: (socketId: string) => `socket:${socketId}:user`,
  socketRoom: (socketId: string) => `socket:${socketId}:room`,
};

const PUBSUB_CHANNEL = 'chat:events';

@Injectable()
export class RedisService {
  private readonly sessionTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.sessionTtl = config.get<number>('SESSION_TTL_SECONDS', 86400);
  }

  // ─── Session ───────────────────────────────────────────────────────────────

  async setSession(token: string, userId: string): Promise<void> {
    await this.redis.set(Keys.session(token), userId, 'EX', this.sessionTtl);
  }

  async getSession(token: string): Promise<string | null> {
    return this.redis.get(Keys.session(token));
  }

  async deleteSession(token: string): Promise<void> {
    await this.redis.del(Keys.session(token));
  }

  // ─── Active users per room ─────────────────────────────────────────────────

  async addUserToRoom(roomId: string, username: string): Promise<void> {
    await this.redis.sadd(Keys.roomUsers(roomId), username);
  }

  async removeUserFromRoom(roomId: string, username: string): Promise<void> {
    await this.redis.srem(Keys.roomUsers(roomId), username);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return this.redis.smembers(Keys.roomUsers(roomId));
  }

  async getRoomUserCount(roomId: string): Promise<number> {
    return this.redis.scard(Keys.roomUsers(roomId));
  }

  async deleteRoomUsers(roomId: string): Promise<void> {
    await this.redis.del(Keys.roomUsers(roomId));
  }

  // ─── Socket ↔ user/room mapping (no in-memory maps) ──────────────────────

  async bindSocket(socketId: string, username: string, roomId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.set(Keys.socketUser(socketId), username, 'EX', this.sessionTtl);
    pipeline.set(Keys.socketRoom(socketId), roomId, 'EX', this.sessionTtl);
    await pipeline.exec();
  }

  async getSocketUser(socketId: string): Promise<string | null> {
    return this.redis.get(Keys.socketUser(socketId));
  }

  async getSocketRoom(socketId: string): Promise<string | null> {
    return this.redis.get(Keys.socketRoom(socketId));
  }

  async unbindSocket(socketId: string): Promise<void> {
    await this.redis.del(Keys.socketUser(socketId), Keys.socketRoom(socketId));
  }

  // ─── Pub/Sub ───────────────────────────────────────────────────────────────

  async publish(payload: object): Promise<void> {
    await this.redis.publish(PUBSUB_CHANNEL, JSON.stringify(payload));
  }

  get pubSubChannel(): string {
    return PUBSUB_CHANNEL;
  }
}
