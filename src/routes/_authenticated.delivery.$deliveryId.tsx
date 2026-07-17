import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy delivery detail — open Sea bottle via `?d=`. */
export const Route = createFileRoute("/_authenticated/delivery/$deliveryId")({
  beforeLoad: ({ params }) => {
    const n = Number(params.deliveryId);
    throw redirect({
      to: "/home",
      search: Number.isFinite(n) ? { d: n } : {},
    });
  },
});
