import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-02',
  devtools: { enabled: true },

  // Static-only: `nuxt generate` emits pure static output. There is no runtime
  // server, so every route must be prerendered at build time (ADR-001, ADR-004).
  ssr: true,
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
    // Nitro owns .nuxt/tsconfig.server.json; `typescript.tsConfig` below does
    // not reach it.
    typescript: {
      tsConfig: { compilerOptions: { ignoreDeprecations: '6.0' } },
    },
  },

  css: ['~/assets/css/main.css'],

  // Tailwind v4 is wired through its Vite plugin, not a Nuxt module.
  // Theme tokens live in @theme blocks in main.css — there is no tailwind.config.js.
  vite: {
    plugins: [tailwindcss()],
  },

  // TypeScript is capped at 6.0.3 (CLAUDE.md / ADR-002). `ignoreDeprecations`
  // is applied to every generated project under .nuxt/, not just the root
  // tsconfig, so `nuxt typecheck` and the editor agree.
  typescript: {
    strict: true,
    typeCheck: false,
    tsConfig: { compilerOptions: { ignoreDeprecations: '6.0' } },
    nodeTsConfig: { compilerOptions: { ignoreDeprecations: '6.0' } },
    sharedTsConfig: { compilerOptions: { ignoreDeprecations: '6.0' } },
  },
})
