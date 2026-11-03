import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NightsService } from './nights.service';
import { SaveNightActionDto } from './dto/save-night-action.dto';

@ApiTags('nights')
@Controller('games/:id/nights')
export class NightsController {
  constructor(private readonly nights: NightsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Начать следующую ночь' })
  start(@Param('id') id: string) {
    return this.nights.startNight(id);
  }

  @Get('current')
  @ApiOperation({ summary: 'Текущая ночь и шаги ролей' })
  current(@Param('id') id: string) {
    return this.nights.getCurrent(id);
  }

  @Post(':nightId/actions')
  @ApiOperation({ summary: 'Сохранить действие ночной роли' })
  saveAction(
    @Param('id') id: string,
    @Param('nightId') nightId: string,
    @Body() dto: SaveNightActionDto,
  ) {
    return this.nights.saveAction(id, nightId, dto);
  }

  @Post(':nightId/complete')
  @ApiOperation({
    summary: 'Завершить ночь: рассчитать убийства и сформировать итоги',
  })
  complete(@Param('id') id: string, @Param('nightId') nightId: string) {
    return this.nights.complete(id, nightId);
  }
}
