<script setup lang="ts">
/**
 * One multi-select filter facet: a `<fieldset>` of checkboxes, one per option.
 * Used twice by `CatalogToolbar` — brands and colour families — which is exactly
 * why it is generic over the option value rather than knowing about either.
 *
 * Options carry a value and a label and nothing else. Phase 6's per-option pack
 * count was removed in full (ADR-035): the checkbox's accessible name is now the
 * label alone, which is what it always should have read as.
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
      >
        <!--
          A real checkbox, not a styled div: it carries its own checked state,
          label association, and keyboard behaviour for free. No option is ever
          disabled or muted, including a colour family no pack carries: "no packs
          are white" is a true answer to a question the user is allowed to ask,
          and every option renders identically because there is no longer a
          count to distinguish them (ADR-035).
        -->
        <input
          type="checkbox"
          class="size-4 shrink-0 accent-neutral-900"
          :checked="selected.includes(option.value)"
          :value="option.value"
          @change="emit('toggle', option.value)"
        >
        <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
      </label>
    </div>
  </fieldset>
</template>
