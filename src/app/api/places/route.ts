import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/places — resolve a Google Maps URL to a place_id + maps URL.
 *
 * Accepts:
 *   { url: "https://maps.app.goo.gl/..." }             — short share link
 *   { url: "https://www.google.com/maps/place/..." }    — full link
 *   { url: "https://www.google.com/maps?cid=..." }      — CID link
 *   { url: "ChIJ..." }                                  — direct Place ID
 *
 * Returns: { place_id?, google_maps_url, name? }
 *
 * place_id is ONLY a ChIJ... format (the only format Google's
 * writereview URL accepts). google_maps_url always points to the
 * business page on Google Maps.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Extract a ChIJ Place ID — the ONLY format that works with writereview */
function extractChIJPlaceId(text: string): string | null {
  const chijMatch = text.match(/(ChIJ[A-Za-z0-9_-]+)/);
  if (chijMatch) return chijMatch[1];
  return null;
}

/** Extract hex feature ID (0x...:0x...) — used for #lrd review link trick */
function extractFeatureId(text: string): string | null {
  const hexMatch = text.match(/(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  return hexMatch ? hexMatch[1] : null;
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

    // Try ChIJ from expanded URL
    placeId = extractChIJPlaceId(expandedUrl);

    // Try ChIJ from page HTML (Google Maps is mostly client-rendered,
    // but sometimes the ChIJ appears in initial script data)
    if (!placeId && pageHtml) {
      placeId = extractChIJPlaceId(pageHtml);
    }

    // Extract hex feature ID from expanded URL or page HTML
    let featureId = extractFeatureId(expandedUrl);
    if (!featureId && pageHtml) {
      featureId = extractFeatureId(pageHtml);
    }

    // Extract place name from /maps/place/NAME/
    const nameMatch = expandedUrl.match(/\/maps\/place\/([^/@?]+)/);
    const placeName = nameMatch
      ? decodeURIComponent(nameMatch[1]).replace(/\+/g, " ")
      : null;

    // Keep full expanded URL (data path contains feature ID for review links)
    const mapsUrl = expandedUrl.includes("google") ? expandedUrl : rawUrl;

    // Return what we have — place_id only if ChIJ, always google_maps_url
    if (mapsUrl.includes("google")) {
      return NextResponse.json({
        ...(placeId ? { place_id: placeId } : {}),
        ...(featureId ? { feature_id: featureId } : {}),
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
