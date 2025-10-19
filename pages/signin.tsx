// pages/signin.tsx
import PhoneAuth from "@/components/PhoneAuth";

export default function SignIn() {
  return (
    <main className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl items-start justify-center p-6">
        <div className="mt-16 w-full flex justify-center">
          <PhoneAuth />
        </div>
      </div>
    </main>
  );
}
