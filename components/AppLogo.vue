<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 56 });
</script>

<template>
  <div
    class="club-emblem flex items-center justify-center rounded-2xl"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      :width="size * 0.62"
      :height="size * 0.62"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FBF5C7" />
          <stop offset="50%" stop-color="#EEE2B1" />
          <stop offset="100%" stop-color="#9F916B" />
        </linearGradient>
      </defs>
      <!-- diamond frame -->
      <path
        d="M50 4 L96 50 L50 96 L4 50 Z"
        stroke="url(#goldGrad)"
        stroke-width="3"
        fill="none"
      />
      <!-- monogram ДМ -->
      <text
        x="50"
        y="62"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="34"
        font-weight="700"
        fill="url(#goldGrad)"
      >
        ДМ
      </text>
    </svg>
  </div>
</template>
