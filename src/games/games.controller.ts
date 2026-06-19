import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { FinishGameDto } from './dto/finish-game.dto';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  @ApiOperation({ summary: 'Создать игру с игроками и ролями' })
  create(@Body() dto: CreateGameDto) {
    return this.games.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список игр' })
  findAll() {
    return this.games.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали игры со всеми игроками, ночами и днями' })
  findOne(@Param('id') id: string) {
    return this.games.findOne(id);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Начать игру' })
  start(@Param('id') id: string) {
    return this.games.start(id);
  }

  @Patch(':id/finish')
  @ApiOperation({ summary: 'Завершить игру и указать победивший клан' })
  finish(@Param('id') id: string, @Body() dto: FinishGameDto) {
    return this.games.finish(id, dto);
  }
}
