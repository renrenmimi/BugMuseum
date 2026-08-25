/** Joins class names, dropping anything falsy. CSS-module lookups are typed
    as `string | undefined`, so this is also the only place that has to care. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
