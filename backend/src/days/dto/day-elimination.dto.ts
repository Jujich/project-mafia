import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DayEliminationDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'GamePlayer id вынесенного игрока. Пусто/null — «никого не вынесли».',
  })
  @IsOptional()
  @IsString()
  eliminatedGamePlayerId?: string | null;
}
