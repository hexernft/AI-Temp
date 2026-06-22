"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function WorkerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="worker-login-page min-h-screen px-4 py-8 text-slate-100">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="dark-card glow-border grid overflow-hidden rounded-[2rem] lg:grid-cols-[1fr_0.86fr]">
          <div className="relative hidden min-h-[620px] overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -left-20 top-12 h-64 w-64 rounded-full bg-[var(--brand-green-soft)] blur-3xl" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[var(--brand-green-soft)] blur-3xl" />

            <div className="relative z-10">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg shadow-blue-500/10">
                <Image
                  src="/image/welcare-logo.png"
                  alt="WelCare logo"
                  fill
                  sizes="48px"
                  className="object-contain p-1.5"
                  priority
                />
              </div>

              <div className="mt-10 inline-flex rounded-full border border-black/10 bg-white px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[var(--brand-green)]">
                Worker Access
              </div>

              <h1 className="mt-4 max-w-xl font-display text-[3.2rem] font-black leading-[1.02] tracking-[-0.065em] text-white">
                WelCare church care command center.
              </h1>

              <p className="mt-4 max-w-md text-[0.95rem] leading-7 text-slate-400">
                Manage first timers, follow-up assignments, foundation school,
                baptism, reports, and growth tracking from one secure dashboard.
              </p>
            </div>

            <div className="relative z-10">
              <div className="grid grid-cols-3 gap-3">
                <LoginStat label="Care" value="Track" />
                <LoginStat label="Growth" value="Guide" />
                <LoginStat label="Reports" value="Review" />
              </div>
            </div>
          </div>

          <div className="border-black/10 p-5 md:p-8 lg:border-l">
            <div className="mx-auto flex min-h-[560px] max-w-sm flex-col justify-center">
              <div className="mb-7 flex items-center justify-between lg:hidden">
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <Image
                    src="/image/welcare-logo.png"
                    alt="WelCare logo"
                    fill
                    sizes="48px"
                    className="object-contain p-1.5"
                    priority
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--brand-green)]">
                  Worker Login
                </p>

                <h1 className="mt-2 font-display text-[2rem] font-black leading-tight tracking-[-0.055em] text-white">
                  Sign in to WelCare
                </h1>

                <p className="mt-2 text-[0.88rem] leading-6 text-slate-400">
                  Secure access for welcome team members, follow-up workers, and
                  church leaders.
                </p>
              </div>

              <form onSubmit={handleLogin} className="mt-7 grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[0.78rem] font-black text-slate-300">
                    Email address
                  </span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input-compact"
                    placeholder="worker@church.com"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[0.78rem] font-black text-slate-300">
                    Password
                  </span>

                  <div className="flex overflow-hidden rounded-xl border border-slate-500/25 bg-slate-900/70 transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.14)]">
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent px-3 py-2 text-[0.85rem] text-white outline-none placeholder:text-slate-500"
                      placeholder="Enter password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="border-l border-black/10 px-3 text-[11px] font-black text-slate-300 transition hover:bg-white"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 rounded-2xl bg-[var(--brand-green)] px-4 py-2.5 text-[11px] font-black text-white shadow-lg shadow-black/5 transition hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.15rem] font-black text-white">
        {value}
      </p>
    </div>
  );
}
