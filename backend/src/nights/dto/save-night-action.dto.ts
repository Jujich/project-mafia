import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NightActionType } from '@prisma/client';

export class SaveNightActionDto {
  @ApiProperty({ enum: NightActionType, description: 'Тип ночного действия' })
  @IsEnum(NightActionType)
  actionType: NightActionType;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'GamePlayer id цели. Null/пусто — действие без цели.',
  })
  @IsOptional()
  @IsString()
  targetGamePlayerId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Вторая цель (для Журналиста).',
  })
  @IsOptional()
  @IsString()
  secondTargetGamePlayerId?: string | null;
}
