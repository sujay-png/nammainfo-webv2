# UI & Design Standards (No AI Slop)

## Guidelines
- **No Sparkles Icons**: Do not use `<Sparkles />` or sparkle emojis (`✨`). Use purposeful, semantic icons (`CreditCard`, `ArrowRight`, `ShieldCheck`).
- **No Neons or Glows**: Avoid fluorescent green, electric purple/cyan, or neon glowing borders/shadows (`shadow-[0_0_..._#...]`). Rely on CSS variable tokens (`var(--primary)`, `var(--card)`, `var(--accent)`, `var(--border)`, `var(--foreground)`, `var(--muted-foreground)`).
- **No Transparent Neon Pills**: Avoid rounded-full pill badges with low-opacity neon backgrounds and borders (`rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-mono`). Instead, use clean rectangular micro-badges (`rounded-[4px]` or `rounded-[5px]`) with neutral borders and muted/monochrome text.
- **No Duplicate Repetitive CTAs**: Never stack multiple cards promoting the exact same upgrade or action. Consolidate status and action into a single unified card.
- **Consistent Radius & Aesthetics**: Retain the clean, grounded `rounded-[5px]` aesthetic across all components.
