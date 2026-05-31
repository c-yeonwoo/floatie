import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "이용약관 — 결" },
      { name: "description", content: "결 서비스 이용약관." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link to="/login" className="text-[11px] uppercase tracking-widest text-muted-foreground">
          ← 돌아가기
        </Link>
        <h1 className="font-serif text-3xl mt-4 mb-8">이용약관</h1>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/80">
          <p className="text-muted-foreground">시행일: 2026년 5월 31일</p>

          <Section title="1. 목적">
            본 약관은 결(이하 “서비스”)이 제공하는 사진 기반 성향 공유 서비스의
            이용 조건과 절차, 회원과 회사의 권리·의무를 정함을 목적으로 합니다.
          </Section>

          <Section title="2. 회원가입과 계정">
            만 14세 이상이라면 누구나 이메일 또는 Google 계정으로 가입할 수 있어요.
            본인 계정 정보는 직접 안전하게 관리해야 하며, 타인에게 양도할 수 없어요.
          </Section>

          <Section title="3. 게시물">
            회원이 업로드한 사진과 글의 저작권은 회원에게 있으며, 회원은 서비스가
            결을 보여주는 데 필요한 범위에서 비독점적 이용을 허락합니다.
            타인의 권리를 침해하거나 음란·폭력·혐오·불법 콘텐츠 게시는 금지되며,
            발견 시 사전 통지 없이 삭제·계정 정지될 수 있어요.
          </Section>

          <Section title="4. 금지 행위">
            도배·스팸, 타인 사칭, 비인가 자동화, 부정 접근, 차별·괴롭힘 등은
            금지됩니다. 위반 시 경고 없이 게시물이 비공개·삭제될 수 있어요.
          </Section>

          <Section title="5. 서비스 변경·종료">
            서비스 일부 또는 전부를 사전 공지 후 변경하거나 종료할 수 있어요.
            회원은 언제든지 탈퇴할 수 있습니다.
          </Section>

          <Section title="6. 면책">
            서비스는 회원 간 다툼에 직접 개입하지 않으며, 천재지변·기술적 결함 등
            불가피한 사유로 발생한 손해에 대해 책임을 지지 않습니다.
          </Section>

          <Section title="7. 문의">
            문의: support@gyeol.app
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
