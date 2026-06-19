import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DayStatus,
  EliminationReason,
  GamePhase,
  GameStatus,
  NightActionType,
  NightStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FULL_GAME_INCLUDE } from '../games/games.service';
import { ROLE_LABEL } from '../common/game-data';
import { DayNominationsDto } from './dto/day-nominations.dto';
import { DayEliminationDto } from './dto/day-elimination.dto';

@Injectable()
export class DaysService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Start the day that follows the just-completed night
  // -------------------------------------------------------------------------
  async startDay(gameId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Игра не найдена.');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Игра должна быть запущена.');
    }

    const openDay = await this.prisma.day.findFirst({
      where: { gameId, status: DayStatus.IN_PROGRESS },
    });
    if (openDay) {
      throw new BadRequestException('Текущий день ещё не завершён.');
    }
    if (game.currentDayNumber >= game.currentNightNumber) {
      throw new BadRequestException(
        'Сначала проведите и завершите ночь, затем начинайте день.',
      );
    }

    const lastNight = await this.prisma.night.findFirst({
      where: { gameId, number: game.currentNightNumber },
    });
    if (!lastNight || lastNight.status !== NightStatus.COMPLETED) {
      throw new BadRequestException('Завершите ночь перед началом дня.');
    }

    const number = game.currentNightNumber;
    const day = await this.prisma.day.create({
      data: {
        gameId,
        number,
        status: DayStatus.IN_PROGRESS,
        discussionStartedAt: new Date(),
      },
    });

    await this.prisma.game.update({
      where: { id: gameId },
      data: { currentPhase: GamePhase.DAY, currentDayNumber: number },
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        phase: GamePhase.DAY,
        type: 'DAY_STARTED',
        payload: { dayNumber: number },
      },
    });

    return this.getCurrent(gameId, day.id);
  }

  // -------------------------------------------------------------------------
  // Current day with night summary, deaths, immunity & nomination candidates
  // -------------------------------------------------------------------------
  async getCurrent(gameId: string, knownDayId?: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: { include: { player: true } } },
    });
    if (!game) throw new NotFoundException('Игра не найдена.');

    const day = knownDayId
      ? await this.prisma.day.findUnique({
          where: { id: knownDayId },
          include: {
            nominations: { include: { nominee: { include: { player: true } } } },
            elimination: { include: { eliminated: { include: { player: true } } } },
          },
        })
      : await this.prisma.day.findFirst({
          where: { gameId, status: DayStatus.IN_PROGRESS },
          orderBy: { number: 'desc' },
          include: {
            nominations: { include: { nominee: { include: { player: true } } } },
            elimination: { include: { eliminated: { include: { player: true } } } },
          },
        });

    if (!day) throw new NotFoundException('Нет активного дня.');

    const night = await this.prisma.night.findFirst({
      where: { gameId, number: day.number },
      include: { actions: true },
    });

    // Beauty's immunity from the preceding night carries into this day.
    const beautyAction = night?.actions.find(
      (a) => a.actionType === NightActionType.BEAUTY_IMMUNITY,
    );
    const immuneId = beautyAction?.targetGamePlayerId ?? null;
    const immunePlayerRow = immuneId
      ? game.players.find((p) => p.id === immuneId)
      : null;

    const deathsLastNight = game.players
      .filter(
        (p) =>
          p.deathPhase === 'NIGHT' && p.deathNightNumber === day.number,
      )
      .map((p) => ({
        gamePlayerId: p.id,
        nickname: p.player.nickname,
        role: p.role,
        roleLabel: ROLE_LABEL[p.role],
        deathReason: p.deathReason,
      }));

    const nominationCandidates = game.players
      .filter((p) => p.isAlive && p.id !== immuneId)
      .map((p) => ({
        gamePlayerId: p.id,
        nickname: p.player.nickname,
        role: p.role,
        roleLabel: ROLE_LABEL[p.role],
      }));

    return {
      day: {
        id: day.id,
        number: day.number,
        status: day.status,
        discussionStartedAt: day.discussionStartedAt,
        discussionEndedAt: day.discussionEndedAt,
      },
      nightSummary: night?.summaryText ?? null,
      deathsLastNight,
      immunePlayer:
        immunePlayerRow && immunePlayerRow.isAlive
          ? {
              gamePlayerId: immunePlayerRow.id,
              nickname: immunePlayerRow.player.nickname,
            }
          : null,
      nominationCandidates,
      nominations: day.nominations.map((n) => ({
        gamePlayerId: n.nomineeGamePlayerId,
        nickname: n.nominee.player.nickname,
      })),
      elimination: day.elimination
        ? {
            eliminatedGamePlayerId: day.elimination.eliminatedGamePlayerId,
            nickname: day.elimination.eliminated?.player.nickname ?? null,
            reason: day.elimination.reason,
          }
        : null,
    };
  }

  // -------------------------------------------------------------------------
  // Nominations
  // -------------------------------------------------------------------------
  async saveNominations(gameId: string, dayId: string, dto: DayNominationsDto) {
    const { day, game } = await this.loadDay(gameId, dayId);
    if (day.status !== DayStatus.IN_PROGRESS) {
      throw new BadRequestException('День уже завершён.');
    }

    const ids = Array.from(new Set(dto.nomineeGamePlayerIds));
    if (ids.length === 0) {
      throw new BadRequestException('Выберите хотя бы одного кандидата.');
    }
    if (ids.length > 5) {
      throw new BadRequestException('Можно выставить не более 5 кандидатов.');
    }

    const immuneId = await this.immunePlayerId(gameId, day.number);

    for (const id of ids) {
      const player = game.players.find((p) => p.id === id);
      if (!player) {
        throw new BadRequestException('Игрок не найден в этой игре.');
      }
      if (!player.isAlive) {
        throw new BadRequestException(
          `Нельзя выставить выбывшего игрока (${player.player.nickname}).`,
        );
      }
      if (id === immuneId) {
        throw new BadRequestException(
          `Игрок ${player.player.nickname} под иммунитетом Красотки — его нельзя выставить сегодня.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.voteNomination.deleteMany({ where: { dayId } });
      for (const id of ids) {
        await tx.voteNomination.create({
          data: { dayId, nomineeGamePlayerId: id },
        });
      }
    });

    return this.getCurrent(gameId, dayId);
  }

  // -------------------------------------------------------------------------
  // Elimination (day vote result)
  // -------------------------------------------------------------------------
  async eliminate(gameId: string, dayId: string, dto: DayEliminationDto) {
    const { day, game } = await this.loadDay(gameId, dayId);
    if (day.status !== DayStatus.IN_PROGRESS) {
      throw new BadRequestException('День уже завершён.');
    }

    const eliminatedId = dto.eliminatedGamePlayerId || null;

    if (eliminatedId) {
      const nominations = await this.prisma.voteNomination.findMany({
        where: { dayId },
      });
      const isNominee = nominations.some(
        (n) => n.nomineeGamePlayerId === eliminatedId,
      );
      if (!isNominee) {
        throw new BadRequestException(
          'Вынести можно только игрока из списка кандидатов.',
        );
      }
      const player = game.players.find((p) => p.id === eliminatedId);
      if (!player) throw new BadRequestException('Игрок не найден.');
      if (!player.isAlive) {
        throw new BadRequestException('Этот игрок уже выбыл.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Revert a previously recorded vote-death (host correcting the result).
      const existing = await tx.dayElimination.findUnique({ where: { dayId } });
      if (existing?.eliminatedGamePlayerId) {
        await tx.gamePlayer.update({
          where: { id: existing.eliminatedGamePlayerId },
          data: {
            isAlive: true,
            deathPhase: null,
            deathReason: null,
            deathDayNumber: null,
          },
        });
      }

      await tx.dayElimination.upsert({
        where: { dayId },
        create: {
          dayId,
          eliminatedGamePlayerId: eliminatedId,
          reason: eliminatedId
            ? EliminationReason.VOTE
            : EliminationReason.NO_ELIMINATION,
        },
        update: {
          eliminatedGamePlayerId: eliminatedId,
          reason: eliminatedId
            ? EliminationReason.VOTE
            : EliminationReason.NO_ELIMINATION,
        },
      });

      if (eliminatedId) {
        await tx.gamePlayer.update({
          where: { id: eliminatedId },
          data: {
            isAlive: false,
            deathPhase: 'DAY',
            deathReason: 'VOTE',
            deathDayNumber: day.number,
          },
        });
      }

      await tx.gameEvent.create({
        data: {
          gameId,
          phase: GamePhase.DAY,
          type: 'DAY_ELIMINATION',
          payload: {
            dayNumber: day.number,
            eliminatedGamePlayerId: eliminatedId,
          },
        },
      });
    });

    return this.getCurrent(gameId, dayId);
  }

  // -------------------------------------------------------------------------
  // Complete the day
  // -------------------------------------------------------------------------
  async complete(gameId: string, dayId: string) {
    const { day } = await this.loadDay(gameId, dayId);
    if (day.status !== DayStatus.IN_PROGRESS) {
      throw new BadRequestException('День уже завершён.');
    }

    const elimination = await this.prisma.dayElimination.findUnique({
      where: { dayId },
    });
    if (!elimination) {
      throw new BadRequestException(
        'Сначала отметьте результат голосования (или «никого не вынесли»).',
      );
    }

    await this.prisma.day.update({
      where: { id: dayId },
      data: {
        status: DayStatus.COMPLETED,
        discussionEndedAt: day.discussionEndedAt ?? new Date(),
        completedAt: new Date(),
      },
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        phase: GamePhase.DAY,
        type: 'DAY_COMPLETED',
        payload: { dayNumber: day.number },
      },
    });

    return this.prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: FULL_GAME_INCLUDE,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async loadDay(gameId: string, dayId: string) {
    const day = await this.prisma.day.findUnique({ where: { id: dayId } });
    if (!day || day.gameId !== gameId) {
      throw new NotFoundException('День не найден.');
    }
    const game = await this.prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { players: { include: { player: true } } },
    });
    return { day, game };
  }

  private async immunePlayerId(
    gameId: string,
    dayNumber: number,
  ): Promise<string | null> {
    const night = await this.prisma.night.findFirst({
      where: { gameId, number: dayNumber },
      include: { actions: true },
    });
    const beauty = night?.actions.find(
      (a) => a.actionType === NightActionType.BEAUTY_IMMUNITY,
    );
    return beauty?.targetGamePlayerId ?? null;
  }
}
