/**
 * Enemy data types for damage calculations
 */

/**
 * Physical damage types that enemies can have negations for
 */
export type PhysicalDamageType = 'physical' | 'strike' | 'slash' | 'pierce';

/**
 * Elemental damage types
 */
export type ElementalDamageType = 'magic' | 'fire' | 'lightning' | 'holy';

/**
 * All damage types combined
 */
export type DamageType = PhysicalDamageType | ElementalDamageType;

/**
 * Enemy defense and negation data
 */
export interface EnemyDefenseData {
  /** Defense value for each damage type (used in the defense step function) */
  defense: {
    physical: number;
    strike: number;
    slash: number;
    pierce: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  /** Negation percentages for each damage type (applied after defense calculation) */
  negation: {
    physical: number;
    strike: number;
    slash: number;
    pierce: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
}

/**
 * Full enemy data record
 */
export interface EnemyData {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Location where enemy is found */
  location: string;
  /** Whether this is a boss enemy */
  isBoss: boolean;
  /** Whether this enemy is from the DLC */
  isDLC: boolean;
  /** Enemy HP */
  health: number;
  /** Defense and negation data */
  defenses: EnemyDefenseData;
}

/**
 * Pre-computed enemy data for the client
 * Only includes bosses to keep the file size manageable
 */
export interface PrecomputedEnemyData {
  /** Boss enemies only, keyed by unique display key (location + name for uniqueness) */
  bosses: Record<string, EnemyData>;
  /** List of unique boss names for dropdown */
  bossNames: string[];
}
