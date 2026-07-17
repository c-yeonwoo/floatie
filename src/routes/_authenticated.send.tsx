import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy send surface — Sea `/home` compose is canonical. */
export const Route = createFileRoute("/_authenticated/send")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
