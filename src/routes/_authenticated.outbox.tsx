import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy outbox list — Sea history overlay is canonical. */
export const Route = createFileRoute("/_authenticated/outbox")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
