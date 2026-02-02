import { memo } from 'react';
import { Star } from 'lucide-react';

interface StarButtonProps {
  isStarred: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const StarButton = memo(function StarButton({
  isStarred,
  onClick,
  size = 'sm',
  className = '',
}: StarButtonProps) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const paddingClasses = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${paddingClasses} rounded hover:bg-[#2a2a2a] transition-colors focus:outline-none focus:ring-1 focus:ring-[#d4af37] ${className}`}
      title={isStarred ? 'Remove from build' : 'Add to build'}
      aria-label={isStarred ? 'Remove from build' : 'Add to build'}
    >
      <Star
        className={`${sizeClasses} transition-colors ${
          isStarred
            ? 'fill-[#d4af37] text-[#d4af37]'
            : 'text-[#4a4a4a] hover:text-[#6a6a6a]'
        }`}
      />
    </button>
  );
});
