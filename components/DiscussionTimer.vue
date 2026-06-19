<script setup lang="ts">
const props = withDefaults(defineProps<{ minutes?: number }>(), {
  minutes: 3,
});

const total = computed(() => props.minutes * 60);
const remaining = ref(total.value);
const running = ref(false);
const finished = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;

const display = computed(() => {
  const m = Math.floor(remaining.value / 60)
    .toString()
    .padStart(2, '0');
  const s = (remaining.value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});

const progress = computed(() =>
  Math.round(((total.value - remaining.value) / total.value) * 100),
);

function beep() {
  if (!import.meta.client) return;
  try {
    const Ctx =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const playTone = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + start + 0.35,
      );
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.36);
    };
    playTone(0);
    playTone(0.45);
    playTone(0.9);
    setTimeout(() => ctx.close().catch(() => {}), 1600);
  } catch {
    /* audio not available — silent fallback */
  }
}

function tick() {
  if (remaining.value <= 1) {
    remaining.value = 0;
    stop();
    finished.value = true;
    beep();
    return;
  }
  remaining.value -= 1;
}

function start() {
  if (running.value || remaining.value === 0) return;
  running.value = true;
  finished.value = false;
  intervalId = setInterval(tick, 1000);
}

function pause() {
  stop();
}

function stop() {
  running.value = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function reset() {
  stop();
  remaining.value = total.value;
  finished.value = false;
}

onBeforeUnmount(stop);
</script>

<template>
  <div class="rounded-2xl bg-navy/40 ring-1 ring-bronze/25 p-5 sm:p-6">
    <div class="flex items-center justify-between gap-3 mb-3">
      <h3 class="font-club text-lg text-champagne">Дневное обсуждение</h3>
      <UBadge
        v-if="finished"
        color="red"
        variant="solid"
        size="lg"
        class="animate-pulse"
      >
        Время вышло
      </UBadge>
      <UBadge v-else-if="running" color="green" variant="soft" size="lg">
        Идёт
      </UBadge>
    </div>

    <div
      class="text-center font-club tabular-nums leading-none mb-4"
      :class="finished ? 'text-red-400' : 'text-gradient-gold'"
      style="font-size: clamp(3rem, 16vw, 5rem)"
    >
      {{ display }}
    </div>

    <UProgress
      :value="progress"
      :color="finished ? 'red' : 'gold'"
      size="md"
      class="mb-5"
    />

    <div class="grid grid-cols-3 gap-3">
      <UButton
        block
        size="xl"
        color="gold"
        icon="i-heroicons-play"
        :disabled="running || remaining === 0"
        @click="start"
      >
        Старт
      </UButton>
      <UButton
        block
        size="xl"
        color="gold"
        variant="soft"
        icon="i-heroicons-pause"
        :disabled="!running"
        @click="pause"
      >
        Пауза
      </UButton>
      <UButton
        block
        size="xl"
        color="gray"
        variant="soft"
        icon="i-heroicons-arrow-path"
        @click="reset"
      >
        Сброс
      </UButton>
    </div>
  </div>
</template>
