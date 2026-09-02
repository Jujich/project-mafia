<script setup lang="ts">
const { signOut } = useAuth();
const config = useRuntimeConfig();
const localMode = computed(() => Boolean(config.public.localGameMode));
const sync = useGameSync();

const syncLabel = computed(() => {
  if (sync.syncing.value) return 'Синхронизация…';
  if (!sync.online.value) return `Офлайн · сохранено на телефоне`;
  if (sync.pendingCount.value > 0) return `Ожидает отправки: ${sync.pendingCount.value}`;
  if (sync.lastError.value) return 'Ошибка синхронизации';
  return 'Данные синхронизированы';
});

const syncColor = computed(() => {
  if (!sync.online.value || sync.lastError.value) return 'orange';
  if (sync.pendingCount.value > 0 || sync.syncing.value) return 'gold';
  return 'green';
});

const links = [
  { label: 'Главная', to: '/', icon: 'i-heroicons-home' },
  { label: 'История игр', to: '/games', icon: 'i-heroicons-rectangle-stack' },
];
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="sticky top-0 z-40 border-b border-bronze/20 bg-navy/80 backdrop-blur supports-[backdrop-filter]:bg-navy/60"
    >
      <div
        class="mx-auto w-full max-w-5xl px-4 py-3 flex items-center justify-between gap-3"
      >
        <NuxtLink to="/" class="flex items-center gap-3 group">
          <AppLogo :size="44" />
          <div class="leading-tight">
            <div class="font-club text-lg sm:text-xl text-gradient-gold">
              Деловая Мафия
            </div>
            <div class="text-[11px] uppercase tracking-widest text-bronze">
              Панель ведущего
            </div>
          </div>
        </NuxtLink>

        <nav class="flex items-center gap-1.5">
          <UButton
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            :icon="link.icon"
            color="gold"
            variant="ghost"
            size="sm"
            class="hidden sm:inline-flex"
          >
            {{ link.label }}
          </UButton>
          <UButton
            to="/games/new"
            icon="i-heroicons-plus"
            color="gold"
            size="sm"
          >
            <span class="hidden sm:inline">Создать игру</span>
            <span class="sm:hidden">Игра</span>
          </UButton>
          <UButton
            v-if="!localMode"
            icon="i-heroicons-arrow-left-start-on-rectangle"
            color="gray"
            variant="ghost"
            size="sm"
            title="Выйти"
            aria-label="Выйти"
            @click="signOut"
          />
        </nav>
      </div>
      <div
        v-if="localMode"
        class="border-t border-bronze/15 bg-navy/70"
      >
        <div class="mx-auto w-full max-w-5xl px-4 py-1.5 flex items-center justify-end">
          <UButton
            :color="syncColor"
            variant="ghost"
            size="2xs"
            :loading="sync.syncing.value"
            :icon="sync.online.value ? 'i-heroicons-cloud' : 'i-heroicons-cloud-slash'"
            :title="sync.lastError.value || 'Нажмите, чтобы повторить отправку'"
            @click="sync.syncPending()"
          >
            {{ syncLabel }}
          </UButton>
        </div>
      </div>
    </header>

    <main class="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <slot />
    </main>

    <footer class="mx-auto w-full max-w-5xl px-4 py-6">
      <div class="club-divider mb-3" />
      <p class="text-center text-xs text-bronze">
        Закрытый клуб «Деловая Мафия» · инструмент ведущего
      </p>
    </footer>
  </div>
</template>
