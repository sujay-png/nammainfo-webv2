"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/current-user";
import type { Post, Profile } from "@/lib/supabase/types";
import { formatDistanceToNow } from "@/lib/utils";
import { Plus, Megaphone, Calendar, TrendingUp, Newspaper } from "lucide-react";

interface FeedPost extends Post {
  profile?: Profile;
}

const postTypeIcons: Record<string, React.ReactNode> = {
  announcement: <Megaphone size={14} />,
  event: <Calendar size={14} />,
  update: <TrendingUp size={14} />,
};

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<"update" | "announcement" | "event">(
    "update"
  );
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    const supabase = createClient();
    const user = await getCurrentUser();
    if (!user) return;

    // Get connections
    const { data: connections } = await supabase
      .from("connections")
      .select("connected_user_id")
      .eq("user_id", user.id);

    const connectedIds = (connections ?? []).map(
      (c: { connected_user_id: string }) => c.connected_user_id
    );
    const feedUserIds = [user.id, ...connectedIds];

    // Get posts from self + connections
    const { data: feedPosts } = await supabase
      .from("posts")
      .select("*")
      .in("profile_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (feedPosts && feedPosts.length > 0) {
      // Fetch profiles for these posts
      const profileIds = [
        ...new Set(feedPosts.map((p: Post) => p.profile_id)),
      ];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", profileIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: Profile) => [p.id, p])
      );

      setPosts(
        feedPosts.map((p: Post) => ({
          ...p,
          profile: profileMap.get(p.profile_id),
        }))
      );
    }

    setLoading(false);
  }

  async function handlePost() {
    if (!newContent.trim()) return;
    setPosting(true);
    const supabase = createClient();
    const user = await getCurrentUser();
    if (!user) return;

    await supabase.from("posts").insert({
      profile_id: user.id,
      content: newContent.trim(),
      post_type: newType,
    });

    setNewContent("");
    setShowCompose(false);
    setPosting(false);
    loadFeed();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="flex items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-ink-800"
        >
          <Plus size={14} />
          Post
        </button>
      </div>

      {/* Compose */}
      {showCompose && (
        <div className="animate-fade-in mb-5 rounded-2xl border border-ink-200 bg-white p-4">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Share an update with your network..."
            rows={3}
            className="w-full resize-none border-none bg-transparent text-sm outline-none placeholder:text-ink-400"
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1">
              {(["update", "announcement", "event"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setNewType(type)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize transition ${
                    newType === type
                      ? "bg-ink-950 text-white"
                      : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
              onClick={handlePost}
              disabled={posting || !newContent.trim()}
              className="rounded-full bg-ink-950 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-ink-800 disabled:opacity-40"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100">
            <Newspaper size={20} className="text-ink-400" />
          </div>
          <p className="text-sm font-medium text-ink-600">No posts yet</p>
          <p className="mt-1 text-xs text-ink-400">
            Share an update or connect with others to see their posts
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="animate-fade-in rounded-2xl border border-ink-100 bg-white p-4 transition hover:shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">
                  {post.profile?.owner_name?.[0]?.toUpperCase() ??
                    post.profile?.business_name?.[0]?.toUpperCase() ??
                    "N"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {post.profile?.owner_name ??
                        post.profile?.business_name ??
                        "Namma Info User"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium capitalize text-ink-500">
                      {postTypeIcons[post.post_type]}
                      {post.post_type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {post.profile?.job_title &&
                      `${post.profile.job_title} · `}
                    {formatDistanceToNow(post.created_at)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                {post.content}
              </p>
              {post.media_url && (
                <img
                  src={post.media_url}
                  alt=""
                  className="mt-3 rounded-xl border border-ink-100"
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
