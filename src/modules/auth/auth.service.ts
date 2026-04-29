import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleDB, DRIZZLE } from '@modules/database/database.module';
import { users, User } from '@modules/database/schema';
import { RedisService } from '@modules/redis/redis.service';
import { generateId } from '@common/utils/id.util';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get or create a user by username, then issue a fresh session token.
   * Idempotent by username — same user always gets a new token.
   */
  async login(username: string): Promise<{ sessionToken: string; user: User }> {
    // Find existing user or create a new one
    let user = await this.findUserByUsername(username);

    if (!user) {
      const [created] = await this.db
        .insert(users)
        .values({ id: generateId.user(), username })
        .returning();
      user = created;
    }

    // Always issue a fresh session token (invalidates nothing — multiple
    // sessions per user are allowed; they expire independently via Redis TTL)
    const sessionToken = generateId.session();
    await this.redis.setSession(sessionToken, user.id);

    return { sessionToken, user };
  }

  async findUserById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user ?? null;
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user ?? null;
  }
}
