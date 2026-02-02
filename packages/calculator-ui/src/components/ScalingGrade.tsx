import type { ScalingGrade as Grade } from '../types';

interface ScalingGradeProps {
  grade: Grade;
  stat: string;
  showLabel?: boolean;
  size?: 'sm' | 'lg';
}

const gradeColors: Record<Grade, string> = {
  'S': 'text-[#d4af37] border-[#d4af37]',
  'A': 'text-[#7bc96f] border-[#7bc96f]',
  'B': 'text-[#5bc0de] border-[#5bc0de]',
  'C': 'text-[#a8a8d8] border-[#a8a8d8]',
  'D': 'text-[#8b8b8b] border-[#8b8b8b]',
  'E': 'text-[#6a6a6a] border-[#6a6a6a]',
  '-': 'text-[#3a3a3a] border-[#3a3a3a]',
};

export function ScalingGrade({ grade, stat, showLabel = true, size = 'sm' }: ScalingGradeProps) {
  const colorClass = gradeColors[grade];
  const sizeClasses = size === 'lg' ? 'text-xl px-2 py-1' : 'text-xs px-1.5 py-0.5';
  
  return (
    <div 
      className={`inline-flex items-center gap-1 border rounded ${colorClass} ${sizeClasses}`}
      title={showLabel ? `${stat} scaling: ${grade}` : undefined}
    >
      {showLabel && <span className="text-[0.65rem] opacity-60">{stat}</span>}
      <span>{grade}</span>
    </div>
  );
}
