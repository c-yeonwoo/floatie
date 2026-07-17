import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripExifAndCompress } from "@/lib/image-utils";
import { StorageImg } from "@/components/storage-img";

export const Route = createFileRoute("/_authenticated/me/edit")({
  head: () => ({ meta: [{ title: "프로필 수정 — 플로티" }] }),
  component: EditProfilePage,
});

const GENDER_LABEL: Record<string, string> = {
  female: "여자",
  male: "남자",
};

function EditProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile-edit"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select(
          "display_name, handle, bio, avatar_url, gender, birth_year, region, height_cm",
        )
        .eq("id", uid)
        .maybeSingle();
      return { uid, profile: data };
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<string>("");
  const [birthYear, setBirthYear] = useState("");
  const [region, setRegion] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.profile) {
      const p = profile.profile;
      setDisplayName(p.display_name ?? "");
      setBio(p.bio ?? "");
      setGender(p.gender ?? "");
      setBirthYear(p.birth_year ? String(p.birth_year) : "");
      setRegion(p.region ?? "");
      setHeightCm(p.height_cm ? String(p.height_cm) : "");
      setAvatarUrl(p.avatar_url ?? null);
    }
  }, [profile]);

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("5MB 이하만 가능해요");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("jpg, png, webp만 가능해요");
      return;
    }
    setAvatarFile(f);
    setAvatarUrl(URL.createObjectURL(f));
    e.target.value = "";
  };

  const onSave = async () => {
    if (!displayName.trim()) return toast.error("닉네임을 입력해 주세요.");
    if (displayName.length > 40) return toast.error("닉네임은 40자 이하로 입력해 주세요.");
    if (bio.length > 160) return toast.error("한줄소개는 160자 이하로 입력해 주세요.");
    const year = Number(birthYear);
    if (!year || year < 1920 || year > 2008) {
      return toast.error("출생 연도를 확인해 주세요.");
    }
    const height = heightCm.trim() ? Number(heightCm) : null;
    if (height != null && (height < 120 || height > 230)) {
      return toast.error("키는 120~230cm로 입력해 주세요.");
    }
    if (!profile?.uid) return;

    setSaving(true);
    try {
      let nextAvatarUrl = profile.profile?.avatar_url ?? null;
      if (avatarFile) {
        const cleaned = await stripExifAndCompress(avatarFile);
        const path = `${profile.uid}/avatar-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("answers")
          .upload(path, cleaned, { upsert: true, contentType: cleaned.type });
        if (upErr) throw upErr;
        nextAvatarUrl = path;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          // Sea unlock card reads ai_intro — keep in sync with the editable intro
          ai_intro: bio.trim() || null,
          avatar_url: nextAvatarUrl,
          birth_year: year,
          region: region.trim() || null,
          height_cm: height,
        })
        .eq("id", profile.uid);
      if (error) throw error;

      toast.success("프로필을 저장했어요.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["my-profile-edit"] });
      qc.invalidateQueries({ queryKey: ["my-mission-profile"] });
      navigate({ to: "/me" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <Link to="/me" className="text-sm text-muted-foreground">
          ← 취소
        </Link>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          프로필 수정
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || isLoading}
          className="text-sm font-medium disabled:opacity-40"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </header>

      <section className="px-6 py-8 flex flex-col items-center">
        <label className="cursor-pointer group">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickAvatar}
            className="hidden"
          />
          <div className="size-28 rounded-full bg-surface border border-border overflow-hidden grid place-items-center">
            {avatarUrl ? (
              <StorageImg src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-muted-foreground">＋</span>
            )}
          </div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-3 text-center">
            사진 변경 · 열린 뒤 공유
          </p>
        </label>
      </section>

      <section className="px-6 space-y-6">
        <Field label="닉네임" hint={`${displayName.length}/40`}>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground"
          />
        </Field>

        <Field label="성별">
          <p className="py-2 text-base">
            {GENDER_LABEL[gender] ?? "—"}
            <span className="ml-2 text-[11px] text-muted-foreground">
              (가입 후 변경 불가 · {gender === "female" ? "보내기" : "답장"} 역할)
            </span>
          </p>
        </Field>

        <Field label="출생 연도">
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="1998"
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground"
          />
        </Field>

        <Field label="지역 (시)">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="서울"
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground"
          />
        </Field>

        <Field label="키 cm (선택)">
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="175"
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground"
          />
        </Field>

        <Field label="한줄소개" hint={`${bio.length}/160`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground resize-none"
            placeholder="열린 뒤 상대에게 보여요."
          />
        </Field>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
