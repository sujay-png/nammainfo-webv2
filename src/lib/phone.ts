/**
 * Indian mobile numbers: accepts what people actually type
 * ("98765 43210", "+91-98765-43210", "098765 43210", "919876543210")
 * and stores one consistent form: "+91 98765 43210".
 */

/** The 10-digit number, or null if it isn't a valid Indian mobile number. */
export function indianMobileDigits(input: string | null | undefined): string | null {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** "+91 98765 43210", or null if invalid. */
export function formatIndianMobile(input: string | null | undefined): string | null {
  const d = indianMobileDigits(input);
  return d ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : null;
}

export const PHONE_ERROR = "Enter a valid 10-digit mobile number";
