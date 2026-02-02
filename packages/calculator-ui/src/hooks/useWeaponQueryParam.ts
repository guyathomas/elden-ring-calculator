import { useState, useEffect, useCallback } from 'react';
import type { WeaponListItem } from '../types.js';

const WEAPON_QUERY_PARAM = 'weapon';

function getWeaponIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(WEAPON_QUERY_PARAM);
}

function updateUrl(weaponId: string | null): void {
  const url = new URL(window.location.href);
  if (weaponId) {
    url.searchParams.set(WEAPON_QUERY_PARAM, weaponId);
  } else {
    url.searchParams.delete(WEAPON_QUERY_PARAM);
  }
  window.history.replaceState({}, '', url.toString());
}

/**
 * Hook to manage selected weapon state synced with URL query parameters.
 *
 * Returns state and setter similar to useState, but the state is
 * initialized from and synced to the URL ?weapon= parameter.
 */
export function useWeaponQueryParam(
  weapons: WeaponListItem[]
): [WeaponListItem | null, (weapon: WeaponListItem | null) => void] {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponListItem | null>(null);

  // Initialize from URL once weapons are loaded
  useEffect(() => {
    if (weapons.length === 0) return;

    const weaponId = getWeaponIdFromUrl();
    if (weaponId) {
      const weapon = weapons.find(w => w.id === weaponId);
      if (weapon) {
        setSelectedWeapon(weapon);
      }
    }
  }, [weapons]);

  // Setter that updates both state and URL atomically
  const setWeaponWithUrl = useCallback((weapon: WeaponListItem | null) => {
    setSelectedWeapon(weapon);
    updateUrl(weapon?.id ?? null);
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const weaponId = getWeaponIdFromUrl();
      if (weaponId) {
        const weapon = weapons.find(w => w.id === weaponId);
        setSelectedWeapon(weapon ?? null);
      } else {
        setSelectedWeapon(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [weapons]);

  return [selectedWeapon, setWeaponWithUrl];
}
