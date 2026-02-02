import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
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
import { Badge } from "./badge"

export type Option = {
  label: string
  value: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between hover:bg-[#1a1a1a] bg-[#1a1a1a] border-[#3a3a3a]",
            className
          )}
        >
          <div className="flex gap-1 flex-wrap items-center overflow-hidden min-w-0 flex-1">
            {selected.length === 0 && (
              <span className="text-muted-foreground font-normal">{placeholder}</span>
            )}
            {selected.length > 0 && selected.length <= 2 && (
               selected.map((item) => (
                <Badge
                  variant="secondary"
                  key={item}
                  className="mr-1 mb-0.5 bg-[#2a2a2a] text-[#d4af37] hover:bg-[#3a3a3a] border-none"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUnselect(item)
                  }}
                >
                  {options.find((option) => option.value === item)?.label || item}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUnselect(item)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleUnselect(item)
                    }}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              ))
            )}
            {selected.length > 2 && (
                 <Badge
                 variant="secondary"
                 className="mr-1 mb-0.5 bg-[#2a2a2a] text-[#d4af37] hover:bg-[#3a3a3a] border-none"
               >
                 {selected.length} selected
               </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 bg-[#1a1a1a] border-[#3a3a3a]" style={{ ['--popover' as string]: '#1a1a1a', ['--popover-foreground' as string]: '#e8e6e3' }}>
        <Command className="bg-[#1a1a1a] text-[#e8e6e3]">
          <CommandInput placeholder="Search..." className="bg-[#1a1a1a] text-[#e8e6e3] border-[#3a3a3a] focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none placeholder:text-[#8b8b8b]" />
          <CommandList className="bg-[#1a1a1a]">
            <CommandEmpty className="text-[#8b8b8b]">No item found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto bg-[#1a1a1a]">
              {/* Select All option */}
              <CommandItem
                onSelect={() => {
                  if (selected.length === options.length) {
                    onChange([])
                  } else {
                    onChange(options.map((o) => o.value))
                  }
                }}
                className="cursor-pointer text-[#e8e6e3] hover:bg-[#2a2a2a] data-[selected=true]:bg-[#2a2a2a] aria-selected:bg-[#2a2a2a] border-b border-[#3a3a3a] mb-1"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.length === options.length
                      ? "opacity-100 text-[#d4af37]"
                      : "opacity-0"
                  )}
                />
                Select All
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onChange(
                      selected.includes(option.value)
                        ? selected.filter((item) => item !== option.value)
                        : [...selected, option.value]
                    )
                  }}
                  className="cursor-pointer text-[#e8e6e3] hover:bg-[#2a2a2a] data-[selected=true]:bg-[#2a2a2a] aria-selected:bg-[#2a2a2a]"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(option.value)
                        ? "opacity-100 text-[#d4af37]"
                        : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
