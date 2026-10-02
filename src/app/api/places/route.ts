import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/places — resolve a Google Maps URL to a place_id + coordinates.
 *
 * Accepts:
 *   { url: "https://maps.app.goo.gl/..." }        — short share link
 *   { url: "https://www.google.com/maps/place/..." } — full link
 *   { url: "https://www.google.com/maps?cid=..." }  — CID link
 *
 * Returns:
 *   { place_id, lat, lng, name? }
 *
 * No API key required — works by following redirects and parsing the
 * expanded URL, or by extracting the place_id / coords directly.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl: string = (body.url ?? "").trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Direct Place ID pasted (ChIJ...)
    if (/^ChIJ[A-Za-z0-9_-]+$/.test(rawUrl)) {
      return NextResponse.json({ place_id: rawUrl });
    }

    // Must be a Google Maps URL
    if (
      !rawUrl.includes("google.com/maps") &&
      !rawUrl.includes("maps.app.goo.gl") &&
      !rawUrl.includes("goo.gl/maps") &&
      !rawUrl.includes("maps.google.com")
    ) {
      return NextResponse.json(
        { error: "Please paste a Google Maps link" },
        { status: 400 }
      );
    }

    // Resolve short URLs by following redirects
    let expandedUrl = rawUrl;
    if (
      rawUrl.includes("maps.app.goo.gl") ||
      rawUrl.includes("goo.gl/maps")
    ) {
      try {
        const res = await fetch(rawUrl, {
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; NammaInfo/1.0; +https://nammainfo.com)",
          },
        });
        expandedUrl = res.url;
      } catch {
        return NextResponse.json(
          { error: "Could not resolve short link — try pasting the full Google Maps URL instead" },
          { status: 400 }
        );
      }
    }

    // Try to extract place_id from URL query params
    const placeIdParam = expandedUrl.match(/[?&]place_id=([^&]+)/);
    if (placeIdParam) {
      return NextResponse.json({ place_id: placeIdParam[1] });
    }

    // Extract from ftid parameter (0x...:0x... format → place_id)
    const ftidMatch = expandedUrl.match(/[?&]ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
    if (ftidMatch) {
      return NextResponse.json({ place_id: ftidMatch[1] });
    }

    // Extract coordinates from /maps/place/.../@lat,lng,... or /maps/@lat,lng,...
    const coordMatch = expandedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

    // Extract CID from ?cid=... parameter
    const cidMatch = expandedUrl.match(/[?&]cid=(\d+)/);

    // Extract place name from /maps/place/NAME/
    const nameMatch = expandedUrl.match(/\/maps\/place\/([^/@?]+)/);
    const placeName = nameMatch
      ? decodeURIComponent(nameMatch[1]).replace(/\+/g, " ")
      : null;

    // Build a response with whatever we extracted
    const result: Record<string, string | number | null> = {};

    if (cidMatch) {
      // CID is a stable identifier we can use
      result.cid = cidMatch[1];
    }

    if (coordMatch) {
      result.lat = parseFloat(coordMatch[1]);
      result.lng = parseFloat(coordMatch[2]);
    }

    if (placeName) {
      result.name = placeName;
    }

    // We store the full expanded URL as the google_maps_url for directions
    // and use coords/cid for the maps embed
    if (result.lat || result.cid) {
      result.google_maps_url = expandedUrl.split("?")[0];
      // Use the expanded URL itself — it's a valid Google Maps link for directions
      return NextResponse.json(result);
    }

    // Last resort: the expanded URL is itself a valid Google Maps link
    // Even if we couldn't parse structured data, the URL works for directions
    if (expandedUrl.includes("google.com/maps")) {
      return NextResponse.json({
        google_maps_url: expandedUrl,
        name: placeName,
      });
    }

    return NextResponse.json(
      { error: "Could not extract location from this link — try a different Google Maps URL" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong — please try again" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/places — legacy search endpoint (requires GOOGLE_PLACES_API_KEY).
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 3) {
    return NextResponse.json(
      { error: "Query must be at least 3 characters" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/textsearch/json"
    );
    url.searchParams.set("query", query.trim());
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      return NextResponse.json(
        { error: "Google API key invalid or restricted" },
        { status: 403 }
      );
    }

    const results = (data.results ?? [])
      .slice(0, 5)
      .map(
        (r: {
          place_id: string;
          name: string;
          formatted_address: string;
          rating?: number;
        }) => ({
          place_id: r.place_id,
          name: r.name,
          address: r.formatted_address,
          rating: r.rating ?? null,
        })
      );

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Google Places API" },
      { status: 502 }
    );
  }
}
