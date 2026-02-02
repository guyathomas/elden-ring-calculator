import { memo } from 'react';
import { X } from 'lucide-react';

interface BuildWeaponCardProps {
  weaponId: string;
  weaponName: string;
  affinity: string;
  totalAR: number;
  categoryName: string;
  requirements: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  };
  onRemove: () => void;
  onClick: () => void;
}

// Format requirements as compact string, only showing non-zero values
function formatRequirements(reqs: BuildWeaponCardProps['requirements']): string {
  const parts: string[] = [];
  if (reqs.str > 0) parts.push(`${reqs.str} Str`);
  if (reqs.dex > 0) parts.push(`${reqs.dex} Dex`);
  if (reqs.int > 0) parts.push(`${reqs.int} Int`);
  if (reqs.fai > 0) parts.push(`${reqs.fai} Fai`);
  if (reqs.arc > 0) parts.push(`${reqs.arc} Arc`);
  return parts.join(' / ');
}

export const BuildWeaponCard = memo(function BuildWeaponCard({
  weaponName,
  affinity,
  totalAR,
  categoryName,
  requirements,
  onRemove,
  onClick,
}: BuildWeaponCardProps) {
  const reqsText = formatRequirements(requirements);
  return (
    <button
      type="button"
      className="w-full text-left flex items-center gap-2 p-2 bg-[#141414] border border-[#2a2a2a] rounded hover:border-[#3a3a3a] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[#e8e6e3] truncate">{weaponName}</div>
        <div className="text-xs text-[#6a6a6a] truncate">
          {categoryName}
          {affinity !== 'Standard' && affinity !== 'Unique' && (
            <> • <span className="text-[#a8a8d8]">{affinity}</span></>
          )}
        </div>
        {reqsText && (
          <div className="text-[10px] text-[#5a5a5a] truncate mt-0.5">{reqsText}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-sm font-medium text-[#d4af37]">{Math.floor(totalAR)}</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-2 rounded opacity-0 group-hover:opacity-100 hover:bg-[#2a2a2a] transition-all text-[#6a6a6a] hover:text-[#e8e6e3]"
          title="Remove from build"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </button>
  );
});
