import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DictionariesService } from './dictionaries.service';

@ApiTags('dictionaries')
@Controller()
export class DictionariesController {
  constructor(private readonly dictionaries: DictionariesService) {}

  @Get('roles')
  @ApiOperation({ summary: 'Список ролей с описанием и кланом' })
  getRoles() {
    return this.dictionaries.getRoles();
  }

  @Get('clans')
  @ApiOperation({ summary: 'Список кланов' })
  getClans() {
    return this.dictionaries.getClans();
  }
}
