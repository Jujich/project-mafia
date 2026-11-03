<script setup lang="ts">
import type { GameListItem } from '~/types/game';

useHead({ title: 'История игр — Деловая Мафия' });

const { data: games, pending, refresh } = await useApiFetch<GameListItem[]>(
  '/api/games',
);

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3 mb-6">
      <h1 class="font-club text-2xl sm:text-3xl text-gradient-gold">
        История игр
      </h1>
      <div class="flex gap-2">
        <UButton
          icon="i-heroicons-arrow-path"
          color="gray"
          variant="soft"
          :loading="pending"
          @click="refresh()"
        >
          <span class="hidden sm:inline">Обновить</span>
        </UButton>
        <UButton to="/games/new" icon="i-heroicons-plus" color="gold">
          Создать
        </UButton>
      </div>
    </div>

    <div v-if="pending" class="text-bronze">Загрузка…</div>

    <UCard v-else-if="!games || games.length === 0" class="text-center py-10">
      <UIcon
        name="i-heroicons-rectangle-stack"
        class="text-4xl text-bronze mb-2"
      />
      <p class="text-champagne mb-4">Пока нет ни одной игры.</p>
      <UButton to="/games/new" color="gold" icon="i-heroicons-plus">
        Создать первую игру
      </UButton>
    </UCard>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UCard v-for="game in games" :key="game.id">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 class="font-club text-lg text-champagne">{{ game.title }}</h2>
            <p class="text-xs text-bronze mt-0.5">
              {{ formatDate(game.startedAt || game.createdAt) }}
            </p>
          </div>
          <UBadge
            :color="STATUS_COLOR[game.status]"
            variant="soft"
            size="md"
          >
            {{ STATUS_LABELS[game.status] }}
          </UBadge>
        </div>

        <div class="flex items-center gap-4 text-sm text-bronze mb-4">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-heroicons-users" />
            {{ game.playersCount }} игроков
          </span>
          <span
            v-if="game.status === 'FINISHED' && game.winnerClan"
            class="inline-flex items-center gap-1 text-gold-300"
          >
            <UIcon name="i-heroicons-trophy" />
            Победа: {{ CLAN_LABELS[game.winnerClan] }}
          </span>
        </div>

        <UButton
          :to="`/games/${game.id}`"
          color="gold"
          variant="soft"
          block
          icon="i-heroicons-arrow-right-circle"
        >
          Открыть
        </UButton>
      </UCard>
    </div>
  </div>
</template>
