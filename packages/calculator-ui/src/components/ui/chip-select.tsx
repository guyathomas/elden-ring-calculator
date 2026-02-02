import * as React from "react"
import { cn } from "./utils"

export type Option = {
  label: string
  value: string
}

interface ChipSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  className?: string
}

export function ChipSelect({
  options,
  selected,
  onChange,
  className,
}: ChipSelectProps) {
  const allSelected = selected.length === options.length

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleSelectAll = () => {
    if (allSelected) {
      onChange([])
    } else {
      onChange(options.map((o) => o.value))
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with select all */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleSelectAll}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors",
            allSelected
              ? "text-[#d4af37] hover:text-[#e8c547]"
              : "text-[#8b8b8b] hover:text-[#e8e6e3]"
          )}
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      {/* Wrapping pills */}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <button
              key={option.value}
              onClick={() => handleToggle(option.value)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap shrink-0",
                "active:scale-95 touch-manipulation",
                isSelected
                  ? "bg-[#1a1505] border-[#d4af37] text-[#d4af37]"
                  : "bg-[#1a1a1a] border-[#333] text-[#8b8b8b] hover:border-[#555] hover:text-[#e8e6e3]"
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
