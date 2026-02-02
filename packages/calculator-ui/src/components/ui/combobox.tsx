"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "./utils"
import { Button } from "./button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

export interface ComboboxOption {
  label: string
  value: string
}

export interface ComboboxGroup {
  label: string
  options: ComboboxOption[]
}

interface ComboboxProps {
  options?: ComboboxOption[]
  groups?: ComboboxGroup[]
  /** Fixed options rendered right after the clear option, before groups */
  fixedOptions?: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  clearOptionLabel?: string
  className?: string
  searchable?: boolean
}

export function Combobox({
  options,
  groups,
  fixedOptions,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  clearOptionLabel,
  className,
  searchable = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Find selected option from fixed options, flat options, or groups
  const selectedOption = React.useMemo(() => {
    if (fixedOptions) {
      const found = fixedOptions.find((option) => option.value === value)
      if (found) return found
    }
    if (options) {
      return options.find((option) => option.value === value)
    }
    if (groups) {
      for (const group of groups) {
        const found = group.options.find((option) => option.value === value)
        if (found) return found
      }
    }
    return undefined
  }, [fixedOptions, options, groups, value])

  const handleSelect = (selectedValue: string | null) => {
    onChange(selectedValue)
    setOpen(false)
  }

  const itemClassName = "cursor-pointer hover:bg-[#2a2a2a] data-[selected=true]:bg-[#2a2a2a] aria-selected:bg-[#2a2a2a]"
  const groupClassName = "bg-[#1a1a1a]"

  const commandContent = (
    <Command className="bg-[#1a1a1a] text-[#e8e6e3]">
      {searchable && (
        <CommandInput
          placeholder={searchPlaceholder}
          className="bg-[#1a1a1a] text-[#e8e6e3]"
        />
      )}
      <CommandList className="bg-[#1a1a1a] max-h-64">
        <CommandEmpty className="text-[#8b8b8b]">{emptyText}</CommandEmpty>
        {clearOptionLabel && (
          <CommandGroup className={groupClassName}>
            <CommandItem
              onSelect={() => handleSelect(null)}
              className={cn(itemClassName, value === null ? "text-[#d4af37]" : "text-[#e8e6e3]")}
            >
              {clearOptionLabel}
            </CommandItem>
          </CommandGroup>
        )}
        {fixedOptions && fixedOptions.length > 0 && (
          <CommandGroup className={groupClassName}>
            {fixedOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => handleSelect(option.value)}
                className={cn(itemClassName, value === option.value ? "text-[#d4af37]" : "text-[#e8e6e3]")}
              >
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {options && (
          <CommandGroup className={groupClassName}>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => handleSelect(option.value)}
                className={cn(itemClassName, value === option.value ? "text-[#d4af37]" : "text-[#e8e6e3]")}
              >
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups?.map((group) => (
          <CommandGroup
            key={group.label}
            heading={group.label}
            className="bg-[#1a1a1a] [&_[cmdk-group-heading]]:text-[#8b8b8b] [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
          >
            {group.options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={() => handleSelect(option.value)}
                className={cn(itemClassName, value === option.value ? "text-[#d4af37]" : "text-[#e8e6e3]")}
              >
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )

  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "w-full justify-between hover:bg-[#1a1a1a] bg-[#1a1a1a] border-[#333] h-auto py-2 px-2 overflow-hidden",
        className
      )}
    >
      <span className={cn(
        "text-sm truncate min-w-0",
        selectedOption ? "text-[#e8e6e3]" : "text-[#8b8b8b] font-normal"
      )}>
        {selectedOption?.label || placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[#8b8b8b] opacity-50" />
    </Button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 bg-[#1a1a1a] border-[#3a3a3a]"
      >
        {commandContent}
      </PopoverContent>
    </Popover>
  )
}
