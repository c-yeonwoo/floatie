import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "알림 — Ditto" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border">
        <Link to="/feed" className="text-[11px] uppercase tracking-widest text-muted-foreground">
          ← 돌아가기
        </Link>
        <h2 className="font-serif text-xl mt-1 leading-snug">알림</h2>
      </header>
      <section className="px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">
          아직 알림이 없어요.
        </p>
        <p className="text-[12px] text-muted-foreground mt-2">
          누군가 당신의 결에 반응하면 여기에 모일 거예요.
        </p>
      </section>
    </main>
  );
}
