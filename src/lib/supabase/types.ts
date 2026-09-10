export type PostType = "announcement" | "event" | "update";

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
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
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          profile_id: string;
          public_slug: string;
          is_active: boolean;
          tap_count: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cards"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["cards"]["Row"]>;
        Relationships: [];
      };
      connections: {
        Row: {
          id: string;
          user_id: string;
          connected_user_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["connections"]["Row"]> & {
          user_id: string;
          connected_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["connections"]["Row"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          profile_id: string;
          content: string;
          post_type: PostType;
          media_url: string | null;
          event_date: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["posts"]["Row"]> & {
          profile_id: string;
          content: string;
          post_type: PostType;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
