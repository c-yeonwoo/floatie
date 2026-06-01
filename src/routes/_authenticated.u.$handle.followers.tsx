import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";

export const Route = createFileRoute("/_authenticated/u/$handle/followers")({
  head: ({ params }) => ({ meta: [{ title: `@${params.handle}의 팔로워` }] }),
  component: FollowersPage,
});

function FollowersPage() {
  const { handle } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["followers", handle],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("handle", handle)
        .maybeSingle();
      if (!profile) return { profile: null, users: [] };

      const { data: rows } = await supabase
        .from("follows")
        .select("follower_id, profiles!follows_follower_id_fkey(handle, display_name, avatar_url, bio)")
        .eq("following_id", profile.id)
        .order("created_at", { ascending: false });

      return {
        profile,
        users: (rows ?? []).map((r: any) => r.profiles).filter(Boolean),
      };
    },
  });

  return (
    <main className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <Link
          to="/u/$handle"
          params={{ handle }}
          className="text-sm text-muted-foreground"
        >
          ←
        </Link>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          팔로워
        </span>
        <span className="w-6" />
      </header>

      <UserList isLoading={isLoading} users={data?.users ?? []} emptyText="아직 팔로워가 없어요." />
    </main>
  );
}

function UserList({
  isLoading,
  users,
  emptyText,
}: {
  isLoading: boolean;
  users: Array<{ handle: string | null; display_name: string | null; avatar_url: string | null; bio: string | null }>;
  emptyText: string;
}) {
  if (isLoading) {
    return (
      <div className="px-6 py-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-16">{emptyText}</p>
    );
  }
  return (
    <ul className="px-2 py-4">
      {users.map((u) =>
        u.handle ? (
          <li key={u.handle}>
            <Link
              to="/u/$handle"
              params={{ handle: u.handle }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface rounded-xl"
            >
              {u.avatar_url ? (
                <img
                  src={u.avatar_url}
                  alt=""
                  className="size-11 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="size-11 rounded-full bg-surface border border-border" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate">
                  {u.display_name ?? u.handle}
                </div>
                <div className="text-[12px] text-muted-foreground truncate">
                  @{u.handle}
                  {u.bio ? ` · ${u.bio}` : ""}
                </div>
              </div>
            </Link>
          </li>
        ) : null,
      )}
    </ul>
  );
}
