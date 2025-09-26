<script setup lang="ts">
import { ref, onMounted } from 'vue'
import lottie from 'lottie-web'

const props = defineProps<{
  animationData: string
  class?: string
}>()

const animationContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (animationContainer.value) {
    lottie.loadAnimation({
      container: animationContainer.value,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: `/lottie/${props.animationData}`,
    })
  }
})
</script>

<template>
  <div :class="class" ref="animationContainer"></div>
</template>
