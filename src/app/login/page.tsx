import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Sign in · KidLog" };

export default async function Login({
  searchParams,
}: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-16">
      <p className="text-4xl font-semibold tracking-tight text-brand">KidLog</p>
      <h1 className="mt-3 text-xl text-ink">One shared timeline for everyone who looks after your child.</h1>
      <div className="mt-10">
        <LoginForm next={next} linkFailed={Boolean(error)} />
      </div>
    </main>
  );
}
