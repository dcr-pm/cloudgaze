export const metadata = { title: "Offline · KidLog" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">You're offline</h1>
      <p className="text-muted">KidLog needs a connection to load the timeline. It will be here when you're back.</p>
      <a href="/" className="mt-4 rounded-2xl bg-brand px-6 py-4 text-lg font-semibold text-white">Try again</a>
    </main>
  );
}
