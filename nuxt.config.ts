export default defineNuxtConfig({
  // ssr: false,
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('appkit-'),
    },
  },
  runtimeConfig: {
    public: {
      projectId: process.env.NUXT_REOWN_PROJECT_ID,
    },
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxthub/core',
    'nuxt-auth-utils',
    '@pinia/nuxt',
    '@pinia/colada-nuxt',
  ],
  devtools: {
    enabled: true,
  },
  css: ['~/assets/main.css'],
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2025-04-02',
  hub: {
    database: true,
    blob: true,
    ai: true,
  },
  nitro: {
    experimental: {
      openAPI: true,
    },
  },
  // Development config
  eslint: {
    config: {
      stylistic: {
        quotes: 'single',
        commaDangle: 'never',
      },
    },
  },
   vite: {
    build: {
      rollupOptions: {
        external: ['solavote-contracts'],
      },
    },
  },
})
