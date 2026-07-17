import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** Textarea that grows with content — no inner scrollbar. */
export function AutoGrowTextarea({
  value,
  className,
  onChange,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const { style, ...restProps } = rest;
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={1}
      className={className}
      style={{ overflow: "hidden", resize: "none", ...style }}
      {...restProps}
    />
  );
}
