import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripExifMany } from "@/lib/image-utils";



const MAX_PHOTOS = 6;

export const Route = createFileRoute("/_authenticated/answer/$questionId")({
  head: () => ({ meta: [{ title: "답변 — 결" }] }),
  component: AnswerPage,
});

function AnswerPage() {
  const { questionId } = Route.useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);

  const { data: question } = useQuery({
    queryKey: ["question", questionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("questions")
        .select("id, text, category")
        .eq("id", Number(questionId))
        .maybeSingle();
      return data;
    },
  });

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: 5MB 이하만 가능해요`);
        continue;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`${f.name}: jpg, png, webp만 가능해요`);
        continue;
      }
      valid.push(f);
    }
    const next = [...files, ...valid].slice(0, MAX_PHOTOS);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const removeAt = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const onSubmit = async () => {
    if (files.length === 0) return toast.error("사진을 선택해 주세요.");
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const cleaned = await stripExifMany(files);
      const urls: string[] = [];
      for (let i = 0; i < cleaned.length; i++) {
        const f = cleaned[i];
        const path = `${uid}/${questionId}-${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("answers")
          .upload(path, f, { upsert: true, contentType: f.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("answers").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }

      const { error: insErr } = await supabase.from("answers").upsert(
        {
          user_id: uid,
          question_id: Number(questionId),
          photos: urls,
          visibility,
        },
        { onConflict: "user_id,question_id" }
      );
      if (insErr) throw insErr;


      toast.success("결이 남았어요.");
      navigate({ to: "/me" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <Link to="/home" className="text-sm text-muted-foreground">← 취소</Link>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">답변</span>
        <span className="w-10" />
      </header>

      <section className="px-6 py-8">
        {question && (
          <div className="mb-8">
            <span className="text-[11px] uppercase tracking-widest text-accent">
              {question.category}
            </span>
            <h2 className="font-serif text-3xl mt-2 leading-snug text-balance">{question.text}</h2>
          </div>
        )}

        {previews.length === 0 ? (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onFiles}
              className="hidden"
            />
            <div className="w-full aspect-square bg-surface border border-border rounded-2xl grid place-items-center">
              <div className="text-center">
                <div className="text-2xl mb-2">＋</div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  사진 고르기
                </span>
                <p className="text-[11px] text-muted-foreground mt-2">최대 {MAX_PHOTOS}장까지</p>
              </div>
            </div>
          </label>
        ) : (
          <div>
            <div className="grid grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square">
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => removeAt(i)}
                    className="absolute top-1 right-1 size-6 rounded-full bg-background/85 text-foreground text-xs grid place-items-center border border-border"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
              {previews.length < MAX_PHOTOS && (
                <label className="aspect-square bg-surface border border-dashed border-border rounded-lg grid place-items-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={onFiles}
                    className="hidden"
                  />
                  <span className="text-2xl text-muted-foreground">＋</span>
                </label>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-right">
              {previews.length} / {MAX_PHOTOS}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-6">
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

        <button
          onClick={onSubmit}
          disabled={submitting || files.length === 0}
          className="w-full bg-foreground text-background py-4 rounded-xl text-sm font-medium mt-8 disabled:opacity-40"
        >
          {submitting ? "남기는 중..." : "결 남기기"}
        </button>
      </section>
    </main>
  );
}
