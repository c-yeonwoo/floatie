import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ReportTarget =
  | { type: "user"; userId: string }
  | { type: "delivery"; deliveryId: number; userId?: string }
  | { type: "message"; messageId: number; userId?: string };

const REASONS = [
  "불쾌·성적 미션/메시지",
  "혐오·차별·괴롭힘",
  "스팸 또는 광고",
  "사칭·개인정보 요구",
  "미성년 의심",
  "기타",
];

export function ReportDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("로그인이 필요해요.");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        reporter_id: uid,
        target_type: target.type,
        reason,
        detail: detail.trim() || null,
        status: "pending",
      };
      if (target.type === "user") payload.target_user_id = target.userId;
      if (target.type === "delivery") {
        payload.target_delivery_id = target.deliveryId;
        if (target.userId) payload.target_user_id = target.userId;
      }
      if (target.type === "message") {
        payload.target_message_id = target.messageId;
        if (target.userId) payload.target_user_id = target.userId;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("reports").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("신고가 접수됐어요. 관리자가 검토한 뒤 조치해요.");
      setDetail("");
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "신고를 보내지 못했어요."),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-background border border-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg mb-1">신고하기</h3>
        <p className="text-[12px] text-muted-foreground mb-5">
          신고된 계정은 관리자 검토 후 영구 제명될 수 있어요.
        </p>
        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-3 text-[14px] cursor-pointer">
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-foreground"
              />
              {r}
            </label>
          ))}
        </div>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="자세한 내용 (선택)"
          className="w-full bg-transparent border border-border rounded-lg p-3 text-[13px] outline-none focus:border-foreground/40 resize-none mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-[12px] text-muted-foreground px-3 py-2">
            취소
          </button>
          <button
            type="button"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="text-[12px] bg-foreground text-background px-4 py-2 rounded-md disabled:opacity-50"
          >
            {submit.isPending ? "보내는 중..." : "신고하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
