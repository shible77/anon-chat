import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleDB, DRIZZLE } from '@modules/database/database.module';
import { rooms, Room } from '@modules/database/schema';
import { RedisService } from '@modules/redis/redis.service';
import { generateId } from '@common/utils/id.util';

export interface RoomWithActiveUsers extends Room {
  activeUsers: number;
}

@Injectable()
export class RoomsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly redis: RedisService,
  ) {}

  async listRooms(): Promise<RoomWithActiveUsers[]> {
    const allRooms = await this.db.select().from(rooms).orderBy(rooms.createdAt);

    // Fetch active user counts from Redis in parallel
    const counts = await Promise.all(
      allRooms.map((r) => this.redis.getRoomUserCount(r.id)),
    );

    return allRooms.map((room, i) => ({ ...room, activeUsers: counts[i] }));
  }

  async getRoom(id: string): Promise<RoomWithActiveUsers> {
    const room = await this.findRoomById(id);
    const activeUsers = await this.redis.getRoomUserCount(id);
    return { ...room, activeUsers };
  }

  async createRoom(name: string, createdBy: string): Promise<Room> {
    const existing = await this.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.name, name))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException({
        code: 'ROOM_NAME_TAKEN',
        message: 'A room with this name already exists',
      });
    }

    const [room] = await this.db
      .insert(rooms)
      .values({ id: generateId.room(), name, createdBy })
      .returning();

    return room;
  }

  async deleteRoom(id: string, requestingUsername: string): Promise<void> {
    const room = await this.findRoomById(id);

    if (room.createdBy !== requestingUsername) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the room creator can delete this room',
      });
    }

    // CASCADE in schema deletes messages; clean up Redis too
    await Promise.all([
      this.db.delete(rooms).where(eq(rooms.id, id)),
      this.redis.deleteRoomUsers(id),
    ]);
  }

  async findRoomById(id: string): Promise<Room> {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1);

    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: `Room with id ${id} does not exist`,
      });
    }

    return room;
  }
}
