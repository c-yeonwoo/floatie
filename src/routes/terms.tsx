import { createFileRoute, Link } from "@tanstack/react-router";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: pageTitle("이용약관") },
      { name: "description", content: "플로티(Floatie) 서비스 이용약관." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="fixed inset-0 bg-background text-foreground overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-6 py-12 min-h-[100dvh]">
        <Link to="/login" className="text-[11px] uppercase tracking-widest text-muted-foreground">
          ← 돌아가기
        </Link>
        <h1 className="font-serif text-3xl mt-4 mb-8">이용약관</h1>
        <div className="space-y-6 text-sm leading-relaxed text-foreground/80">
          <p className="text-muted-foreground">초안 · 서비스명 “플로티(Floatie)” · 법률 문안 확정 전</p>

          <Section title="1. 목적">
            본 약관은 플로티(Floatie)(이하 “서비스”)가 제공하는 익명 미션·상호 인정 기반
            라이트 소셜 서비스의 이용 조건과 절차를 정합니다.
          </Section>

          <Section title="2. 회원가입과 계정">
            만 18세 이상만 가입할 수 있습니다. 계정 정보는 본인이 관리하며
            타인에게 양도할 수 없습니다.
          </Section>

          <Section title="3. 미션과 콘텐츠">
            회원이 작성·답장한 미션과 메시지의 책임은 회원에게 있습니다.
            불쾌·성적·혐오·불법 콘텐츠는 금지되며, 신고 시 삭제·이용 제한될 수
            있습니다.
          </Section>

          <Section title="4. 금지 행위">
            스팸, 사칭, 스토킹성 재매칭 시도, 개인정보 무단 요구, 자동화 남용 등을
            금지합니다.
          </Section>

          <Section title="5. 서비스 변경·종료">
            서비스는 사전 고지 후 변경·종료될 수 있으며, 회원은 언제든 탈퇴할 수
            있습니다.
          </Section>

          <Section title="6. 문의">
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
