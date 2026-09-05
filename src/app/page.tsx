import { auth } from "@clerk/nextjs/server";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default async function Home() {
  // Resource-based auth check (Clerk's current recommendation over
  // middleware path matching) — this page is the protected resource, so it
  // decides for itself, redirecting to /sign-in if there's no session.
  await auth.protect();

  return (
    <div className="flex flex-1 flex-col h-screen">
      <ChatWorkspace />
    </div>
  );
}
