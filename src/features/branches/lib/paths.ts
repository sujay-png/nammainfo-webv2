/**
 * Public links. One place builds them so every screen agrees:
 *
 *   /abc                   main profile
 *   /abc/mangaluru         branch
 *   /abc/mangaluru/sujay   team member of that branch
 *   /abc/sujay             team member with no branch (also redirects
 *                          to the branch link when they have one)
 */
export const SITE_URL = "https://nammainfo.in";

export function profilePath(username: string) {
  return `/${username}`;
}

export function branchPath(username: string, branchSlug: string) {
  return `/${username}/${branchSlug}`;
}

export function employeePath(username: string, employeeSlug: string, branchSlug?: string | null) {
  return branchSlug ? `/${username}/${branchSlug}/${employeeSlug}` : `/${username}/${employeeSlug}`;
}

/** Full link for copying / sharing. `origin` defaults to the live site. */
export function absolute(path: string, origin: string = SITE_URL) {
  return `${origin.replace(/\/$/, "")}${path}`;
}

/** Same link without "https://", for showing on screen. */
export function displayLink(path: string) {
  return `nammainfo.in${path}`;
}
