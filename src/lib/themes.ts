/* ------------------------------------------------------------------ */
/*  Theme definitions for Namma Info                                   */
/*  Each theme defines CSS variable overrides for light + dark modes   */
/* ------------------------------------------------------------------ */

export interface ThemeColors {
  /** Light mode variables */
  light: {
    "--background": string;
    "--foreground": string;
    "--muted": string;
    "--muted-foreground": string;
    "--border": string;
    "--card": string;
    "--card-foreground": string;
    "--accent": string;
    "--accent-foreground": string;
    "--input": string;
    "--ring": string;
    "--primary": string;
    "--primary-foreground": string;
  };
  /** Dark mode variables */
  dark: {
    "--background": string;
    "--foreground": string;
    "--muted": string;
    "--muted-foreground": string;
    "--border": string;
    "--card": string;
    "--card-foreground": string;
    "--accent": string;
    "--accent-foreground": string;
    "--input": string;
    "--ring": string;
    "--primary": string;
    "--primary-foreground": string;
  };
}

export interface ThemeDefinition {
  slug: string;
  name: string;
  /** Preview swatch colors shown in the picker */
  preview: { primary: string; accent: string; bg: string };
  colors: ThemeColors;
}

export const themes: ThemeDefinition[] = [
  {
    slug: "default",
    name: "Monochrome",
    preview: { primary: "#0A0A0A", accent: "#F5F5F5", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#0A0A0A",
        "--muted": "#F5F5F5",
        "--muted-foreground": "#737373",
        "--border": "#E5E5E5",
        "--card": "#FFFFFF",
        "--card-foreground": "#0A0A0A",
        "--accent": "#F5F5F5",
        "--accent-foreground": "#0A0A0A",
        "--input": "#E5E5E5",
        "--ring": "#0A0A0A",
        "--primary": "#0A0A0A",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#0A0A0A",
        "--foreground": "#FAFAFA",
        "--muted": "#171717",
        "--muted-foreground": "#A3A3A3",
        "--border": "#262626",
        "--card": "#171717",
        "--card-foreground": "#FAFAFA",
        "--accent": "#262626",
        "--accent-foreground": "#FAFAFA",
        "--input": "#262626",
        "--ring": "#FAFAFA",
        "--primary": "#FAFAFA",
        "--primary-foreground": "#0A0A0A",
      },
    },
  },
  {
    slug: "ocean",
    name: "Ocean Blue",
    preview: { primary: "#2563EB", accent: "#EFF6FF", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#0F172A",
        "--muted": "#F1F5F9",
        "--muted-foreground": "#64748B",
        "--border": "#E2E8F0",
        "--card": "#FFFFFF",
        "--card-foreground": "#0F172A",
        "--accent": "#EFF6FF",
        "--accent-foreground": "#1E40AF",
        "--input": "#E2E8F0",
        "--ring": "#2563EB",
        "--primary": "#2563EB",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#0B1120",
        "--foreground": "#E2E8F0",
        "--muted": "#1E293B",
        "--muted-foreground": "#94A3B8",
        "--border": "#1E293B",
        "--card": "#131C2E",
        "--card-foreground": "#E2E8F0",
        "--accent": "#1E3A5F",
        "--accent-foreground": "#93C5FD",
        "--input": "#1E293B",
        "--ring": "#3B82F6",
        "--primary": "#3B82F6",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "emerald",
    name: "Emerald",
    preview: { primary: "#059669", accent: "#ECFDF5", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#022C22",
        "--muted": "#F0FDF4",
        "--muted-foreground": "#4B5563",
        "--border": "#D1FAE5",
        "--card": "#FFFFFF",
        "--card-foreground": "#022C22",
        "--accent": "#ECFDF5",
        "--accent-foreground": "#065F46",
        "--input": "#D1FAE5",
        "--ring": "#059669",
        "--primary": "#059669",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#041F17",
        "--foreground": "#D1FAE5",
        "--muted": "#0D2B22",
        "--muted-foreground": "#6EE7B7",
        "--border": "#134E3A",
        "--card": "#0A2A1F",
        "--card-foreground": "#D1FAE5",
        "--accent": "#134E3A",
        "--accent-foreground": "#A7F3D0",
        "--input": "#134E3A",
        "--ring": "#10B981",
        "--primary": "#10B981",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "sunset",
    name: "Sunset Orange",
    preview: { primary: "#EA580C", accent: "#FFF7ED", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#1C1917",
        "--muted": "#FFF7ED",
        "--muted-foreground": "#78716C",
        "--border": "#FED7AA",
        "--card": "#FFFFFF",
        "--card-foreground": "#1C1917",
        "--accent": "#FFF7ED",
        "--accent-foreground": "#9A3412",
        "--input": "#FED7AA",
        "--ring": "#EA580C",
        "--primary": "#EA580C",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#1A0E06",
        "--foreground": "#FED7AA",
        "--muted": "#2C1A0E",
        "--muted-foreground": "#FDBA74",
        "--border": "#3D2314",
        "--card": "#221208",
        "--card-foreground": "#FED7AA",
        "--accent": "#3D2314",
        "--accent-foreground": "#FDBA74",
        "--input": "#3D2314",
        "--ring": "#F97316",
        "--primary": "#F97316",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "royal",
    name: "Royal Purple",
    preview: { primary: "#7C3AED", accent: "#F5F3FF", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#1E1B4B",
        "--muted": "#F5F3FF",
        "--muted-foreground": "#6B7280",
        "--border": "#E9D5FF",
        "--card": "#FFFFFF",
        "--card-foreground": "#1E1B4B",
        "--accent": "#F5F3FF",
        "--accent-foreground": "#5B21B6",
        "--input": "#E9D5FF",
        "--ring": "#7C3AED",
        "--primary": "#7C3AED",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#0E0A1F",
        "--foreground": "#E9D5FF",
        "--muted": "#1A1333",
        "--muted-foreground": "#C4B5FD",
        "--border": "#2E1F5E",
        "--card": "#140F28",
        "--card-foreground": "#E9D5FF",
        "--accent": "#2E1F5E",
        "--accent-foreground": "#DDD6FE",
        "--input": "#2E1F5E",
        "--ring": "#8B5CF6",
        "--primary": "#8B5CF6",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "rose",
    name: "Rose Pink",
    preview: { primary: "#E11D48", accent: "#FFF1F2", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#1C1917",
        "--muted": "#FFF1F2",
        "--muted-foreground": "#71717A",
        "--border": "#FECDD3",
        "--card": "#FFFFFF",
        "--card-foreground": "#1C1917",
        "--accent": "#FFF1F2",
        "--accent-foreground": "#9F1239",
        "--input": "#FECDD3",
        "--ring": "#E11D48",
        "--primary": "#E11D48",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#1A0A10",
        "--foreground": "#FECDD3",
        "--muted": "#2D1320",
        "--muted-foreground": "#FDA4AF",
        "--border": "#4C1D2F",
        "--card": "#200E18",
        "--card-foreground": "#FECDD3",
        "--accent": "#4C1D2F",
        "--accent-foreground": "#FECDD3",
        "--input": "#4C1D2F",
        "--ring": "#F43F5E",
        "--primary": "#F43F5E",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "amber",
    name: "Amber Gold",
    preview: { primary: "#D97706", accent: "#FFFBEB", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#1C1917",
        "--muted": "#FFFBEB",
        "--muted-foreground": "#78716C",
        "--border": "#FDE68A",
        "--card": "#FFFFFF",
        "--card-foreground": "#1C1917",
        "--accent": "#FFFBEB",
        "--accent-foreground": "#92400E",
        "--input": "#FDE68A",
        "--ring": "#D97706",
        "--primary": "#D97706",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#1A1206",
        "--foreground": "#FDE68A",
        "--muted": "#2C1E0B",
        "--muted-foreground": "#FCD34D",
        "--border": "#3D2B11",
        "--card": "#221708",
        "--card-foreground": "#FDE68A",
        "--accent": "#3D2B11",
        "--accent-foreground": "#FDE68A",
        "--input": "#3D2B11",
        "--ring": "#F59E0B",
        "--primary": "#F59E0B",
        "--primary-foreground": "#1C1917",
      },
    },
  },
  {
    slug: "teal",
    name: "Teal",
    preview: { primary: "#0D9488", accent: "#F0FDFA", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#042F2E",
        "--muted": "#F0FDFA",
        "--muted-foreground": "#5B7876",
        "--border": "#CCFBF1",
        "--card": "#FFFFFF",
        "--card-foreground": "#042F2E",
        "--accent": "#F0FDFA",
        "--accent-foreground": "#115E59",
        "--input": "#CCFBF1",
        "--ring": "#0D9488",
        "--primary": "#0D9488",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#031A17",
        "--foreground": "#CCFBF1",
        "--muted": "#0B2926",
        "--muted-foreground": "#5EEAD4",
        "--border": "#134E48",
        "--card": "#072623",
        "--card-foreground": "#CCFBF1",
        "--accent": "#134E48",
        "--accent-foreground": "#99F6E4",
        "--input": "#134E48",
        "--ring": "#14B8A6",
        "--primary": "#14B8A6",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "slate",
    name: "Slate Blue",
    preview: { primary: "#475569", accent: "#F1F5F9", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#0F172A",
        "--muted": "#F8FAFC",
        "--muted-foreground": "#64748B",
        "--border": "#E2E8F0",
        "--card": "#FFFFFF",
        "--card-foreground": "#0F172A",
        "--accent": "#F1F5F9",
        "--accent-foreground": "#334155",
        "--input": "#E2E8F0",
        "--ring": "#475569",
        "--primary": "#475569",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#0C1222",
        "--foreground": "#CBD5E1",
        "--muted": "#1E293B",
        "--muted-foreground": "#94A3B8",
        "--border": "#1E293B",
        "--card": "#131C2E",
        "--card-foreground": "#CBD5E1",
        "--accent": "#1E293B",
        "--accent-foreground": "#CBD5E1",
        "--input": "#1E293B",
        "--ring": "#64748B",
        "--primary": "#64748B",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
  {
    slug: "crimson",
    name: "Crimson",
    preview: { primary: "#DC2626", accent: "#FEF2F2", bg: "#FFFFFF" },
    colors: {
      light: {
        "--background": "#FFFFFF",
        "--foreground": "#1C1917",
        "--muted": "#FEF2F2",
        "--muted-foreground": "#71717A",
        "--border": "#FECACA",
        "--card": "#FFFFFF",
        "--card-foreground": "#1C1917",
        "--accent": "#FEF2F2",
        "--accent-foreground": "#991B1B",
        "--input": "#FECACA",
        "--ring": "#DC2626",
        "--primary": "#DC2626",
        "--primary-foreground": "#FFFFFF",
      },
      dark: {
        "--background": "#1A0808",
        "--foreground": "#FECACA",
        "--muted": "#2D1010",
        "--muted-foreground": "#FCA5A5",
        "--border": "#4C1414",
        "--card": "#200C0C",
        "--card-foreground": "#FECACA",
        "--accent": "#4C1414",
        "--accent-foreground": "#FECACA",
        "--input": "#4C1414",
        "--ring": "#EF4444",
        "--primary": "#EF4444",
        "--primary-foreground": "#FFFFFF",
      },
    },
  },
];

/** Look up a theme by slug, falling back to default */
export function getTheme(slug: string | null | undefined): ThemeDefinition {
  return themes.find((t) => t.slug === slug) ?? themes[0];
}

/** Generate inline CSS variable string for a theme + mode */
export function themeToCSS(
  theme: ThemeDefinition,
  mode: "light" | "dark"
): string {
  const vars = theme.colors[mode];
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
