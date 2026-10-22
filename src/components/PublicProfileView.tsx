"use client";

import { useState, useMemo, useEffect } from "react";
import { saveContactFromUrl } from "@/lib/save-contact";
import Link from "next/link";
import Image from "next/image";
import type { Profile, Card, Review, Employee } from "@/lib/supabase/types";
import { initials, googleReviewUrl, directionsUrl } from "@/lib/utils";
import { getTheme } from "@/lib/themes";
import TapTracker from "@/components/TapTracker";
import AutoSaveCard from "@/components/AutoSaveCard";
import {
  Download,
  Phone,
  Mail,
  Globe,
  MapPin,
  Share2,
  Star,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  UserPlus,
  Eye,
  Users,
  Award,
  Clock,
  Briefcase,
  Image as ImageIcon,
  RefreshCw,
  MessageCircle,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  Banknote,
  CreditCard,
  Wallet,
  Copy,
  Check,
  FileText,
  BookUser,
  Navigation,
  X,
} from "lucide-react";

/**
 * Ensure a URL string has a protocol prefix, so it opens as an absolute URL
 * rather than being treated as a relative path under nammainfo.in.
 */
function ensureProtocol(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/**
 * Build the correct href for a social link.
 * WhatsApp links use wa.me/<number> instead of a raw URL.
 */
function socialHref(link: { platform: string; url: string }): string {
  const p = link.platform.toLowerCase();
  if (p.includes("whatsapp")) {
    const digits = link.url.replace(/[^0-9]/g, "");
    return `https://wa.me/${digits}`;
  }
  return ensureProtocol(link.url);
}

/** Get the WhatsApp number from social links */
function getWhatsAppNumber(
  socialLinks: { platform: string; url: string }[]
): string | null {
  const wa = socialLinks.find((l) =>
    l.platform.toLowerCase().includes("whatsapp")
  );
  if (!wa) return null;
  return wa.url.replace(/[^0-9]/g, "");
}

/* ------------------------------------------------------------------ */
/*  Review suggestions                                                  */
/*                                                                      */
/*  Each suggestion is a full 3-paragraph review about ONE specific     */
/*  service/product the owner has listed:                               */
/*    1. about the company                                              */
/*    2. about the service/product itself (uses its description)        */
/*    3. recommending it to others                                      */
/*  The service/product name appears in every paragraph. Paragraph      */
/*  templates are mixed randomly, so refreshing gives fresh wording.    */
/* ------------------------------------------------------------------ */

type ReviewItem = { name: string; description?: string; category?: string; kind: "service" | "product" };

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Pick an index not used yet in this batch (so the 4 cards on screen differ). */
function pickFreshIdx(len: number, used: Set<number>, avoid?: (i: number) => boolean): number {
  const all = Array.from({ length: len }, (_, i) => i);
  let pool = all.filter((i) => !used.has(i) && !(avoid?.(i)));
  if (!pool.length) pool = all.filter((i) => !used.has(i));
  if (!pool.length) pool = all;
  const idx = pool[Math.floor(Math.random() * pool.length)];
  used.add(idx);
  return idx;
}
function pickFresh<T>(arr: T[], used: Set<number>): T {
  return arr[pickFreshIdx(arr.length, used)];
}

/* Openings this phone has already copied for a business are remembered and
   never offered again. A shop that hands its phone to several customers
   would otherwise post reviews that all start the same way. */
const USED_KEY = (profileId: string) => `nammainfo:usedReviewOpeners:${profileId}`;
const reviewSignatures = new Map<string, string>(); // review text -> "o12m4"

function readUsedOpeners(profileId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(USED_KEY(profileId)) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function rememberCopiedReview(profileId: string, text: string) {
  const sig = reviewSignatures.get(text);
  if (!sig) return;
  try {
    const list = Array.from(readUsedOpeners(profileId)).filter((x) => x !== sig);
    localStorage.setItem(USED_KEY(profileId), JSON.stringify([...list, sig].slice(-300)));
  } catch {}
}

/** "Akshara Digital India Pvt Ltd" -> "Akshara Digital India" */
function shortBizName(name: string): string {
  const short = name
    .replace(/\b(pvt\.?|private|ltd\.?|limited|llp|inc\.?|corp\.?|co\.)(?=\s|$)/gi, "")
    .replace(/[\s,.&]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return short.length >= 3 ? short : name;
}

/** Areas like "Global" or "All India" read badly in "here in ___". */
function placeName(area?: string | null): string | null {
  const a = area?.trim();
  if (!a) return null;
  if (/global|world|international|india|online|anywhere|all over|pan |nationwide|everywhere/i.test(a)) return null;
  return a;
}

/** First sentence of an owner-written description, cleaned for reuse. */
function descSentence(desc?: string): string | null {
  if (!desc) return null;
  let first = desc.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  first = first.replace(/\s*[—–]\s*|\s+-\s+/g, ", ").replace(/[.!?,\s]+$/, "");
  if (first.length < 8 || first.length > 180) return null;
  return /^[A-Z][a-z]/.test(first) ? first[0].toLowerCase() + first.slice(1) : first;
}

/** Final safety net: no dashes as punctuation, tidy spacing. */
function tidy(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/\.\s+([a-z])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\s{2,}/g, " ")
    .replace(/\.\./g, ".")
    .trim();
}

type ReviewRole =
  | "retailer"
  | "manufacturer"
  | "wholesaler"
  | "distributor"
  | "service"
  | "agency"
  | "freelancer"
  | "product"; // product, business type unknown: neutral wording, never claims they made it

/** Which angle to write from, based on the business type and the item. */
function reviewRole(businessType: string | null | undefined, kind: ReviewItem["kind"]): ReviewRole {
  if (kind === "service") {
    if (businessType === "agency") return "agency";
    if (businessType === "freelancer") return "freelancer";
    return "service";
  }
  switch (businessType) {
    case "retailer":
    case "manufacturer":
    case "wholesaler":
    case "distributor":
      return businessType;
    default:
      return "product";
  }
}

type F = (b: string, s: string) => string;

interface RolePack {
  open: F[];
  main: ((s: string) => string)[];
  detail: string[];
  rec: F[];
  desc: (s: string, d: string) => string;
  /** Overrides for roles where "the staff / the owner / the team" doesn't fit. */
  mid?: string[];
  closers?: string[];
}

function rolePacks(owner: string | null): Record<ReviewRole, RolePack> {
  const cap = (d: string) => d[0].toUpperCase() + d.slice(1);
  const productDesc = (s: string, d: string) =>
    rand([`It was just as they describe it: ${d}.`, `${cap(d)}, exactly as promised.`, `As they mention, the ${s} is ${d}.`]);
  const serviceDesc = (s: string, d: string) =>
    rand([`Their ${s} covers ${d}, and they did all of it.`, `They told me upfront it would include ${d}, and that is what I got.`]);

  return {
    retailer: {
      open: [
        (b, s) => `I bought ${s} from ${b} last week and it was a pleasant experience.`,
        (b, s) => `${b} is where I go for ${s} now.`,
        (b, s) => `Went to ${b} looking for ${s} and found what I wanted.`,
        (b, s) => `Been buying ${s} from ${b} for some time, so I thought I should finally write a review.`,
        (b, s) => `A neighbour told me ${b} has a good range of ${s}, so I went there.`,
        (b, s) => `I needed ${s} urgently and ${b} had it in stock.`,
        (b, s) => `Visited ${b} for ${s} and I liked the way they dealt with me.`,
        (b, s) => `Good shop for ${s}. I went to ${b} after checking a couple of other places.`,
        (b, s) => `My family has been buying ${s} from ${b} for a while now.`,
        (b, s) => `Picked up ${s} from ${b} recently.`,
        (b, s) => `Shopping for ${s} at ${b} was easy and quick.`,
        (b, s) => `I used to buy ${s} from wherever was closest, but this time I tried ${b} and I am glad I did.`,
      ],
      main: [
        (s) => `They have a good variety of ${s}, so I could compare a few before choosing.`,
        (s) => `The ${s} I got was genuine and in good condition.`,
        (s) => `Prices for ${s} were reasonable, a little better than what I saw elsewhere.`,
        (s) => `The staff explained the different ${s} options without pushing me towards the costliest one.`,
        (s) => `They had the ${s} I wanted in stock, so there was no waiting.`,
        (s) => `The ${s} was well packed and exactly what I asked for.`,
        (s) => `I checked the ${s} once I got home and it was exactly as shown in the shop.`,
        (s) => `Billing for the ${s} was quick and they gave a proper bill.`,
      ],
      detail: [
        `The shop is clean and things are easy to find.`,
        `They also told me about the current offers, which saved me a bit.`,
        `Even when it was busy, someone came to help me quickly.`,
        `They were fine with me taking my time to decide.`,
        `They suggested a couple of options I had not tried before.`,
        `Paying by UPI was smooth.`,
        `I have gone back a few times since, and it has been the same good experience.`,
      ],
      rec: [
        (b, s) => `For ${s}, I would suggest ${b} to anyone nearby.`,
        (b, s) => `If you need ${s}, do check ${b} once.`,
        (b, s) => `I will keep buying my ${s} from ${b}.`,
        (b, s) => `Recommending ${b} for ${s} to friends and family.`,
        (b, s) => `Good place for ${s}. ${b} has got a regular customer in me.`,
        (b, s) => `Anyone looking for genuine ${s} at a fair price can go to ${b}.`,
      ],
      desc: productDesc,
    },

    manufacturer: {
      open: [
        (b, s) => `I ordered ${s} directly from ${b}, who make it themselves.`,
        (b, s) => `${b} makes their own ${s}, and you can tell the difference.`,
        (b, s) => `I have been using ${s} made by ${b} for a while now.`,
        (b, s) => `Got ${s} from ${b} after a friend recommended their products.`,
        (b, s) => `We placed an order for ${s} with ${b} for our office.`,
        (b, s) => `Bought ${s} straight from the makers, ${b}.`,
        (b, s) => `I wanted ${s} made to my requirement and ${b} did it.`,
        (b, s) => `I visited ${b} to see their ${s} before ordering, and came back impressed.`,
      ],
      main: [
        (s) => `The quality of the ${s} is very good. You can see the care that goes into making it.`,
        (s) => `Their ${s} is well made and has held up well so far.`,
        (s) => `The finishing on the ${s} is neat and it feels solid.`,
        (s) => `They were happy to customise the ${s} a little for my needs.`,
        (s) => `Since they make the ${s} themselves, the price was better than buying from a shop.`,
        (s) => `Every batch of ${s} I have received has been the same quality.`,
      ],
      detail: [
        `They explained the materials they use, which gave me confidence.`,
        `Delivery was on the date they promised.`,
        `Packing was strong and nothing was damaged.`,
        `They also shared a few tips on how to take care of it.`,
        `Bulk and small orders are both handled properly.`,
      ],
      rec: [
        (b, s) => `If you want ${s} straight from the makers, go to ${b}.`,
        (b, s) => `I would recommend ${b} for ${s} to anyone who values quality.`,
        (b, s) => `Will order my ${s} from ${b} again.`,
        (b, s) => `Good quality ${s} at a fair price. ${b} is a good choice.`,
      ],
      desc: productDesc,
    },

    wholesaler: {
      open: [
        (b, s) => `We run a small store and have been buying ${s} in bulk from ${b} for some months.`,
        (b, s) => `${b} is our regular supplier for ${s}.`,
        (b, s) => `I source ${s} for my shop from ${b}.`,
        (b, s) => `We started taking ${s} from ${b} after our earlier supplier kept delaying.`,
        (b, s) => `For bulk orders of ${s}, ${b} has been reliable for us.`,
        (b, s) => `Our business buys ${s} wholesale from ${b}.`,
        (b, s) => `I have been ordering ${s} from ${b} for our outlet.`,
      ],
      main: [
        (s) => `Their rates for ${s} are competitive, so our margins are better.`,
        (s) => `Stock of ${s} is usually available, and they tell us in advance if something is short.`,
        (s) => `Every order of ${s} has come on time and in the right quantity.`,
        (s) => `The quality of the ${s} stays the same from one order to the next.`,
        (s) => `They are flexible with order quantities for ${s}, which helps a small business like ours.`,
      ],
      detail: [
        `Billing and GST invoices are always proper.`,
        `If a piece comes damaged, they replace it without any fuss.`,
        `Payment terms are fair and clearly explained.`,
        `Placing orders over WhatsApp is quick.`,
        `Delivery to our shop is on time.`,
      ],
      rec: [
        (b, s) => `Shop owners looking for a dependable ${s} supplier should talk to ${b}.`,
        (b, s) => `For wholesale ${s}, I can recommend ${b}.`,
        (b, s) => `We will continue taking our ${s} from ${b}.`,
        (b, s) => `If you buy ${s} in bulk, ${b} is worth contacting.`,
      ],
      desc: productDesc,
    },

    distributor: {
      open: [
        (b, s) => `We get our ${s} through ${b}, who are dealers in this area.`,
        (b, s) => `${b} is an authorised dealer for ${s}, so I bought from them.`,
        (b, s) => `I purchased ${s} from ${b} because I wanted a genuine product with proper warranty.`,
        (b, s) => `Our company has been getting ${s} supplied by ${b}.`,
        (b, s) => `For ${s}, ${b} is the dealer I trust.`,
        (b, s) => `I was told ${b} is the right place for original ${s}, and that turned out to be true.`,
      ],
      main: [
        (s) => `The ${s} came with a proper bill and warranty.`,
        (s) => `Supply of ${s} has been regular, without delays.`,
        (s) => `They know the ${s} range well and suggested the right one for my need.`,
        (s) => `Genuine ${s} at the right price, which is not always easy to find.`,
        (s) => `When I had a warranty question about the ${s}, they took it up with the company for me.`,
      ],
      detail: [
        `Delivery was on time.`,
        `They helped with the installation details as well.`,
        `After sales support has been good so far.`,
        `Invoices and warranty papers were all in order.`,
        `They picked up my call even after the sale was done.`,
      ],
      rec: [
        (b, s) => `For genuine ${s} with proper support, I recommend ${b}.`,
        (b, s) => `If you want ${s} from an authorised dealer, ${b} is a good option.`,
        (b, s) => `Happy to recommend ${b} for ${s}.`,
        (b, s) => `I will be getting my ${s} from ${b} again.`,
      ],
      desc: productDesc,
    },

    product: {
      open: [
        (b, s) => `I got ${s} from ${b} recently.`,
        (b, s) => `Bought ${s} from ${b} and I am happy with it.`,
        (b, s) => `${b} was suggested to me when I was looking for ${s}.`,
        (b, s) => `I have been getting my ${s} from ${b} for some time.`,
        (b, s) => `Needed ${s} and ${b} sorted it out quickly.`,
        (b, s) => `Tried ${b} for ${s} for the first time this month.`,
        (b, s) => `My experience buying ${s} from ${b} was good.`,
      ],
      main: [
        (s) => `The ${s} was in good condition and exactly what I needed.`,
        (s) => `The price of the ${s} was fair.`,
        (s) => `They helped me pick the right ${s} for my requirement.`,
        (s) => `The ${s} has been working well for me so far.`,
        (s) => `They had the ${s} ready when they said they would.`,
      ],
      detail: [
        `Billing was simple and quick.`,
        `They packed everything properly.`,
        `They answered all my questions before I paid.`,
        `Delivery was on time.`,
      ],
      rec: [
        (b, s) => `For ${s}, I would recommend ${b}.`,
        (b, s) => `If you need ${s}, check with ${b}.`,
        (b, s) => `I will go back to ${b} for ${s}.`,
        (b, s) => `Good place to get ${s}. ${b} is reliable.`,
      ],
      desc: productDesc,
    },

    service: {
      open: [
        (b, s) => `I hired ${b} for ${s} and I am glad I did.`,
        (b, s) => `Got ${s} done by ${b} recently.`,
        (b, s) => `${b} took care of our ${s} last month.`,
        (b, s) => `A friend gave me the number of ${b} when I needed ${s}.`,
        (b, s) => `I had been putting off ${s} for a while until I called ${b}.`,
        (b, s) => `We needed ${s} on a tight schedule, and ${b} managed it.`,
        (b, s) => `Called ${b} for ${s} and they got back to me the same day.`,
        (b, s) => `This is my second time using ${b} for ${s}.`,
        (b, s) => `Our requirement for ${s} was a bit complicated, but ${b} handled it calmly.`,
        (b, s) => `I compared a few quotes for ${s} and went with ${b}.`,
      ],
      main: [
        (s) => `The ${s} was done neatly and on time.`,
        (s) => `They explained what the ${s} would involve before starting, so there were no surprises.`,
        (s) => `Whoever handled our ${s} clearly knew the work well.`,
        (s) => `The result of the ${s} is good, and I have had no issues since.`,
        (s) => `They finished the ${s} in the time they said they would.`,
        (s) => `The cost of the ${s} was exactly what they quoted. Nothing extra at the end.`,
      ],
      detail: [
        `They kept me updated at each step.`,
        `Small changes I asked for were done without any argument.`,
        `They followed up later to check everything was fine.`,
        `Replies on WhatsApp were quick.`,
        `They were polite and patient with all my questions.`,
        `They came at the time they said they would.`,
      ],
      rec: [
        (b, s) => `If you need ${s}, give ${b} a call.`,
        (b, s) => `I would recommend ${b} for ${s}.`,
        (b, s) => `Will use ${b} again for ${s}.`,
        (b, s) => `For ${s}, ${b} is a safe choice.`,
        (b, s) => `I have already passed on the number of ${b} to two friends who needed ${s}.`,
      ],
      desc: serviceDesc,
    },

    freelancer: {
      open: [
        (b, s) => `I hired ${b} for ${s} and it worked out really well.`,
        (b, s) => `Found ${b} through a reference when I needed someone for ${s}.`,
        (b, s) => `Worked with ${b} on ${s} recently.`,
        (b, s) => `I wanted one person to handle ${s} from start to end, and ${b} did exactly that.`,
        (b, s) => `This is the second time I have given ${b} work on ${s}.`,
        (b, s) => `I was a little unsure about hiring a freelancer for ${s}, but ${b} changed my mind.`,
        (b, s) => `${b} took up our ${s} at short notice.`,
        (b, s) => `We needed help with ${s} without hiring a full agency, so we went with ${b}.`,
        (b, s) => `Got in touch with ${b} for ${s} after seeing their earlier work.`,
      ],
      main: [
        (s) => `They understood the ${s} brief quickly and asked the right questions.`,
        (s) => `The ${s} was delivered before the deadline.`,
        (s) => `Since I was talking directly to the person doing the ${s}, communication was easy.`,
        (s) => `The quality of the ${s} was as good as bigger firms, at a much better price.`,
        (s) => `They shared progress on the ${s} regularly and took feedback well.`,
        (s) => `The ${s} came out just the way I had imagined it.`,
      ],
      detail: [
        `Revisions were done quickly and without any fuss.`,
        `They were available on WhatsApp whenever I had a doubt.`,
        `Payment terms were simple and fair.`,
        `They kept everything I shared confidential.`,
        `They stuck to the timeline we agreed on.`,
        `They even gave a few useful suggestions I had not thought of.`,
      ],
      rec: [
        (b, s) => `If you need someone reliable for ${s}, I recommend ${b}.`,
        (b, s) => `Will be working with ${b} again for ${s}.`,
        (b, s) => `For ${s}, ${b} is a great person to hire.`,
        (b, s) => `Anyone looking for a freelancer for ${s} should get in touch with ${b}.`,
      ],
      desc: serviceDesc,
      mid: [
        `Very professional and easy to work with.`,
        `Honest about timelines right from the start.`,
        `Patient with all my questions, even the silly ones.`,
        `Quick to reply whenever I messaged.`,
        `Clearly knows the work well.`,
        `Down to earth and genuine.`,
        `Took the time to understand exactly what I needed.`,
        `Treated my small project as seriously as a big one.`,
      ],
      closers: [`Thank you!`, `Keep it up.`, `Five stars from me.`, `Good work.`, `Thanks again.`, `Wishing you more success.`],
    },

    agency: {
      open: [
        (b, s) => `We worked with ${b} on ${s} for our business.`,
        (b, s) => `${b} handled our ${s} from planning to completion.`,
        (b, s) => `We brought in ${b} for ${s} after a recommendation.`,
        (b, s) => `I consulted ${b} for ${s} and it was money well spent.`,
        (b, s) => `Our team has been working with ${b} on ${s} for a few months now.`,
        (b, s) => `We were struggling with ${s} until we started working with ${b}.`,
      ],
      main: [
        (s) => `They understood what we wanted from the ${s} quickly and laid out a clear plan.`,
        (s) => `Regular updates on the ${s} meant we never had to chase them.`,
        (s) => `Their advice on the ${s} was practical, not just theory.`,
        (s) => `The ${s} they handled for us has shown good results.`,
        (s) => `They coordinated everything for the ${s}, so we could focus on running our business.`,
      ],
      detail: [
        `Meetings started on time and they came prepared.`,
        `They were honest about what would and would not work.`,
        `Reports were simple to understand.`,
        `Anyone in their team could answer our questions.`,
        `They stuck to the budget we agreed.`,
      ],
      rec: [
        (b, s) => `For ${s}, I recommend talking to ${b}.`,
        (b, s) => `Businesses looking for help with ${s} should consider ${b}.`,
        (b, s) => `We will continue working with ${b} on ${s}.`,
        (b, s) => `If ${s} is on your list, ${b} is a good team to have.`,
      ],
      desc: serviceDesc,
    },
  };
}

function generateReviewSuggestions(
  profile: Profile,
  count: number = 4,
  category?: string
): string[] {
  const fullName = profile.business_name || profile.owner_name || "this business";
  const shortName = shortBizName(fullName);
  const owner = profile.owner_name && profile.business_name ? profile.owner_name.split(" ")[0] : null;
  const place = placeName(profile.coverage_area);
  const years = profile.years_in_business;
  const clients = profile.clients_served;
  const businessType = profile.business_type ?? null;
  const usedOnThisPhone = typeof window !== "undefined" ? readUsedOpeners(profile.id) : new Set<string>();

  const services = ((profile.services as ReviewItem[]) ?? []).map((s) => ({ ...s, kind: "service" as const }));
  const products = ((profile.products as ReviewItem[]) ?? []).map((p) => ({ ...p, kind: "product" as const }));
  let items: ReviewItem[] = [...services, ...products].filter((it) => it?.name?.trim());
  if (category) items = items.filter((it) => it.category?.trim() === category);
  if (items.length === 0) {
    const productish = ["retailer", "manufacturer", "wholesaler", "distributor"].includes(businessType ?? "");
    items = [{ name: category || (productish ? "their products" : "their service"), kind: productish ? "product" : "service" }];
  }

  const packs = rolePacks(owner);

  // About the people. Shared by every role.
  const mid: string[] = [
    `The people there are polite and helpful.`,
    `They answered all my questions patiently.`,
    `Very genuine people to deal with.`,
    `No pressure at all. They let me decide in my own time.`,
    `They were honest about what would suit me.`,
    `They reply quickly on phone and WhatsApp.`,
    owner ? `${owner} personally looked after me.` : `The owner personally looked after me.`,
    `Friendly staff, and they know their work.`,
    `They are straightforward about pricing.`,
    `You can tell they care about keeping customers happy.`,
    `Everything was done in a simple way, with no fuss.`,
    `They kept their word on everything they told me.`,
    `They treat you with respect even if you are buying something small.`,
    `It felt like dealing with people who actually care about their name.`,
  ];
  const facts: string[] = [
    ...(years ? [`They have been at it for ${years}+ years and it shows.`, `${years} years in business is not a small thing, and you can see why they have lasted.`] : []),
    ...(clients ? [`No surprise they have ${clients}+ happy customers.`] : []),
    ...(place ? [`Good to have a business like this in ${place}.`] : []),
  ];
  const leadIns = ["Good experience.", "Very happy.", "Five stars.", "Satisfied customer.", "Genuine business.", "Recommended."];
  const closers = [
    `Thanks to the whole team.`,
    `Keep it up.`,
    `Five stars from me.`,
    `Good work.`,
    `Thanks again.`,
    `Wishing them more success.`,
    `Happy customer here.`,
  ];

  const usedOpen = new Map<ReviewRole, Set<number>>();
  const usedMain = new Map<ReviewRole, Set<number>>();
  const usedRec = new Map<ReviewRole, Set<number>>();
  const setFor = (m: Map<ReviewRole, Set<number>>, r: ReviewRole) => {
    if (!m.has(r)) m.set(r, new Set());
    return m.get(r)!;
  };
  const usedMid = new Set<number>();
  const usedDetail = new Set<string>();
  const usedClose = new Set<number>();
  const order = [...items].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => {
    const item = order[i % order.length];
    const s = item.name.trim();
    const d = descSentence(item.description);
    const role = reviewRole(businessType, item.kind);
    const pack = packs[role];

    // Opening sentence + people sentence = what Google shows first. Skip any
    // combination this phone has already copied for this business.
    const oi = pickFreshIdx(pack.open.length, setFor(usedOpen, role), (x) =>
      Array.from(usedOnThisPhone).some((sig) => sig.startsWith(`${role}:o${x}m`))
    );
    const midPool = pack.mid ?? mid;
    const closePool = pack.closers ?? closers;
    const mi = pickFreshIdx(midPool.length, usedMid, (x) => usedOnThisPhone.has(`${role}:o${oi}m${x}`));
    const b1 = shortName !== fullName && Math.random() < 0.4 ? shortName : fullName;
    const b3 = shortName !== fullName && Math.random() < 0.5 ? shortName : fullName;

    // Paragraph 1: the business and the people
    const p1 = [pack.open[oi](b1, s), midPool[mi]];
    if (facts.length && Math.random() < 0.6) p1.push(rand(facts));
    else p1.push(midPool[pickFreshIdx(midPool.length, usedMid)]);
    if (Math.random() < 0.5) [p1[1], p1[2]] = [p1[2], p1[1]];
    const lead = Math.random() < 0.25 ? `${rand(leadIns)} ` : "";

    // Paragraph 2: the product / service itself, written for this role
    const p2 = [pickFresh(pack.main, setFor(usedMain, role))(s)];
    if (d) p2.push(pack.desc(s, d));
    const extras = pack.detail.filter((x) => !usedDetail.has(x));
    const nDetail = d ? (Math.random() < 0.5 ? 1 : 2) : 2;
    for (let k = 0; k < nDetail && extras.length; k++) {
      const x = extras.splice(Math.floor(Math.random() * extras.length), 1)[0];
      usedDetail.add(x);
      p2.push(x);
    }

    // Paragraph 3: recommendation
    const p3 = [pickFresh(pack.rec, setFor(usedRec, role))(b3, s)];
    p3.push(closePool[pickFreshIdx(closePool.length, usedClose)]);

    const text = [lead + p1.join(" "), p2.join(" "), p3.join(" ")].map(tidy).join("\n\n");
    reviewSignatures.set(text, `${role}:o${oi}m${mi}`);
    return text;
  });
}

export default function PublicProfileView({
  profile,
  card,
  reviews,
  employees,
  isEmployeeView = false,
  hideHero = false,
}: {
  profile: Profile;
  card: Card | null;
  reviews: Review[];
  employees: Employee[];
  /** When true, hides the "Create your own profile" CTA */
  isEmployeeView?: boolean;
  /** When true, hides the hero/header section (used when embedded inside employee view) */
  hideHero?: boolean;
}) {
  const ownerTheme = getTheme(profile.theme);
  const directionsHref = directionsUrl(profile);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeMode(isDark ? "dark" : "light");
  }, []);

  const themeVars = useMemo(() => {
    const vars = ownerTheme.colors[themeMode];
    return vars as Record<string, string>;
  }, [ownerTheme, themeMode]);

  const [reviewSuggestionsMap, setReviewSuggestionsMap] = useState<Record<string, string[]>>({});
  const [activeReviewTab, setActiveReviewTab] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [qrLightbox, setQrLightbox] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  // The review the visitor just copied — drives the "Review copied" sheet.
  const [copiedReview, setCopiedReview] = useState<string | null>(null);
  const [servicePopup, setServicePopup] = useState<{
    name: string;
    description?: string;
    price?: string;
    emoji?: string;
    category?: string;
  } | null>(null);

  const [profileUrl, setProfileUrl] = useState(() => {
    const base = "https://nammainfo.in";
    return profile.username
      ? `${base}/${profile.username}`
      : card
        ? `${base}/${card.public_slug}`
        : base;
  });

  useEffect(() => {
    const origin = window.location.origin;
    const url = profile.username
      ? `${origin}/${profile.username}`
      : card
        ? `${origin}/${card.public_slug}`
        : window.location.href;
    setProfileUrl(url);
  }, [profile.username, card]);

  /* Build service categories for review tabs */
  const reviewCategories = useMemo(() => {
    const svcs = (profile.services as { name: string; category?: string }[]) ?? [];
    return Array.from(new Set(svcs.map(s => s.category?.trim()).filter(Boolean))) as string[];
  }, [profile.services]);

  useEffect(() => {
    const initial: Record<string, string[]> = { All: generateReviewSuggestions(profile) };
    reviewCategories.forEach((cat) => {
      initial[cat] = generateReviewSuggestions(profile, 4, cat);
    });
    setReviewSuggestionsMap(initial);
  }, [profile, reviewCategories]);

  const reviewSuggestions = reviewSuggestionsMap[activeReviewTab] ?? [];

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  function refreshSuggestions(tab?: string) {
    const key = tab ?? activeReviewTab;
    const cat = key === "All" ? undefined : key;
    setReviewSuggestionsMap((prev) => ({
      ...prev,
      [key]: generateReviewSuggestions(profile, 4, cat),
    }));
  }

  async function saveContact() {
    saveContactFromUrl(
      `/api/vcard/${profile.id}`,
      `${(profile.owner_name ?? profile.business_name ?? "contact").replace(/[^a-z0-9 ]/gi, "").trim() || "contact"}.vcf`
    );
  }

  async function shareProfile() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile.business_name ?? "Namma Info",
          text: `Check out ${profile.owner_name ?? "this business"} on Namma Info`,
          url: profileUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(profileUrl);
    }
  }

  /* Cast arrays once */
  const socialLinks = (profile.social_links as { platform: string; url: string }[]) ?? [];
  const servicesList = (profile.services as { name: string; description?: string; price?: string; emoji?: string; category?: string }[]) ?? [];
  const productsList = (profile.products as { name: string; image_url?: string; price?: string; emoji?: string; category?: string }[]) ?? [];
  const galleryList = (profile.gallery as { url: string; category?: string; caption?: string }[]) ?? [];
  const bankAccounts = (profile.bank_accounts as { bank_name?: string; account_holder?: string; account_number?: string; ifsc?: string; upi_id?: string; qr_url?: string }[]) ?? [];

  /* Dynamic label for services/products section */
  const hasServices = servicesList.length > 0;
  const hasProducts = productsList.length > 0;
  const servicesLabel = hasServices && hasProducts
    ? "Services & Products"
    : hasServices
      ? "Services"
      : "Products";

  const whatsAppNumber = getWhatsAppNumber(socialLinks);

  return (
    <main
      className={`mx-auto max-w-lg bg-[var(--background)] ${hideHero ? "" : "min-h-dvh"}`}
      style={themeVars as React.CSSProperties}
    >
      {!isEmployeeView && <TapTracker profileId={profile.id} cardId={card?.id} />}
      {!isEmployeeView && (
        <AutoSaveCard
          card={{
            id: profile.id,
            owner_name: profile.owner_name,
            business_name: profile.business_name,
            job_title: profile.job_title,
            logo_url: profile.logo_url,
            avatar_url: profile.avatar_url,
            username: profile.username,
            slug: card?.public_slug ?? profile.slug ?? null,
          }}
        />
      )}
      {!hideHero && (
        <>
          {/* Hero — Cover + Avatar */}
          <div className="relative">
            <div className="relative h-44 w-full overflow-hidden bg-[var(--foreground)]">
              {profile.cover_url ? (
                <Image
                  src={profile.cover_url}
                  alt=""
                  fill
                  sizes="(max-width: 512px) 100vw, 512px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="h-full w-full bg-[var(--foreground)]" />
              )}
            </div>
            <div className="absolute -bottom-12 left-5">
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-4 border-[var(--card)] bg-[var(--accent)] shadow-card">
                {profile.logo_url ? (
                  <Image
                    src={profile.logo_url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--foreground)] font-headline text-2xl font-bold text-[var(--background)]">
                    {initials(profile.owner_name || profile.business_name)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name + info */}
          <div className="mt-14 px-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-headline text-xl font-bold text-[var(--foreground)]">
                  {profile.owner_name || "Namma Info Member"}
                </h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {[profile.job_title, profile.business_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            {/* Stats */}
            {(profile.years_in_business ||
              profile.clients_served ||
              reviews.length > 0) && (
              <div className="mt-4 flex gap-3">
                {profile.years_in_business && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                    <Clock size={12} className="text-[var(--muted-foreground)]" />
                    <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                      {profile.years_in_business}+ yrs
                    </span>
                  </div>
                )}
                {profile.clients_served && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                    <Users size={12} className="text-[var(--muted-foreground)]" />
                    <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                      {profile.clients_served}+ clients
                    </span>
                  </div>
                )}
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5">
                    <Star size={12} className="fill-[var(--foreground)] text-[var(--foreground)]" />
                    <span className="font-mono text-xs font-medium text-[var(--foreground)]">
                      {avgRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="mt-5 flex gap-2 px-5">
            <button
              onClick={saveContact}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] py-3.5 text-xs font-semibold text-[var(--background)] shadow-card-lg transition hover:opacity-90"
            >
              <UserPlus size={15} />
              Add to Contacts
            </button>
            {profile.website && (
              <a
                href={ensureProtocol(profile.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-3.5 text-xs font-semibold text-[var(--foreground)] shadow-card transition hover:shadow-card-hover"
              >
                <Globe size={15} />
                Visit Website
              </a>
            )}
          </div>

          {/* Quick contact */}
          <div className="mt-4 grid grid-cols-3 gap-2 px-5">
            {profile.phone && (
              <QuickAction
                href={`tel:${profile.phone}`}
                icon={<Phone size={18} />}
                label="Call"
              />
            )}
            {profile.email && (
              <QuickAction
                href={`mailto:${profile.email}`}
                icon={<Mail size={18} />}
                label="Email"
              />
            )}
            <button
              onClick={shareProfile}
              className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
            >
              <Share2 size={18} className="text-[var(--foreground)]" />
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">Share</span>
            </button>
          </div>

          {/* Get Directions — the owner's Maps link, else their address.
              (Never the Google review link.) */}
          {directionsHref && (
            <div className="mt-3 px-5">
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] py-3 text-xs font-semibold text-[var(--foreground)] transition hover:shadow-card"
              >
                <Navigation size={15} />
                Get Directions
              </a>
            </div>
          )}
        </>
      )}

      {/* ===== ALL SECTIONS — COLLAPSIBLE ACCORDIONS ===== */}
      <div id="details" className={`space-y-4 px-5 pb-8 ${hideHero ? "pt-2" : "pt-6"}`}>

        {/* ── About Us ── */}
        {(profile.bio || profile.address || profile.coverage_area) && (
          <CollapsibleSection title="About Us" icon={<Briefcase size={15} />}>
            {profile.bio && (
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                {profile.bio}
              </p>
            )}
            {profile.address && (
              <a
                href={directionsHref ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`${profile.bio ? "mt-3" : ""} flex items-start gap-2 text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline`}
              >
                <MapPin size={13} className="mt-0.5 shrink-0" />
                {profile.address}
              </a>
            )}
            {profile.coverage_area && (
              <div className="mt-1.5 flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                <Globe size={13} className="mt-0.5 shrink-0" />
                Serves: {profile.coverage_area}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* ── Services & Products (dynamic label) ── */}
        {(hasServices || hasProducts) && (
          <ServicesTabs
            servicesList={servicesList}
            productsList={productsList}
            servicesLabel={servicesLabel}
            hasServices={hasServices}
            hasProducts={hasProducts}
            onServiceTap={setServicePopup}
          />
        )}

        {/* ── Gallery ── */}
        {galleryList.length > 0 && (
          <CollapsibleSection
            title="Gallery"
            icon={<ImageIcon size={15} />}
            badge={galleryList.length}
          >
            <PublicGallery gallery={galleryList} allGallery={galleryList} onImageTap={(idx) => setLightboxIndex(idx)} />
          </CollapsibleSection>
        )}

        {/* ── Connect With Us ── */}
        {socialLinks.length > 0 && (
          <CollapsibleSection title="Connect With Us" icon={<MessageCircle size={15} />}>
            <div className="grid grid-cols-2 gap-2">
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={socialHref(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2.5 transition hover:bg-[var(--accent)]"
                >
                  <SocialIcon platform={link.platform} />
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    {link.platform}
                  </span>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Write a Google Review ── */}
        <CollapsibleSection
          title="Write a Google Review"
          icon={<Star size={15} />}
          badge={reviews.length > 0 ? reviews.length : undefined}
          headerExtra={
            profile.google_place_id ? (
              <a
                href={googleReviewUrl(profile.google_place_id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
              >
                Google Reviews
                <ExternalLink size={10} />
              </a>
            ) : undefined
          }
        >
            {/* Existing reviews summary */}
            {reviews.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="font-headline text-3xl font-bold text-[var(--foreground)]">
                  {avgRating.toFixed(1)}
                </span>
                <div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={
                          s <= Math.round(avgRating)
                            ? "fill-[var(--foreground)] text-[var(--foreground)]"
                            : "text-[var(--muted-foreground)]"
                        }
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    {reviews.length} review{reviews.length !== 1 && "s"}
                  </p>
                </div>
              </div>
            )}

            {/* Recent reviews inline */}
            {reviews.length > 0 && (
              <div className="mb-4 space-y-2">
                {reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="rounded-xl bg-[var(--accent)] px-3 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--foreground)]">
                        {review.reviewer_name}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={10}
                            className={
                              s <= review.rating
                                ? "fill-amber-500 text-amber-500"
                                : "text-[var(--muted-foreground)]"
                            }
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Category tabs for review suggestions */}
            {reviewCategories.length > 0 && (
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {["All", ...reviewCategories].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveReviewTab(tab)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
                      activeReviewTab === tab
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* AI-generated review suggestions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {profile.google_place_id
                    ? "Tap to review on Google"
                    : "Share your experience"}
                </p>
                <button
                  onClick={() => refreshSuggestions()}
                  className="flex items-center gap-1 rounded-lg p-1.5 text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title="Get new suggestions"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="space-y-2">
                {reviewSuggestions.map((text, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      // Copy first, then show a clear "Review copied" sheet.
                      // Google opens from the sheet's button, so people see
                      // the message (and how to paste) before they leave.
                      copyText(text);
                      rememberCopiedReview(profile.id, text);
                      setCopiedReview(text);
                    }}
                    className="w-full rounded-xl border border-[var(--border)] p-3 text-left transition hover:border-[var(--foreground)]/20 hover:shadow-card"
                  >
                    <div className="mb-1.5 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={10}
                          className="fill-[var(--foreground)] text-[var(--foreground)]"
                        />
                      ))}
                    </div>
                    <p className="whitespace-pre-line text-xs leading-relaxed text-[var(--muted-foreground)]">
                      {text}
                    </p>
                    <p className="mt-2 flex items-center gap-1 font-mono text-[9px] font-medium text-[var(--muted-foreground)]">
                      <Copy size={8} />
                      {profile.google_place_id
                        ? "Tap to copy & open Google Reviews"
                        : "Tap to copy review text"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
        </CollapsibleSection>

        {/* ── Banking & Payment Info ── */}
        {bankAccounts.length > 0 && (
          <CollapsibleSection
            title="Banking & Payment Info"
            icon={<Banknote size={15} />}
            badge={bankAccounts.length}
          >
            <div className="space-y-3">
              {bankAccounts.map((acc, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] p-3">
                  {acc.bank_name && (
                    <div className="mb-2 flex items-center gap-2">
                      <CreditCard size={14} className="text-[var(--muted-foreground)]" />
                      <span className="text-sm font-semibold text-[var(--foreground)]">{acc.bank_name}</span>
                    </div>
                  )}
                  {acc.account_holder && (
                    <p className="mb-1 text-xs text-[var(--muted-foreground)]">
                      Account Holder: <span className="font-medium text-[var(--foreground)]">{acc.account_holder}</span>
                    </p>
                  )}
                  {acc.account_number && (
                    <div className="flex items-center justify-between py-1">
                      <span className="font-mono text-xs text-[var(--muted-foreground)]">A/C: {acc.account_number}</span>
                      <button onClick={() => navigator.clipboard.writeText(acc.account_number!)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><Copy size={12} /></button>
                    </div>
                  )}
                  {acc.ifsc && <p className="font-mono text-xs text-[var(--muted-foreground)]">IFSC: {acc.ifsc}</p>}
                  {acc.upi_id && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2">
                      <Wallet size={14} className="text-[var(--muted-foreground)]" />
                      <span className="font-mono text-xs font-medium text-[var(--foreground)]">{acc.upi_id}</span>
                      <button onClick={() => navigator.clipboard.writeText(acc.upi_id!)} className="ml-auto p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><Copy size={12} /></button>
                    </div>
                  )}
                  {acc.qr_url && (
                    <button
                      onClick={() => setQrLightbox(acc.qr_url!)}
                      className="mt-2 block"
                    >
                      <div className="relative h-32 w-32">
                        <Image src={acc.qr_url} alt="Payment QR" fill sizes="128px" className="rounded-lg object-contain transition hover:opacity-80" loading="lazy" />
                      </div>
                      <p className="mt-1 text-[9px] text-[var(--muted-foreground)]">Tap to enlarge</p>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Downloads & Actions ── */}
        <CollapsibleSection title="Downloads & Actions" icon={<Download size={15} />}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={saveContact}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 text-left transition hover:bg-[var(--accent)]"
            >
              <BookUser size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">Save Contact</span>
            </button>
            <button
              onClick={shareProfile}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 text-left transition hover:bg-[var(--accent)]"
            >
              <Share2 size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">Share Profile</span>
            </button>
            {profile.brochure_url && (
              <a
                href={profile.brochure_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-3 transition hover:bg-[var(--accent)]"
              >
                <FileText size={16} className="text-[var(--muted-foreground)]" />
                <span className="text-xs font-medium text-[var(--foreground)]">Brochure</span>
              </a>
            )}
          </div>
        </CollapsibleSection>

        {/* GST & Address footer */}
        {(profile.gst_number || profile.address) && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            {profile.gst_number && (
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-[var(--muted-foreground)]" />
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  GST: {profile.gst_number}
                </span>
              </div>
            )}
            {profile.address && (
              <div className="mt-1 flex items-start gap-2">
                <MapPin size={12} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {profile.address}
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA — hidden on employee views */}
        {!isEmployeeView && (
          <Link
            href="/signup"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] py-4 text-sm font-medium text-[var(--muted-foreground)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            <UserPlus size={16} />
            Create your own Namma Info profile
          </Link>
        )}

        <p className="pt-4 text-center font-mono text-[11px] text-[var(--muted-foreground)]">
          Powered by Namma Info
        </p>
      </div>

      {/* ===== LIGHTBOX — Gallery images with swipe ===== */}
      {lightboxIndex !== null && galleryList[lightboxIndex] && (
        <GalleryLightbox
          images={galleryList}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}

      {/* ===== LIGHTBOX — QR Code ===== */}
      {qrLightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setQrLightbox(null)}
        >
          <button
            onClick={() => setQrLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
          <div
            className="rounded-2xl bg-[#fff] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={qrLightbox}
              alt="Payment QR Code"
              className="h-72 w-72 object-contain sm:h-80 sm:w-80"
            />
            <p className="mt-2 text-center text-xs text-gray-500">Scan to pay</p>
          </div>
        </div>
      )}

      {/* ===== SERVICE DETAIL POPUP ===== */}
      {servicePopup && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setServicePopup(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-[var(--card)] p-5 pb-8 shadow-xl sm:rounded-3xl sm:pb-5"
            style={themeVars as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-2xl">
                  {servicePopup.emoji || "⚡"}
                </div>
                <div>
                  <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
                    {servicePopup.name}
                  </h3>
                  {servicePopup.category && (
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                      {servicePopup.category}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setServicePopup(null)}
                className="rounded-full p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              >
                <X size={18} />
              </button>
            </div>

            {servicePopup.description && (
              <p className="mb-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {servicePopup.description}
              </p>
            )}

            {servicePopup.price && (
              <div className="mb-4 inline-block rounded-lg bg-[var(--accent)] px-3 py-1.5">
                <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
                  {servicePopup.price}
                </span>
              </div>
            )}

            {whatsAppNumber ? (
              <a
                href={`https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(
                  `Hi, I'm interested in your service: ${servicePopup.name}. Could you please share more details?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] py-3.5 text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
              >
                <MessageCircle size={18} />
                Enquire on WhatsApp
              </a>
            ) : profile.phone ? (
              <a
                href={`tel:${profile.phone}`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] py-3.5 text-sm font-semibold text-[var(--background)] transition hover:opacity-90"
              >
                <Phone size={18} />
                Call to Enquire
              </a>
            ) : null}
          </div>
        </div>
      )}
      {/* ===== COPIED TOAST ===== */}
      {copiedReview !== null && (
        <ReviewCopiedSheet
          text={copiedReview}
          googleUrl={profile.google_place_id ? googleReviewUrl(profile.google_place_id) : null}
          onCopyAgain={() => copyText(copiedReview)}
          onClose={() => setCopiedReview(null)}
        />
      )}

      {copiedToast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 animate-[fadeInUp_0.2s_ease-out] rounded-full bg-[var(--foreground)] px-4 py-2 text-xs font-medium text-[var(--background)] shadow-lg">
          ✓ Review text copied — paste it on Google!
        </div>
      )}
    </main>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

/** Clipboard copy with a fallback for older in-app browsers. */
function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}

function legacyCopy(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  } catch {}
}

/**
 * Shown right after a review suggestion is tapped: makes it obvious the
 * text is already copied, and shows how to paste it on Google — people
 * were giving 5 stars and leaving without pasting.
 */
function ReviewCopiedSheet({
  text,
  googleUrl,
  onCopyAgain,
  onClose,
}: {
  text: string;
  googleUrl: string | null;
  onCopyAgain: () => void;
  onClose: () => void;
}) {
  const [copiedAgain, setCopiedAgain] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const steps = googleUrl
    ? [
        "Tap the 5 stars on Google",
        "Long-press the review box and tap Paste",
        "Tap Post — done!",
      ]
    : ["Open the review page you want to post on", "Long-press the text box and tap Paste", "Post your review"];

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-copied-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-slide-up rounded-t-[28px] bg-[var(--background)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-[28px] sm:pb-6"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />

        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={22} strokeWidth={3} />
          </span>
          <div>
            <h2 id="review-copied-title" className="font-headline text-lg font-semibold tracking-tight text-[var(--foreground)]">
              Review copied!
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              It&apos;s on your clipboard — just paste it{googleUrl ? " on Google" : ""}.
            </p>
          </div>
        </div>

        {/* What was copied */}
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="mb-1 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={10} className="fill-amber-500 text-amber-500" />
            ))}
          </div>
          <p className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-[var(--muted-foreground)]">
            {text}
          </p>
        </div>

        {/* How to paste */}
        <ol className="mt-4 space-y-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-[var(--foreground)]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] font-mono text-[11px] font-semibold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {googleUrl ? (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setTimeout(onClose, 300)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] py-4 text-sm font-semibold text-[var(--primary-foreground)] transition active:scale-[0.99]"
          >
            Open Google &amp; paste review
            <ExternalLink size={16} />
          </a>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-[var(--primary)] py-4 text-sm font-semibold text-[var(--primary-foreground)] transition active:scale-[0.99]"
          >
            Got it
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onCopyAgain();
            setCopiedAgain(true);
            setTimeout(() => setCopiedAgain(false), 1500);
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
        >
          {copiedAgain ? <Check size={14} /> : <Copy size={14} />}
          {copiedAgain ? "Copied again" : "Copy again"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* ================================================================== */

function ServicesTabs({
  servicesList,
  productsList,
  servicesLabel,
  hasServices,
  hasProducts,
  onServiceTap,
}: {
  servicesList: { name: string; description?: string; price?: string; emoji?: string; category?: string }[];
  productsList: { name: string; image_url?: string; price?: string; emoji?: string; category?: string }[];
  servicesLabel: string;
  hasServices: boolean;
  hasProducts: boolean;
  onServiceTap: (s: { name: string; description?: string; price?: string; emoji?: string; category?: string }) => void;
}) {
  /* Build category tabs from services */
  const categories = useMemo(() => {
    if (!hasServices) return [] as string[];
    const cats = Array.from(new Set(servicesList.map(s => s.category?.trim()).filter(Boolean))) as string[];
    return cats;
  }, [servicesList, hasServices]);

  const hasCategories = categories.length > 0;

  /* "All" tab + category tabs */
  const tabs = useMemo(() => {
    const t: string[] = [];
    if (hasCategories) {
      t.push("All", ...categories);
    }
    return t;
  }, [categories, hasCategories]);

  const [activeTab, setActiveTab] = useState("All");

  /* Filter services by active tab */
  const filteredServices = useMemo(() => {
    if (!hasServices) return [];
    if (!hasCategories || activeTab === "All") return servicesList;
    return servicesList.filter(s => (s.category?.trim() || "") === activeTab);
  }, [servicesList, activeTab, hasServices, hasCategories]);

  /* Build category tabs from products */
  const productCategories = useMemo(() => {
    if (!hasProducts) return [] as string[];
    const cats = Array.from(new Set(productsList.map(p => p.category?.trim()).filter(Boolean))) as string[];
    return cats;
  }, [productsList, hasProducts]);

  const hasProductCategories = productCategories.length > 0;

  const productTabs = useMemo(() => {
    const t: string[] = [];
    if (hasProductCategories) {
      t.push("All", ...productCategories);
    }
    return t;
  }, [productCategories, hasProductCategories]);

  const [activeProductTab, setActiveProductTab] = useState("All");

  /* Filter products by active tab */
  const filteredProducts = useMemo(() => {
    if (!hasProducts) return [];
    if (!hasProductCategories || activeProductTab === "All") return productsList;
    return productsList.filter(p => (p.category?.trim() || "") === activeProductTab);
  }, [productsList, activeProductTab, hasProducts, hasProductCategories]);

  const hasBoth = hasServices && hasProducts;

  /* Shared services content block (grid + optional category tabs) */
  const servicesContent = (
    <>
      {hasCategories && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
                activeTab === tab
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {filteredServices.map((s, i) => (
          <ServiceCard key={`${s.name}-${i}`} service={s} onTap={onServiceTap} />
        ))}
      </div>
    </>
  );

  /* Shared products content block (grid + optional category tabs) */
  const productsContent = (
    <>
      {hasProductCategories && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {productTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveProductTab(tab)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
                activeProductTab === tab
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {filteredProducts.map((p, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-[var(--border)]">
            {p.image_url ? (
              <div className="relative aspect-square w-full">
                <Image src={p.image_url} alt={p.name} fill sizes="(max-width: 512px) 50vw, 240px" className="object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-[var(--accent)] text-2xl">
                {p.emoji || "📦"}
              </div>
            )}
            <div className="p-2.5">
              <p className="text-xs font-semibold text-[var(--foreground)]">{p.name}</p>
              {p.price && (
                <p className="mt-0.5 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">{p.price}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <CollapsibleSection
      title={servicesLabel}
      icon={<Award size={15} />}
      badge={servicesList.length + productsList.length}
    >
      {hasBoth ? (
        /* Both exist → inner accordions for each */
        <div className="space-y-2">
          <InnerAccordion title="Services" badge={servicesList.length} defaultOpen>
            {servicesContent}
          </InnerAccordion>
          <InnerAccordion title="Products" badge={productsList.length}>
            {productsContent}
          </InnerAccordion>
        </div>
      ) : (
        /* Only one exists → show directly, no inner accordion */
        <>
          {hasServices && servicesContent}
          {hasProducts && productsContent}
        </>
      )}
    </CollapsibleSection>
  );
}

function ServiceCard({
  service,
  onTap,
}: {
  service: { name: string; description?: string; price?: string; emoji?: string; category?: string };
  onTap: (s: typeof service) => void;
}) {
  return (
    <button
      onClick={() => onTap(service)}
      className="rounded-xl border border-[var(--border)] p-3 text-left transition hover:shadow-card active:scale-[0.98]"
    >
      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-base">
        {service.emoji || "⚡"}
      </div>
      <p className="text-xs font-semibold text-[var(--foreground)]">{service.name}</p>
      {service.description && (
        <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--muted-foreground)]">{service.description}</p>
      )}
      {service.price && (
        <p className="mt-1 font-mono text-[10px] font-semibold text-[var(--muted-foreground)]">{service.price}</p>
      )}
    </button>
  );
}

/**
 * Inner accordion — used inside a CollapsibleSection for sub-grouping
 * (e.g. Services / Products within "Services & Products").
 */
function InnerAccordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-3"
      >
        <span className="font-headline text-xs font-semibold text-[var(--foreground)]">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[9px] font-medium text-[var(--muted-foreground)]">
              {badge}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-[var(--muted-foreground)] transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--border)] px-3.5 py-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible section — accordion toggle with smooth animation.
 */
function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  headerExtra,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2 font-headline text-sm font-semibold text-[var(--foreground)]">
          <span className="text-[var(--muted-foreground)]">{icon}</span>
          {title}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {badge !== undefined && badge > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-2 font-mono text-[10px] font-medium text-[var(--muted-foreground)]">
              {badge}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-[var(--muted-foreground)] transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--border)] px-4 py-3">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function PublicGallery({
  gallery,
  allGallery,
  onImageTap,
}: {
  gallery: { url: string; category?: string; caption?: string }[];
  allGallery: { url: string; category?: string; caption?: string }[];
  onImageTap: (globalIndex: number) => void;
}) {
  const [activeTab, setActiveTab] = useState("All");
  const categories = [
    "All",
    ...Array.from(new Set(gallery.map((g) => g.category).filter(Boolean))),
  ] as string[];
  const filtered =
    activeTab === "All"
      ? gallery
      : gallery.filter((g) => g.category === activeTab);

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10px] font-medium transition ${
                activeTab === cat
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {filtered.map((img, i) => {
          const globalIdx = allGallery.findIndex((g) => g.url === img.url);
          return (
            <button
              key={i}
              onClick={() => onImageTap(globalIdx >= 0 ? globalIdx : i)}
              className="overflow-hidden rounded-lg transition active:scale-95"
            >
              <div className="relative aspect-square w-full">
                <Image
                  src={img.url}
                  alt={img.caption ?? ""}
                  fill
                  sizes="(max-width: 512px) 33vw, 160px"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition hover:shadow-card"
    >
      <span className="text-[var(--foreground)]">{icon}</span>
      <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{label}</span>
    </a>
  );
}

function GalleryLightbox({
  images,
  currentIndex,
  onClose,
  onChange,
}: {
  images: { url: string; caption?: string }[];
  currentIndex: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);

  const goPrev = () => {
    if (currentIndex > 0) onChange(currentIndex - 1);
  };
  const goNext = () => {
    if (currentIndex < images.length - 1) onChange(currentIndex + 1);
  };

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  };
  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 60) {
      if (touchDelta > 0) goPrev();
      else goNext();
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  const img = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {/* Counter */}
      <div className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1.5 font-mono text-xs text-white backdrop-blur">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Prev arrow */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next arrow */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Image with touch handling */}
      <div
        className="flex h-full w-full flex-col items-center justify-center px-12 py-16"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={img.url}
          alt={img.caption ?? ""}
          className="max-h-full max-w-full rounded-lg object-contain transition-transform duration-200"
          style={{ transform: touchDelta !== 0 ? `translateX(${touchDelta}px)` : undefined }}
          draggable={false}
        />
        {img.caption && (
          <p className="mt-3 text-center text-sm text-white/70">{img.caption}</p>
        )}
      </div>
    </div>
  );
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const cls = "h-4 w-4 text-[var(--muted-foreground)]";
  if (p.includes("instagram")) return <Instagram className={cls} />;
  if (p.includes("youtube")) return <Youtube className={cls} />;
  if (p.includes("facebook")) return <Facebook className={cls} />;
  if (p.includes("linkedin")) return <Linkedin className={cls} />;
  if (p.includes("whatsapp")) return <MessageCircle className={cls} />;
  return <Globe className={cls} />;
}
