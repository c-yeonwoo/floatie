import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "개인정보 처리방침 — 숨결" },
      { name: "description", content: "숨결 서비스 개인정보 처리방침." },
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
          <p className="text-muted-foreground">시행일: 2026년 5월 31일</p>

          <Section title="1. 수집 항목">
            이메일, 닉네임, 핸들, 프로필 사진, 자기소개, 성별(선택),
            업로드 사진, 댓글·좋아요·팔로우 기록, 접속 로그.
            사진은 업로드 전 위치정보(EXIF/GPS)가 제거됩니다.
          </Section>

          <Section title="2. 수집 목적">
            계정 식별, 결(피드/탐색) 제공, AI 성향 요약, 신고·차단을 통한 안전한
            커뮤니티 유지.
          </Section>

          <Section title="3. 보관 기간">
            회원 탈퇴 시 즉시 파기합니다. 단, 관계 법령에 따라 일정 기간 보관이
            필요한 정보는 해당 기간 동안만 보관 후 파기합니다.
          </Section>

          <Section title="4. 제3자 제공">
            법령에 따른 요청을 제외하고는 제3자에게 제공하지 않습니다.
            인증·저장·AI 처리는 Google Cloud(Supabase 기반)와 Lovable AI 인프라를
            이용하며, 그 외 외부 처리는 없습니다.
          </Section>

          <Section title="5. 회원의 권리">
            언제든지 본인의 정보를 열람·수정·삭제할 수 있으며, 계정 삭제로 모든
            데이터의 파기를 요청할 수 있어요.
          </Section>

          <Section title="6. 안전조치">
            전송 구간 암호화(HTTPS), 접근 권한 분리, 행 단위 보안(RLS) 정책으로
            데이터를 보호합니다.
          </Section>

          <Section title="7. 문의">
            개인정보 보호 책임자: support@gyeol.app
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
