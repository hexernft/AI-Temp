"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const tasks = [
  { title: "AI sales assistant", progress: "1/5 completed", width: "42%" },
  { title: "Customer conversations", progress: "3/5 completed", width: "74%" },
  { title: "Order tracking", progress: "4/5 completed", width: "88%" },
];

const categories = ["WhatsApp AI", "Orders", "Handoff"];
const files = ["Knowledge_base.pdf", "Customer_flow.ai", "Order_summary.ai", "Business_rules.ai"];

export default function HomePage() {
  const [isChecking, setIsChecking] = useState(true);
  const [isEntering, setIsEntering] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        window.location.replace("/dashboard");
        return;
      }

      setIsChecking(false);
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  function enterDashboard() {
    if (isEntering) return;

    setIsEntering(true);

    window.setTimeout(() => {
      window.location.href = "/login";
    }, 450);
  }

  if (isChecking) {
    return (
      <main className="mobile-ui-stage flex min-h-screen items-center justify-center px-4">
        <div className="mobile-ui-card flex items-center gap-3 px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm font-semibold text-[var(--text-soft)]">
            Loading platform...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-ui-stage relative overflow-hidden">
      <span className="premium-orb left-[12%] top-[12%] text-blue-400" />
      <span className="premium-orb right-[14%] top-[16%] text-fuchsia-400" />
      <span className="premium-orb bottom-[18%] right-[34%] text-emerald-400" />

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-6 lg:grid-cols-[0.82fr_1fr_0.92fr]">
        <div className="mobile-ui-card min-h-[46rem] p-5">
          <header className="mb-7 flex items-center justify-between">
            <button className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--surface-blue)] text-blue-500">
              <Menu className="h-4 w-4" />
            </button>
            <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-lg">
              <Bell className="h-4 w-4 text-[var(--text-soft)]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500" />
            </div>
          </header>

          <div className="mb-7 flex items-center gap-4">
            <div className="mobile-avatar h-16 w-16">WA</div>
            <div>
              <p className="text-sm font-black text-[var(--text-main)]">Hi there!</p>
              <h1 className="text-lg font-black text-[var(--text-main)]">
                WhatsApp AI Platform
              </h1>
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                Good morning!
              </p>
            </div>
          </div>

          <div className="mb-7 flex items-center gap-3 rounded-xl bg-[var(--surface-blue)] px-4 py-3">
            <input
              className="bg-transparent p-0 text-sm outline-none"
              placeholder="Search conversations"
              readOnly
            />
            <Search className="h-4 w-4 text-blue-500" />
          </div>

          <p className="mb-3 text-sm font-black text-[var(--text-main)]">Tasks</p>

          <div className="mobile-task-card mb-5 flex items-center gap-4 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-blue-500">Add a new task</p>
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                Create your next workflow
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.title} className="mobile-task-card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-[var(--text-main)]">{task.title}</p>
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                      Small description
                    </p>
                  </div>
                  <span className="rounded-xl bg-[var(--surface-blue)] px-3 py-1 text-[10px] font-black text-blue-500">
                    {task.progress}
                  </span>
                </div>
                <div className="premium-metric-bar">
                  <span style={{ width: task.width }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mobile-ui-card overflow-hidden">
          <div className="mobile-ui-hero p-6 pb-20">
            <div className="mb-12 flex items-center justify-between">
              <Link href="/login" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
                <ArrowRight className="h-4 w-4 rotate-180" />
              </Link>
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              </div>
            </div>

            <div className="max-w-md">
              <div className="premium-pill mb-5 gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Premium workspace
              </div>
              <h2 className="text-5xl font-black leading-[0.95] tracking-[-0.06em] text-white md:text-6xl">
                Dashboard panel for WhatsApp AI.
              </h2>
              <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-white/78">
                Conversations, customers, orders, schools, pupils, knowledge base,
                AI testing and analytics in one clean command center.
              </p>
            </div>
          </div>

          <div className="-mt-12 rounded-t-[2.2rem] bg-white p-6">
            <div className="mb-5 flex items-center justify-between text-xs font-black text-[var(--text-muted)]">
              <span>1/5 completed</span>
              <span>Live workspace</span>
            </div>
            <div className="premium-metric-bar mb-7">
              <span style={{ width: "64%" }} />
            </div>

            <p className="mb-3 text-sm font-black text-[var(--text-main)]">Categories</p>
            <div className="mb-7 flex flex-wrap gap-2">
              {categories.map((category, index) => (
                <span
                  key={category}
                  className={`rounded-full px-3 py-1.5 text-xs font-black ${
                    index === 0
                      ? "bg-[var(--purple-soft)] text-[var(--purple-strong)]"
                      : index === 1
                        ? "bg-[var(--orange-soft)] text-[#c56f18]"
                        : "bg-[var(--green-soft)] text-[#239c5c]"
                  }`}
                >
                  {category}
                </span>
              ))}
            </div>

            <p className="mb-3 text-sm font-black text-[var(--text-main)]">Team</p>
            <div className="mb-8 flex gap-3">
              {["AD", "BO", "ST"].map((item) => (
                <div key={item} className="mobile-avatar h-12 w-12 shadow-lg">
                  {item}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={enterDashboard}
                disabled={isEntering}
                className="action-link-primary gap-2 px-5 py-3"
              >
                {isEntering ? "Opening" : "Enter Dashboard"}
                {isEntering ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
              <Link href="/admin-login" className="action-link-secondary px-5 py-3">
                Admin Login
              </Link>
            </div>
          </div>
        </div>

        <div className="mobile-ui-card hidden min-h-[46rem] overflow-hidden lg:block">
          <div className="mobile-ui-hero p-6 pb-16">
            <div className="mb-10 flex items-center justify-between">
              <Link href="/login" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
                <ArrowRight className="h-4 w-4 rotate-180" />
              </Link>
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              </div>
            </div>
            <h2 className="max-w-xs text-4xl font-black leading-none tracking-[-0.055em] text-white">
              AI-assisted customer operations
            </h2>
          </div>

          <div className="-mt-10 rounded-t-[2.2rem] bg-white p-6">
            <div className="mb-7 flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-blue)] text-blue-500">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Deadline</p>
                <p className="font-black text-[var(--text-main)]">August 20th</p>
              </div>
              <div className="ml-auto mobile-avatar h-14 w-14">AI</div>
            </div>

            <p className="mb-7 text-sm font-semibold leading-6 text-[var(--text-muted)]">
              Train the model with business rules, answer customers faster, create
              order summaries, and keep every team member aligned.
            </p>

            <p className="mb-3 text-sm font-black text-[var(--text-main)]">Files</p>
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file} className="mobile-task-card flex items-center gap-3 p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-soft)] text-blue-500">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--text-main)]">{file}</p>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)]">August, 18th</p>
                  </div>
                  <Download className="h-4 w-4 text-blue-500" />
                </div>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3">
              {[MessageCircle, UsersRound, CheckCircle2].map((Icon, index) => (
                <div key={index} className="mobile-task-card grid place-items-center p-4">
                  <Icon className="h-5 w-5 text-blue-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
