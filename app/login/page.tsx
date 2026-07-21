import LoginForm from "@/components/admin/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold">Admin Login</h1>
        <p className="mt-2 text-neutral-400">
          Enter the admin password.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}