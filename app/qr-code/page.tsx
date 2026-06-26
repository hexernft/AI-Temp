"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";

type Programme = {
  id: string;
  name: string;
  slug: string;
  programme_date: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "No date set";

  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function QRCodePage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loadingProgrammes, setLoadingProgrammes] = useState(true);

  const welcomeUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/welcome`;
  }, []);

  useEffect(() => {
    async function loadProgrammes() {
      setLoadingProgrammes(true);

      const { data, error } = await supabase
        .from("programmes")
        .select("id, name, slug, programme_date")
        .eq("is_active", true)
        .order("programme_date", { ascending: false });

      if (error) {
        console.error("QR programmes load error:", error);
      }

      setProgrammes(data || []);
      setLoadingProgrammes(false);
    }

    loadProgrammes();
  }, []);

  async function handleCopy() {
    if (!welcomeUrl) return;

    try {
      await navigator.clipboard.writeText(welcomeUrl);
      alert("First timer form link copied.");
    } catch {
      alert("Could not copy link. Please copy it manually.");
    }
  }

  async function handleCopyProgramme(slug: string) {
    const programmeUrl = `${window.location.origin}/programmes/${slug}`;

    try {
      await navigator.clipboard.writeText(programmeUrl);
      alert("Programme form link copied.");
    } catch {
      alert("Could not copy link. Please copy it manually.");
    }
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  QR Codes
                </p>
                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  First timer form QR codes
                </h1>
                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Display, print, or copy QR codes for regular services and
                  special programme first-timer forms.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/programmes"
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                >
                  Manage Programmes
                </Link>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Copy Regular Link
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none">
              <div className="mx-auto max-w-[340px] rounded-2xl border border-slate-200 bg-white p-5 text-center print:border-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  WelCare
                </p>
                <h2 className="mt-1 font-display text-[1.35rem] font-black tracking-[-0.045em] text-slate-950">
                  Regular Service Form
                </h2>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  Scan to fill the regular church welcome form.
                </p>

                <div className="mx-auto mt-4 flex w-fit rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 print:shadow-none">
                  {welcomeUrl ? (
                    <QRCodeSVG
                      value={welcomeUrl}
                      size={230}
                      level="H"
                      includeMargin
                    />
                  ) : (
                    <div className="flex h-[230px] w-[230px] items-center justify-center rounded-xl bg-slate-50">
                      <p className="text-xs font-bold text-slate-500">
                        Loading QR...
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-4 break-all rounded-xl bg-slate-50 px-3 py-2 text-[0.75rem] font-semibold leading-5 text-slate-500">
                  {welcomeUrl || "Loading link..."}
                </p>

                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Regular service
                </p>
              </div>
            </div>

            <div className="grid gap-4 print:hidden">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Regular service link
                </h2>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  The regular service QR code points to the current site URL
                  plus{" "}
                  <span className="font-black text-slate-800">/welcome</span>.
                </p>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
                    Current link
                  </p>
                  <p className="mt-1 break-all text-[0.82rem] font-semibold text-slate-700">
                    {welcomeUrl || "/welcome"}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Programme forms
                </h2>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  Create a special programme to generate its own QR code and
                  track submissions separately from regular services.
                </p>
                <Link
                  href="/programmes"
                  className="mt-3 inline-flex rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                >
                  Manage Programme QR Codes
                </Link>
              </section>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <h2 className="font-display text-[1rem] font-black text-slate-950">
              Active programme QR codes
            </h2>
            <p className="mt-0.5 text-[0.78rem] leading-5 text-slate-500">
              These QR codes point visitors to programme-specific public forms.
            </p>

            {loadingProgrammes ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                Loading programme QR codes...
              </p>
            ) : programmes.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                No active programmes yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {programmes.map((programme) => {
                  const programmeUrl =
                    typeof window === "undefined"
                      ? `/programmes/${programme.slug}`
                      : `${window.location.origin}/programmes/${programme.slug}`;

                  return (
                    <div
                      key={programme.id}
                      className="rounded-2xl border border-slate-200 p-3"
                    >
                      <h3 className="font-display text-[0.98rem] font-black text-slate-950">
                        {programme.name}
                      </h3>
                      <p className="mt-0.5 text-[0.75rem] font-semibold text-slate-500">
                        {formatDate(programme.programme_date)}
                      </p>

                      <div className="mt-3 w-fit rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
                        <QRCodeSVG
                          value={programmeUrl}
                          size={140}
                          level="H"
                          includeMargin
                        />
                      </div>

                      <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-[0.72rem] font-semibold leading-5 text-slate-500">
                        {programmeUrl}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/programmes/${programme.slug}`}
                          className="rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleCopyProgramme(programme.slug)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
