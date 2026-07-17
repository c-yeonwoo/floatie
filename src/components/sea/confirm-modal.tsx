export type ConfirmOpts = {
  em?: string;
  title: string;
  body?: string;
  yes?: string;
  no?: string;
  onOk: () => void;
};

/** Centered confirm dialog (sits above the note). Controlled by parent state. */
export function ConfirmModal({ opts, onClose }: { opts: ConfirmOpts | null; onClose: () => void }) {
  return (
    <div
      className={"fl-cf-scrim" + (opts ? " on" : "")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {opts && (
        <div className="fl-cf" role="dialog" aria-modal="true">
          <div className="em">{opts.em ?? "💛"}</div>
          <h4>{opts.title}</h4>
          {opts.body && <p>{opts.body}</p>}
          <div className="fl-cf-row">
            <button className="no" onClick={onClose}>
              {opts.no ?? "닫기"}
            </button>
            <button
              className="yes"
              onClick={() => {
                const fn = opts.onOk;
                onClose();
                fn();
              }}
            >
              {opts.yes ?? "확인"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
