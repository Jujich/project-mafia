import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Role } from '@prisma/client';

export class PlayerAssignmentDto {
  @ApiProperty({ example: 'Антон', description: 'Ник игрока' })
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @ApiProperty({ enum: Role, description: 'Роль игрока в этой игре' })
  @IsEnum(Role)
  role: Role;
}

export class CreateGameDto {
  @ApiProperty({ example: 'Игра №14', description: 'Название игры' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    required: false,
    description: 'Дата/время игры в формате ISO. По умолчанию — текущее время.',
    example: '2026-06-19T19:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  playedAt?: string;

  @ApiProperty({
    type: [PlayerAssignmentDto],
    description: 'Игроки с назначенными ролями',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlayerAssignmentDto)
  players: PlayerAssignmentDto[];
}
