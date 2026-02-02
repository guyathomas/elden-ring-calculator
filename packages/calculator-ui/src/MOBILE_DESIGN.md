# Elden Ring Weapon Calculator - Mobile Design

## Core Mobile Design Principles

1. **Vertical-first layout** - Stack sections instead of horizontal arrangement
2. **Collapsible stat inputs** - Hide after configuration to maximize weapon list space
3. **Card-based weapon list** - Replace table with touch-friendly cards
4. **Full-screen detail view** - Modal overlay instead of slideout panel
5. **Sticky header** - Mode toggle always accessible

---

## Mobile Layout Structure

### 1. **Sticky Header Bar**
```
┌─────────────────────────────────┐
│ [≡] Weapon Calculator    [▼]    │  ← Hamburger menu + Collapse toggle
│                                  │
│ [Fixed] [Solver] ←─────────────→ Mode Toggle (centered)
└─────────────────────────────────┘
```

**Features:**
- Hamburger menu (left) for app settings/filters
- Collapse button (right) to hide/show stat inputs
- Mode toggle centered and prominent
- Background: `bg-[#0a0a0a]` with bottom border

---

### 2. **Stat Input Section (Collapsible)**

#### **Fixed Mode - Mobile**
```
┌─────────────────────────────────┐
│ Attributes                       │
├─────────────────────────────────┤
│  STR    DEX    INT    FAI    ARC │
│  [30]   [30]   [30]   [30]   [30]│
└─────────────────────────────────┘
```
- 5 inputs in single row (54px each fits ~270px)
- Minimal labels, just stat abbreviations above
- 2-row layout: labels + inputs

#### **Solver Mode - Mobile**
```
┌─────────────────────────────────┐
│ Optimize For                     │
├─────────────────────────────────┤
│ STR        DEX        INT        │
│ [10]—[80]  [10]—[80]  [10]—[80] │
│                                  │
│ FAI        ARC                   │
│ [10]—[80]  [10]—[80]            │
├─────────────────────────────────┤
│ Budget Constraints               │
├─────────────────────────────────┤
│ Level  VIG   MND   END  │ Avail │
│ [150]  [40]  [30]  [30] │  250  │
└─────────────────────────────────┘
```
- **Optimization stats**: 2 rows (3 + 2 grid)
- **Budget section**: Labeled section with constraints + available points
- Section headers with gold underline
- Vertical spacing between groups

---

### 3. **Weapon Card List**

#### **Card Design**
```
┌─────────────────────────────────────┐
│ Blasphemous Blade              [>] │
│ ──────────────────────────────────  │
│ Total: 847  │  STR 22  DEX 15      │
│              │  INT 0   FAI 60      │
│ ─────────────────────────────────── │
│ 🗡️ 523  🔵 0  🔥 324  ⚡ 0  ✨ 0   │
└─────────────────────────────────────┘
```

**Card Components:**
- **Header**: Weapon name + chevron indicator
- **Stats Row**: Total damage + optimal stat distribution
- **Damage Breakdown**: Icons + color-coded damage types
  - Physical: ⚔️ gray
  - Magic: 🔵 blue  
  - Fire: 🔥 orange
  - Lightning: ⚡ yellow
  - Holy: ✨ gold

**Card Styling:**
- `bg-[#1a1a1a]` with `border-[#2a2a2a]`
- Touch target: min 60px height
- Active state: border changes to gold
- Swipeable? (optional: swipe to favorite/compare)

---

### 4. **Full-Screen Detail Modal**

```
┌─────────────────────────────────────┐
│ ✕                        Blasphemous│
│                              Blade  │
├─────────────────────────────────────┤
│                                     │
│  [Weapon Image/Icon]                │
│                                     │
├─────────────────────────────────────┤
│ Damage Breakdown                    │
│ • Physical     523                  │
│ • Fire         324                  │
│ • Total        847                  │
├─────────────────────────────────────┤
│ Optimal Stats (Total: 97)           │
│ STR  22    INT   0    ARC  0        │
│ DEX  15    FAI  60                  │
├─────────────────────────────────────┤
│ Scaling Grades                      │
│ STR [D]   INT [—]   ARC [—]         │
│ DEX [E]   FAI [B]                   │
├─────────────────────────────────────┤
│ Requirements                        │
│ STR 22 | DEX 15 | INT 0             │
│ FAI 21 | ARC 0                      │
├─────────────────────────────────────┤
│ Weapon Type: Greatsword             │
│ Skill: Taker's Flames               │
└─────────────────────────────────────┘
```

**Modal Features:**
- Full screen overlay with close button (top-left ✕)
- Scrollable content
- Organized into clear sections
- Large touch targets
- Could include "Compare" and "Favorite" buttons at bottom

---

## Responsive Breakpoints

### **Mobile Portrait (< 640px)**
- Single column layout
- Collapsible stat inputs
- Card-based weapon list
- Full-screen modals

### **Mobile Landscape / Small Tablet (640px - 768px)**
- Consider 2-column card grid
- Keep collapsible inputs
- Wider modal (not full-screen, centered)

### **Tablet (768px+)**
- Transition to desktop layout
- Show table instead of cards
- Side drawer instead of modal

---

## Touch Interactions

1. **Tap weapon card** → Open detail modal
2. **Swipe header down** → Collapse stat inputs
3. **Swipe header up** → Expand stat inputs
4. **Long-press weapon card** → Quick-compare mode (optional)
5. **Pinch inputs** → Lock/unlock stat (in solver mode)

---

## Mobile-Specific Features

### **Quick Filters (Hamburger Menu)**
```
┌─────────────────────┐
│ Filters             │
├─────────────────────┤
│ ☐ Melee Only        │
│ ☐ Ranged Only       │
│ ☐ Minimum Req Met   │
│ ☐ Favorites         │
├─────────────────────┤
│ Sort By             │
│ ○ Total Damage      │
│ ○ Physical Damage   │
│ ○ Weapon Name       │
│ ○ Stat Investment   │
└─────────────────────┘
```

### **Comparison Mode**
- Toggle to "compare mode" → tap 2-3 weapons
- Side-by-side comparison cards
- Highlight differences in damage/stats

### **Stat Presets**
- Save common builds ("Quality 40/40", "Pure Faith")
- Quick-load from dropdown

---

## Performance Optimizations

1. **Virtual scrolling** for weapon list (100+ weapons)
2. **Lazy load** detail modal content
3. **Debounce** stat input changes (wait 300ms before recalculating)
4. **Memoize** damage calculations

---

## Accessibility

- Touch targets: minimum 44px × 44px
- Input labels clearly associated
- Sufficient color contrast (especially damage type colors)
- Modal traps focus, ESC to close
- Swipe gestures have button alternatives

---

## Technical Implementation Notes

### **Responsive Strategy**
```tsx
// Use Tailwind breakpoints
<div className="
  // Mobile (default)
  flex flex-col gap-2
  
  // Tablet
  md:grid md:grid-cols-2
  
  // Desktop
  lg:grid-cols-1 lg:flex-row
">
```

### **Collapsible Section**
```tsx
const [inputsExpanded, setInputsExpanded] = useState(true);

// Animate height with motion
<motion.div
  initial={false}
  animate={{ height: inputsExpanded ? 'auto' : 0 }}
  className="overflow-hidden"
>
  {/* Stat inputs */}
</motion.div>
```

### **Card List Component**
```tsx
<div className="flex flex-col gap-2 p-4">
  {weapons.map(weapon => (
    <WeaponCard 
      key={weapon.id}
      weapon={weapon}
      onClick={() => setSelectedWeapon(weapon)}
    />
  ))}
</div>
```

---

## Color Coding (Mobile)

Maintain desktop color scheme:
- **Background**: `#0a0a0a`
- **Cards**: `#1a1a1a`
- **Borders**: `#2a2a2a`
- **Gold accent**: `#d4af37`
- **Text primary**: `#e8e6e3`
- **Text secondary**: `#8b8b8b`

**Damage Types:**
- Physical: `#9ca3af` (gray)
- Magic: `#60a5fa` (blue)
- Fire: `#fb923c` (orange)
- Lightning: `#fbbf24` (yellow)
- Holy: `#d4af37` (gold)

---

## Next Steps

1. Implement responsive breakpoints in existing components
2. Create `<WeaponCard>` component
3. Create `<WeaponDetailModal>` component
4. Add collapse/expand state to `<StatInputPanel>`
5. Add media query detection hook
6. Test on real devices (iOS Safari, Android Chrome)
