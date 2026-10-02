import { NextRequest, NextResponse } from "next/server";

/**
 * Searches Google Places API for a business by name/address
 * and returns matching Place IDs.
 *
 * Requires GOOGLE_PLACES_API_KEY in environment variables.
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
