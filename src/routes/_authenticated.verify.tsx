import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { confirmPhoneOtp, requestPhoneOtp } from "@/lib/safety";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({ meta: [{ title: "본인인증 — 플로티" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => requestPhoneOtp(phone),
    onSuccess: (res) => {
      setSentPhone(res.phone ?? phone);
      setDevCode(res.dev_code ?? null);
      toast.success(
        res.dev_code
          ? `인증번호를 보냈어요. (개발용: ${res.dev_code})`
          : "인증번호를 보냈어요.",
      );
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "실패";
      if (msg.includes("phone already used")) toast.error("이미 인증된 번호예요.");
      else if (msg.includes("invalid phone")) toast.error("휴대폰 번호를 확인해 주세요. (010…)");
      else if (msg.includes("rate limit")) toast.error("잠시 후 다시 시도해 주세요.");
      else toast.error(msg);
    },
  });

  const confirm = useMutation({
    mutationFn: () => confirmPhoneOtp(sentPhone ?? phone, code),
    onSuccess: () => {
      toast.success("본인인증이 완료됐어요.");
      qc.invalidateQueries({ queryKey: ["safety-profile"] });
      navigate({ to: "/home" });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "실패";
      if (msg.includes("mismatch")) toast.error("인증번호가 달라요.");
      else if (msg.includes("expired")) toast.error("인증번호가 만료됐어요. 다시 받아 주세요.");
      else toast.error(msg);
    },
  });

  return (
    <main className="px-6 py-10 max-w-sm mx-auto">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">본인인증</p>
      <h1 className="font-serif text-3xl mt-2">휴대폰 인증</h1>
      <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
        익명이어도 안전한 설렘을 위해, 미션을 주고받기 전에 휴대폰 본인인증이 필요해요.
        번호는 상대에게 공개되지 않아요.
      </p>

      <div className="mt-8 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">휴대폰 번호</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            inputMode="tel"
            className="mt-1 w-full rounded-xl border border-border px-3 py-3 text-[15px]"
          />
        </div>
        <button
          type="button"
          disabled={request.isPending || phone.replace(/\D/g, "").length < 10}
          onClick={() => request.mutate()}
          className="w-full rounded-full border border-border py-3 text-sm disabled:opacity-40"
        >
          {request.isPending ? "요청 중…" : "인증번호 받기"}
        </button>

        {sentPhone && (
          <>
            <div>
              <label className="text-xs text-muted-foreground">인증번호 6자리</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-border px-3 py-3 text-[15px] tracking-widest"
              />
              {devCode && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  개발 모드 코드: {devCode} (운영에서는 SMS로 발송)
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={confirm.isPending || code.length !== 6}
              onClick={() => confirm.mutate()}
              className="w-full rounded-full bg-foreground text-background py-3 text-sm disabled:opacity-40"
            >
              {confirm.isPending ? "확인 중…" : "인증 완료"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
