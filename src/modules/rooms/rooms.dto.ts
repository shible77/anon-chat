import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: 'general',
    minLength: 3,
    maxLength: 32,
    pattern: '^[a-zA-Z0-9-]+$',
  })
  @IsString()
  @MinLength(3, { message: 'Room name must be between 3 and 32 characters' })
  @MaxLength(32, { message: 'Room name must be between 3 and 32 characters' })
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'Room name may only contain letters, numbers, and hyphens',
  })
  name: string;
}

export class RoomDto {
  @ApiProperty({ example: 'room_a1b2c3d4' })
  id: string;

  @ApiProperty({ example: 'general' })
  name: string;

  @ApiProperty({ example: 'ali_123' })
  createdBy: string;

  @ApiProperty({ example: '2026-04-29T18:40:00.000Z' })
  createdAt: Date;
}

export class RoomWithActiveUsersDto extends RoomDto {
  @ApiProperty({ example: 2, minimum: 0 })
  activeUsers: number;
}

export class RoomsListDataDto {
  @ApiProperty({ type: [RoomWithActiveUsersDto] })
  rooms: RoomWithActiveUsersDto[];
}

export class RoomsListResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: RoomsListDataDto })
  data: RoomsListDataDto;
}

export class RoomResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: RoomDto })
  data: RoomDto;
}

export class RoomWithActiveUsersResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: RoomWithActiveUsersDto })
  data: RoomWithActiveUsersDto;
}

export class DeleteRoomDataDto {
  @ApiProperty({ example: true })
  deleted: true;
}

export class DeleteRoomResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: DeleteRoomDataDto })
  data: DeleteRoomDataDto;
}
