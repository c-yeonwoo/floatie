import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReportTarget =
  | { type: "answer"; answerId: number }
  | { type: "comment"; commentId: number }
  | { type: "user"; userId: string };

const REASONS = [
  "부적절한 사진 / 선정적",
  "혐오·차별·괴롭힘",
  "스팸 또는 광고",
  "타인 사칭 / 개인정보 노출",
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
      const payload: any = {
        reporter_id: uid,
        target_type: target.type,
        reason,
        detail: detail.trim() || null,
      };
      if (target.type === "answer") payload.target_answer_id = target.answerId;
      if (target.type === "comment") payload.target_comment_id = target.commentId;
      if (target.type === "user") payload.target_user_id = target.userId;
      const { error } = await supabase.from("reports").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("신고가 접수되었어요. 살펴볼게요.");
      setDetail("");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "신고를 보내지 못했어요."),
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
          어떤 점이 불편하셨나요?
        </p>
        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <label
              key={r}
              className="flex items-center gap-3 text-[14px] cursor-pointer"
            >
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
          <button
            onClick={onClose}
            className="text-[12px] text-muted-foreground px-3 py-2"
          >
            취소
          </button>
          <button
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
