# Project Rules & Guidelines: Namma Info Web

## UI & Design Standards (Strict: No AI Slop)

1. **No Sparkles / "AI Magic" Icons**:
   - Never use `<Sparkles />` or sparkle emojis (✨) on buttons, cards, upgrade banners, or feature headers.
   - Use clean, functional icons (e.g. `CreditCard`, `ArrowRight`, `ShieldCheck`, `CheckCircle2`) that directly represent the action.

2. **No Neon Colors, Glows, or Laser Effects**:
   - Avoid fluorescent green, electric purple/cyan, or neon glowing borders (e.g., `shadow-[0_0_..._#...]`, `animate-pulse` neon dots).
   - Use the project's semantic theme tokens: `var(--foreground)`, `var(--muted-foreground)`, `var(--card)`, `var(--accent)`, `var(--border)`, `var(--primary)`.
   - Maintain high contrast, professional, and accessible color schemes.

3. **No Transparent Neon Pills or Over-Decorated Badges**:
   - Avoid rounded-full pill badges with low-opacity neon backgrounds and matching colored borders (e.g., `rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-mono`).
   - For status badges or chips, use crisp micro-badges: rectangular with subtle radius (`rounded-[4px]` or `rounded-[5px]`), neutral borders (`border-[var(--border)]`), and muted or monochrome text.

4. **No Repetitive Duplicate CTAs / Cards**:
   - Never stack duplicate cards or banners promoting the exact same action (e.g., an "Account Status" card asking to upgrade to Pro directly followed by another banner asking to upgrade to Pro).
   - Consolidate upgrade prompts and contextual states (like 100% profile completion) directly inside the primary status card.

5. **Component Aesthetic & Consistency**:
   - Follow the established design system: `rounded-[5px]` radius on cards, inputs, and buttons.
   - Use crisp typography, clear visual hierarchy, and scannable key-value blocks.
