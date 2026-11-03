import {
  Body,
  Controller,
  Headers,
  Param,
  Put,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { SyncService } from './sync.service';

function tokenMatches(actual: string | undefined): boolean {
  const expected = process.env.MOBILE_SYNC_TOKEN ?? '';
  if (!expected) {
    throw new ServiceUnavailableException('Мобильная синхронизация не настроена.');
  }
  const actualBuffer = Buffer.from(actual ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

@ApiTags('offline sync')
@Controller('sync/games')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Put(':clientGameId')
  @ApiOperation({
    summary: 'Идемпотентно импортировать локальный снимок игры',
  })
  @ApiHeader({
    name: 'X-Mobile-Sync-Token',
    required: true,
    description: 'Отдельный токен мобильной синхронизации (MOBILE_SYNC_TOKEN).',
  })
  importGame(
    @Param('clientGameId') clientGameId: string,
    @Headers('x-mobile-sync-token') token: string | undefined,
    @Body() body: unknown,
  ) {
    if (!tokenMatches(token)) {
      throw new UnauthorizedException('Неверный токен мобильной синхронизации.');
    }
    return this.sync.importGame(clientGameId, body);
  }
}
