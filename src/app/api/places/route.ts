import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/places — resolve a Google link to review + maps URLs.
 *
 * Accepts:
 *   { url: "https://g.page/r/XXXX/review" }             — Google Business review link (BEST)
 *   { url: "https://search.google.com/local/writereview?placeid=ChIJ..." } — direct review URL
 *   { url: "https://maps.app.goo.gl/..." }               — short share link
 *   { url: "https://www.google.com/maps/place/..." }      — full link
 *   { url: "https://www.google.com/maps?cid=..." }        — CID link
 *   { url: "ChIJ..." }                                    — direct Place ID
 *
 * Returns: { review_url?, place_id?, google_maps_url?, name? }
 *
 * review_url is the direct "write a review" link (best for users).
 * place_id is ONLY a ChIJ... format.
 * google_maps_url always points to the business page on Google Maps.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Extract a ChIJ Place ID — the ONLY format that works with writereview */
function extractChIJPlaceId(text: string): string | null {
  const chijMatch = text.match(/(ChIJ[A-Za-z0-9_-]+)/);
  if (chijMatch) return chijMatch[1];
  return null;
}

/** Check if a URL is a direct Google review link (g.page or writereview) */
function isGoogleReviewLink(url: string): boolean {
  return (
    /g\.page\/r\/[A-Za-z0-9_-]+\/review/i.test(url) ||
    url.includes("search.google.com/local/writereview")
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl: string = (body.url ?? "").trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Direct ChIJ Place ID pasted
    if (/^ChIJ[A-Za-z0-9_-]+$/.test(rawUrl)) {
      return NextResponse.json({
        place_id: rawUrl,
        review_url: `https://search.google.com/local/writereview?placeid=${rawUrl}`,
      });
    }

    // Google Business Profile review link → store directly (opens review dialog)
    if (isGoogleReviewLink(rawUrl)) {
      return NextResponse.json({ review_url: rawUrl });
    }

    // Must look like a Google-related URL
    if (
      !rawUrl.includes("google.com/maps") &&
      !rawUrl.includes("google.co") &&
      !rawUrl.includes("maps.app.goo.gl") &&
      !rawUrl.includes("goo.gl/maps") &&
      !rawUrl.includes("maps.google") &&
      !rawUrl.includes("g.page")
    ) {
      return NextResponse.json(
        { error: "Please paste a Google Maps link or Google Business review link" },
        { status: 400 }
      );
    }

    // Try ChIJ from raw URL first
    let placeId = extractChIJPlaceId(rawUrl);
    if (placeId) {
      return NextResponse.json({
        place_id: placeId,
        review_url: `https://search.google.com/local/writereview?placeid=${placeId}`,
        google_maps_url: rawUrl,
      });
    }

    // Resolve URL by following redirects
    let expandedUrl = rawUrl;
    let pageHtml = "";

    try {
      const res = await fetch(rawUrl, {
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA },
      });
      expandedUrl = res.url;
      pageHtml = await res.text();
    } catch {
      return NextResponse.json(
        { error: "Could not resolve this link — try pasting the full Google Maps URL" },
        { status: 400 }
      );
    }

    // Check if redirect landed on a review link
    if (isGoogleReviewLink(expandedUrl)) {
      return NextResponse.json({ review_url: expandedUrl });
    }

    // Try ChIJ from expanded URL
    placeId = extractChIJPlaceId(expandedUrl);

    // Try ChIJ from page HTML
    if (!placeId && pageHtml) {
      placeId = extractChIJPlaceId(pageHtml);
    }

    // Build review URL if we got ChIJ
    const reviewUrl = placeId
      ? `https://search.google.com/local/writereview?placeid=${placeId}`
      : null;

    // Extract place name from /maps/place/NAME/
    const nameMatch = expandedUrl.match(/\/maps\/place\/([^/@?]+)/);
    const placeName = nameMatch
      ? decodeURIComponent(nameMatch[1]).replace(/\+/g, " ")
      : null;

    // Keep full expanded URL
    const mapsUrl = expandedUrl.includes("google") ? expandedUrl : rawUrl;

    // Return what we have
    if (mapsUrl.includes("google")) {
      return NextResponse.json({
        ...(placeId ? { place_id: placeId } : {}),
        ...(reviewUrl ? { review_url: reviewUrl } : {}),
        google_maps_url: mapsUrl,
        ...(placeName ? { name: placeName } : {}),
      });
    }

    return NextResponse.json(
      { error: "Could not process this link — try a different Google Maps URL" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong — please try again" },
      { status: 500 }
    );
  }
}
