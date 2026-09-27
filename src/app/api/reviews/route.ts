import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile_id, reviewer_name, reviewer_email, rating, comment } = body;

    if (!profile_id || !reviewer_name || !rating) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        profile_id,
        reviewer_name: reviewer_name.trim(),
        reviewer_email: reviewer_email?.trim() || null,
        rating: Math.round(rating),
        comment: comment?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Review insert error:", error);
      return NextResponse.json(
        { error: "Failed to submit review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ review: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
