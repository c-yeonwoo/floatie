import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "개인정보 처리방침 — 플로티" },
      { name: "description", content: "플로티(Floatie) 서비스 개인정보 처리방침." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="fixed inset-0 bg-background text-foreground overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-6 py-12 min-h-[100dvh]">
        <Link to="/login" className="text-[11px] uppercase tracking-widest text-muted-foreground">
          ← 돌아가기
        </Link>
        <h1 className="font-serif text-3xl mt-4 mb-8">개인정보 처리방침</h1>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/80">
          <p className="text-muted-foreground">초안 · 서비스명 “플로티(Floatie)” · 법률 문안 확정 전</p>

          <Section title="1. 수집 항목">
            이메일(또는 소셜 계정 식별자), 닉네임, 프로필 사진(선택), 한 줄 소개,
            성별·출생연도·지역·매칭 선호, 미션·답장·채팅 내용, 신고·차단 기록,
            접속·활성 로그.
          </Section>

          <Section title="2. 수집 목적">
            계정 식별, 익명 미션 매칭, 양방향 OK 후 프로필 공유, 안전(신고·차단),
            서비스 개선.
          </Section>

          <Section title="3. 보관 기간">
            회원 탈퇴 시 파기를 원칙으로 하며, 법령상 보관이 필요한 경우 해당
            기간만 보관합니다.
          </Section>

          <Section title="4. 제3자 제공">
            법령에 따른 경우를 제외하고 동의 없이 제3자에게 제공하지 않습니다.
          </Section>

          <Section title="5. 문의">
            문의 채널은 런칭 전 확정합니다.
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-lg text-foreground mb-2">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
