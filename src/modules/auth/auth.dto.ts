import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'ali_123',
    minLength: 2,
    maxLength: 24,
    pattern: '^[a-zA-Z0-9_]+$',
  })
  @IsString()
  @MinLength(2, { message: 'username must be between 2 and 24 characters' })
  @MaxLength(24, { message: 'username must be between 2 and 24 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username: string;
}

export class AuthUserDto {
  @ApiProperty({ example: 'usr_9g4f2m3q' })
  id: string;

  @ApiProperty({ example: 'ali_123' })
  username: string;

  @ApiProperty({ example: '2026-04-29T18:32:11.481Z' })
  createdAt: Date;
}

export class LoginResponseDataDto {
  @ApiProperty({
    example: 'sess_VW8L6Bhj8b1g2gTHfK8k0oT0slA67Wrz8nYQ',
  })
  sessionToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: LoginResponseDataDto })
  data: LoginResponseDataDto;
}
