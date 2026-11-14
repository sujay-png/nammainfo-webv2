-- =====================================================================
-- Namma Info: WhatsApp Inbox & Two-Way Customer Messaging
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  contact_name text,
  company_name text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'voice', 'template', 'video', 'location', 'sticker')),
  content text,
  media_id text,
  media_url text,
  media_mime_type text,
  media_filename text,
  media_size bigint,
  meta_message_id text UNIQUE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  is_read boolean NOT NULL DEFAULT false,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages (phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_id ON public.whatsapp_messages (meta_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_unread ON public.whatsapp_messages (is_read) WHERE is_read = false AND direction = 'inbound';

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Admins & staff can select, insert, update whatsapp messages
DROP POLICY IF EXISTS "Staff and Admin full access on whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Staff and Admin full access on whatsapp_messages"
  ON public.whatsapp_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.role IN ('admin', 'staff'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.role IN ('admin', 'staff'))
    )
  );

