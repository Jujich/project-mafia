<script setup lang="ts">
import type { Game, NightCurrent, NightStep } from '~/types/game';

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const id = route.params.id as string;

useHead({ title: 'Ночь — Деловая Мафия' });

const {
  data: current,
  pending,
  error,
} = await useApiFetch<NightCurrent>(`/api/games/${id}/nights/current`);

const steps = computed<NightStep[]>(() => current.value?.steps ?? []);
const nightId = computed(() => current.value?.night.id ?? '');
const nightNumber = computed(() => current.value?.night.number ?? 0);

const NONE = '__none__';

// local selection + saved state, keyed by actionType
const selections = reactive<Record<string, { target: string; second: string }>>(
  {},
);
const saved = reactive<Record<string, boolean>>({});
const feedback = reactive<
  Record<string, { result: string | null; publicText: string | null; privateText: string | null }>
>({});

watchEffect(() => {
  for (const s of steps.value) {
    if (!(s.actionType in selections)) {
      const a = s.savedAction;
      selections[s.actionType] = {
        target: a
          ? a.targetGamePlayerId ?? (s.allowNoTarget ? NONE : '')
          : '',
        second: a?.secondTargetGamePlayerId ?? '',
      };
      if (a) {
        saved[s.actionType] = true;
        feedback[s.actionType] = {
          result: a.result,
          publicText: a.publicText,
          privateText: a.privateText,
        };
      }
    }
  }
});

const currentIndex = ref(0);
const step = computed<NightStep | undefined>(() => steps.value[currentIndex.value]);
const saving = ref(false);

function optionsFor(s: NightStep) {
  const opts = s.eligibleTargets.map((t) => ({
    value: t.gamePlayerId,
    label: `${t.nickname} · ${t.roleLabel}`,
  }));
  if (s.allowNoTarget) {
    return [{ value: NONE, label: '— Никого —' }, ...opts];
  }
  return opts;
}

async function saveCurrent() {
  const s = step.value;
  if (!s) return;
  const sel = selections[s.actionType];

  if (s.selection !== 'none') {
    if (!sel.target) {
      useToast().add({
        title: 'Выберите игрока',
        color: 'orange',
        icon: 'i-heroicons-exclamation-triangle',
      });
      return;
    }
    if (s.selection === 'double' && (!sel.second || sel.second === sel.target)) {
      useToast().add({
        title: 'Выберите двух разных игроков',
        color: 'orange',
        icon: 'i-heroicons-exclamation-triangle',
      });
      return;
    }
  }

  saving.value = true;
  try {
    const res = await api.saveNightAction(id, nightId.value, {
      actionType: s.actionType,
      targetGamePlayerId:
        s.selection === 'none' || sel.target === NONE ? null : sel.target,
      secondTargetGamePlayerId:
        s.selection === 'double' ? sel.second : undefined,
    });
    saved[s.actionType] = true;
    feedback[s.actionType] = res.feedback;
    useToast().add({
      title: 'Действие сохранено',
      color: 'green',
      icon: 'i-heroicons-check-circle',
    });
  } finally {
    saving.value = false;
  }
}

function markActionChanged(actionType: string) {
  if (!saved[actionType]) return;
  saved[actionType] = false;
  delete feedback[actionType];
}

const canComplete = computed(() =>
  steps.value.every((s) => !s.requiresAction || saved[s.actionType]),
);

const hiddenReviewActions = new Set([
  'DOCTOR_HEAL',
  'JOURNALIST_COMPARE',
  'WHITE_MARK_WAKE',
]);
const reviewSteps = computed(() =>
  steps.value.filter((s) => !hiddenReviewActions.has(s.actionType)),
);

function next() {
  if (currentIndex.value < steps.value.length - 1) currentIndex.value += 1;
}
function prev() {
  if (currentIndex.value > 0) currentIndex.value -= 1;
}

// completion
const reviewOpen = ref(false);
const completing = ref(false);
const result = ref<{ summary: string | null } | null>(null);

function nick(s: NightStep, id?: string) {
  return s.eligibleTargets.find((x) => x.gamePlayerId === id)?.nickname ?? '?';
}

// Human-readable description of each role's night action, for the review.
function actionSummary(s: NightStep) {
  if (s.requiresAction && !saved[s.actionType]) {
    return 'Действие не сохранено';
  }

  const sel = selections[s.actionType];
  const hasTarget = !!sel?.target && sel.target !== NONE;
  const actionResult = feedback[s.actionType]?.result;
  const t = () => nick(s, sel?.target);

  switch (s.actionType) {
    case 'BEAUTY_IMMUNITY':
      return hasTarget
        ? `Красотка дала иммунитет игроку ${t()}`
        : 'Красотка никого не выбрала';
    case 'MAFIA_KILL':
      return hasTarget ? `Мафия убила игрока ${t()}` : 'Мафия никого не убила';
    case 'MANIAC_KILL':
      return hasTarget ? `Маньяк убил игрока ${t()}` : 'Маньяк никого не убил';
    case 'COMMISSAR_CHECK':
      return actionResult === 'MAFIA'
        ? 'Комиссар нашёл мафию'
        : 'Комиссар не нашёл мафию';
    case 'DON_CHECK':
      return actionResult === 'FOUND'
        ? 'Дон нашёл комиссара. Комиссар живёт ещё одну ночь, потом умирает'
        : 'Дон не нашёл комиссара';
    case 'COP_SHOOT':
      return actionResult === 'HIT'
        ? `Коп нашёл игрока ${t()}`
        : 'Коп не нашёл';
    default:
      return s.title;
  }
}

async function completeNight() {
  completing.value = true;
  try {
    const game = await api.completeNight(id, nightId.value);
    reviewOpen.value = false;
    const night = (game as Game).nights.find((n) => n.id === nightId.value);
    result.value = { summary: night?.summaryText ?? null };
  } finally {
    completing.value = false;
  }
}

async function goToDay() {
  await api.startDay(id);
  await router.push(`/games/${id}/day`);
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3 mb-4">
      <NuxtLink
        :to="`/games/${id}`"
        class="text-xs text-bronze hover:text-gold-300 inline-flex items-center gap-1"
      >
        <UIcon name="i-heroicons-arrow-left" /> К панели игры
      </NuxtLink>
    </div>

    <div v-if="pending" class="text-bronze">Загрузка ночи…</div>

    <UCard v-else-if="error" class="text-center py-10">
      <UIcon name="i-heroicons-moon" class="text-4xl text-bronze mb-2" />
      <p class="text-champagne mb-4">Нет активной ночи для этой игры.</p>
      <UButton :to="`/games/${id}`" color="gold">Вернуться на панель</UButton>
    </UCard>

    <!-- RESULT after completion -->
    <UCard v-else-if="result">
      <template #header>
        <h1 class="font-club text-2xl text-gradient-gold">
          Итоги ночи {{ nightNumber }}
        </h1>
      </template>
      <p
        v-if="result.summary"
        class="whitespace-pre-line text-lg text-champagne leading-relaxed"
      >
        {{ result.summary }}
      </p>
      <p v-else class="text-bronze">Этой ночью ничего не произошло.</p>

      <template #footer>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UButton
            color="gold"
            size="xl"
            icon="i-heroicons-sun"
            block
            @click="goToDay"
          >
            Перейти ко дню
          </UButton>
          <UButton
            :to="`/games/${id}`"
            color="gray"
            variant="soft"
            size="xl"
            block
          >
            На панель игры
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- STEPPER -->
    <div v-else-if="step">
      <h1 class="font-club text-3xl sm:text-4xl text-gradient-gold mb-1">
        Ночь {{ nightNumber }}
      </h1>
      <p class="text-bronze text-sm mb-4">
        Шаг {{ currentIndex + 1 }} из {{ steps.length }}
      </p>

      <!-- step dots -->
      <div class="flex flex-wrap gap-1.5 mb-5">
        <button
          v-for="(s, i) in steps"
          :key="s.key"
          class="h-2.5 rounded-full transition-all"
          :class="[
            i === currentIndex ? 'w-8 bg-gold-400' : 'w-2.5',
            saved[s.actionType]
              ? 'bg-green-500'
              : i === currentIndex
                ? 'bg-gold-400'
                : 'bg-bronze/40',
          ]"
          @click="currentIndex = i"
        />
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-club text-xl text-champagne flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="text-gold-300" />
              {{ step.title }}
            </h2>
            <UBadge
              v-if="saved[step.actionType]"
              color="green"
              variant="soft"
            >
              Сохранено
            </UBadge>
          </div>
        </template>

        <p class="whitespace-pre-line text-champagne/90 leading-relaxed mb-5">
          {{ step.hostText }}
        </p>

        <!-- target selection -->
        <div v-if="step.selection === 'single'" class="space-y-2">
          <UFormGroup label="Цель действия">
            <USelect
              v-model="selections[step.actionType].target"
              :options="optionsFor(step)"
              value-attribute="value"
              option-attribute="label"
              placeholder="Выберите игрока"
              size="xl"
              :disabled="saving"
              @update:model-value="markActionChanged(step.actionType)"
            />
          </UFormGroup>
        </div>

        <div v-else-if="step.selection === 'double'" class="space-y-3">
          <UFormGroup label="Первый игрок">
            <USelect
              v-model="selections[step.actionType].target"
              :options="optionsFor(step)"
              value-attribute="value"
              option-attribute="label"
              placeholder="Выберите игрока"
              size="xl"
              :disabled="saving"
              @update:model-value="markActionChanged(step.actionType)"
            />
          </UFormGroup>
          <UFormGroup label="Второй игрок">
            <USelect
              v-model="selections[step.actionType].second"
              :options="optionsFor(step)"
              value-attribute="value"
              option-attribute="label"
              placeholder="Выберите игрока"
              size="xl"
              :disabled="saving"
              @update:model-value="markActionChanged(step.actionType)"
            />
          </UFormGroup>
        </div>

        <p v-else class="text-sm text-bronze italic">
          Для этой роли действие не требуется.
        </p>

        <!-- feedback -->
        <div v-if="feedback[step.actionType]" class="mt-4 space-y-2">
          <UAlert
            v-if="feedback[step.actionType].publicText"
            color="gold"
            variant="soft"
            icon="i-heroicons-megaphone"
            title="Объявить всем"
            :description="feedback[step.actionType].publicText!"
          />
          <UAlert
            v-if="feedback[step.actionType].privateText"
            color="blue"
            variant="soft"
            icon="i-heroicons-eye-slash"
            title="Только ведущему"
            :description="feedback[step.actionType].privateText!"
          />
        </div>

        <template #footer>
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              v-if="step.selection !== 'none'"
              color="gold"
              size="lg"
              icon="i-heroicons-check"
              :loading="saving"
              @click="saveCurrent"
            >
              Сохранить действие
            </UButton>
            <div class="flex-1" />
            <UButton
              color="gray"
              variant="soft"
              size="lg"
              icon="i-heroicons-arrow-left"
              :disabled="currentIndex === 0"
              @click="prev"
            >
              Назад
            </UButton>
            <UButton
              v-if="currentIndex < steps.length - 1"
              color="gold"
              variant="soft"
              size="lg"
              trailing-icon="i-heroicons-arrow-right"
              @click="next"
            >
              Далее
            </UButton>
            <UButton
              v-else
              color="gold"
              size="lg"
              icon="i-heroicons-flag"
              @click="reviewOpen = true"
            >
              К завершению ночи
            </UButton>
          </div>
        </template>
      </UCard>
    </div>

    <!-- REVIEW MODAL -->
    <UModal v-model="reviewOpen">
      <UCard>
        <template #header>
          <h3 class="font-club text-lg text-champagne">
            Обзор действий ночи {{ nightNumber }}
          </h3>
        </template>

        <ul class="space-y-2">
          <li
            v-for="s in reviewSteps"
            :key="s.key"
            class="flex items-start gap-2 rounded-lg bg-navy/40 px-3 py-2"
          >
            <span class="text-xs uppercase tracking-wide text-bronze/70 shrink-0 w-24">
              {{ s.title }}
            </span>
            <span class="text-champagne flex-1">{{ actionSummary(s) }}</span>
          </li>
        </ul>

        <UAlert
          v-if="!canComplete"
          class="mt-4"
          color="orange"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          title="Не все действия сохранены"
          description="Сохраните действия всех активных ролей перед завершением ночи."
        />

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="soft" @click="reviewOpen = false">
              Отмена
            </UButton>
            <UButton
              color="gold"
              icon="i-heroicons-check-circle"
              :loading="completing"
              :disabled="!canComplete"
              @click="completeNight"
            >
              Завершить ночь
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
