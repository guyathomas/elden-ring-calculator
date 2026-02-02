import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "./utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion"

export type Option = {
  label: string
  value: string
}

// Weapon type groupings
const WEAPON_GROUPS: Record<string, string[]> = {
  "Melee": [
    // Swords
    "Dagger",
    "Straight Sword",
    "Greatsword",
    "Colossal Sword",
    "Curved Sword",
    "Curved Greatsword",
    "Thrusting Sword",
    "Heavy Thrusting Sword",
    "Backhand Blade",
    "Light Greatsword",
    // Katanas & Twinblades
    "Katana",
    "Great Katana",
    "Twinblade",
    // Axes & Hammers
    "Axe",
    "Greataxe",
    "Hammer",
    "Great Hammer",
    "Flail",
    // Polearms
    "Spear",
    "Great Spear",
    "Halberd",
    "Reaper",
    // Fists & Claws
    "Fist",
    "Claw",
    "Hand-to-Hand",
    "Beast Claw",
    // Other Melee
    "Whip",
    "Colossal Weapon",
    "Torch",
    "Unarmed",
  ],
  "Ranged": [
    "Light Bow",
    "Bow",
    "Greatbow",
    "Crossbow",
    "Ballista",
    "Perfume Bottle",
    "Throwing Blade",
  ],
  "Catalysts": [
    "Glintstone Staff",
    "Sacred Seal",
  ],
  "Shields": [
    "Small Shield",
    "Medium Shield",
    "Greatshield",
    "Thrusting Shield",
  ],
}

interface GroupedCheckboxListProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  className?: string
}

export function GroupedCheckboxList({
  options,
  selected,
  onChange,
  className,
}: GroupedCheckboxListProps) {
  // Get the available options as a set for quick lookup
  const availableValues = new Set(options.map((o) => o.value))

  // Build groups with only available options, sorted alphabetically
  const groups = Object.entries(WEAPON_GROUPS)
    .map(([groupName, groupValues]) => ({
      name: groupName,
      options: groupValues.filter((v) => availableValues.has(v)).sort((a, b) => a.localeCompare(b)),
    }))
    .filter((group) => group.options.length > 0)

  // Find any options not in groups, sorted alphabetically
  const groupedValues = new Set(Object.values(WEAPON_GROUPS).flat())
  const ungroupedOptions = options.filter((o) => !groupedValues.has(o.value))
  if (ungroupedOptions.length > 0) {
    groups.push({
      name: "Other",
      options: ungroupedOptions.map((o) => o.value).sort((a, b) => a.localeCompare(b)),
    })
  }

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleGroupToggle = (groupOptions: string[]) => {
    const availableGroupOptions = groupOptions.filter((v) => availableValues.has(v))
    const allGroupSelected = availableGroupOptions.every((v) => selected.includes(v))

    if (allGroupSelected) {
      // Deselect all in group
      onChange(selected.filter((v) => !availableGroupOptions.includes(v)))
    } else {
      // Select all in group
      const newSelected = new Set(selected)
      availableGroupOptions.forEach((v) => newSelected.add(v))
      onChange(Array.from(newSelected))
    }
  }

  const getGroupSelectedCount = (groupOptions: string[]) => {
    return groupOptions.filter((v) => availableValues.has(v) && selected.includes(v)).length
  }

  const getGroupTotalCount = (groupOptions: string[]) => {
    return groupOptions.filter((v) => availableValues.has(v)).length
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Grouped accordion */}
      <Accordion type="multiple" defaultValue={[]} className="w-full">
        {groups.map((group) => {
          const selectedCount = getGroupSelectedCount(group.options)
          const totalCount = getGroupTotalCount(group.options)
          const allGroupSelected = selectedCount === totalCount

          return (
            <AccordionItem
              key={group.name}
              value={group.name}
              className="border-[#2a2a2a]"
            >
              <div className="flex items-center gap-2 py-2">
                {/* Checkbox - separate from accordion trigger */}
                <button
                  onClick={() => handleGroupToggle(group.options)}
                  className="w-5 h-5 border rounded flex items-center justify-center transition-colors shrink-0 touch-manipulation"
                  style={{
                    backgroundColor: allGroupSelected ? '#d4af37' : selectedCount > 0 ? 'rgba(212,175,55,0.3)' : 'transparent',
                    borderColor: selectedCount > 0 ? '#d4af37' : 'rgba(212,175,55,0.5)',
                  }}
                  aria-label={`Select all ${group.name}`}
                >
                  {allGroupSelected && <Check className="w-3 h-3 text-black" />}
                  {!allGroupSelected && selectedCount > 0 && (
                    <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#d4af37' }} />
                  )}
                </button>

                {/* Accordion trigger - expands/collapses */}
                <AccordionTrigger className="flex-1 py-0 hover:no-underline text-[#e8e6e3]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{group.name}</span>
                    <span className="text-xs text-[#8b8b8b]">
                      {selectedCount}/{totalCount}
                    </span>
                  </div>
                </AccordionTrigger>
              </div>
              <AccordionContent className="pb-2">
                <div className="flex flex-col gap-1 pl-6">
                  {group.options.filter((v) => availableValues.has(v)).map((value) => {
                    const isSelected = selected.includes(value)
                    return (
                      <button
                        key={value}
                        onClick={() => handleToggle(value)}
                        className="flex items-center gap-3 py-1.5 text-left touch-manipulation"
                      >
                        <div
                          className="w-4 h-4 border rounded flex items-center justify-center transition-colors shrink-0"
                          style={{
                            backgroundColor: isSelected ? '#d4af37' : 'transparent',
                            borderColor: isSelected ? '#d4af37' : 'rgba(212,175,55,0.5)',
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-black" />}
                        </div>
                        <span
                          className={cn(
                            "text-sm transition-colors",
                            isSelected ? "text-[#e8e6e3]" : "text-[#8b8b8b]"
                          )}
                        >
                          {value}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
