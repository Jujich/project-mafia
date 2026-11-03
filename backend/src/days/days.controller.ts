import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DaysService } from './days.service';
import { DayNominationsDto } from './dto/day-nominations.dto';
import { DayEliminationDto } from './dto/day-elimination.dto';

@ApiTags('days')
@Controller('games/:id/days')
export class DaysController {
  constructor(private readonly days: DaysService) {}

  @Post('start')
  @ApiOperation({ summary: 'Начать день после ночи' })
  start(@Param('id') id: string) {
    return this.days.startDay(id);
  }

  @Get('current')
  @ApiOperation({ summary: 'Текущий день: итоги ночи, иммунитет, кандидаты' })
  current(@Param('id') id: string) {
    return this.days.getCurrent(id);
  }

  @Post(':dayId/nominations')
  @ApiOperation({ summary: 'Сохранить кандидатов на голосование' })
  nominations(
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: DayNominationsDto,
  ) {
    return this.days.saveNominations(id, dayId, dto);
  }

  @Post(':dayId/eliminate')
  @ApiOperation({ summary: 'Сохранить результат голосования' })
  eliminate(
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: DayEliminationDto,
  ) {
    return this.days.eliminate(id, dayId, dto);
  }

  @Post(':dayId/complete')
  @ApiOperation({ summary: 'Завершить день' })
  complete(@Param('id') id: string, @Param('dayId') dayId: string) {
    return this.days.complete(id, dayId);
  }
}
