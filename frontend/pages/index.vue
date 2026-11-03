<script setup lang="ts">
useHead({ title: 'Деловая Мафия — Панель ведущего' });
</script>

<template>
  <div class="flex flex-col items-center text-center py-8 sm:py-14">
    <AppLogo :size="112" class="mb-6" />

    <h1 class="font-club text-4xl sm:text-5xl text-gradient-gold mb-3">
      Деловая Мафия
    </h1>
    <p class="max-w-xl text-base sm:text-lg text-champagne/80 mb-2">
      Панель ведущего для проведения клубной Мафии и сохранения результатов игр.
    </p>
    <p class="max-w-md text-sm text-bronze mb-8">
      Создавайте игру, назначайте роли, ведите ночь и день по подсказкам и
      сохраняйте структурированные данные для будущей статистики.
    </p>

    <div class="grid w-full max-w-md grid-cols-1 sm:grid-cols-2 gap-3">
      <UButton
        to="/games/new"
        size="xl"
        color="gold"
        icon="i-heroicons-plus-circle"
        block
      >
        Создать игру
      </UButton>
      <UButton
        to="/games"
        size="xl"
        color="gold"
        variant="soft"
        icon="i-heroicons-rectangle-stack"
        block
      >
        История игр
      </UButton>
    </div>

    <div class="club-divider my-10 w-full max-w-md" />

    <div class="grid w-full max-w-3xl grid-cols-1 sm:grid-cols-3 gap-4 text-left">
      <UCard>
        <div class="flex items-center gap-2 mb-1 text-champagne">
          <UIcon name="i-heroicons-moon" class="text-gold-300" />
          <span class="font-semibold">Пошаговая ночь</span>
        </div>
        <p class="text-sm text-bronze">
          Приложение подсказывает, кто просыпается, и считает итоги ночи.
        </p>
      </UCard>
      <UCard>
        <div class="flex items-center gap-2 mb-1 text-champagne">
          <UIcon name="i-heroicons-sun" class="text-gold-300" />
          <span class="font-semibold">День и голосование</span>
        </div>
        <p class="text-sm text-bronze">
          Таймер обсуждения, выставление кандидатов и вынос игрока.
        </p>
      </UCard>
      <UCard>
        <div class="flex items-center gap-2 mb-1 text-champagne">
          <UIcon name="i-heroicons-trophy" class="text-gold-300" />
          <span class="font-semibold">Результаты</span>
        </div>
        <p class="text-sm text-bronze">
          Сохранение состава, ролей и победителя для будущей статистики.
        </p>
      </UCard>
    </div>
  </div>
</template>
