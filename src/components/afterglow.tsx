import { useEffect } from "react";

type Props = {
  show: boolean;
  message?: string;
  subMessage?: string;
  durationMs?: number;
  onDone?: () => void;
};

/**
 * 잔향 화면. 답을 남긴 직후 짧은 여운을 주기 위한 풀스크린 오버레이.
 * - 호흡하는 점 애니메이션
 * - 본문 메시지는 명조체로
 * - durationMs 이후 onDone 호출
 */
export function Afterglow({
  show,
  message = "당신의 숨이 결에 더해졌어요",
  subMessage = "오늘 하루의 한 장",
  durationMs = 2200,
  onDone,
}: Props) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onDone?.(), durationMs);
    return () => clearTimeout(t);
  }, [show, durationMs, onDone]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background animate-fade-in"
      style={{ height: "var(--app-vh, 100dvh)" }}
      aria-live="polite"
      role="status"
    >
      <div className="relative h-24 w-24">
        <span className="absolute inset-0 rounded-full bg-foreground/10 animate-[pulse_2s_ease-in-out_infinite]" />
        <span className="absolute inset-3 rounded-full bg-foreground/15 animate-[pulse_2s_ease-in-out_infinite_0.2s]" />
        <span className="absolute inset-6 rounded-full bg-foreground/60" />
      </div>
      <p className="font-serif text-xl mt-10 text-foreground text-center px-8 text-balance break-keep [word-break:keep-all]">
        {message}
      </p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-3">
        {subMessage}
      </p>
    </div>
  );
}
