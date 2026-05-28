import React from "react";

const STORAGE_PREFIX = "folha-app:filtros";

const canUseLocalStorage = () =>
  typeof window !== "undefined" && !!window.localStorage;

export const buildPersistedFiltersKey = (
  routeName: string,
  userId?: string | null,
) => {
  return userId
    ? `${STORAGE_PREFIX}:${userId}:${routeName}`
    : `${STORAGE_PREFIX}:${routeName}`;
};

export const usePersistedFilters = <TFilters extends Record<string, unknown>>(
  routeName: string,
  userId?: string | null,
) => {
  const storageKey = React.useMemo(
    () => buildPersistedFiltersKey(routeName, userId),
    [routeName, userId],
  );

  const readFilters = React.useCallback((): Partial<TFilters> | null => {
    if (!canUseLocalStorage()) return null;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Partial<TFilters>)
        : null;
    } catch {
      window.localStorage.removeItem(storageKey);
      return null;
    }
  }, [storageKey]);

  const saveFilters = React.useCallback(
    (filters: Partial<TFilters>) => {
      if (!canUseLocalStorage()) return;

      // Comentário: persistimos somente filtros operacionais simples (IDs/valores), nunca resultados ou valores de folha.
      window.localStorage.setItem(storageKey, JSON.stringify(filters));
    },
    [storageKey],
  );

  const clearFilters = React.useCallback(() => {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return React.useMemo(
    () => ({ storageKey, readFilters, saveFilters, clearFilters }),
    [storageKey, readFilters, saveFilters, clearFilters],
  );
};
