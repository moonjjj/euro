// Spring durations matching the linear() easings in globals.css (--spring-*).
export const SPRING = {
  morph: 690,
  snappy: 450,
  soft: 530,
} as const;

export type SpringName = keyof typeof SPRING;

/** `width 690ms var(--spring-morph) 0ms` for each property. */
export function spring(props: string | string[], name: SpringName = "morph", delay = 0): string {
  return (Array.isArray(props) ? props : [props])
    .map((p) => `${p} ${SPRING[name]}ms var(--spring-${name}) ${delay}ms`)
    .join(", ");
}

/** Exit timing used by `.blur-exit` — shapes wait this long before collapsing. */
export const EXIT_MS = 140;
