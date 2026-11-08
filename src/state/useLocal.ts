import { useEffect, useState } from "react";

/**
 * useState that persists to localStorage. Storage can throw (private mode,
 * blocked site data), so every access is guarded and the app still works
 * without it — it just forgets on reload.
 */
export function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`beacon:${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`beacon:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
