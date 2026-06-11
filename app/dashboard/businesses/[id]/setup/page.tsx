"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
  Settings2,
  TestTube2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Business = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  created_at: string | null;
  conversations_count?: number;
  leads_count?: number;
  knowledge_items_count?: number;
  setup_percentage?: number;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "business_owner" | "staff" | string;
};

type KnowledgeItem = {
  id: string;
  business_id: string;
  title: string;
  category: string | null;
  content: string;
  created_at: string;
};

type PhoneNumber = {
  id: string;
  phone_number: string | null;
  display_phone_number: string | null;
  is_active: boolean | null;
};

type SetupStep = {
  title: string;
  description: string;
  completed: boolean;
  actionLabel: string;
  actionHref: string;
};

function getBusinessName(business: Business | null) {
  if (!business) return "Business";
  return business.name || business.type || "Business";
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function BusinessSetupPage() {
  const params = useParams();
  const businessId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadSetup() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch("/api/dashboard/businesses", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load business setup.");
        }

        const loadedProfile = data.profile as Profile | null;
        const businesses = (data.businesses || []) as Business[];
        const foundBusiness = businesses.find((item) => item.id === businessId);

        if (!loadedProfile) {
          throw new Error("Your user profile was not found.");
        }

        if (!foundBusiness) {
          throw new Error("Business not found or you do not have access to it.");
        }

        setProfile(loadedProfile);
        setBusiness(foundBusiness);
        setConversationCount(foundBusiness.conversations_count || 0);
        setLeadCount(foundBusiness.leads_count || 0);

        const [knowledgeResult, phoneNumberResult] = await Promise.all([
          supabase
            .from("business_knowledge")
            .select("id, business_id, title, category, content, created_at")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
          supabase
            .from("business_phone_numbers")
            .select("id, phone_number, display_phone_number, is_active")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
        ]);

        if (knowledgeResult.error) {
          throw new Error(knowledgeResult.error.message);
        }

        if (phoneNumberResult.error) {
          throw new Error(phoneNumberResult.error.message);
        }

        setKnowledgeItems((knowledgeResult.data || []) as KnowledgeItem[]);
        setPhoneNumbers((phoneNumberResult.data || []) as PhoneNumber[]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Setup guide could not be loaded."
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (businessId) {
      loadSetup();
    }
  }, [businessId]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07131f] text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 size={20} className="animate-spin" />
          Loading setup guide...
        </div>
      </main>
    );
  }

  if (errorMessage || !business) {
    return (
      <main className="min-h-screen bg-[#07131f] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard/businesses"
            className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Businesses
          </Link>

          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-200 shadow-xl">
            {errorMessage || "Setup guide could not be loaded."}
          </section>
        </div>
      </main>
    );
  }

  const canEditBusiness =
    profile?.role === "super_admin" || profile?.role === "business_owner";

  const activePhoneNumbers = phoneNumbers.filter((item) => item.is_active);

  const setupSteps: SetupStep[] = [
    {
      title: "Business profile",
      description:
        "Add the business name, type, description, phone, WhatsApp, email, and location.",
      completed: Boolean(
        business.name &&
          business.type &&
          business.description &&
          (business.phone || business.whatsapp || business.email) &&
          business.location
      ),
      actionLabel: "Edit business",
      actionHref: `/dashboard/businesses/${business.id}/edit`,
    },
    {
      title: "Knowledge base",
      description:
        "Add products, services, prices, FAQs, policies, and customer instructions for the assistant.",
      completed: knowledgeItems.length > 0,
      actionLabel: "Manage knowledge",
      actionHref: `/dashboard/businesses/${business.id}/knowledge`,
    },
    {
      title: "WhatsApp number",
      description:
        "Connect at least one active WhatsApp number in the WhatsApp Numbers page.",
      completed: activePhoneNumbers.length > 0,
      actionLabel: "Manage numbers",
      actionHref: "/dashboard/whatsapp-numbers",
    },
    {
      title: "Test assistant",
      description:
        "Send a sample customer message and confirm the AI answers with the correct business context.",
      completed: false,
      actionLabel: "Open test chat",
      actionHref: `/dashboard/businesses/${business.id}/test-chat`,
    },
  ];

  const completedSteps = setupSteps.filter((step) => step.completed).length;
  const setupPercentage = Math.round((completedSteps / setupSteps.length) * 100);

  return (
    <main className="min-h-screen bg-[#07131f] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/dashboard/businesses/${business.id}`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Business
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/dashboard/businesses/${business.id}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#162c45]"
            >
              <Settings2 size={16} />
              Edit Profile
            </Link>
            <Link
              href={`/dashboard/businesses/${business.id}/test-chat`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              <TestTube2 size={16} />
              Test Chat
            </Link>
          </div>
        </nav>

        <section className="mb-5 rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <ClipboardList size={24} />
          </div>

          <p className="mb-3 text-sm font-medium text-emerald-300">
            Setup guide
          </p>

          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Prepare {getBusinessName(business)} for WhatsApp AI.
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
            This page now follows the current schema and checks the linked
            tables for knowledge items and WhatsApp numbers instead of relying
            on removed columns from the businesses table.
          </p>
        </section>

        <section className="mb-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm text-slate-400">Setup</p>
            <h2 className="mt-3 text-3xl font-bold text-white">
              {setupPercentage}%
            </h2>
            <p className="mt-3 text-sm text-slate-500">
              {completedSteps} of {setupSteps.length} core steps complete
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <Bot size={24} />
            </div>
            <p className="text-sm text-slate-400">Knowledge</p>
            <h2 className="mt-3 text-3xl font-bold text-white">
              {knowledgeItems.length}
            </h2>
            <p className="mt-3 text-sm text-slate-500">Training entries</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <MessageCircle size={24} />
            </div>
            <p className="text-sm text-slate-400">Conversations</p>
            <h2 className="mt-3 text-3xl font-bold text-white">
              {conversationCount}
            </h2>
            <p className="mt-3 text-sm text-slate-500">Chats tracked</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <UserRoundCheck size={24} />
            </div>
            <p className="text-sm text-slate-400">Leads</p>
            <h2 className="mt-3 text-3xl font-bold text-white">{leadCount}</h2>
            <p className="mt-3 text-sm text-slate-500">Customer requests</p>
          </div>
        </section>

        <section className="mb-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
                <ClipboardList size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Setup Steps</h2>
                <p className="text-sm text-slate-400">
                  Complete each step before going live.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {setupSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-[#122338] p-4"
                >
                  <div className="flex gap-3">
                    <div
                      className={`mt-1 ${
                        step.completed ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {step.completed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">{step.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            {step.description}
                          </p>
                        </div>

                        {(canEditBusiness || step.actionHref.includes("/knowledge") || step.actionHref.includes("/test-chat")) ? (
                          <Link
                            href={step.actionHref}
                            className="shrink-0 rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#162c45]"
                          >
                            {step.actionLabel}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Current Business Data
                  </h2>
                  <p className="text-sm text-slate-400">
                    Values saved in the current businesses table
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Name" value={business.name || "Not saved"} />
                <InfoCard label="Type" value={business.type || "Not saved"} />
                <InfoCard label="Phone" value={business.phone || "Not saved"} />
                <InfoCard label="WhatsApp" value={business.whatsapp || "Not saved"} />
                <InfoCard label="Email" value={business.email || "Not saved"} />
                <InfoCard label="Location" value={business.location || "Not saved"} />
                <InfoCard label="Created" value={formatDate(business.created_at)} />
                <InfoCard
                  label="Active WhatsApp numbers"
                  value={String(activePhoneNumbers.length)}
                />
              </div>

              {business.description ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#122338] p-4">
                  <p className="mb-2 text-sm text-slate-500">Description</p>
                  <p className="text-sm leading-6 text-slate-200">
                    {business.description}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
                  <Phone size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    WhatsApp Connection
                  </h2>
                  <p className="text-sm text-slate-400">
                    Managed through the WhatsApp Numbers table
                  </p>
                </div>
              </div>

              {phoneNumbers.length > 0 ? (
                <div className="space-y-3">
                  {phoneNumbers.map((number) => (
                    <div
                      key={number.id}
                      className="rounded-2xl border border-white/10 bg-[#122338] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {number.display_phone_number || number.phone_number || "WhatsApp number"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {number.is_active ? "Active" : "Inactive"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            number.is_active
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-red-500/10 text-red-300"
                          }`}
                        >
                          {number.is_active ? "Connected" : "Needs review"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                  No WhatsApp number has been linked yet. Add one from the
                  WhatsApp Numbers page before testing live WhatsApp messages.
                </p>
              )}
            </section>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Recommended Go-Live Test</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Before presenting the assistant to a client, test the AI reply inside
            the dashboard, then test a real WhatsApp message from a customer phone.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <GuideCard title="1. Add knowledge" text="Add products, prices, FAQs, delivery details, and policies." />
            <GuideCard title="2. Link number" text="Add and activate the business WhatsApp number." />
            <GuideCard title="3. Test AI" text="Use the test chat to confirm the assistant answers correctly." />
            <GuideCard title="4. Test live" text="Send a real WhatsApp message and check the inbox." />
          </div>

          <a
            href="https://business.facebook.com/settings"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#122338] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#162c45]"
          >
            Open Meta Business Settings
            <ExternalLink size={15} />
          </a>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#122338] p-4">
      <p className="mb-2 text-sm text-slate-500">{label}</p>
      <p className="break-words text-sm text-slate-200">{value}</p>
    </div>
  );
}

function GuideCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#122338] p-4">
      <p className="mb-2 font-semibold text-white">{title}</p>
      <p className="text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}
