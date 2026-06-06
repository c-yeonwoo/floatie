import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { StorageImg } from "@/components/storage-img";

/**
 * 친구(상호 팔로우) 목록을 보여주고 선택한 친구들에게 질문 넛지를 보냅니다.
 */
export function NudgeDialog({
  open,
  onClose,
  questionId,
  questionText,
}: {
  open: boolean;
  onClose: () => void;
  questionId: number;
  questionText?: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["mutual-friends", questionId],
    enabled: open,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      if (!me) return { friends: [], alreadySent: new Set<string>() };

      // 내가 팔로우하는 사람 + 나를 팔로우하는 사람의 교집합 = 친구
      const [{ data: outgoing }, { data: incoming }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", me),
        supabase.from("follows").select("follower_id").eq("following_id", me),
      ]);
      const out = new Set((outgoing ?? []).map((r: any) => r.following_id));
      const friendIds = (incoming ?? [])
        .map((r: any) => r.follower_id)
        .filter((id: string) => out.has(id));

      if (friendIds.length === 0)
        return { friends: [], alreadySent: new Set<string>() };

      const [{ data: profiles }, { data: sent }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", friendIds),
        supabase
          .from("nudges")
          .select("receiver_id")
          .eq("sender_id", me)
          .eq("question_id", questionId),
      ]);

      return {
        friends: profiles ?? [],
        alreadySent: new Set((sent ?? []).map((r: any) => r.receiver_id)),
      };
    },
  });

  const friends = data?.friends ?? [];
  const alreadySent = data?.alreadySent ?? new Set<string>();

  const toggleable = useMemo(
    () => friends.filter((f: any) => !alreadySent.has(f.id)),
    [friends, alreadySent],
  );

  const send = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      if (!me) throw new Error("로그인이 필요해요.");
      if (selected.size === 0) throw new Error("친구를 선택해 주세요.");

      const rows = Array.from(selected).map((receiver_id) => ({
        sender_id: me,
        receiver_id,
        question_id: questionId,
      }));
      const { error } = await supabase.from("nudges").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n}명에게 넛지를 보냈어요.`);
      qc.invalidateQueries({ queryKey: ["mutual-friends", questionId] });
      qc.invalidateQueries({ queryKey: ["received-nudges"] });
      setSelected(new Set());
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "보내지 못했어요."),
  });

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === toggleable.length) setSelected(new Set());
    else setSelected(new Set(toggleable.map((f: any) => f.id)));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-background border border-border rounded-2xl p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg mb-1">친구에게 물어보기</h3>
        <p className="text-[12px] text-muted-foreground mb-2">
          서로 팔로우한 친구의 결이 궁금할 때
        </p>
        {questionText && (
          <p className="text-[13px] text-foreground/80 mb-4 border-l-2 border-accent/40 pl-3 line-clamp-2">
            {questionText}
          </p>
        )}

        <div className="flex-1 overflow-y-auto -mx-2 px-2 min-h-[160px]">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">
                아직 친구가 없어요.
              </p>
              <p className="text-[12px] text-muted-foreground/70 mt-2">
                서로 팔로우한 사람이 친구가 돼요.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {friends.map((f: any) => {
                const sent = alreadySent.has(f.id);
                const isSelected = selected.has(f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={sent}
                      onClick={() => toggle(f.id)}
                      className={
                        "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors " +
                        (sent
                          ? "opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "bg-accent/10"
                            : "hover:bg-secondary")
                      }
                    >
                      {f.avatar_url ? (
                        <StorageImg
                          src={f.avatar_url}
                          alt=""
                          className="size-9 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="size-9 rounded-full bg-surface border border-border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] truncate">
                          {f.display_name ?? f.handle}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          @{f.handle}
                        </div>
                      </div>
                      {sent ? (
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          보냄
                        </span>
                      ) : (
                        <div
                          className={
                            "size-5 rounded-full border " +
                            (isSelected
                              ? "bg-foreground border-foreground"
                              : "border-border")
                          }
                          aria-hidden
                        >
                          {isSelected && (
                            <svg
                              viewBox="0 0 20 20"
                              fill="none"
                              className="w-full h-full text-background p-0.5"
                            >
                              <path
                                d="M5 10l3 3 7-7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {toggleable.length > 0 && (
          <button
            type="button"
            onClick={selectAll}
            className="self-start text-[11px] text-muted-foreground underline underline-offset-4 mt-3"
          >
            {selected.size === toggleable.length ? "선택 해제" : "전체 선택"}
          </button>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={onClose}
            className="text-[13px] text-muted-foreground px-3 py-2"
          >
            취소
          </button>
          <button
            onClick={() => send.mutate()}
            disabled={send.isPending || selected.size === 0}
            className="text-[13px] bg-foreground text-background px-4 py-2 rounded-md disabled:opacity-40"
          >
            {send.isPending
              ? "보내는 중..."
              : selected.size > 0
                ? `${selected.size}명에게 보내기`
                : "보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
