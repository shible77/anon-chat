import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@modules/database/database.module';
import { RedisModule } from '@modules/redis/index';
import { AuthModule } from '@modules/auth/auth.module';
import { RoomsModule } from '@modules/rooms/rooms.module';
import { MessagesModule } from '@modules/messages/messages.module';
import { ChatModule } from '@modules/chat/chat.module';

@Module({
  imports: [
    // Config must be first so other modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    RoomsModule,
    MessagesModule,
    ChatModule,
  ],
})
export class AppModule {}
