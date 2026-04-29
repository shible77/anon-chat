import { IsString, IsOptional, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    example: 'hello everyone',
    minLength: 1,
    maxLength: 1000,
    description: 'The server trims leading and trailing whitespace before saving.',
  })
  @IsString()
  @MinLength(1, { message: 'Message content cannot be empty' })
  @MaxLength(1000, { message: 'Message content must not exceed 1000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;
}

export class GetMessagesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    example: 'msg_1x2y3z',
    description: 'Fetch messages older than the message represented by this cursor id.',
  })
  @IsOptional()
  @IsString()
  before?: string;
}

export class MessageDto {
  @ApiProperty({ example: 'msg_3jk82p' })
  id: string;

  @ApiProperty({ example: 'room_a1b2c3d4' })
  roomId: string;

  @ApiProperty({ example: 'ali_123' })
  username: string;

  @ApiProperty({ example: 'hello everyone' })
  content: string;

  @ApiProperty({ example: '2026-04-29T19:02:55.003Z' })
  createdAt: Date;
}

export class MessagesPageDto {
  @ApiProperty({
    type: [MessageDto],
    description: 'Messages are returned in chronological order within the page.',
  })
  messages: MessageDto[];

  @ApiProperty({ example: true })
  hasMore: boolean;

  @ApiProperty({
    nullable: true,
    example: 'msg_1x2y3z',
    description: 'Use this message id as the next `before` cursor.',
  })
  nextCursor: string | null;
}

export class MessagesPageResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: MessagesPageDto })
  data: MessagesPageDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: MessageDto })
  data: MessageDto;
}
