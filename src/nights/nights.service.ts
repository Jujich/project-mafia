import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Clan,
  GamePhase,
  GameStatus,
  NightActionType,
  NightStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FULL_GAME_INCLUDE } from '../games/games.service';
import { buildNightSteps, NightStep, StepPlayer } from './night-steps';
import { resolveNight, ResolverPlayer } from './night-resolution';
import { SaveNightActionDto } from './dto/save-night-action.dto';

const GAME_WITH_PLAYERS = {
  players: { include: { player: true }, orderBy: { createdAt: 'asc' } },
} as const;

@Injectable()
export class NightsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Start the next night
  // -------------------------------------------------------------------------
  async startNight(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: GAME_WITH_PLAYERS,
    });
    if (!game) throw new NotFoundException('Игра не найдена.');
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Игра должна быть запущена, чтобы начать ночь.',
      );
    }

    const openNight = await this.prisma.night.findFirst({
      where: { gameId, status: NightStatus.IN_PROGRESS },
    });
    if (openNight) {
      throw new BadRequestException('Предыдущая ночь ещё не завершена.');
    }
    if (game.currentNightNumber !== game.currentDayNumber) {
      throw new BadRequestException(
        'Сначала завершите текущий день, затем начинайте следующую ночь.',
      );
    }

    const nextNumber = game.currentNightNumber + 1;

    const commissar = game.players.find((p) => p.role === Role.COMMISSAR);
    const commissarDead = !!commissar && !commissar.isAlive;
    const donFoundEarlier =
      game.donFoundCommissar &&
      game.donFoundCommissarNightNumber != null &&
      nextNumber > game.donFoundCommissarNightNumber;
    const donActsWithMafia =
      game.donActsWithMafia || donFoundEarlier || commissarDead;

    const night = await this.prisma.night.create({
      data: { gameId, number: nextNumber, status: NightStatus.IN_PROGRESS },
    });

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        currentPhase: GamePhase.NIGHT,
        currentNightNumber: nextNumber,
        donActsWithMafia,
      },
    });

    await this.prisma.gameEvent.create({
      data: {
        gameId,
        phase: GamePhase.NIGHT,
        type: 'NIGHT_STARTED',
        payload: { nightNumber: nextNumber, donActsWithMafia },
      },
    });

    return this.getCurrent(gameId);
  }

  // -------------------------------------------------------------------------
  // Current night + steps
  // -------------------------------------------------------------------------
  async getCurrent(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: GAME_WITH_PLAYERS,
    });
    if (!game) throw new NotFoundException('Игра не найдена.');

    const night = await this.prisma.night.findFirst({
      where: { gameId, status: NightStatus.IN_PROGRESS },
      include: { actions: true },
      orderBy: { number: 'desc' },
    });
    if (!night) {
      throw new NotFoundException('Нет активной ночи.');
    }

    const steps = buildNightSteps(this.toStepPlayers(game.players), {
      nightNumber: night.number,
      donActsWithMafia: game.donActsWithMafia,
      doctorSelfHealUsed: game.doctorSelfHealUsed,
    });

    const actionsByType = new Map(night.actions.map((a) => [a.actionType, a]));

    return {
      night: {
        id: night.id,
        number: night.number,
        status: night.status,
        summaryText: night.summaryText,
      },
      donActsWithMafia: game.donActsWithMafia,
      steps: steps.map((step) => {
        const saved = actionsByType.get(step.actionType);
        return {
          ...step,
          savedAction: saved
            ? {
                id: saved.id,
                targetGamePlayerId: saved.targetGamePlayerId,
                secondTargetGamePlayerId: saved.secondTargetGamePlayerId,
                result: saved.result,
                publicText: saved.publicText,
                privateText: saved.privateText,
              }
            : null,
        };
      }),
    };
  }

  // -------------------------------------------------------------------------
  // Save a night action
  // -------------------------------------------------------------------------
  async saveAction(gameId: string, nightId: string, dto: SaveNightActionDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: GAME_WITH_PLAYERS,
    });
    if (!game) throw new NotFoundException('Игра не найдена.');

    const night = await this.prisma.night.findUnique({ where: { id: nightId } });
    if (!night || night.gameId !== gameId) {
      throw new NotFoundException('Ночь не найдена.');
    }
    if (night.status !== NightStatus.IN_PROGRESS) {
      throw new BadRequestException('Ночь уже завершена.');
    }

    const players = this.toStepPlayers(game.players);
    const steps = buildNightSteps(players, {
      nightNumber: night.number,
      donActsWithMafia: game.donActsWithMafia,
      doctorSelfHealUsed: game.doctorSelfHealUsed,
    });

    const step = steps.find((s) => s.actionType === dto.actionType);
    if (!step) {
      throw new BadRequestException(
        'Эта роль сейчас не просыпается и не может действовать.',
      );
    }

    const target = this.resolveTarget(step, dto.targetGamePlayerId, players);
    const secondTarget =
      step.selection === 'double'
        ? this.resolveSecondTarget(step, dto, players, target)
        : null;

    // Role-specific guards (spec §16).
    if (step.actionType === NightActionType.DOCTOR_HEAL && target) {
      const doctorId = this.actorIdForStep(step, players);
      if (target.id === doctorId && game.doctorSelfHealUsed) {
        throw new BadRequestException(
          'Доктор уже использовал самолечение в этой игре.',
        );
      }
    }

    const feedback = this.computeFeedback(step.actionType, target, secondTarget);

    // Don found / un-found bookkeeping (corrections within the same night).
    if (step.actionType === NightActionType.DON_CHECK) {
      if (feedback.result === 'FOUND') {
        await this.prisma.game.update({
          where: { id: gameId },
          data: {
            donFoundCommissar: true,
            donFoundCommissarNightNumber: night.number,
          },
        });
      } else if (
        game.donFoundCommissar &&
        game.donFoundCommissarNightNumber === night.number
      ) {
        await this.prisma.game.update({
          where: { id: gameId },
          data: { donFoundCommissar: false, donFoundCommissarNightNumber: null },
        });
      }
    }

    // One action per type per night — replace on re-save.
    await this.prisma.nightAction.deleteMany({
      where: { nightId, actionType: dto.actionType },
    });

    const action = await this.prisma.nightAction.create({
      data: {
        nightId,
        actorRole: step.role,
        actionType: dto.actionType,
        actorGamePlayerId: this.actorIdForStep(step, players),
        targetGamePlayerId: target?.id ?? null,
        secondTargetGamePlayerId: secondTarget?.id ?? null,
        result: feedback.result,
        publicText: feedback.publicText,
        privateText: feedback.privateText,
      },
      include: {
        target: { include: { player: true } },
        secondTarget: { include: { player: true } },
      },
    });

    return {
      action: {
        id: action.id,
        actionType: action.actionType,
        targetGamePlayerId: action.targetGamePlayerId,
        secondTargetGamePlayerId: action.secondTargetGamePlayerId,
        result: action.result,
        publicText: action.publicText,
        privateText: action.privateText,
      },
      feedback,
    };
  }

  // -------------------------------------------------------------------------
  // Complete the night (central resolution)
  // -------------------------------------------------------------------------
  async complete(gameId: string, nightId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: GAME_WITH_PLAYERS,
    });
    if (!game) throw new NotFoundException('Игра не найдена.');

    const night = await this.prisma.night.findUnique({
      where: { id: nightId },
      include: { actions: true },
    });
    if (!night || night.gameId !== gameId) {
      throw new NotFoundException('Ночь не найдена.');
    }
    if (night.status !== NightStatus.IN_PROGRESS) {
      throw new BadRequestException('Ночь уже завершена.');
    }

    const players = this.toStepPlayers(game.players);
    const steps = buildNightSteps(players, {
      nightNumber: night.number,
      donActsWithMafia: game.donActsWithMafia,
      doctorSelfHealUsed: game.doctorSelfHealUsed,
    });

    // All required steps must have a saved action (spec §16).
    const savedTypes = new Set(night.actions.map((a) => a.actionType));
    const missing = steps
      .filter((s) => s.requiresAction && !savedTypes.has(s.actionType))
      .map((s) => s.title);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Заполните действия ролей перед завершением ночи: ${missing.join(', ')}.`,
      );
    }

    const byType = (t: NightActionType) =>
      night.actions.find((a) => a.actionType === t) ?? null;

    const resolverPlayers: ResolverPlayer[] = game.players.map((gp) => ({
      id: gp.id,
      nickname: gp.player.nickname,
      role: gp.role,
      clan: gp.clan,
      isAlive: gp.isAlive,
    }));

    const result = resolveNight({
      nightNumber: night.number,
      donFoundCommissar: game.donFoundCommissar,
      donFoundCommissarNightNumber: game.donFoundCommissarNightNumber,
      players: resolverPlayers,
      actions: {
        beautyTargetId: byType(NightActionType.BEAUTY_IMMUNITY)?.targetGamePlayerId,
        mafiaTargetId: byType(NightActionType.MAFIA_KILL)?.targetGamePlayerId,
        maniacTargetId: byType(NightActionType.MANIAC_KILL)?.targetGamePlayerId,
        doctorTargetId: byType(NightActionType.DOCTOR_HEAL)?.targetGamePlayerId,
        doctorActorId: byType(NightActionType.DOCTOR_HEAL)?.actorGamePlayerId,
        copTargetId: byType(NightActionType.COP_SHOOT)?.targetGamePlayerId,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const death of result.deaths) {
        await tx.gamePlayer.update({
          where: { id: death.gamePlayerId },
          data: {
            isAlive: false,
            deathPhase: 'NIGHT',
            deathReason: death.reason,
            deathNightNumber: night.number,
          },
        });

        // Record the delayed Commissar kill as an explicit action for the audit.
        if (death.reason === 'DON_DELAYED') {
          await tx.nightAction.create({
            data: {
              nightId,
              actorRole: Role.DON,
              actionType: NightActionType.DON_DELAYED_KILL,
              targetGamePlayerId: death.gamePlayerId,
              result: 'KILLED',
            },
          });
        }
      }

      if (result.doctorSelfHealUsedNow) {
        await tx.game.update({
          where: { id: gameId },
          data: { doctorSelfHealUsed: true },
        });
      }

      await tx.night.update({
        where: { id: nightId },
        data: {
          status: NightStatus.COMPLETED,
          summaryText: result.summaryText,
          completedAt: new Date(),
        },
      });

      await tx.gameEvent.create({
        data: {
          gameId,
          phase: GamePhase.NIGHT,
          type: 'NIGHT_COMPLETED',
          payload: {
            nightNumber: night.number,
            deaths: result.deaths as unknown as Prisma.JsonArray,
            summaryText: result.summaryText,
          },
        },
      });
    });

    return this.prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: FULL_GAME_INCLUDE,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toStepPlayers(
    players: { id: string; role: Role; clan: Clan; isAlive: boolean; player: { nickname: string } }[],
  ): StepPlayer[] {
    return players.map((p) => ({
      id: p.id,
      nickname: p.player.nickname,
      role: p.role,
      clan: p.clan,
      isAlive: p.isAlive,
    }));
  }

  private actorIdForStep(step: NightStep, players: StepPlayer[]): string | null {
    const alive = players.filter((p) => p.isAlive);
    if (step.actionType === NightActionType.MAFIA_KILL) {
      const don = alive.find((p) => p.role === Role.DON);
      if (step.title.includes('Дон') && don) return don.id;
      return alive.find((p) => p.role === Role.MAFIA)?.id ?? don?.id ?? null;
    }
    return alive.find((p) => p.role === step.role)?.id ?? null;
  }

  private resolveTarget(
    step: NightStep,
    targetId: string | null | undefined,
    players: StepPlayer[],
  ): StepPlayer | null {
    if (step.selection === 'none') return null;

    if (!targetId) {
      if (!step.allowNoTarget) {
        throw new BadRequestException(
          `Для шага «${step.title}» нужно выбрать игрока.`,
        );
      }
      return null;
    }

    const eligible = new Set(step.eligibleTargets.map((t) => t.gamePlayerId));
    if (!eligible.has(targetId)) {
      throw new BadRequestException(
        'Нельзя выбрать этого игрока: он недоступен как цель действия.',
      );
    }
    return players.find((p) => p.id === targetId) ?? null;
  }

  private resolveSecondTarget(
    step: NightStep,
    dto: SaveNightActionDto,
    players: StepPlayer[],
    firstTarget: StepPlayer | null,
  ): StepPlayer | null {
    if (!dto.targetGamePlayerId || !dto.secondTargetGamePlayerId) {
      throw new BadRequestException('Журналист должен выбрать двух игроков.');
    }
    if (dto.targetGamePlayerId === dto.secondTargetGamePlayerId) {
      throw new BadRequestException(
        'Журналист должен выбрать двух разных игроков.',
      );
    }
    const eligible = new Set(step.eligibleTargets.map((t) => t.gamePlayerId));
    if (!eligible.has(dto.secondTargetGamePlayerId)) {
      throw new BadRequestException(
        'Вторая цель недоступна для проверки Журналиста.',
      );
    }
    void firstTarget;
    return players.find((p) => p.id === dto.secondTargetGamePlayerId) ?? null;
  }

  private computeFeedback(
    actionType: NightActionType,
    target: StepPlayer | null,
    secondTarget: StepPlayer | null,
  ): { result: string | null; publicText: string | null; privateText: string | null } {
    switch (actionType) {
      case NightActionType.BEAUTY_IMMUNITY:
        return {
          result: null,
          publicText: target
            ? `Красотка дала иммунитет игроку ${target.nickname}. Этого игрока нельзя убить этой ночью, нельзя выставить и вынести днём. Игрок молчит в обсуждении, но может выставить другого игрока.`
            : null,
          privateText: null,
        };

      case NightActionType.COMMISSAR_CHECK: {
        if (!target) return { result: null, publicText: null, privateText: null };
        const isMafia = target.clan === Clan.MAFIA;
        return {
          result: isMafia ? 'MAFIA' : 'NOT_MAFIA',
          publicText: isMafia ? 'Комиссар нашёл мафию.' : null,
          privateText: isMafia ? 'Это мафия.' : 'Это не мафия.',
        };
      }

      case NightActionType.DON_CHECK: {
        if (!target) return { result: 'NONE', publicText: null, privateText: null };
        const found = target.role === Role.COMMISSAR;
        return {
          result: found ? 'FOUND' : 'NOT_FOUND',
          publicText: null,
          privateText: found
            ? 'Дон нашёл Комиссара. Этой ночью это не объявляется. Со следующей ночи Дон просыпается вместе с мафией и выбирает цель убийства. После следующей ночи объяви смерть Комиссара.'
            : 'Это не Комиссар.',
        };
      }

      case NightActionType.JOURNALIST_COMPARE: {
        if (!target || !secondTarget) {
          return { result: null, publicText: null, privateText: null };
        }
        const same = target.clan === secondTarget.clan;
        return {
          result: same ? 'SAME_CLAN' : 'DIFFERENT_CLAN',
          publicText: null,
          privateText: same
            ? 'Игроки из одного клана.'
            : 'Игроки из разных кланов.',
        };
      }

      case NightActionType.COP_SHOOT: {
        if (!target) return { result: 'NONE', publicText: null, privateText: null };
        const willKill =
          target.role === Role.MAFIA ||
          target.role === Role.DON ||
          target.role === Role.MANIAC;
        return {
          result: willKill ? 'HIT' : 'MISS',
          publicText: null,
          privateText: willKill
            ? `Коп попал. Утром в итогах будет: Коп убил игрока ${target.nickname}.`
            : 'Коп выбрал мирного игрока. Ничего не произойдёт.',
        };
      }

      default:
        // MAFIA_KILL, MANIAC_KILL, DOCTOR_HEAL, WHITE_MARK_WAKE — resolved later.
        return { result: null, publicText: null, privateText: null };
    }
  }
}
