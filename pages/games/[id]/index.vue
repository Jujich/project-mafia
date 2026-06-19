<script setup lang="ts">
import type { Game } from '~/types/game';

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const id = route.params.id as string;
const busy = ref(false);

const { data: game, pending, refresh } = await useFetch<Game>(
  `/api/games/${id}`,
);

useHead(() => ({ title: `${game.value?.title ?? 'Игра'} — Деловая Мафия` }));

const alive = computed(() =>
  (game.value?.players ?? []).filter((p) => p.isAlive),
);
const dead = computed(() =>
  (game.value?.players ?? []).filter((p) => !p.isAlive),
);

const inProgressNight = computed(() =>
  game.value?.nights.find((n) => n.status === 'IN_PROGRESS'),
);
const inProgressDay = computed(() =>
  game.value?.days.find((d) => d.status === 'IN_PROGRESS'),
);

const phaseLabel = computed(() => {
  const g = game.value;
  if (!g) return '';
  if (g.status === 'FINISHED') return 'Игра завершена';
  if (inProgressNight.value) return `Ночь ${inProgressNight.value.number}`;
  if (inProgressDay.value) return `День ${inProgressDay.value.number}`;
  if (g.currentNightNumber > g.currentDayNumber)
    return `Ночь ${g.currentNightNumber} завершена`;
  if (g.currentNightNumber === 0) return 'Готова к первой ночи';
  return `День ${g.currentDayNumber} завершён`;
});

type Cta = { label: string; icon: string; mode: string } | null;
const primaryCta = computed<Cta>(() => {
  const g = game.value;
  if (!g || g.status === 'FINISHED') return null;
  if (g.status === 'SETUP')
    return { label: 'Начать игру', icon: 'i-heroicons-play', mode: 'start' };
  if (inProgressNight.value)
    return { label: 'Продолжить ночь', icon: 'i-heroicons-moon', mode: 'goNight' };
  if (inProgressDay.value)
    return { label: 'Продолжить день', icon: 'i-heroicons-sun', mode: 'goDay' };
  if (g.currentNightNumber > g.currentDayNumber)
    return { label: 'Перейти ко дню', icon: 'i-heroicons-sun', mode: 'startDay' };
  return {
    label: g.currentNightNumber === 0 ? 'Начать первую ночь' : 'Начать следующую ночь',
    icon: 'i-heroicons-moon',
    mode: 'startNight',
  };
});

async function runCta(mode: string) {
  busy.value = true;
  try {
    if (mode === 'start') {
      await api.startGame(id);
      await refresh();
    } else if (mode === 'goNight') {
      await router.push(`/games/${id}/night`);
    } else if (mode === 'goDay') {
      await router.push(`/games/${id}/day`);
    } else if (mode === 'startNight') {
      await api.startNight(id);
      await router.push(`/games/${id}/night`);
    } else if (mode === 'startDay') {
      await api.startDay(id);
      await router.push(`/games/${id}/day`);
    }
  } finally {
    busy.value = false;
  }
}

function foundByDon(role: string) {
  return role === 'COMMISSAR' && !!game.value?.donFoundCommissar;
}
</script>

<template>
  <div v-if="pending" class="text-bronze">Загрузка…</div>
  <div v-else-if="game">
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <NuxtLink
          to="/games"
          class="text-xs text-bronze hover:text-gold-300 inline-flex items-center gap-1"
        >
          <UIcon name="i-heroicons-arrow-left" /> К списку игр
        </NuxtLink>
        <h1 class="font-club text-2xl sm:text-3xl text-gradient-gold mt-1">
          {{ game.title }}
        </h1>
      </div>
      <UBadge :color="STATUS_COLOR[game.status]" variant="soft" size="lg">
        {{ STATUS_LABELS[game.status] }}
      </UBadge>
    </div>

    <!-- state summary -->
    <UCard class="mb-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <UIcon
            :name="
              inProgressNight || game.currentPhase === 'NIGHT'
                ? 'i-heroicons-moon'
                : 'i-heroicons-sun'
            "
            class="text-2xl text-gold-300"
          />
          <div>
            <p class="text-xs uppercase tracking-widest text-bronze">
              Текущая фаза
            </p>
            <p class="text-lg text-champagne">{{ phaseLabel }}</p>
          </div>
        </div>

        <div class="flex items-center gap-5 text-center">
          <div>
            <p class="text-2xl font-club text-champagne">{{ alive.length }}</p>
            <p class="text-xs text-bronze">в игре</p>
          </div>
          <div>
            <p class="text-2xl font-club text-bronze">{{ dead.length }}</p>
            <p class="text-xs text-bronze">выбыло</p>
          </div>
        </div>
      </div>

      <div
        v-if="game.status === 'FINISHED'"
        class="mt-4 rounded-xl bg-navy/50 ring-1 ring-gold-500/30 p-4"
      >
        <p class="text-gold-300 font-semibold inline-flex items-center gap-2">
          <UIcon name="i-heroicons-trophy" />
          Победитель: {{ game.winnerClan ? CLAN_LABELS[game.winnerClan] : '—' }}
        </p>
        <p v-if="game.hostComment" class="text-sm text-champagne/80 mt-1">
          {{ game.hostComment }}
        </p>
      </div>

      <div
        v-if="primaryCta"
        class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <UButton
          :icon="primaryCta.icon"
          color="gold"
          size="xl"
          block
          :loading="busy"
          @click="runCta(primaryCta.mode)"
        >
          {{ primaryCta.label }}
        </UButton>
        <UButton
          :to="`/games/${id}/finish`"
          icon="i-heroicons-flag"
          color="gray"
          variant="soft"
          size="xl"
          block
        >
          Завершить игру
        </UButton>
      </div>
    </UCard>

    <!-- players -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <UCard>
        <template #header>
          <h2 class="font-club text-lg text-champagne flex items-center gap-2">
            <UIcon name="i-heroicons-user-group" class="text-gold-300" />
            В игре ({{ alive.length }})
          </h2>
        </template>
        <ul class="space-y-2">
          <li
            v-for="p in alive"
            :key="p.id"
            class="flex items-center justify-between gap-2 rounded-xl bg-navy/40 ring-1 ring-bronze/15 px-3 py-2.5"
          >
            <div>
              <p class="text-champagne">{{ p.player.nickname }}</p>
              <p class="text-xs text-gold-300/80">{{ roleLabel(p.role) }}</p>
            </div>
            <PlayerBadges :player="p" :found-by-don="foundByDon(p.role)" />
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-club text-lg text-champagne flex items-center gap-2">
            <UIcon name="i-heroicons-x-circle" class="text-bronze" />
            Выбыли ({{ dead.length }})
          </h2>
        </template>
        <ul v-if="dead.length" class="space-y-2">
          <li
            v-for="p in dead"
            :key="p.id"
            class="flex items-center justify-between gap-2 rounded-xl bg-navy/30 px-3 py-2.5 opacity-80"
          >
            <div>
              <p class="text-champagne/80 line-through">
                {{ p.player.nickname }}
              </p>
              <p class="text-xs text-bronze">{{ roleLabel(p.role) }}</p>
            </div>
            <PlayerBadges :player="p" />
          </li>
        </ul>
        <p v-else class="text-sm text-bronze">Пока никто не выбыл.</p>
      </UCard>
    </div>
  </div>
</template>
