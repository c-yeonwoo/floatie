import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripExifAndCompress } from "@/lib/image-utils";
import { pickPhoto, validatePickedPhoto } from "@/lib/native-photo";

export const Route = createFileRoute("/_authenticated/answer/$questionId")({
  head: () => ({ meta: [{ title: "답변 — 결" }] }),
  component: AnswerPage,
});

function AnswerPage() {
  const { questionId } = Route.useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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

  const choosePhoto = async () => {
    try {
      const f = await pickPhoto();
      if (!f) return;
      const err = validatePickedPhoto(f);
      if (err) return toast.error(err);
      if (preview) URL.revokeObjectURL(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "사진을 불러오지 못했어요");
    }
  };

  const onSubmit = async () => {
    if (!file) return toast.error("사진을 선택해 주세요.");
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const cleaned = await stripExifAndCompress(file);
      const path = `${uid}/${questionId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("answers")
        .upload(path, cleaned, { upsert: true, contentType: cleaned.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("answers").getPublicUrl(path);

      const { error: insErr } = await supabase.from("answers").upsert(
        {
          user_id: uid,
          question_id: Number(questionId),
          photos: [pub.publicUrl],
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

        {!preview ? (
          <button type="button" onClick={choosePhoto} className="block w-full text-left">
            <div className="w-full aspect-square bg-surface border border-border rounded-2xl grid place-items-center">
              <div className="text-center">
                <div className="text-2xl mb-2">＋</div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  사진 한 장 고르기
                </span>
                <p className="text-[11px] text-muted-foreground mt-2">
                  이 질문엔 단 한 장으로 답해요
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="relative">
            <img
              src={preview}
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
          disabled={submitting || !file}
          className="w-full bg-foreground text-background py-4 rounded-xl text-sm font-medium mt-8 disabled:opacity-40"
        >
          {submitting ? "남기는 중..." : "결 남기기"}
        </button>
      </section>
    </main>
  );
}
