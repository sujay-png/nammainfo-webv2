"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Counts one "tap" (profile visit) per visitor per browser session.
 *
 * This has to run in the browser, not in the server component: the
 * public pages are ISR-cached, so server code only runs once per cache
 * refresh rather than once per visitor. The actual +1 happens inside the
 * `record_card_tap` Postgres function (SECURITY DEFINER), because the
 * anon key isn't allowed to UPDATE the cards table directly.
 */
export default function TapTracker({
  profileId,
  cardId,
}: {
  profileId: string;
  cardId?: string | null;
}) {
  useEffect(() => {
    const key = `nammainfo:tap:${profileId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode / storage blocked — still count the visit.
    }

    const supabase = createClient();
    supabase
      .rpc("record_card_tap", {
        p_card_id: cardId ?? null,
        p_profile_id: profileId,
      } as never)
      .then(({ error }) => {
        if (error) console.warn("[TapTracker]", error.message);
      });
  }, [profileId, cardId]);

  return null;
}
