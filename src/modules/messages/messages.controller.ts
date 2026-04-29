import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto, GetMessagesQueryDto } from './messages.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/rooms/:id/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async getMessages(
    @Param('id') roomId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    const result = await this.messages.getMessages(
      roomId,
      query.limit,
      query.before,
    );

    return {
      messages: result.messages.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        username: m.username,
        content: m.content,
        createdAt: m.createdAt,
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }

  @Post()
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async sendMessage(
    @Param('id') roomId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string; username: string },
  ) {
    const message = await this.messages.sendMessage(roomId, user.username, dto.content);

    return {
      id: message.id,
      roomId: message.roomId,
      username: message.username,
      content: message.content,
      createdAt: message.createdAt,
    };
  }
}
