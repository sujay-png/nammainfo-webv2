-- =====================================================================
--  Namma Info: custom links, custom buttons and WhatsApp greetings
--  Run in the Supabase SQL Editor before deploying the matching code.
--  Safe to run more than once.
--
--  1. profiles.custom_links       up to 3 { id, label, url }
--     Buttons at the top of the public card, under "Add to Contacts".
--  2. profiles.custom_buttons     up to 10 { id, label, url, kind, file_name? }
--     kind = 'link' (any web address) or 'file' (a PDF / image the owner
--     uploaded to profile-media/<id>/buttons/). Shown next to the brochure,
--     e.g. "Menu", "Price list".
--  3. profiles.greeting_templates up to 4 { id, heading, body, attach[] }
--     The owner's own WhatsApp greetings (messages 2 to 5 in the Greet
--     sheet; message 1 is built in). attach lists what to add as links:
--     'profile', 'website', 'brochure', 'button:<id>'.
--     Team members use their business's templates with their own name.
-- =====================================================================

alter table public.profiles add column if not exists custom_links jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists custom_buttons jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists greeting_templates jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_custom_links_shape;
alter table public.profiles add constraint profiles_custom_links_shape
  check (jsonb_typeof(custom_links) = 'array'
         and jsonb_array_length(custom_links) <= 3
         and pg_column_size(custom_links) <= 4096);

alter table public.profiles drop constraint if exists profiles_custom_buttons_shape;
alter table public.profiles add constraint profiles_custom_buttons_shape
  check (jsonb_typeof(custom_buttons) = 'array'
         and jsonb_array_length(custom_buttons) <= 10
         and pg_column_size(custom_buttons) <= 8192);

alter table public.profiles drop constraint if exists profiles_greeting_templates_shape;
alter table public.profiles add constraint profiles_greeting_templates_shape
  check (jsonb_typeof(greeting_templates) = 'array'
         and jsonb_array_length(greeting_templates) <= 4
         and pg_column_size(greeting_templates) <= 16384);

notify pgrst, 'reload schema';
