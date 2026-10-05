-- Separate Google Maps (directions) link from the Google Reviews link.
-- Until now the About section's "Google Maps Link" field wrote into
-- google_place_id, which is also the Reviews link — so "Get Directions"
-- opened the review page.
alter table public.profiles add column if not exists maps_url text;

-- Carry over any plain Maps links that owners had pasted into
-- google_place_id (not review links), so their directions keep working.
update public.profiles
set maps_url = google_place_id
where maps_url is null
  and google_place_id ~* '^https?://'
  and google_place_id !~* '(review|writereview|g\.page/r/)';
