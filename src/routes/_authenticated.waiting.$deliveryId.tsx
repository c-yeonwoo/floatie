import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy waiting scene — Sea bottle via `?d=`. */
export const Route = createFileRoute("/_authenticated/waiting/$deliveryId")({
  beforeLoad: ({ params }) => {
    const n = Number(params.deliveryId);
    throw redirect({
      to: "/home",
      search: Number.isFinite(n) ? { d: n } : {},
    });
  },
});
