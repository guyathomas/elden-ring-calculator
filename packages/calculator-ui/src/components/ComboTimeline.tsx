import { useMemo } from 'react';
import type { ComboData } from '../types';
import { BaseTimeline, EVENT_COLORS, type TimelineRowData } from './BaseTimeline';

interface ComboTimelineProps {
  combo: ComboData;
  className?: string;
}

/**
 * Timeline visualization showing how a combo's frame data results in a true/pseudo combo
 */
export function ComboTimeline({ combo, className = '' }: ComboTimelineProps) {
  const { rows, maxFrame, hitB, stunEnd } = useMemo(() => {
    const hitA = combo.hitFrameA;
    const cancelA = combo.cancelFrameA;
    const stunEndFrame = hitA + combo.stunDuration;
    const hitBFrame = cancelA + combo.startupFrameB;
    const max = Math.max(stunEndFrame, hitBFrame) + 3;

    const timelineRows: TimelineRowData[] = [
      {
        key: 'attackA',
        label: combo.attackAName,
        type: 'Attack',
        ranges: [
          {
            start: hitA,
            end: hitA,
            label: 'Hit',
            color: EVENT_COLORS.Attack,
          },
          {
            start: cancelA,
            end: max,
            label: combo.cancelType,
            color: EVENT_COLORS.Cancel,
          },
        ],
      },
      {
        key: 'opponent',
        label: 'Opponent Stun',
        type: 'Stun',
        ranges: [
          {
            start: hitA,
            end: stunEndFrame - 1,
            label: `${combo.stunDuration}f stun`,
            color: EVENT_COLORS.Stun,
          },
        ],
      },
      {
        key: 'attackB',
        label: combo.attackBName,
        type: 'Attack',
        ranges: [
          {
            start: cancelA,
            end: hitBFrame - 1,
            label: 'Startup',
            color: EVENT_COLORS.Startup,
          },
          {
            start: hitBFrame,
            end: hitBFrame,
            label: 'Hit',
            color: EVENT_COLORS.Attack,
          },
        ],
      },
    ];

    return { rows: timelineRows, maxFrame: max, hitB: hitBFrame, stunEnd: stunEndFrame };
  }, [combo]);

  const footer = (
    <div
      style={{
        marginTop: 8,
        padding: '8px 12px',
        background: '#141414',
        borderRadius: 4,
        fontSize: 11,
        color: '#8b8b8b',
      }}
    >
      Attack B hits at frame {hitB} • Opponent recovers at frame {stunEnd}
    </div>
  );

  return <BaseTimeline rows={rows} maxFrame={maxFrame} className={className} footer={footer} />;
}
