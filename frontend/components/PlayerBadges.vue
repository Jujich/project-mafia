<script setup lang="ts">
import type { GamePlayer } from '~/types/game';

const props = withDefaults(
  defineProps<{
    player: GamePlayer;
    immune?: boolean;
    foundByDon?: boolean;
    showRole?: boolean;
  }>(),
  { immune: false, foundByDon: false, showRole: false },
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <UBadge v-if="props.player.isAlive" color="green" variant="soft" size="xs">
      Жив
    </UBadge>
    <UBadge v-else color="gray" variant="soft" size="xs">Выбыл</UBadge>

    <UBadge
      v-if="props.showRole"
      color="gold"
      variant="outline"
      size="xs"
    >
      {{ roleLabel(props.player.role) }}
    </UBadge>

    <template v-if="props.player.isAlive">
      <UBadge v-if="props.immune" color="gold" variant="solid" size="xs">
        Иммунитет
      </UBadge>
      <UBadge v-if="props.immune" color="gold" variant="soft" size="xs">
        Молчит днём
      </UBadge>
      <UBadge v-if="props.foundByDon" color="orange" variant="soft" size="xs">
        Найден Доном
      </UBadge>
    </template>

    <UBadge
      v-if="!props.player.isAlive && props.player.deathReason"
      color="red"
      variant="subtle"
      size="xs"
    >
      {{ DEATH_REASON_LABELS[props.player.deathReason] }}
    </UBadge>
  </div>
</template>
