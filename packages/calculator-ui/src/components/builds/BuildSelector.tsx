import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Build } from '../../types/buildTypes.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover.js';

interface BuildSelectorProps {
  builds: Build[];
  activeBuild: Build | null;
  onSelectBuild: (id: string) => void;
  onCreateBuild: (name: string) => void;
  onRenameBuild: (id: string, name: string) => void;
  onDeleteBuild: (id: string) => void;
}

export function BuildSelector({
  builds,
  activeBuild,
  onSelectBuild,
  onCreateBuild,
  onRenameBuild,
  onDeleteBuild,
}: BuildSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Focus edit input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Focus new input when creating
  useEffect(() => {
    if (isCreating && newInputRef.current) {
      newInputRef.current.focus();
    }
  }, [isCreating]);

  // Reset inline state when popover closes
  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleStartEdit = (build: Build) => {
    setEditingId(build.id);
    setEditName(build.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameBuild(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleCreate = () => {
    if (newName.trim()) {
      onCreateBuild(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewName('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-[#e8e6e3] hover:border-[#4a4a4a] transition-colors"
        >
          <span className="truncate">{activeBuild?.name ?? 'Select build'}</span>
          <ChevronDown className={`w-4 h-4 text-[#6a6a6a] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 bg-[#1a1a1a] border-[#333] max-h-64 overflow-y-auto"
        align="start"
      >
        {builds.map((build) => (
          <div
            key={build.id}
            className={`flex items-center gap-1 px-2 py-1.5 ${
              build.id === activeBuild?.id ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]'
            }`}
          >
            {editingId === build.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0.5 bg-[#0a0a0a] border border-[#444] rounded text-base md:text-xs text-[#e8e6e3] focus:outline-none focus:border-[#d4af37]"
                />
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="p-2 rounded hover:bg-[#333] text-[#7bc96f]"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-2 rounded hover:bg-[#333] text-[#6a6a6a]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSelectBuild(build.id);
                    setIsOpen(false);
                  }}
                  className="flex-1 text-left text-sm text-[#e8e6e3] truncate py-0.5"
                >
                  {build.name}
                  <span className="text-[#6a6a6a] text-xs ml-2">({build.weapons.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(build)}
                  className="p-2 rounded hover:bg-[#333] text-[#6a6a6a] hover:text-[#e8e6e3]"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {builds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteBuild(build.id)}
                    className="p-2 rounded hover:bg-[#333] text-[#6a6a6a] hover:text-[#ef4444]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Create new build */}
        {isCreating ? (
          <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[#2a2a2a]">
            <input
              ref={newInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') handleCancelCreate();
              }}
              placeholder="Build name..."
              className="flex-1 min-w-0 px-1.5 py-0.5 bg-[#0a0a0a] border border-[#444] rounded text-base md:text-xs text-[#e8e6e3] focus:outline-none focus:border-[#d4af37]"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="p-2 rounded hover:bg-[#333] text-[#7bc96f]"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleCancelCreate}
              className="p-2 rounded hover:bg-[#333] text-[#6a6a6a]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#d4af37] hover:bg-[#222] border-t border-[#2a2a2a]"
          >
            <Plus className="w-4 h-4" />
            New Build
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
