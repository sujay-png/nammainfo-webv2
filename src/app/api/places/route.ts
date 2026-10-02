import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/places — resolve a Google Maps URL to a place_id.
 *
 * Accepts:
 *   { url: "https://maps.app.goo.gl/..." }             — short share link
 *   { url: "https://www.google.com/maps/place/..." }    — full link
 *   { url: "https://www.google.com/maps?cid=..." }      — CID link
 *   { url: "ChIJ..." }                                  — direct Place ID
 *
 * Returns: { place_id, google_maps_url?, name? }
 *
 * No API key required — resolves short links via redirect, then parses
 * the expanded URL (and page HTML as fallback) to extract Place ID.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractPlaceId(url: string): string | null {
  // 1. Direct ChIJ... place ID in the URL or as the value itself
  const chijMatch = url.match(/(ChIJ[A-Za-z0-9_-]+)/);
  if (chijMatch) return chijMatch[1];

  // 2. place_id= query parameter
  const placeIdParam = url.match(/[?&]place_id=([^&]+)/);
  if (placeIdParam) return decodeURIComponent(placeIdParam[1]);

  // 3. ftid= parameter (hex format 0x...:0x...)
  const ftidMatch = url.match(/[?&]ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (ftidMatch) return ftidMatch[1];

  // 4. Embedded in Google Maps data= parameter as !1sChIJ... or !1s0x...
  const dataPlaceMatch = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  if (dataPlaceMatch) return dataPlaceMatch[1];
  const dataHexMatch = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (dataHexMatch) return dataHexMatch[1];

  return null;
}

/** Scrape place ID from Google Maps page HTML as a fallback */
function extractPlaceIdFromHtml(html: string): string | null {
  // Google Maps pages embed Place IDs in various patterns in the page source:

  // Pattern 1: "place_id":"ChIJ..." or "placeId":"ChIJ..."
  const jsonMatch = html.match(/["'](?:place_id|placeId)["']\s*:\s*["'](ChIJ[A-Za-z0-9_-]+)["']/);
  if (jsonMatch) return jsonMatch[1];

  // Pattern 2: ChIJ in data attributes or script blocks — e.g. [null,"ChIJ..."]
  const arrayMatch = html.match(/\[(?:null,)*"(ChIJ[A-Za-z0-9_-]+)"/);
  if (arrayMatch) return arrayMatch[1];

  // Pattern 3: writereview?placeid=ChIJ... link in the page
  const reviewLink = html.match(/writereview\?placeid=(ChIJ[A-Za-z0-9_-]+)/);
  if (reviewLink) return reviewLink[1];

  // Pattern 4: /maps/place/ data with !1sChIJ in script tags
  const scriptMatch = html.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  if (scriptMatch) return scriptMatch[1];

  // Pattern 5: 0x hex format place references
  const hexMatch = html.match(/["'](0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)["']/);
  if (hexMatch) return hexMatch[1];

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl: string = (body.url ?? "").trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Direct Place ID pasted
    if (/^ChIJ[A-Za-z0-9_-]+$/.test(rawUrl)) {
      return NextResponse.json({ place_id: rawUrl });
    }
    if (/^0x[0-9a-fA-F]+:0x[0-9a-fA-F]+$/.test(rawUrl)) {
      return NextResponse.json({ place_id: rawUrl });
    }

    // Must look like a Google Maps URL
    if (
      !rawUrl.includes("google.com/maps") &&
      !rawUrl.includes("google.co") &&
      !rawUrl.includes("maps.app.goo.gl") &&
      !rawUrl.includes("goo.gl/maps") &&
      !rawUrl.includes("maps.google")
    ) {
      return NextResponse.json(
        { error: "Please paste a Google Maps link" },
        { status: 400 }
      );
    }

    // Try to extract from the raw URL first (full URLs sometimes already have it)
    let placeId = extractPlaceId(rawUrl);
    if (placeId) {
      return NextResponse.json({ place_id: placeId, google_maps_url: rawUrl });
    }

    // Resolve short URLs by following redirects
    let expandedUrl = rawUrl;
    let pageHtml = "";
    const isShortUrl =
      rawUrl.includes("maps.app.goo.gl") ||
      rawUrl.includes("goo.gl/maps") ||
      rawUrl.length < 60;

    try {
      const res = await fetch(rawUrl, {
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA },
      });
      expandedUrl = res.url;
      // Read the HTML for fallback Place ID extraction
      pageHtml = await res.text();
    } catch {
      if (isShortUrl) {
        return NextResponse.json(
          { error: "Could not resolve this link — try pasting the full Google Maps URL" },
          { status: 400 }
        );
      }
    }

    // Try to extract place ID from expanded URL
    placeId = extractPlaceId(expandedUrl);

    // Fallback: scrape Place ID from the page HTML
    if (!placeId && pageHtml) {
      placeId = extractPlaceIdFromHtml(pageHtml);
    }

    // If still no Place ID and we haven't fetched HTML yet (non-short URL), try now
    if (!placeId && !pageHtml && expandedUrl.includes("google")) {
      try {
        const res = await fetch(expandedUrl, {
          headers: { "User-Agent": BROWSER_UA },
        });
        pageHtml = await res.text();
        placeId = extractPlaceIdFromHtml(pageHtml);
      } catch {
        // ignore — we'll return what we have
      }
    }

    // Extract place name from /maps/place/NAME/
    const nameMatch = expandedUrl.match(/\/maps\/place\/([^/@?]+)/);
    const placeName = nameMatch
      ? decodeURIComponent(nameMatch[1]).replace(/\+/g, " ")
      : null;

    // Clean up the Maps URL (remove tracking params, keep it usable)
    const cleanUrl = expandedUrl.split("?")[0] || expandedUrl;
    const mapsUrl = cleanUrl.includes("google") ? cleanUrl : expandedUrl;

    if (placeId) {
      return NextResponse.json({
        place_id: placeId,
        google_maps_url: mapsUrl,
        ...(placeName ? { name: placeName } : {}),
      });
    }

    // Could not extract Place ID — return error instead of just the URL
    return NextResponse.json(
      {
        error:
          "Could not extract Place ID from this link. Try opening Google Maps, searching for your business, clicking 'Share' and pasting that link.",
      },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong — please try again" },
      { status: 500 }
    );
  }
}
