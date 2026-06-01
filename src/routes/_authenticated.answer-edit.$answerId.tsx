import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripExifAndCompress } from "@/lib/image-utils";
import { pickPhoto, validatePickedPhoto } from "@/lib/native-photo";
import { StorageImg } from "@/components/storage-img";
import { extractAnswersPath } from "@/lib/storage-url";

export const Route = createFileRoute("/_authenticated/answer-edit/$answerId")({
  head: () => ({ meta: [{ title: "결 수정 — 결" }] }),
  component: AnswerEditPage,
});

function AnswerEditPage() {
  const { answerId } = Route.useParams();
  const navigate = useNavigate();
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [originalUrls, setOriginalUrls] = useState<string[]>([]);
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
    const photos: string[] = a.photos ?? [];
    setOriginalUrls(photos);
    setExistingUrl(photos[0] ?? null);
    setVisibility(a.visibility === "private" ? "private" : "public");
  }, [a]);

  const choosePhoto = async () => {
    try {
      const f = await pickPhoto();
      if (!f) return;
      const err = validatePickedPhoto(f);
      if (err) return toast.error(err);
      if (newPreview) URL.revokeObjectURL(newPreview);
      setNewFile(f);
      setNewPreview(URL.createObjectURL(f));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "사진을 불러오지 못했어요");
    }
  };

  const onSave = async () => {
    if (!a || !isOwner) return;
    if (!existingUrl && !newFile) return toast.error("사진을 선택해 주세요.");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      let finalValue = existingUrl as string;
      if (newFile) {
        const cleaned = await stripExifAndCompress(newFile);
        const path = `${uid}/${a.id}-edit-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("answers")
          .upload(path, cleaned, { upsert: true, contentType: cleaned.type });
        if (upErr) throw upErr;
        finalValue = path;
      }

      const { error: updErr } = await supabase
        .from("answers")
        .update({ photos: [finalValue], visibility })
        .eq("id", a.id);
      if (updErr) throw updErr;

      // Remove old files that are no longer used
      const removedPaths = originalUrls
        .filter((u) => u !== finalValue)
        .map((u) => extractAnswersPath(u))
        .filter((p): p is string => !!p);
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

  const displayUrl = newPreview ?? existingUrl;

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
          disabled={saving || (!existingUrl && !newFile)}
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

        {originalUrls.length > 1 && (
          <p className="text-[11px] text-muted-foreground mb-3">
            이 결은 여러 장이었어요. 저장하면 한 장으로 정리됩니다.
          </p>
        )}

        {displayUrl ? (
          <div className="relative">
            <StorageImg
              src={displayUrl}
              alt=""
              className="w-full aspect-square object-cover rounded-2xl border border-border"
            />
            <button
              type="button"
              onClick={choosePhoto}
              className="absolute bottom-3 right-3 bg-background/85 backdrop-blur text-[11px] uppercase tracking-widest border border-border rounded-full px-3 py-1.5"
            >
              다시 고르기
            </button>
          </div>
        ) : (
          <button type="button" onClick={choosePhoto} className="block w-full text-left">
            <div className="w-full aspect-square bg-surface border border-dashed border-border rounded-2xl grid place-items-center">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                사진 고르기
              </span>
            </div>
          </button>
        )}

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
