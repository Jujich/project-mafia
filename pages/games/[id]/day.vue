<script setup lang="ts">
import type { DayCurrent } from '~/types/game';

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const id = route.params.id as string;

useHead({ title: 'День — Деловая Мафия' });

const { data, pending, error } = await useApiFetch<DayCurrent>(
  `/api/games/${id}/days/current`,
);

const state = ref<DayCurrent | null>(data.value ?? null);
watch(data, (v) => {
  if (v && !state.value) state.value = v;
});

const dayId = computed(() => state.value?.day.id ?? '');
const dayNumber = computed(() => state.value?.day.number ?? 0);

// --- nominations ---
const NONE = '__none__';
const selectedNominees = ref<string[]>([]);
watchEffect(() => {
  if (state.value && selectedNominees.value.length === 0) {
    selectedNominees.value = state.value.nominations.map((n) => n.gamePlayerId);
  }
});

// 1-based position of a candidate in the nomination order (0 if not selected).
function nomineeOrder(gpId: string) {
  return selectedNominees.value.indexOf(gpId) + 1;
}

function toggleNominee(gpId: string) {
  const idx = selectedNominees.value.indexOf(gpId);
  if (idx >= 0) {
    selectedNominees.value.splice(idx, 1);
  } else {
    if (selectedNominees.value.length >= 5) {
      useToast().add({
        title: 'Не более 5 кандидатов',
        color: 'orange',
        icon: 'i-heroicons-exclamation-triangle',
      });
      return;
    }
    selectedNominees.value.push(gpId);
  }
}

const savingNoms = ref(false);
async function saveNominations() {
  if (selectedNominees.value.length === 0) {
    useToast().add({
      title: 'Выберите хотя бы одного кандидата',
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    });
    return;
  }
  savingNoms.value = true;
  try {
    state.value = await api.saveNominations(
      id,
      dayId.value,
      selectedNominees.value,
    );
  } finally {
    savingNoms.value = false;
  }
}

// --- elimination ---
const eliminationChoice = ref<string>('');
watchEffect(() => {
  if (state.value?.elimination) {
    eliminationChoice.value =
      state.value.elimination.eliminatedGamePlayerId ?? NONE;
  }
});

const savingElim = ref(false);
async function saveElimination() {
  if (!eliminationChoice.value) {
    useToast().add({
      title: 'Отметьте результат голосования',
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    });
    return;
  }
  savingElim.value = true;
  try {
    state.value = await api.eliminate(
      id,
      dayId.value,
      eliminationChoice.value === NONE ? null : eliminationChoice.value,
    );
  } finally {
    savingElim.value = false;
  }
}

// --- complete / next night ---
const completing = ref(false);
const completed = ref(false);
async function completeDay() {
  if (!state.value?.elimination) {
    useToast().add({
      title: 'Сначала сохраните результат голосования',
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    });
    return;
  }
  completing.value = true;
  try {
    await api.completeDay(id, dayId.value);
    completed.value = true;
  } finally {
    completing.value = false;
  }
}

async function startNextNight() {
  await api.startNight(id);
  await router.push(`/games/${id}/night`);
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

    <div v-if="pending" class="text-bronze">Загрузка дня…</div>

    <UCard v-else-if="error || !state" class="text-center py-10">
      <UIcon name="i-heroicons-sun" class="text-4xl text-bronze mb-2" />
      <p class="text-champagne mb-4">Нет активного дня для этой игры.</p>
      <UButton :to="`/games/${id}`" color="gold">Вернуться на панель</UButton>
    </UCard>

    <!-- COMPLETED state -->
    <UCard v-else-if="completed" class="text-center py-8">
      <UIcon name="i-heroicons-check-circle" class="text-5xl text-green-400 mb-3" />
      <h2 class="font-club text-2xl text-champagne mb-1">
        День {{ dayNumber }} завершён
      </h2>
      <p class="text-bronze mb-6">Можно начинать следующую ночь.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
        <UButton
          color="gold"
          size="xl"
          icon="i-heroicons-moon"
          block
          @click="startNextNight"
        >
          Начать следующую ночь
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
    </UCard>

    <div v-else class="space-y-5">
      <h1 class="font-club text-3xl sm:text-4xl text-gradient-gold">
        День {{ dayNumber }}
      </h1>

      <!-- night summary -->
      <UCard>
        <template #header>
          <h2 class="font-club text-lg text-champagne flex items-center gap-2">
            <UIcon name="i-heroicons-newspaper" class="text-gold-300" />
            Итоги ночи
          </h2>
        </template>
        <p
          v-if="state.nightSummary"
          class="whitespace-pre-line text-champagne leading-relaxed"
        >
          {{ state.nightSummary }}
        </p>
        <p v-else class="text-bronze">Итоги ночи отсутствуют.</p>

        <div v-if="state.deathsLastNight.length" class="mt-4">
          <p class="text-sm text-bronze mb-2">Погибли ночью:</p>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="d in state.deathsLastNight"
              :key="d.gamePlayerId"
              color="red"
              variant="soft"
              size="lg"
            >
              {{ d.nickname }} · {{ d.roleLabel }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <!-- immunity warning -->
      <UAlert
        v-if="state.immunePlayer"
        color="gold"
        variant="soft"
        icon="i-heroicons-shield-check"
        title="Иммунитет Красотки"
        :description="`Игрок ${state.immunePlayer.nickname} под иммунитетом Красотки: молчит в обсуждении, его нельзя выставить и вынести сегодня, но он может выставить другого игрока.`"
      />

      <!-- discussion timer -->
      <DiscussionTimer :minutes="3" :storage-key="`${id}:${dayId}`" />

      <!-- nominations -->
      <UCard>
        <template #header>
          <h2 class="font-club text-lg text-champagne flex items-center gap-2">
            <UIcon name="i-heroicons-hand-raised" class="text-gold-300" />
            Выставление на голосование
          </h2>
        </template>
        <p class="text-sm text-bronze mb-3">
          Выберите до 5 кандидатов из живых игроков
          ({{ selectedNominees.length }}/5). Порядок выставления сохраняется —
          номер показывает очередь игрока.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in state.nominationCandidates"
            :key="c.gamePlayerId"
            class="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition-colors"
            :class="
              selectedNominees.includes(c.gamePlayerId)
                ? 'bg-gold-400 text-navy ring-gold-400 font-semibold'
                : 'bg-navy/40 text-champagne ring-bronze/30 hover:ring-gold-400/60'
            "
            @click="toggleNominee(c.gamePlayerId)"
          >
            <span
              v-if="nomineeOrder(c.gamePlayerId)"
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-gold-300 text-xs font-bold"
            >
              {{ nomineeOrder(c.gamePlayerId) }}
            </span>
            <span>
              {{ c.nickname }}
              <span class="opacity-70 text-xs">· {{ c.roleLabel }}</span>
            </span>
          </button>
        </div>
        <p
          v-if="!state.nominationCandidates.length"
          class="text-sm text-bronze"
        >
          Нет доступных кандидатов.
        </p>

        <template #footer>
          <UButton
            color="gold"
            icon="i-heroicons-check"
            :loading="savingNoms"
            :disabled="!selectedNominees.length"
            @click="saveNominations"
          >
            Сохранить кандидатов
          </UButton>
        </template>
      </UCard>

      <!-- voting result -->
      <UCard v-if="state.nominations.length">
        <template #header>
          <h2 class="font-club text-lg text-champagne flex items-center gap-2">
            <UIcon name="i-heroicons-scale" class="text-gold-300" />
            Результат голосования
          </h2>
        </template>
        <div class="space-y-2">
          <label
            v-for="n in state.nominations"
            :key="n.gamePlayerId"
            class="flex items-center gap-3 rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-3 py-2.5 cursor-pointer"
            :class="
              eliminationChoice === n.gamePlayerId ? 'ring-gold-400' : ''
            "
          >
            <URadio
              v-model="eliminationChoice"
              :value="n.gamePlayerId"
              name="elim"
            />
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-gold-300 text-xs font-bold"
            >
              {{ n.order }}
            </span>
            <span class="text-champagne">{{ n.nickname }}</span>
          </label>
          <label
            class="flex items-center gap-3 rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-3 py-2.5 cursor-pointer"
            :class="eliminationChoice === NONE ? 'ring-gold-400' : ''"
          >
            <URadio v-model="eliminationChoice" :value="NONE" name="elim" />
            <span class="text-champagne">Никого не вынесли</span>
          </label>
        </div>

        <template #footer>
          <UButton
            color="gold"
            icon="i-heroicons-check"
            :loading="savingElim"
            :disabled="!eliminationChoice"
            @click="saveElimination"
          >
            Сохранить результат
          </UButton>
        </template>
      </UCard>

      <!-- elimination confirmation -->
      <UAlert
        v-if="state.elimination"
        :color="state.elimination.eliminatedGamePlayerId ? 'red' : 'primary'"
        variant="soft"
        icon="i-heroicons-information-circle"
        :title="
          state.elimination.eliminatedGamePlayerId
            ? `Будет вынесен: ${state.elimination.nickname}`
            : 'Сегодня никого не вынесли'
        "
      />

      <!-- complete -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UButton
          color="gold"
          size="xl"
          icon="i-heroicons-flag"
          block
          :loading="completing"
          :disabled="!state.elimination"
          @click="completeDay"
        >
          Завершить день
        </UButton>
        <UButton
          :to="`/games/${id}/finish`"
          color="gray"
          variant="soft"
          size="xl"
          icon="i-heroicons-trophy"
          block
        >
          Завершить игру
        </UButton>
      </div>
    </div>
  </div>
</template>
