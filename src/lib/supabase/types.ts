/* ------------------------------------------------------------------ */
/*  Hand-written types matching the live Supabase schema               */
/* ------------------------------------------------------------------ */

export type PostType = "announcement" | "event" | "update";

export interface SocialLink {
  platform: string;
  url: string;
  label?: string;
}

export interface ServiceItem {
  name: string;
  description?: string;
  price?: string;
  image_url?: string;
  category?: string;
}

export interface GalleryItem {
  url: string;
  caption?: string;
  category?: string;
}

export interface BankAccount {
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc: string;
  upi_id?: string;
}

/* ---- Profiles ---------------------------------------------------- */

export interface Profile {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  job_title: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bio: string | null;
  avatar_url: string | null;
  slug: string;
  created_at: string;
  logo_url: string | null;
  card_designed: boolean;
  username: string | null;
  is_member: boolean;
  membership_expires_at: string | null;
  years_in_business: number | null;
  clients_served: number | null;
  coverage_area: string | null;
  services: ServiceItem[];
  gallery: GalleryItem[];
  social_links: SocialLink[];
  bank_accounts: BankAccount[];
  brochure_url: string | null;
  address: string | null;
  gst_number: string | null;
  cover_url: string | null;
  // Added for web — will be migrated
  google_place_id: string | null;
  /** Google Maps link for "Get Directions" (separate from the reviews link). */
  maps_url?: string | null;
  products: ServiceItem[];
  theme: string;
}

export type ProfileInsert = Partial<Profile> & { id: string };
export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;

/* ---- Cards ------------------------------------------------------- */

export interface Card {
  id: string;
  profile_id: string;
  public_slug: string;
  is_active: boolean;
  tap_count: number;
  created_at: string;
  physical_card_ordered: boolean;
}

export type CardInsert = Partial<Card> & { profile_id: string };
export type CardUpdate = Partial<Omit<Card, "id">>;

/* ---- Connections ------------------------------------------------- */

export interface Connection {
  id: string;
  user_id: string;
  connected_user_id: string;
  created_at: string;
}

/* ---- Posts -------------------------------------------------------- */

export interface Post {
  id: string;
  profile_id: string;
  content: string;
  post_type: PostType;
  media_url: string | null;
  event_date: string | null;
  created_at: string;
}

/* ---- Reviews ----------------------------------------------------- */

export interface Review {
  id: string;
  profile_id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

/* ---- Employees --------------------------------------------------- */

export interface Employee {
  id: string;
  owner_id: string;
  name: string;
  designation: string;
  email: string | null;
  phone: string | null;
  slug: string;
  avatar_url: string | null;
  cover_url: string | null;
  is_active: boolean;
  created_at: string;
}

/* ---- Database type (for Supabase client generic) ----------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRelationship = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: AnyRelationship[];
      };
      cards: {
        Row: Card;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: AnyRelationship[];
      };
      connections: {
        Row: Connection;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: AnyRelationship[];
      };
      posts: {
        Row: Post;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: AnyRelationship[];
      };
      reviews: {
        Row: Review;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: AnyRelationship[];
      };
      employees: {
        Row: Employee;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: AnyRelationship[];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
