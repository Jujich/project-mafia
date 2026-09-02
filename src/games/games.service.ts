import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, GamePhase, GameStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { clanForRole, ROLE_DEFINITIONS, ROLE_LABEL } from '../common/game-data';
import { CreateGameDto } from './dto/create-game.dto';
import { FinishGameDto } from './dto/finish-game.dto';

/** Full game payload used everywhere the frontend renders the host panel. */
export const FULL_GAME_INCLUDE = {
  players: {
    include: { player: true },
    orderBy: { createdAt: 'asc' },
  },
  nights: {
    include: {
      actions: {
        include: {
          actor: { include: { player: true } },
          target: { include: { player: true } },
          secondTarget: { include: { player: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { number: 'asc' },
  },
  days: {
    include: {
      nominations: { include: { nominee: { include: { player: true } } } },
      elimination: { include: { eliminated: { include: { player: true } } } },
    },
    orderBy: { number: 'asc' },
  },
} satisfies Prisma.GameInclude;

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGameDto) {
    if (!dto.players || dto.players.length === 0) {
      throw new BadRequestException('Нельзя создать игру без игроков.');
    }

    this.validateRoleMultiplicity(dto.players.map((p) => p.role));
    this.validateUniqueNicknames(dto.players.map((p) => p.nickname));

    const playedAt = dto.playedAt ? new Date(dto.playedAt) : new Date();
    if (Number.isNaN(playedAt.getTime())) {
      throw new BadRequestException('Некорректная дата игры.');
    }

    return this.prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          title: dto.title.trim(),
          status: GameStatus.SETUP,
          currentPhase: GamePhase.SETUP,
          playedAt,
        },
      });

      for (const assignment of dto.players) {
        const nickname = assignment.nickname.trim();
        const player = await tx.player.upsert({
          where: { nickname },
          create: { nickname },
          update: {},
        });

        await tx.gamePlayer.create({
          data: {
            gameId: game.id,
            playerId: player.id,
            role: assignment.role,
            clan: clanForRole(assignment.role),
          },
        });
      }

      await tx.gameEvent.create({
        data: {
          gameId: game.id,
          phase: GamePhase.SETUP,
          type: 'GAME_CREATED',
          payload: {
            title: game.title,
            players: dto.players.map((p) => ({
              nickname: p.nickname.trim(),
              role: p.role,
            })),
            playedAt: playedAt.toISOString(),
          },
        },
      });

      return tx.game.findUniqueOrThrow({
        where: { id: game.id },
        include: FULL_GAME_INCLUDE,
      });
    });
  }

  async findAll() {
    const games = await this.prisma.game.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        players: { select: { id: true } },
      },
    });

    return games.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      currentPhase: g.currentPhase,
      startedAt: g.startedAt,
      finishedAt: g.finishedAt,
      winnerClan: g.winnerClan,
      playersCount: g.players.length,
      createdAt: g.createdAt,
    }));
  }

  async findOne(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: FULL_GAME_INCLUDE,
    });
    if (!game) {
      throw new NotFoundException('Игра не найдена.');
    }
    return game;
  }

  async start(id: string) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) {
      throw new NotFoundException('Игра не найдена.');
    }
    if (game.status !== GameStatus.SETUP) {
      throw new BadRequestException('Игра уже запущена или завершена.');
    }

    await this.prisma.game.update({
      where: { id },
      data: {
        status: GameStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    await this.prisma.gameEvent.create({
      data: { gameId: id, phase: GamePhase.SETUP, type: 'GAME_STARTED' },
    });

    return this.findOne(id);
  }

  async finish(id: string, dto: FinishGameDto) {
    const game = await this.prisma.game.findUnique({ where: { id } });
    if (!game) {
      throw new NotFoundException('Игра не найдена.');
    }
    if (game.status === GameStatus.FINISHED) {
      throw new BadRequestException('Игра уже завершена.');
    }

    await this.prisma.game.update({
      where: { id },
      data: {
        status: GameStatus.FINISHED,
        currentPhase: GamePhase.FINISHED,
        finishedAt: new Date(),
        winnerClan: dto.winnerClan,
        hostComment: dto.comment?.trim() || null,
      },
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId: id,
        phase: GamePhase.FINISHED,
        type: 'GAME_FINISHED',
        payload: { winnerClan: dto.winnerClan, comment: dto.comment ?? null },
      },
    });

    return this.findOne(id);
  }

  // -------------------------------------------------------------------------

  private validateRoleMultiplicity(roles: Role[]) {
    const counts = new Map<Role, number>();
    for (const role of roles) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }

    for (const def of ROLE_DEFINITIONS) {
      const count = counts.get(def.role) ?? 0;
      if (!def.canHaveMultiple && count > 1) {
        throw new BadRequestException(
          `Роль «${ROLE_LABEL[def.role]}» может быть только у одного игрока.`,
        );
      }
    }
  }

  private validateUniqueNicknames(nicknames: string[]) {
    const seen = new Set<string>();
    for (const raw of nicknames) {
      const nickname = raw.trim().toLowerCase();
      if (!nickname) {
        throw new BadRequestException('Ник игрока не может быть пустым.');
      }
      if (seen.has(nickname)) {
        throw new BadRequestException(
          `Ник «${raw.trim()}» повторяется. Ники игроков должны быть уникальными.`,
        );
      }
      seen.add(nickname);
    }
  }
}
