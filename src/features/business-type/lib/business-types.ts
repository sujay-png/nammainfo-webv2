/**
 * "What best describes your business?" — required, asked in onboarding and
 * the About section. Review suggestions are written differently for each
 * type, so a retail shop never gets "the way they made it" style reviews
 * and a freelancer's reviews talk about one person, not "the staff".
 */
export type BusinessType =
  | "retailer"
  | "wholesaler"
  | "distributor"
  | "manufacturer"
  | "service_provider"
  | "agency"
  | "freelancer";

export const BUSINESS_TYPES: { value: BusinessType; label: string; hint: string }[] = [
  { value: "retailer", label: "Retailer / Shop", hint: "We sell products to customers" },
  { value: "wholesaler", label: "Wholesaler", hint: "We sell in bulk to shops and businesses" },
  { value: "distributor", label: "Distributor / Dealer", hint: "We supply brands we are authorised for" },
  { value: "manufacturer", label: "Manufacturer / Maker", hint: "We make our own products" },
  { value: "service_provider", label: "Service provider", hint: "Our team does the work" },
  { value: "agency", label: "Agency / Consultant", hint: "We plan, advise or manage for clients" },
  { value: "freelancer", label: "Freelancer", hint: "I work independently for clients" },
];

export function businessTypeLabel(v?: string | null): string | null {
  return BUSINESS_TYPES.find((t) => t.value === v)?.label ?? null;
}
