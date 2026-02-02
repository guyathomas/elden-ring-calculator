import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Build, BuildsState, BuildsStorageSchema } from '../types/buildTypes.js';
import { BUILDS_STORAGE_KEY, DEFAULT_BUILD_NAME } from '../types/buildTypes.js';

function generateId(): string {
  return crypto.randomUUID();
}

function createDefaultBuild(): Build {
  const now = Date.now();
  return {
    id: generateId(),
    name: DEFAULT_BUILD_NAME,
    weapons: [],
    createdAt: now,
    updatedAt: now,
  };
}

function checkStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function loadFromStorage(): BuildsState {
  try {
    const raw = localStorage.getItem(BUILDS_STORAGE_KEY);
    if (!raw) {
      // First visit - create default build
      const defaultBuild = createDefaultBuild();
      return {
        builds: [defaultBuild],
        activeBuildId: defaultBuild.id,
      };
    }
    const parsed: BuildsStorageSchema = JSON.parse(raw);
    if (parsed.version === 1) {
      // Ensure at least one build exists
      if (parsed.data.builds.length === 0) {
        const defaultBuild = createDefaultBuild();
        return {
          builds: [defaultBuild],
          activeBuildId: defaultBuild.id,
        };
      }
      // Ensure activeBuildId is valid
      const activeExists = parsed.data.builds.some(b => b.id === parsed.data.activeBuildId);
      if (!activeExists) {
        return {
          ...parsed.data,
          activeBuildId: parsed.data.builds[0].id,
        };
      }
      return parsed.data;
    }
    // Unknown version, start fresh
    const defaultBuild = createDefaultBuild();
    return {
      builds: [defaultBuild],
      activeBuildId: defaultBuild.id,
    };
  } catch {
    // Parse error, start fresh
    const defaultBuild = createDefaultBuild();
    return {
      builds: [defaultBuild],
      activeBuildId: defaultBuild.id,
    };
  }
}

function saveToStorage(state: BuildsState): void {
  try {
    const schema: BuildsStorageSchema = {
      version: 1,
      data: state,
    };
    localStorage.setItem(BUILDS_STORAGE_KEY, JSON.stringify(schema));
  } catch {
    // Storage quota exceeded or unavailable - silently fail
  }
}

export interface UseBuildReturn {
  builds: Build[];
  activeBuild: Build | null;
  storageAvailable: boolean;

  createBuild: (name: string) => Build;
  renameBuild: (id: string, name: string) => void;
  deleteBuild: (id: string) => void;
  setActiveBuild: (id: string | null) => void;

  toggleWeapon: (weaponId: string) => void;
  isWeaponStarred: (weaponId: string) => boolean;
  clearBuild: (id: string) => void;
}

export function useBuilds(): UseBuildReturn {
  const [storageAvailable] = useState(checkStorageAvailable);
  const [state, setState] = useState<BuildsState>(() => {
    if (!storageAvailable) {
      const defaultBuild = createDefaultBuild();
      return {
        builds: [defaultBuild],
        activeBuildId: defaultBuild.id,
      };
    }
    return loadFromStorage();
  });

  // Persist to localStorage on state change
  useEffect(() => {
    if (storageAvailable) {
      saveToStorage(state);
    }
  }, [state, storageAvailable]);

  const activeBuild = useMemo(() => {
    return state.builds.find(b => b.id === state.activeBuildId) ?? null;
  }, [state.builds, state.activeBuildId]);

  const createBuild = useCallback((name: string): Build => {
    const now = Date.now();
    const newBuild: Build = {
      id: generateId(),
      name,
      weapons: [],
      createdAt: now,
      updatedAt: now,
    };
    setState(prev => ({
      builds: [...prev.builds, newBuild],
      activeBuildId: newBuild.id,
    }));
    return newBuild;
  }, []);

  const renameBuild = useCallback((id: string, name: string): void => {
    setState(prev => ({
      ...prev,
      builds: prev.builds.map(b =>
        b.id === id ? { ...b, name, updatedAt: Date.now() } : b
      ),
    }));
  }, []);

  const deleteBuild = useCallback((id: string): void => {
    setState(prev => {
      const remaining = prev.builds.filter(b => b.id !== id);

      // If no builds left, create a default one
      if (remaining.length === 0) {
        const defaultBuild = createDefaultBuild();
        return {
          builds: [defaultBuild],
          activeBuildId: defaultBuild.id,
        };
      }

      // If active build was deleted, select the first remaining
      const newActiveId = prev.activeBuildId === id
        ? remaining[0].id
        : prev.activeBuildId;

      return {
        builds: remaining,
        activeBuildId: newActiveId,
      };
    });
  }, []);

  const setActiveBuild = useCallback((id: string | null): void => {
    setState(prev => ({
      ...prev,
      activeBuildId: id,
    }));
  }, []);

  const toggleWeapon = useCallback((weaponId: string): void => {
    setState(prev => {
      if (!prev.activeBuildId) return prev;

      return {
        ...prev,
        builds: prev.builds.map(b => {
          if (b.id !== prev.activeBuildId) return b;

          const exists = b.weapons.includes(weaponId);

          if (exists) {
            // Remove weapon
            return {
              ...b,
              weapons: b.weapons.filter(id => id !== weaponId),
              updatedAt: Date.now(),
            };
          } else {
            // Add weapon
            return {
              ...b,
              weapons: [...b.weapons, weaponId],
              updatedAt: Date.now(),
            };
          }
        }),
      };
    });
  }, []);

  const isWeaponStarred = useCallback((weaponId: string): boolean => {
    if (!activeBuild) return false;
    return activeBuild.weapons.includes(weaponId);
  }, [activeBuild]);

  const clearBuild = useCallback((id: string): void => {
    setState(prev => ({
      ...prev,
      builds: prev.builds.map(b =>
        b.id === id ? { ...b, weapons: [], updatedAt: Date.now() } : b
      ),
    }));
  }, []);

  return {
    builds: state.builds,
    activeBuild,
    storageAvailable,
    createBuild,
    renameBuild,
    deleteBuild,
    setActiveBuild,
    toggleWeapon,
    isWeaponStarred,
    clearBuild,
  };
}
