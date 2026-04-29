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
import {
  CreateRoomDto,
  DeleteRoomResponseDto,
  RoomResponseDto,
  RoomsListResponseDto,
  RoomWithActiveUsersResponseDto,
} from './rooms.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RedisService } from '../redis/redis.service';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/swagger/api-response.dto';

@ApiTags('Rooms')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms' })
  @ApiOkResponse({ type: RoomsListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Create a room' })
  @ApiCreatedResponse({ type: RoomResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'A room with this name already exists',
  })
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
  @ApiOperation({ summary: 'Get room details' })
  @ApiParam({ name: 'id', description: 'Room identifier' })
  @ApiOkResponse({ type: RoomWithActiveUsersResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'id', description: 'Room identifier' })
  @ApiOkResponse({ type: DeleteRoomResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Only the room creator can delete this room',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async deleteRoom(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; username: string },
  ) {
    await this.rooms.deleteRoom(id, user.username);
    await this.redis.publish({ type: 'room:deleted', roomId: id });
    return { deleted: true };
  }
}
