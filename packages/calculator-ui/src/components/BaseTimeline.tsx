import { useRef, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Shared constants
export const CELL_SIZE = 16;
export const LABEL_WIDTH = 120;
export const HEADER_HEIGHT = 24;
export const ROW_HEIGHT = 20;

// Color palette for different event types
export const EVENT_COLORS: Record<string, { bg: string; outline: string }> = {
  Attack: { bg: 'crimson', outline: 'darkred' },
  Cancel: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  LightAttackOnly: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  FastGoods: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  RightAttack: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  LeftAttack: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  FastWeaponArt: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  Dodge: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  Block: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  SwitchWeapon: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  Goods: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  Magic: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  WeaponArt: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  Move: { bg: 'rgb(33, 23, 110)', outline: 'navy' },
  SpEffect: { bg: 'darkorchid', outline: 'indigo' },
  HyperArmour: { bg: 'darkorchid', outline: 'indigo' },
  Stun: { bg: 'darkorchid', outline: 'indigo' },
  Startup: { bg: '#0ea5e9', outline: '#0284c7' },
  default: { bg: '#6b7280', outline: '#4b5563' },
};

export function getEventColor(type: string): { bg: string; outline: string } {
  return EVENT_COLORS[type] || EVENT_COLORS.default;
}

export interface TimelineRange {
  start: number;
  end: number;
  label?: string;
  /** Override color for this specific range */
  color?: { bg: string; outline: string };
}

export interface TimelineRowData {
  key: string;
  label: string;
  /** Used for color lookup if range doesn't specify color */
  type: string;
  ranges: TimelineRange[];
}

export interface BaseTimelineProps {
  rows: TimelineRowData[];
  maxFrame: number;
  className?: string;
  footer?: ReactNode;
}

/**
 * Base timeline grid component used by AnimationTimeline and ComboTimeline
 */
export function BaseTimeline({ rows, maxFrame, className = '', footer }: BaseTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const frameNumbers = useMemo(
    () => Array.from({ length: maxFrame }, (_, i) => i + 1),
    [maxFrame]
  );

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState);
      return () => el.removeEventListener('scroll', updateScrollState);
    }
  }, [maxFrame, updateScrollState]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -CELL_SIZE * 10, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: CELL_SIZE * 10, behavior: 'smooth' });
  };

  if (rows.length === 0) {
    return <div className={`text-[#6a6a6a] text-sm ${className}`}>No event data available.</div>;
  }

  const gridWidth = frameNumbers.length * CELL_SIZE;

  return (
    <div className={className}>
      <div style={{ display: 'flex', background: '#141414', borderRadius: 4 }}>
        {/* Fixed left column with labels */}
        <div style={{ width: LABEL_WIDTH, flexShrink: 0, background: '#141414', borderRight: '1px solid #2a2a3a' }}>
          {/* Nav buttons row */}
          <div
            style={{
              height: HEADER_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderBottom: '1px solid #2a2a3a',
            }}
          >
            <button
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              style={{
                opacity: canScrollLeft ? 1 : 0.3,
                cursor: canScrollLeft ? 'pointer' : 'not-allowed',
                background: 'transparent',
                border: 'none',
                color: '#8b8b8b',
                padding: 4,
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={scrollRight}
              disabled={!canScrollRight}
              style={{
                opacity: canScrollRight ? 1 : 0.3,
                cursor: canScrollRight ? 'pointer' : 'not-allowed',
                background: 'transparent',
                border: 'none',
                color: '#8b8b8b',
                padding: 4,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Row labels */}
          {rows.map(row => (
            <div
              key={row.key}
              style={{
                height: ROW_HEIGHT,
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                fontSize: 10,
                color: '#8b8b8b',
                borderBottom: '1px solid #2a2a3a',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
              title={row.label}
            >
              {row.label}
            </div>
          ))}
        </div>

        {/* Scrollable grid area */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div style={{ width: gridWidth }}>
            {/* Frame number header */}
            <div style={{ display: 'flex', height: HEADER_HEIGHT, borderBottom: '1px solid #2a2a3a' }}>
              {frameNumbers.map(frame => (
                <div
                  key={frame}
                  style={{
                    width: CELL_SIZE,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: '#6a6a6a',
                    borderRight: '1px solid #2a2a3a',
                    flexShrink: 0,
                  }}
                >
                  {frame}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {rows.map(row => (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  height: ROW_HEIGHT,
                  borderBottom: '1px solid #2a2a3a',
                  position: 'relative',
                }}
              >
                {/* Empty cells for grid */}
                {frameNumbers.map(frame => (
                  <div
                    key={frame}
                    style={{
                      width: CELL_SIZE,
                      height: '100%',
                      borderRight: '1px solid #2a2a3a',
                      background: '#1a1a2e',
                      flexShrink: 0,
                    }}
                  />
                ))}

                {/* Event bars */}
                {row.ranges.map((range, idx) => {
                  const color = range.color || getEventColor(row.type);
                  const left = (range.start - 1) * CELL_SIZE;
                  const width = (range.end - range.start + 1) * CELL_SIZE;

                  return (
                    <div
                      key={`${range.start}-${range.end}-${idx}`}
                      style={{
                        position: 'absolute',
                        top: 1,
                        bottom: 1,
                        left,
                        width,
                        background: color.bg,
                        outline: `2px solid ${color.outline}`,
                        opacity: 0.85,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        zIndex: 10,
                      }}
                      title={`${range.label || row.type}: frames ${range.start}-${range.end}`}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: 'white',
                          paddingLeft: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {range.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {footer}
    </div>
  );
}
