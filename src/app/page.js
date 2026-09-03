import Link from "next/link";
import { siteName } from "@/lib/site-config";

// Minimal entry page: the application UI lives in the static dashboard.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{siteName()}</h1>
      <a
        href="/dashboard.html"
        className="rounded-full border border-current px-5 py-3 text-base font-medium"
      >
        Open the dashboard
      </a>
      <footer className="mt-8 text-sm opacity-70">
        <Link href="/privacy" className="underline">Privacy · Confidentialité</Link>
      </footer>
    </main>
  );
}
