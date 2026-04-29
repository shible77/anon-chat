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
import {
  GetMessagesQueryDto,
  MessageResponseDto,
  MessagesPageResponseDto,
  SendMessageDto,
} from './messages.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/swagger/api-response.dto';

@ApiTags('Messages')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/rooms/:id/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated message history' })
  @ApiParam({ name: 'id', description: 'Room identifier' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'before', required: false, type: String, example: 'msg_1x2y3z' })
  @ApiOkResponse({ type: MessagesPageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Send a message to a room' })
  @ApiParam({ name: 'id', description: 'Room identifier' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ErrorResponseDto })
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
