import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (the
// exported function must be named `proxy`, not `middleware`, and a default
// export is not picked up) and dropped the Edge runtime for it — it now
// always runs on Node.js. clerkMiddleware()'s handler signature is
// runtime-agnostic, so it works unchanged under the new name.
//
// This used to gate "/" with createRouteMatcher()-based path matching, but
// Clerk now recommends against that (path-based middleware auth can diverge
// from how Next.js actually routes a request). Protection now lives on the
// page itself — see src/app/page.tsx — this just keeps Clerk's session
// context wired up for every request.
export const proxy = clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
