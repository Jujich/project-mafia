import { Injectable } from '@nestjs/common';
import {
  CLAN_DEFINITIONS,
  ClanDefinition,
  ROLE_DEFINITIONS,
  RoleDefinition,
} from '../common/game-data';

@Injectable()
export class DictionariesService {
  getRoles(): RoleDefinition[] {
    return ROLE_DEFINITIONS;
  }

  getClans(): ClanDefinition[] {
    return CLAN_DEFINITIONS;
  }
}
