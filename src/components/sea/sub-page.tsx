import { useEffect, useState, type ReactNode } from "react";

/** Generic right-sliding sub-page (history / ticket shop). Slides in when open. */
export function SubPageOverlay({
  open,
  title,
  onBack,
  children,
}: {
  open: boolean;
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setOn(true));
      return () => cancelAnimationFrame(r);
    }
    setOn(false);
    const t = setTimeout(() => setMounted(false), 360);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return (
    <div className={"fl-page" + (on ? " on" : "")}>
      <div className="fl-page-top">
        <button className="bk" onClick={onBack} aria-label="뒤로">←</button>
        <h2>{title}</h2>
      </div>
      <div className="fl-page-body">{children}</div>
    </div>
  );
}
