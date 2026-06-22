"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/workers/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_active")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        router.push("/workers/login");
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        alert("Your WelCare account has been deactivated.");
        router.push("/workers/login");
        return;
      }

      setChecking(false);
    }

    checkUser();
  }, [router]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-[var(--text-main)]">
        <div className="dark-card glow-border max-w-sm rounded-3xl p-8 text-center shadow-xl">
          <p className="text-lg font-black">Checking access...</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Please wait while we open your dashboard.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}