import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Clan } from '@prisma/client';

export class FinishGameDto {
  @ApiProperty({ enum: Clan, description: 'Победивший клан' })
  @IsEnum(Clan)
  winnerClan: Clan;

  @ApiProperty({ required: false, description: 'Комментарий ведущего' })
  @IsOptional()
  @IsString()
  comment?: string;
}
