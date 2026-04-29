import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [AuthModule, RoomsModule],
  providers: [ChatGateway],
})
export class ChatModule {}
