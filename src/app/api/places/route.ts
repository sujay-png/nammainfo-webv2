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
 * Prioritizes ChIJ... Place IDs (needed for writereview URL).
 * Falls back to hex 0x...:0x... or the Google Maps URL.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Extract a ChIJ Place ID from a URL (preferred — works with writereview) */
function extractChIJPlaceId(url: string): string | null {
  const chijMatch = url.match(/(ChIJ[A-Za-z0-9_-]+)/);
  if (chijMatch) return chijMatch[1];

  const placeIdParam = url.match(/[?&]place_id=(ChIJ[^&]+)/);
  if (placeIdParam) return decodeURIComponent(placeIdParam[1]);

  const dataMatch = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  if (dataMatch) return dataMatch[1];

  return null;
}

/** Extract a hex format Place ID (0x...:0x...) — fallback, doesn't work with writereview */
function extractHexPlaceId(url: string): string | null {
  const ftidMatch = url.match(/[?&]ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (ftidMatch) return ftidMatch[1];

  const dataHexMatch = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (dataHexMatch) return dataHexMatch[1];

  // Standalone in URL
  const standaloneHex = url.match(/(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (standaloneHex) return standaloneHex[1];

  return null;
}

/** Scrape ChIJ Place ID from Google Maps page HTML */
function extractChIJFromHtml(html: string): string | null {
  // "place_id":"ChIJ..." or "placeId":"ChIJ..."
  const jsonMatch = html.match(/["'](?:place_id|placeId)["']\s*:\s*["'](ChIJ[A-Za-z0-9_-]+)["']/);
  if (jsonMatch) return jsonMatch[1];

  // [null,"ChIJ..."] in script data
  const arrayMatch = html.match(/\[(?:null,)*"(ChIJ[A-Za-z0-9_-]+)"/);
  if (arrayMatch) return arrayMatch[1];

  // writereview?placeid=ChIJ... link in the page
  const reviewLink = html.match(/writereview\?placeid=(ChIJ[A-Za-z0-9_-]+)/);
  if (reviewLink) return reviewLink[1];

  // !1sChIJ in script/data blocks
  const scriptMatch = html.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
  if (scriptMatch) return scriptMatch[1];

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

    // Try ChIJ from raw URL first
    let placeId = extractChIJPlaceId(rawUrl);
    if (placeId) {
      return NextResponse.json({ place_id: placeId, google_maps_url: rawUrl });
    }

    // Resolve URL by following redirects and read the page HTML
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

    // Try ChIJ from expanded URL
    placeId = extractChIJPlaceId(expandedUrl);

    // Try ChIJ from page HTML (most reliable source)
    if (!placeId && pageHtml) {
      placeId = extractChIJFromHtml(pageHtml);
    }

    // Fall back to hex format from URL (works for directions, not for writereview)
    if (!placeId) {
      placeId = extractHexPlaceId(expandedUrl);
    }

    // Extract place name from /maps/place/NAME/
    const nameMatch = expandedUrl.match(/\/maps\/place\/([^/@?]+)/);
    const placeName = nameMatch
      ? decodeURIComponent(nameMatch[1]).replace(/\+/g, " ")
      : null;

    // Clean up the Maps URL
    const cleanUrl = expandedUrl.split("?")[0] || expandedUrl;
    const mapsUrl = cleanUrl.includes("google") ? cleanUrl : expandedUrl;

    if (placeId) {
      return NextResponse.json({
        place_id: placeId,
        google_maps_url: mapsUrl,
        ...(placeName ? { name: placeName } : {}),
      });
    }

    // No Place ID but we have a valid Maps URL — return it
    if (expandedUrl.includes("google")) {
      return NextResponse.json({
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
