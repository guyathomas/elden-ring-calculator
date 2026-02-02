import { useMemo } from 'react';
import type { AnimationEventData } from '../types';
import { spEffectNames } from '@elden-ring-calculator/calculator-core/client';
import { BaseTimeline, type TimelineRowData } from './BaseTimeline';

const EVENT_LABELS: Record<string, string> = {
  Attack: 'Attack',
  LightAttackOnly: 'LightAttackOnly Cancel',
  FastGoods: 'FastGoods Cancel',
  RightAttack: 'RightAttack Cancel',
  LeftAttack: 'LeftAttack Cancel',
  FastWeaponArt: 'FastWeaponArt Cancel',
  Dodge: 'Dodge Cancel',
  Block: 'Block Cancel',
  SwitchWeapon: 'SwitchWeapon Cancel',
  Goods: 'Goods Cancel',
  Magic: 'Magic Cancel',
  WeaponArt: 'WeaponArt Cancel',
  Move: 'Move Cancel',
  Behavior: 'Behavior',
  SpEffect: 'SpEffect',
  Sound: 'Sound',
};

const EVENT_SHORT_LABELS: Record<string, string> = {
  Attack: 'Attack',
  LightAttackOnly: 'Light ...',
  FastGoods: 'Fast Goods',
  RightAttack: 'Right Attack',
  LeftAttack: 'Left Attack',
  FastWeaponArt: 'Fast Weapon Art',
  Dodge: 'Dodge / Jump',
  Block: 'Guard',
  SwitchWeapon: 'Switch Weapon / Crouch',
  Goods: 'Goods',
  Magic: 'Magic',
  WeaponArt: 'Weapon Art',
  Move: 'Move',
};

interface AnimationTimelineProps {
  animation: AnimationEventData;
  className?: string;
}

/**
 * Timeline visualization for a single animation's frame data
 */
export function AnimationTimeline({ animation, className = '' }: AnimationTimelineProps) {
  const rows = useMemo((): TimelineRowData[] => {
    const result: TimelineRowData[] = [];

    if (animation.activeFrames.length > 0) {
      result.push({
        key: 'attack',
        label: EVENT_LABELS['Attack'],
        type: 'Attack',
        ranges: animation.activeFrames.map(af => ({
          start: af.startFrame,
          end: af.endFrame,
          label: 'Attack',
        })),
      });
    }

    const cancelOrder = [
      'LightAttackOnly',
      'FastGoods',
      'RightAttack',
      'LeftAttack',
      'FastWeaponArt',
      'Dodge',
      'Block',
      'SwitchWeapon',
      'Goods',
      'Magic',
      'WeaponArt',
      'Move',
    ];

    const cancelsByType = new Map<string, typeof animation.cancels>();
    for (const cancel of animation.cancels) {
      const existing = cancelsByType.get(cancel.type) || [];
      existing.push(cancel);
      cancelsByType.set(cancel.type, existing);
    }

    for (const type of cancelOrder) {
      const cancels = cancelsByType.get(type);
      if (cancels && cancels.length > 0) {
        result.push({
          key: `cancel-${type}`,
          label: EVENT_LABELS[type] || type,
          type,
          ranges: cancels.map(c => ({
            start: c.startFrame,
            end: c.endFrame,
            label: EVENT_SHORT_LABELS[type] || type,
          })),
        });
      }
    }

    if (animation.spEffects.length > 0) {
      result.push({
        key: 'spEffect',
        label: 'SpEffect',
        type: 'SpEffect',
        ranges: animation.spEffects.map(sp => ({
          start: sp.startFrame,
          end: sp.endFrame,
          label: (spEffectNames as Record<string, string>)[String(sp.id)] || `SpEffect ${sp.id}`,
        })),
      });
    }

    return result;
  }, [animation]);

  return <BaseTimeline rows={rows} maxFrame={animation.maxFrame} className={className} />;
}
