"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function QRCodePage() {
  const welcomeUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/welcome`;
  }, []);

  function handlePrint() {
    window.print();
  }

  async function handleCopy() {
    if (!welcomeUrl) return;

    try {
      await navigator.clipboard.writeText(welcomeUrl);
      alert("First timer form link copied.");
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
                  QR Code
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  First timer form QR
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Display, print, or copy the QR code that sends first timers
                  directly to the public welcome form.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800"
                >
                  Print QR
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
                >
                  Copy Link
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
                  First Timer Form
                </h2>

                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  Scan to fill the church welcome form.
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
                  No registration required
                </p>
              </div>
            </div>

            <div className="grid gap-4 print:hidden">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  How to use it
                </h2>

                <div className="mt-3 grid gap-2">
                  <Instruction
                    number="1"
                    title="Display during welcome"
                    text="Show the QR code on screen when welcoming first timers."
                  />

                  <Instruction
                    number="2"
                    title="Print for welcome cards"
                    text="Place it on cards, flyers, seat cards, or the reception desk."
                  />

                  <Instruction
                    number="3"
                    title="Let the form capture details"
                    text="Visitors scan, fill, submit, and their interaction ends there."
                  />

                  <Instruction
                    number="4"
                    title="Workers continue from dashboard"
                    text="Logged-in workers handle assignments, follow-up, and growth tracking."
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Form link
                </h2>

                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  The QR code points to the current site URL plus{" "}
                  <span className="font-black text-slate-800">/welcome</span>.
                  On Vercel, it will automatically use your live domain.
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
            </div>
          </section>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Instruction({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[11px] font-black text-white">
        {number}
      </div>

      <div>
        <p className="text-[0.85rem] font-black text-slate-800">{title}</p>
        <p className="mt-0.5 text-[0.78rem] leading-5 text-slate-500">{text}</p>
      </div>
    </div>
  );
}