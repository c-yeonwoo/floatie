import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { stripExifAndCompress } from "@/lib/image-utils";


export const Route = createFileRoute("/_authenticated/me/edit")({
  head: () => ({ meta: [{ title: "프로필 수정" }] }),
  component: EditProfilePage,
});

const GENDERS = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
  { value: "other", label: "기타" },
  { value: "prefer_not", label: "비공개" },
] as const;

function EditProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile-edit"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      return { uid, profile: data };
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.profile) {
      setDisplayName(profile.profile.display_name ?? "");
      setHandle(profile.profile.handle ?? "");
      setBio(profile.profile.bio ?? "");
      setGender((profile.profile as any).gender ?? "");
      setAvatarUrl(profile.profile.avatar_url ?? null);
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
    if (!profile?.uid) return;

    setSaving(true);
    try {
      let nextAvatarUrl = profile.profile?.avatar_url ?? null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${profile.uid}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("answers")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("answers").getPublicUrl(path);
        nextAvatarUrl = pub.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          handle: handle.trim() || null,
          bio: bio.trim() || null,
          gender: gender || null,
          avatar_url: nextAvatarUrl,
        } as any)
        .eq("id", profile.uid);
      if (error) throw error;

      toast.success("프로필을 저장했어요.");
      qc.invalidateQueries({ queryKey: ["my-gyeol"] });
      qc.invalidateQueries({ queryKey: ["my-profile-edit"] });
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
        <Link to="/me" className="text-sm text-muted-foreground">← 취소</Link>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">프로필 수정</span>
        <button
          onClick={onSave}
          disabled={saving || isLoading}
          className="text-sm font-medium text-accent disabled:opacity-40"
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
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-muted-foreground">＋</span>
            )}
          </div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-3 text-center group-hover:text-foreground">
            사진 변경
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
            placeholder="이름"
          />
        </Field>

        <Field label="핸들" hint="@아이디 (선택)">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            maxLength={24}
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground"
            placeholder="user_handle"
          />
        </Field>

        <Field label="성별">
          <div className="flex flex-wrap gap-2 mt-1">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(gender === g.value ? "" : g.value)}
                className={
                  "px-4 py-2 rounded-full text-xs border transition-colors " +
                  (gender === g.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground")
                }
              >
                {g.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="한줄소개" hint={`${bio.length}/160`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            className="w-full bg-transparent border-b border-border py-2 text-base focus:outline-none focus:border-foreground resize-none"
            placeholder="당신의 결을 한 문장으로 소개해 주세요."
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
