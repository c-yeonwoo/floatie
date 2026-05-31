import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripExifMany } from "@/lib/image-utils";

const MAX_PHOTOS = 6;

export const Route = createFileRoute("/_authenticated/answer-edit/$answerId")({
  head: () => ({ meta: [{ title: "결 수정 — 결" }] }),
  component: AnswerEditPage,
});

type Slot =
  | { kind: "existing"; url: string }
  | { kind: "new"; file: File; preview: string };

function AnswerEditPage() {
  const { answerId } = Route.useParams();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["answer-edit", answerId],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      const { data: answer } = await supabase
        .from("answers")
        .select("id, user_id, photos, visibility, questions(text, category)")
        .eq("id", Number(answerId))
        .maybeSingle();
      return { answer, me };
    },
  });

  const a = data?.answer as any | null;
  const isOwner = !!a && data?.me === a.user_id;

  useEffect(() => {
    if (!a) return;
    setSlots((a.photos as string[]).map((url) => ({ kind: "existing", url })));
    setVisibility(a.visibility === "private" ? "private" : "public");
  }, [a]);

  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: 10MB 이하만 가능해요`);
        continue;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`${f.name}: jpg, png, webp만 가능해요`);
        continue;
      }
      valid.push(f);
    }
    const remaining = MAX_PHOTOS - slots.length;
    const next: Slot[] = valid.slice(0, remaining).map((f) => ({
      kind: "new",
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setSlots([...slots, ...next]);
    e.target.value = "";
  };

  const removeAt = (i: number) => {
    setSlots(slots.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    const copy = [...slots];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setSlots(copy);
  };

  const onSave = async () => {
    if (!a || !isOwner) return;
    if (slots.length === 0) return toast.error("사진을 최소 한 장은 남겨주세요.");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      // Upload new files first
      const newFiles = slots
        .filter((s): s is Extract<Slot, { kind: "new" }> => s.kind === "new")
        .map((s) => s.file);
      const cleaned = await stripExifMany(newFiles);
      const newUrls: string[] = [];
      for (let i = 0; i < cleaned.length; i++) {
        const f = cleaned[i];
        const path = `${uid}/${a.id}-edit-${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("answers")
          .upload(path, f, { upsert: true, contentType: f.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("answers").getPublicUrl(path);
        newUrls.push(pub.publicUrl);
      }

      // Build final ordered URL list, then delete removed-existing files
      let newUrlIdx = 0;
      const finalUrls = slots.map((s) =>
        s.kind === "existing" ? s.url : newUrls[newUrlIdx++],
      );

      const originalUrls: string[] = a.photos ?? [];
      const keptSet = new Set(
        slots.filter((s) => s.kind === "existing").map((s) => (s as any).url),
      );
      const removedPaths = originalUrls
        .filter((u) => !keptSet.has(u))
        .map((u) => u.replace(/^.*\/storage\/v1\/object\/public\/answers\//, ""))
        .filter((p) => p.length > 0 && !p.startsWith("http"));

      const { error: updErr } = await supabase
        .from("answers")
        .update({ photos: finalUrls, visibility })
        .eq("id", a.id);
      if (updErr) throw updErr;

      if (removedPaths.length > 0) {
        await supabase.storage.from("answers").remove(removedPaths);
      }

      toast.success("결을 수정했어요.");
      navigate({ to: "/answer-detail/$answerId", params: { answerId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!a || !isOwner) return;
    if (!confirm("이 결을 정말 삭제할까요? 되돌릴 수 없어요.")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("answers").delete().eq("id", a.id);
      if (error) throw error;
      toast.success("결을 삭제했어요.");
      navigate({ to: "/me" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제에 실패했어요.");
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  }
  if (!a) {
    return <div className="p-10 text-center text-sm text-muted-foreground">없는 결이에요.</div>;
  }
  if (!isOwner) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        본인의 결만 수정할 수 있어요.
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <Link
          to="/answer-detail/$answerId"
          params={{ answerId }}
          className="text-sm text-muted-foreground"
        >
          ← 취소
        </Link>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">결 수정</span>
        <button
          onClick={onSave}
          disabled={saving || slots.length === 0}
          className="text-sm font-medium text-accent disabled:opacity-40"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </header>

      <section className="px-6 py-8">
        <div className="mb-6">
          <span className="text-[11px] uppercase tracking-widest text-accent">
            {a.questions?.category}
          </span>
          <h2 className="font-serif text-xl mt-1 leading-snug text-balance">
            {a.questions?.text}
          </h2>
        </div>

        <p className="text-[11px] text-muted-foreground mb-3">
          첫 번째 사진이 대표 이미지로 보여요. 화살표로 순서를 바꿀 수 있어요.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {slots.map((s, i) => (
            <div key={i} className="relative aspect-square">
              <img
                src={s.kind === "existing" ? s.url : s.preview}
                alt=""
                className="w-full h-full object-cover rounded-xl border border-border"
              />
              {i === 0 && (
                <span className="absolute top-2 left-2 text-[10px] bg-foreground text-background px-2 py-0.5 rounded-full">
                  대표
                </span>
              )}
              <button
                onClick={() => removeAt(i)}
                aria-label="제거"
                className="absolute top-2 right-2 size-7 rounded-full bg-background/85 text-foreground text-sm grid place-items-center border border-border"
              >
                ×
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="size-7 rounded-full bg-background/85 border border-border text-sm disabled:opacity-30"
                  aria-label="앞으로"
                >
                  ‹
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === slots.length - 1}
                  className="size-7 rounded-full bg-background/85 border border-border text-sm disabled:opacity-30"
                  aria-label="뒤로"
                >
                  ›
                </button>
              </div>
            </div>
          ))}

          {slots.length < MAX_PHOTOS && (
            <label className="aspect-square bg-surface border border-dashed border-border rounded-xl grid place-items-center cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={addFiles}
                className="hidden"
              />
              <div className="text-center">
                <div className="text-2xl text-muted-foreground">＋</div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  사진 추가
                </span>
              </div>
            </label>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground mt-2 text-right">
          {slots.length} / {MAX_PHOTOS}
        </p>

        <div className="flex gap-2 mt-8">
          <button
            onClick={() => setVisibility("public")}
            className={
              "flex-1 py-2 text-xs rounded-md border transition-colors " +
              (visibility === "public"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground")
            }
          >
            전체공개
          </button>
          <button
            onClick={() => setVisibility("private")}
            className={
              "flex-1 py-2 text-xs rounded-md border transition-colors " +
              (visibility === "private"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground")
            }
          >
            나만 보기
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center">
          <button
            onClick={onDelete}
            disabled={deleting}
            className="text-[11px] uppercase tracking-widest text-destructive hover:underline underline-offset-4 disabled:opacity-50"
          >
            {deleting ? "삭제 중..." : "이 결 삭제하기"}
          </button>
        </div>
      </section>
    </main>
  );
}
