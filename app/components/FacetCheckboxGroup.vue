<script setup lang="ts">
/**
 * One multi-select filter facet: a `<fieldset>` of checkboxes with per-option
 * catalog counts. Used twice by `CatalogToolbar` — brands and colour families —
 * which is exactly why it is generic over the option value rather than knowing
 * about either.
 *
 * It is the first component in this codebase with an `emits`: it reports a
 * toggle and holds no state, so the URL stays the single source of truth
 * (ADR-004). A `v-model` over the selected array would have this component
 * computing the next array, duplicating `toggleFacet`.
 */
import type { Facet } from '~/utils/catalog'

defineProps<{
  /** Names the group for assistive tech; rendered visibly above the boxes. */
  legend: string
  options: readonly Facet<string>[]
  selected: readonly string[]
}>()

const emit = defineEmits<{ toggle: [value: string] }>()
</script>

<template>
  <fieldset class="min-w-0">
    <legend class="mb-2 text-xs font-bold uppercase tracking-wider text-card-muted">
      {{ legend }}
    </legend>

    <div class="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-center gap-2 rounded py-0.5 text-sm"
        :class="option.count === 0 ? 'text-card-muted' : ''"
      >
        <!--
          A real checkbox, not a styled div: it carries its own checked state,
          label association, and keyboard behaviour for free. Zero-count options
          stay enabled — "no packs are purple" is a true answer to a question the
          user is allowed to ask, and a disabled control hides it.
        -->
        <input
          type="checkbox"
          class="size-4 shrink-0 accent-neutral-900"
          :checked="selected.includes(option.value)"
          :value="option.value"
          @change="emit('toggle', option.value)"
        >
        <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
        <!--
          Counts are over the WHOLE catalog, not the current results, so the
          numbers do not shift underneath a user mid-selection (ADR-034). The
          bare digit needs a noun to read as anything aloud.
        -->
        <span class="shrink-0 text-xs tabular-nums text-card-muted">
          {{ option.count }}<span class="sr-only"> {{ option.count === 1 ? 'pack' : 'packs' }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
