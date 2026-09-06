import { auth } from "@clerk/nextjs/server";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default async function Home() {
  // Resource-based auth check (Clerk's current recommendation over
  // middleware path matching) — this page is the protected resource, so it
  // decides for itself, redirecting to /sign-in if there's no session.
  await auth.protect();

  // h-screen + overflow-hidden, and deliberately NOT flex-1: as a flex item
  // of <body>, flex-1 would reset flex-basis to 0 and let min-height:auto
  // grow this past the viewport, which is what breaks every percentage
  // height below it. overflow-hidden is what makes min-height:auto resolve
  // to 0 here, so this container can never grow past one screen.
  return (
    <div className="h-screen overflow-hidden">
      <ChatWorkspace />
    </div>
  );
}
