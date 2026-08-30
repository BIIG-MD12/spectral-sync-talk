import { createFileRoute } from "@tanstack/react-router";
import { CircleDot } from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "FluidTalk — Status" },
      { name: "description", content: "Share disappearing status updates with your FluidTalk contacts." },
      { property: "og:title", content: "FluidTalk — Status" },
      { property: "og:description", content: "Disappearing status updates on FluidTalk." },
    ],
  }),
  component: StatusScreen,
});

function StatusScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-24">
      <div className="glass-panel grid size-16 place-items-center rounded-3xl">
        <CircleDot className="size-7 text-primary" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">Status</h1>
      <p className="mt-2 max-w-xs text-center text-[13px] text-muted-foreground">
        Status updates are on the way. You'll soon share moments that disappear after 24 hours.
      </p>
    </main>
  );
}
