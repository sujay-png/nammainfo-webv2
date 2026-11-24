import type { GreetingTemplate } from "../types";

/** Who is sending: the owner, or a team member (with their own name and card). */
export interface Sender {
  name: string;
  designation: string | null;
  company: string | null;
  /** Their public Namma Info link (owner, branch or team-member card). */
  profileUrl: string | null;
}

/** Something from the profile that can go into a message as a link. */
export interface Attachable {
  key: string;
  label: string;
  /** What goes in the message text: a short branded link where possible. */
  url: string;
  /** For uploaded documents (brochure, menu PDF…): the real file, so it can be sent as an attachment. */
  file?: { url: string; name: string };
}

/** Message 1, word for word as agreed. Empty lines are dropped. */
export function defaultGreeting(contactName: string, s: Sender): string {
  const lines = [
    `Hey ${contactName}`,
    "",
    `Greetings from ${s.name}`,
    s.designation || null,
    s.company || null,
    "",
    "Thank you for connecting with me through nammainfo.in",
  ];
  if (s.profileUrl) {
    lines.push("", "Here is my company profile url for future reference", s.profileUrl);
  }
  return lines.filter((l) => l !== null).join("\n");
}

/** {name} {my_name} {designation} {company} {profile_link} */
export function fillPlaceholders(text: string, contactName: string, s: Sender): string {
  return text
    .replace(/\{name\}/gi, contactName)
    .replace(/\{my_name\}/gi, s.name)
    .replace(/\{designation\}/gi, s.designation ?? "")
    .replace(/\{company\}/gi, s.company ?? "")
    .replace(/\{profile_link\}/gi, s.profileUrl ?? "");
}

/** Messages 2-5: *heading*, the body, then each chosen link on its own line. */
export function templateMessage(
  t: GreetingTemplate,
  contactName: string,
  s: Sender,
  attachables: Attachable[],
  opts: { leaveOutFiles?: boolean } = {}
): string {
  const parts: string[] = [];
  if (t.heading.trim()) parts.push(`*${fillPlaceholders(t.heading.trim(), contactName, s)}*`);
  if (t.body.trim()) parts.push(fillPlaceholders(t.body.trim(), contactName, s));
  const links = t.attach
    .map((k) => attachables.find((a) => a.key === k))
    .filter((a): a is Attachable => !!a)
    .filter((a) => !(opts.leaveOutFiles && a.file))
    .map((a) => `${a.label}: ${a.url}`);
  if (links.length) parts.push(links.join("\n"));
  return parts.join("\n\n");
}

/** wa.me link with the message ready; Indian 10-digit numbers get +91. */
export function whatsappUrl(phone: string, text: string): string {
  const d = phone.replace(/[^0-9]/g, "");
  const n = d.length === 10 ? `91${d}` : d.replace(/^0+/, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Ready-made templates offered when a slot is empty. */
export const SAMPLE_TEMPLATES: Omit<GreetingTemplate, "id">[] = [
  {
    heading: "Our brochure",
    body: "Hi {name}, as promised, here is our brochure. Do reach out if you have any questions.\n\n{my_name}\n{company}",
    attach: ["brochure", "profile"],
  },
  {
    heading: "Thank you for visiting",
    body: "Hi {name}, it was great meeting you. If we served you well, a quick Google review would mean a lot to us.",
    attach: ["review"],
  },
  {
    heading: "Visit us",
    body: "Hi {name}, here is how to reach us. Looking forward to seeing you.\n\n{my_name}, {company}",
    attach: ["directions", "profile"],
  },
  {
    heading: "Special offer",
    body: "Hi {name}, thank you for connecting with {company}. Here are our latest details.",
    attach: ["profile", "website"],
  },
];

/** The uploaded documents a template sends (brochure, menu PDF…), in order. */
export function templateFiles(t: GreetingTemplate, attachables: Attachable[]): Attachable[] {
  return t.attach
    .map((k) => attachables.find((a) => a.key === k))
    .filter((a): a is Attachable => !!a && !!a.file);
}

/** "Akshara Digital India Brochure.pdf": a readable name for an attached file. */
export function attachmentName(company: string | null, label: string, url: string): string {
  const ext = (url.split("?")[0].match(/\.(pdf|jpe?g|png|webp)$/i)?.[1] ?? "pdf").toLowerCase();
  const base = [company, label].filter(Boolean).join(" ").replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${base || "document"}.${ext}`;
}
