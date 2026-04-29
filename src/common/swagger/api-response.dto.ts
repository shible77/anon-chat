import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({ example: 'ROOM_NOT_FOUND' })
  code: string;

  @ApiProperty({ example: 'Room with id room_abc123 does not exist' })
  message: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: ErrorDetailDto })
  error: ErrorDetailDto;
}
