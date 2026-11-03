<script setup lang="ts">
import type { Game, Role } from '~/types/game';

useHead({ title: 'Создание игры — Деловая Мафия' });

const api = useGameApi();
const router = useRouter();

const step = ref(1);
const creating = ref(false);

// --- Step 1: basics ---
function defaultDateTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const title = ref('');
const playedAt = ref(defaultDateTime());

// --- Step 2: players ---
const players = ref<{ nickname: string }[]>([]);
const newNick = ref('');

function addPlayer() {
  const nick = newNick.value.trim();
  if (!nick) return;
  if (
    players.value.some((p) => p.nickname.toLowerCase() === nick.toLowerCase())
  ) {
    useToast().add({
      title: 'Такой ник уже добавлен',
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    });
    return;
  }
  players.value.push({ nickname: nick });
  newNick.value = '';
}
function removePlayer(index: number) {
  players.value.splice(index, 1);
}

// --- Step 3: role composition ---
const counts = reactive({ civilianCount: 2, mafiaCount: 2 });
const toggles = reactive({
  don: true,
  maniac: true,
  doctor: true,
  commissar: true,
  beauty: true,
  cop: true,
  journalist: false,
  whiteMark: false,
});

const SINGLE_ROLES: { key: keyof typeof toggles; role: Role; optional: boolean }[] =
  [
    { key: 'don', role: 'DON', optional: false },
    { key: 'maniac', role: 'MANIAC', optional: false },
    { key: 'doctor', role: 'DOCTOR', optional: false },
    { key: 'commissar', role: 'COMMISSAR', optional: false },
    { key: 'beauty', role: 'BEAUTY', optional: false },
    { key: 'cop', role: 'COP', optional: false },
    { key: 'journalist', role: 'JOURNALIST', optional: true },
    { key: 'whiteMark', role: 'WHITE_MARK', optional: true },
  ];

const pool = computed<{ role: Role; count: number }[]>(() => {
  const arr: { role: Role; count: number }[] = [];
  if (counts.civilianCount > 0)
    arr.push({ role: 'CIVILIAN', count: counts.civilianCount });
  if (counts.mafiaCount > 0)
    arr.push({ role: 'MAFIA', count: counts.mafiaCount });
  for (const s of SINGLE_ROLES) {
    if (toggles[s.key]) arr.push({ role: s.role, count: 1 });
  }
  return arr;
});
const poolTotal = computed(() => pool.value.reduce((s, p) => s + p.count, 0));
const poolMap = computed(() =>
  Object.fromEntries(pool.value.map((p) => [p.role, p.count])) as Record<
    Role,
    number
  >,
);

function adjust(key: 'civilianCount' | 'mafiaCount', delta: number) {
  counts[key] = Math.max(0, counts[key] + delta);
}

// --- Step 4: assignment ---
const assignments = ref<(Role | null)[]>([]);
watchEffect(() => {
  // keep assignments array in sync with players length
  const arr = [...assignments.value];
  arr.length = players.value.length;
  for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = null;
  assignments.value = arr;
});

const assignedMap = computed(() => {
  const m = {} as Record<string, number>;
  for (const a of assignments.value) if (a) m[a] = (m[a] ?? 0) + 1;
  return m;
});
const remainingMap = computed(() => {
  const m = {} as Record<string, number>;
  for (const [role, count] of Object.entries(poolMap.value)) {
    m[role] = count - (assignedMap.value[role] ?? 0);
  }
  return m;
});

function autoAssignRemainingCivilians() {
  if (!compositionValid.value) return;

  const unassignedIndexes = assignments.value.reduce<number[]>(
    (indexes, assignedRole, playerIndex) => {
      if (!assignedRole) indexes.push(playerIndex);
      return indexes;
    },
    [],
  );
  if (unassignedIndexes.length === 0) return;

  const rolesStillRemaining = pool.value.filter(
    ({ role }) => (remainingMap.value[role] ?? 0) > 0,
  );
  const onlyCiviliansRemain =
    rolesStillRemaining.length === 1 &&
    rolesStillRemaining[0]?.role === 'CIVILIAN' &&
    (remainingMap.value.CIVILIAN ?? 0) === unassignedIndexes.length;

  if (!onlyCiviliansRemain) return;

  const next = [...assignments.value];
  for (const playerIndex of unassignedIndexes) {
    next[playerIndex] = 'CIVILIAN';
  }
  assignments.value = next;
}

function assignRole(index: number, role: Role | null) {
  const next = [...assignments.value];
  next[index] = role;
  assignments.value = next;
  autoAssignRemainingCivilians();
}

function clearAssignment(index: number) {
  const next = [...assignments.value];
  next[index] = null;
  assignments.value = next;
}

function roleOptions(index: number) {
  const current = assignments.value[index];
  return pool.value
    .filter((p) => (remainingMap.value[p.role] ?? 0) > 0 || p.role === current)
    .map((p) => ({
      value: p.role,
      label: `${roleLabel(p.role)} · осталось ${remainingMap.value[p.role] ?? 0}`,
    }));
}

// --- validation ---
const step1Valid = computed(() => title.value.trim().length > 0);
const step2Valid = computed(() => players.value.length >= 1);
const compositionValid = computed(
  () => poolTotal.value > 0 && poolTotal.value === players.value.length,
);
const assignmentsValid = computed(() => {
  if (!compositionValid.value) return false;
  if (assignments.value.some((a) => !a)) return false;
  for (const [role, count] of Object.entries(poolMap.value)) {
    if ((assignedMap.value[role] ?? 0) !== count) return false;
  }
  return true;
});

async function createAndStart() {
  if (!assignmentsValid.value) return;
  creating.value = true;
  try {
    const payload = {
      title: title.value.trim(),
      playedAt: playedAt.value
        ? new Date(playedAt.value).toISOString()
        : undefined,
      players: players.value.map((p, i) => ({
        nickname: p.nickname,
        role: assignments.value[i] as Role,
      })),
    };
    const game = await api.createGame(payload);
    await api.startGame(game.id);
    await router.push(`/games/${game.id}`);
  } catch {
    creating.value = false;
  }
}

const steps = [
  { n: 1, label: 'Основное' },
  { n: 2, label: 'Игроки' },
  { n: 3, label: 'Роли' },
  { n: 4, label: 'Назначение' },
  { n: 5, label: 'Подтверждение' },
];

function next() {
  if (step.value < 5) step.value += 1;
  if (step.value === 4) autoAssignRemainingCivilians();
}
function back() {
  if (step.value > 1) step.value -= 1;
}
</script>

<template>
  <div>
    <h1 class="font-club text-2xl sm:text-3xl text-gradient-gold mb-5">
      Новая игра
    </h1>

    <!-- step indicator -->
    <div class="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1">
      <template v-for="(s, i) in steps" :key="s.n">
        <div
          class="flex items-center gap-2 shrink-0"
          :class="step === s.n ? 'opacity-100' : 'opacity-50'"
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
            :class="
              step >= s.n
                ? 'bg-gold-400 text-navy'
                : 'bg-surface ring-1 ring-bronze/40 text-bronze'
            "
          >
            {{ s.n }}
          </span>
          <span class="text-sm text-champagne hidden sm:inline">{{
            s.label
          }}</span>
        </div>
        <div
          v-if="i < steps.length - 1"
          class="h-px w-3 sm:w-6 bg-bronze/40 shrink-0"
        />
      </template>
    </div>

    <!-- STEP 1 -->
    <UCard v-show="step === 1">
      <div class="space-y-4">
        <UFormGroup label="Название игры" required>
          <UInput
            v-model="title"
            size="lg"
            placeholder="Например: Игра №14"
            icon="i-heroicons-pencil-square"
          />
        </UFormGroup>
        <UFormGroup label="Дата и время игры">
          <UInput v-model="playedAt" type="datetime-local" size="lg" />
        </UFormGroup>
      </div>
    </UCard>

    <!-- STEP 2 -->
    <UCard v-show="step === 2">
      <div class="space-y-4">
        <UFormGroup label="Добавить игрока по нику">
          <div class="flex gap-2">
            <UInput
              v-model="newNick"
              size="lg"
              class="flex-1"
              placeholder="Ник игрока"
              icon="i-heroicons-user"
              @keydown.enter.prevent="addPlayer"
            />
            <UButton
              color="gold"
              size="lg"
              icon="i-heroicons-plus"
              @click="addPlayer"
            >
              Добавить
            </UButton>
          </div>
        </UFormGroup>

        <div
          class="flex items-center justify-between text-sm text-bronze pt-1"
        >
          <span>Игроков: {{ players.length }}</span>
          <span v-if="players.length < 4" class="text-gold-300">
            Рекомендуется не менее 6
          </span>
        </div>

        <ul v-if="players.length" class="space-y-2">
          <li
            v-for="(p, i) in players"
            :key="i"
            class="flex items-center justify-between rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-3 py-2"
          >
            <span class="flex items-center gap-2 text-champagne">
              <span class="text-bronze text-sm">{{ i + 1 }}.</span>
              {{ p.nickname }}
            </span>
            <UButton
              color="red"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              @click="removePlayer(i)"
            />
          </li>
        </ul>
        <p v-else class="text-sm text-bronze">Список игроков пуст.</p>
      </div>
    </UCard>

    <!-- STEP 3 -->
    <UCard v-show="step === 3">
      <div class="space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            class="rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p class="text-champagne font-semibold">Мирные жители</p>
              <p class="text-xs text-bronze">Без ночного действия</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                size="sm"
                color="gray"
                variant="soft"
                icon="i-heroicons-minus"
                @click="adjust('civilianCount', -1)"
              />
              <span class="w-7 text-center text-lg text-champagne">{{
                counts.civilianCount
              }}</span>
              <UButton
                size="sm"
                color="gold"
                variant="soft"
                icon="i-heroicons-plus"
                @click="adjust('civilianCount', 1)"
              />
            </div>
          </div>

          <div
            class="rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p class="text-champagne font-semibold">Мафия</p>
              <p class="text-xs text-bronze">Рядовые мафиози</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                size="sm"
                color="gray"
                variant="soft"
                icon="i-heroicons-minus"
                @click="adjust('mafiaCount', -1)"
              />
              <span class="w-7 text-center text-lg text-champagne">{{
                counts.mafiaCount
              }}</span>
              <UButton
                size="sm"
                color="gold"
                variant="soft"
                icon="i-heroicons-plus"
                @click="adjust('mafiaCount', 1)"
              />
            </div>
          </div>
        </div>

        <div>
          <p class="text-sm text-bronze mb-2">Особые роли</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              v-for="s in SINGLE_ROLES"
              :key="s.key"
              class="flex items-center justify-between rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-4 py-3 cursor-pointer"
            >
              <span class="text-champagne">
                {{ roleLabel(s.role) }}
                <UBadge
                  v-if="s.optional"
                  color="gold"
                  variant="soft"
                  size="xs"
                  class="ml-1"
                  >опц.</UBadge
                >
              </span>
              <UToggle v-model="toggles[s.key]" color="primary" />
            </label>
          </div>
        </div>

        <UAlert
          :color="compositionValid ? 'green' : 'orange'"
          variant="soft"
          :icon="
            compositionValid
              ? 'i-heroicons-check-circle'
              : 'i-heroicons-exclamation-triangle'
          "
          :title="`Ролей в составе: ${poolTotal} · Игроков: ${players.length}`"
          :description="
            compositionValid
              ? 'Состав совпадает с количеством игроков.'
              : 'Количество ролей должно совпадать с количеством игроков.'
          "
        />
      </div>
    </UCard>

    <!-- STEP 4 -->
    <UCard v-show="step === 4">
      <div class="space-y-3">
        <p class="text-sm text-bronze">
          Назначьте каждому игроку роль. Каждая роль из состава используется ровно
          один раз.
        </p>
        <div
          v-for="(p, i) in players"
          :key="i"
          class="grid grid-cols-1 sm:grid-cols-[1fr_auto] sm:items-center gap-2 rounded-xl bg-navy/40 ring-1 ring-bronze/20 px-3 py-3"
        >
          <span class="text-champagne flex items-center gap-2">
            <span class="text-bronze text-sm">{{ i + 1 }}.</span>
            {{ p.nickname }}
          </span>
          <div class="flex items-center gap-1 sm:w-80">
            <USelect
              :model-value="assignments[i] ?? undefined"
              :options="roleOptions(i)"
              value-attribute="value"
              option-attribute="label"
              placeholder="Выбрать роль"
              size="lg"
              class="flex-1"
              @update:model-value="assignRole(i, $event)"
            />
            <UButton
              v-if="assignments[i]"
              color="gray"
              variant="ghost"
              size="sm"
              icon="i-heroicons-x-mark"
              :aria-label="`Снять роль с игрока ${p.nickname}`"
              title="Снять роль"
              @click="clearAssignment(i)"
            />
          </div>
        </div>

        <UAlert
          :color="assignmentsValid ? 'green' : 'orange'"
          variant="soft"
          :icon="
            assignmentsValid
              ? 'i-heroicons-check-circle'
              : 'i-heroicons-information-circle'
          "
          :title="
            assignmentsValid
              ? 'Все роли назначены.'
              : 'Назначьте роли всем игрокам.'
          "
        />
      </div>
    </UCard>

    <!-- STEP 5 -->
    <UCard v-show="step === 5">
      <div class="space-y-4">
        <div>
          <p class="text-xs uppercase tracking-widest text-bronze">Игра</p>
          <p class="font-club text-xl text-champagne">{{ title }}</p>
        </div>
        <div class="club-divider" />
        <div>
          <p class="text-sm text-bronze mb-2">
            Состав ({{ players.length }} игроков)
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="(p, i) in players"
              :key="i"
              class="flex items-center justify-between rounded-lg bg-navy/40 px-3 py-2"
            >
              <span class="text-champagne">{{ p.nickname }}</span>
              <UBadge color="gold" variant="soft">{{
                assignments[i] ? roleLabel(assignments[i] as Role) : '—'
              }}</UBadge>
            </li>
          </ul>
        </div>
      </div>
    </UCard>

    <!-- nav -->
    <div class="flex items-center justify-between gap-3 mt-6">
      <UButton
        color="gray"
        variant="soft"
        size="lg"
        icon="i-heroicons-arrow-left"
        :disabled="step === 1"
        @click="back"
      >
        Назад
      </UButton>

      <UButton
        v-if="step < 5"
        color="gold"
        size="lg"
        trailing-icon="i-heroicons-arrow-right"
        :disabled="
          (step === 1 && !step1Valid) ||
          (step === 2 && !step2Valid) ||
          (step === 3 && !compositionValid) ||
          (step === 4 && !assignmentsValid)
        "
        @click="next"
      >
        Далее
      </UButton>

      <UButton
        v-else
        color="gold"
        size="lg"
        icon="i-heroicons-play-circle"
        :loading="creating"
        :disabled="!assignmentsValid"
        @click="createAndStart"
      >
        Создать и начать
      </UButton>
    </div>
  </div>
</template>
