import { useEffect, useState } from "react";
import { StorageImg } from "@/components/storage-img";

export type MenuItem = { key: string; label: string; onClick: () => void };

/** Top-right avatar with a dropdown menu (replaces the removed tab bar's "나"). */
export function AvatarMenu({ avatar, initial, items }: { avatar?: string | null; initial: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <>
      <button
        className="fl-icn me"
        aria-label="메뉴"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{ overflow: "hidden", padding: 0 }}
      >
        {avatar ? <StorageImg src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
      </button>
      {open && (
        <div className="fl-menu" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <div key={it.key}>
              {it.key === "logout" && <div className="fl-menu-sep" />}
              <button
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
