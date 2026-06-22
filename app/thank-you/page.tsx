import Image from "next/image";
import Link from "next/link";

export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-2xl items-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm md:p-6">
          <div className="mx-auto relative h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Image
              src="/image/welcare-logo.png"
              alt="WelCare logo"
              fill
              sizes="56px"
              className="object-contain p-1.5"
              priority
            />
          </div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Details Submitted
          </p>

          <h1 className="mt-2 font-display text-[1.8rem] font-black leading-tight tracking-[-0.05em] text-slate-950 md:text-[2rem]">
            Thank you for worshipping with us.
          </h1>

          <p className="mx-auto mt-3 max-w-md text-[0.9rem] leading-6 text-slate-500">
            Your details have been received successfully. Our welcome team will
            reach out to you through your preferred contact method.
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
            <p className="text-[0.82rem] font-black text-slate-800">
              What happens next?
            </p>

            <div className="mt-3 grid gap-2">
              <Step
                number="1"
                text="A welcome worker may contact you to check on you."
              />
              <Step
                number="2"
                text="You may receive information about services, next steps, or church programs."
              />
              <Step
                number="3"
                text="Your growth journey can be followed up with care and prayer."
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href="/welcome"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-50"
            >
              Submit Another Form
            </Link>

            <Link
              href="/workers/login"
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-slate-800"
            >
              Worker Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-xl bg-white p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-black text-white">
        {number}
      </div>

      <p className="text-[0.82rem] leading-5 text-slate-600">{text}</p>
    </div>
  );
}