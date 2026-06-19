<script setup lang="ts">
import type { Clan, Game } from '~/types/game';

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const id = route.params.id as string;

useHead({ title: 'Завершение игры — Деловая Мафия' });

const { data: game } = await useFetch<Game>(`/api/games/${id}`);

const CLANS: { clan: Clan; label: string; desc: string; icon: string }[] = [
  {
    clan: 'CIVILIANS',
    label: 'Мирные',
    desc: 'Мирный житель, Красотка, Доктор, Комиссар, Коп, Журналист, Белая метка',
    icon: 'i-heroicons-users',
  },
  {
    clan: 'MAFIA',
    label: 'Мафия',
    desc: 'Мафия и Дон',
    icon: 'i-heroicons-fire',
  },
  {
    clan: 'MANIAC',
    label: 'Маньяк',
    desc: 'Маньяк играет сам за себя',
    icon: 'i-heroicons-bolt',
  },
];

const winnerClan = ref<Clan | null>(
  (game.value?.winnerClan as Clan | null) ?? null,
);
const comment = ref(game.value?.hostComment ?? '');
const saving = ref(false);

async function save() {
  if (!winnerClan.value) {
    useToast().add({
      title: 'Выберите победивший клан',
      color: 'orange',
      icon: 'i-heroicons-exclamation-triangle',
    });
    return;
  }
  saving.value = true;
  try {
    await api.finishGame(id, {
      winnerClan: winnerClan.value,
      comment: comment.value.trim() || undefined,
    });
    useToast().add({
      title: 'Игра завершена',
      color: 'green',
      icon: 'i-heroicons-check-circle',
    });
    await router.push(`/games/${id}`);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <NuxtLink
      :to="`/games/${id}`"
      class="text-xs text-bronze hover:text-gold-300 inline-flex items-center gap-1 mb-3"
    >
      <UIcon name="i-heroicons-arrow-left" /> К панели игры
    </NuxtLink>

    <h1 class="font-club text-2xl sm:text-3xl text-gradient-gold mb-5">
      Завершение игры
    </h1>

    <UCard>
      <div class="space-y-5">
        <div>
          <p class="text-sm text-bronze mb-2">Победивший клан</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              v-for="c in CLANS"
              :key="c.clan"
              class="text-left rounded-2xl p-4 ring-1 transition-all"
              :class="
                winnerClan === c.clan
                  ? 'bg-gold-400/15 ring-gold-400'
                  : 'bg-navy/40 ring-bronze/25 hover:ring-gold-400/50'
              "
              @click="winnerClan = c.clan"
            >
              <div class="flex items-center gap-2 mb-1">
                <UIcon :name="c.icon" class="text-xl text-gold-300" />
                <span class="font-club text-lg text-champagne">{{
                  c.label
                }}</span>
                <UIcon
                  v-if="winnerClan === c.clan"
                  name="i-heroicons-check-circle"
                  class="ml-auto text-gold-300"
                />
              </div>
              <p class="text-xs text-bronze leading-snug">{{ c.desc }}</p>
            </button>
          </div>
        </div>

        <UFormGroup label="Комментарий ведущего (необязательно)">
          <UTextarea
            v-model="comment"
            :rows="3"
            placeholder="Например: лучший игрок, спорные моменты, длительность…"
          />
        </UFormGroup>
      </div>

      <template #footer>
        <UButton
          color="gold"
          size="xl"
          icon="i-heroicons-trophy"
          block
          :loading="saving"
          :disabled="!winnerClan"
          @click="save"
        >
          Сохранить результат и завершить игру
        </UButton>
      </template>
    </UCard>
  </div>
</template>
