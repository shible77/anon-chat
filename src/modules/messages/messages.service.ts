import { Injectable, Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, eq, lt, desc } from 'drizzle-orm';
import { DrizzleDB, DRIZZLE } from '../database/database.module';
import { messages, rooms, Message } from '../database/schema';
import { RedisService } from '../redis/redis.service';
import { generateId } from '../../common/utils/id.util';

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly redis: RedisService,
  ) {}

  async getMessages(
    roomId: string,
    limit: number = 50,
    before?: string,
  ): Promise<PaginatedMessages> {
    // Verify room exists
    const [room] = await this.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: `Room with id ${roomId} does not exist` });
    }

    // Cursor-based pagination: fetch one extra row to determine hasMore
    const fetchLimit = limit + 1;

    let conditions = eq(messages.roomId, roomId);

    if (before) {
      // Find the createdAt of the cursor message for comparison
      const [cursor] = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, before))
        .limit(1);

      if (cursor) {
        conditions = and(
          eq(messages.roomId, roomId),
          lt(messages.createdAt, cursor.createdAt),
        ) as any;
      }
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(conditions)
      .orderBy(desc(messages.createdAt))
      .limit(fetchLimit);

    // Rows come back newest-first; reverse for chronological display
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    const nextCursor = hasMore ? page[0]?.id ?? null : null;

    return { messages: page, hasMore, nextCursor };
  }

  async sendMessage(
    roomId: string,
    username: string,
    content: string,
  ): Promise<Message> {
    const trimmed = content.trim();

    if (!trimmed) {
      throw new UnprocessableEntityException({
        code: 'MESSAGE_EMPTY',
        message: 'Message content cannot be empty',
      });
    }

    if (trimmed.length > 1000) {
      throw new UnprocessableEntityException({
        code: 'MESSAGE_TOO_LONG',
        message: 'Message content must not exceed 1000 characters',
      });
    }

    // Verify room exists
    const [room] = await this.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: `Room with id ${roomId} does not exist` });
    }

    const [message] = await this.db
      .insert(messages)
      .values({
        id: generateId.message(),
        roomId,
        username,
        content: trimmed,
      })
      .returning();

    // Publish to Redis pub/sub — the WebSocket gateway subscribes and fans out.
    // We never emit directly from the REST controller.
    await this.redis.publish({
      type: 'message:new',
      roomId,
      message: {
        id: message.id,
        username: message.username,
        content: message.content,
        createdAt: message.createdAt,
      },
    });

    return message;
  }
}
