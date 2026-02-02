import { AlertTriangle } from 'lucide-react';

export function StorageWarning() {
  return (
    <div className="flex items-start gap-2 p-3 bg-[#1a1a0a] border border-[#3a3a2a] rounded text-sm">
      <AlertTriangle className="w-4 h-4 text-[#f0ad4e] shrink-0 mt-0.5" />
      <div className="text-[#f0ad4e]">
        <span className="font-medium">Storage unavailable.</span>{' '}
        <span className="text-[#a0a050]">
          Your builds won&apos;t be saved between sessions.
        </span>
      </div>
    </div>
  );
}
