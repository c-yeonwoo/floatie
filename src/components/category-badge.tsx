type Props = {
  category?: string | null;
  className?: string;
  /**
   * When provided, the badge renders as a clickable button.
   * The page passes a handler that toggles a `?category=` filter on the current route.
   */
  onClick?: (category: string) => void;
  /** Visual state: when this badge matches the active filter, give it a filled treatment. */
  active?: boolean;
};

const BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-widest uppercase transition-colors";

/**
 * Small pill badge for question categories (취향, 순간, 감정 등).
 * Used wherever a question is rendered so the user can read the tone at a glance.
 * Pass `onClick` to make it a filter toggle.
 */
export function CategoryBadge({
  category,
  className = "",
  onClick,
  active = false,
}: Props) {
  if (!category) return null;

  const tone = active
    ? "border-accent bg-accent text-accent-foreground"
    : "border-accent/40 bg-accent/8 text-accent";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick(category);
        }}
        className={`${BASE} ${tone} hover:bg-accent/20 ${className}`}
        aria-pressed={active}
      >
        {category}
      </button>
    );
  }
  return <span className={`${BASE} ${tone} ${className}`}>{category}</span>;
}

/**
 * "필터: 취향 ✕" chip shown at top of filtered pages.
 */
export function CategoryFilterChip({
  category,
  onClear,
}: {
  category: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-[12px] text-foreground hover:bg-foreground/10 transition-colors"
    >
      <span className="text-muted-foreground">필터</span>
      <span className="font-medium">{category}</span>
      <span aria-hidden className="text-muted-foreground">✕</span>
    </button>
  );
}
