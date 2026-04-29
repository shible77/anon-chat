import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './rooms.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RedisService } from '../redis/redis.service';

@Controller('api/v1/rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async listRooms() {
    const roomList = await this.rooms.listRooms();
    return {
      rooms: roomList.map((r) => ({
        id: r.id,
        name: r.name,
        createdBy: r.createdBy,
        activeUsers: r.activeUsers,
        createdAt: r.createdAt,
      })),
    };
  }

  @Post()
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: { id: string; username: string },
  ) {
    const room = await this.rooms.createRoom(dto.name, user.username);
    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
    };
  }

  @Get(':id')
  async getRoom(@Param('id') id: string) {
    const room = await this.rooms.getRoom(id);
    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      activeUsers: room.activeUsers,
      createdAt: room.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteRoom(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; username: string },
  ) {
    await this.rooms.deleteRoom(id, user.username);
    await this.redis.publish({ type: 'room:deleted', roomId: id });
    return { deleted: true };
  }
}
