<script setup lang="ts">
definePageMeta({ layout: false });
useHead({ title: 'Вход — Деловая Мафия' });

const { signIn } = useAuth();

const login = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

function extractMessage(err: any): string {
  const d = err?.data;
  return (
    d?.statusMessage ||
    d?.message ||
    err?.statusMessage ||
    'Не удалось войти. Попробуйте ещё раз.'
  );
}

async function onSubmit() {
  if (loading.value) return;
  errorMessage.value = '';
  loading.value = true;
  try {
    await signIn({ login: login.value.trim(), password: password.value });
    await navigateTo('/');
  } catch (err: any) {
    errorMessage.value = extractMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="flex flex-col items-center text-center mb-8">
        <AppLogo :size="88" class="mb-5" />
        <h1 class="font-club text-3xl text-gradient-gold">Деловая Мафия</h1>
        <p class="text-[11px] uppercase tracking-widest text-bronze mt-1">
          Панель ведущего
        </p>
      </div>

      <UCard>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div>
            <h2 class="font-club text-lg text-champagne mb-1">Вход</h2>
            <p class="text-sm text-bronze">
              Доступ к панели только для ведущего клуба.
            </p>
          </div>

          <UFormGroup label="Логин">
            <UInput
              v-model="login"
              autocomplete="username"
              icon="i-heroicons-user"
              placeholder="Логин"
              size="lg"
              autofocus
              :disabled="loading"
            />
          </UFormGroup>

          <UFormGroup label="Пароль">
            <UInput
              v-model="password"
              type="password"
              autocomplete="current-password"
              icon="i-heroicons-lock-closed"
              placeholder="Пароль"
              size="lg"
              :disabled="loading"
            />
          </UFormGroup>

          <UAlert
            v-if="errorMessage"
            color="red"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :title="errorMessage"
          />

          <UButton
            type="submit"
            color="gold"
            size="lg"
            block
            :loading="loading"
            icon="i-heroicons-arrow-right-end-on-rectangle"
          >
            Войти
          </UButton>
        </form>
      </UCard>

      <p class="text-center text-xs text-bronze mt-6">
        Закрытый клуб «Деловая Мафия»
      </p>
    </div>
  </div>
</template>
