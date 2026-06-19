import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class DayNominationsDto {
  @ApiProperty({
    type: [String],
    description: 'GamePlayer id кандидатов на голосование (1–5).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  nomineeGamePlayerIds: string[];
}
