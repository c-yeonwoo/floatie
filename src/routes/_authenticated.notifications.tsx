import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "알림 — 숨결" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <Link to="/feed" className="text-sm text-muted-foreground">← 뒤로</Link>
        <h1 className="font-serif text-lg tracking-tight">알림</h1>
        <span className="w-10" />
      </header>

      <section className="px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">
          아직 알림이 없어요.
        </p>
        <p className="text-[12px] text-muted-foreground mt-2">
          누군가 당신의 숨에 반응하면 여기에 모일 거예요.
        </p>
      </section>
    </main>
  );
}
