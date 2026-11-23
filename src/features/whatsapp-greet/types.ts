/**
 * WhatsApp greetings (Contacts → a contact → "Greet <name> on WhatsApp").
 *
 * Message 1 is built in. Messages 2-5 are the owner's own templates, stored
 * in profiles.greeting_templates (migration 20261123). Team members use
 * their business's templates, filled with their own name and card link.
 */
export interface GreetingTemplate {
  id: string;
  /** Sent in bold as the first line, and used as the template's name. */
  heading: string;
  body: string;
  /** What to add as links at the end, see AttachKey. */
  attach: string[];
}

/** profile | website | brochure | review | directions | btn:<custom button id> | link:<custom link id> */
export type AttachKey = string;

export const MAX_GREETINGS = 4;

export function cleanGreetings(value: unknown): GreetingTemplate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const heading = typeof o.heading === "string" ? o.heading.trim().slice(0, 60) : "";
      const body = typeof o.body === "string" ? o.body.slice(0, 1000) : "";
      if (!heading && !body.trim()) return null;
      return {
        id: typeof o.id === "string" ? o.id : Math.random().toString(36).slice(2, 10),
        heading,
        body,
        attach: Array.isArray(o.attach) ? o.attach.filter((a): a is string => typeof a === "string").slice(0, 12) : [],
      };
    })
    .filter((x): x is GreetingTemplate => !!x)
    .slice(0, MAX_GREETINGS);
}
