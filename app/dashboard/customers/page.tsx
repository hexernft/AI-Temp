"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  business_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  business_name?: string | null;
  business_type?: string | null;
  conversation_count?: number;
  latest_conversation_id?: string | null;
  latest_conversation_status?: string | null;
  latest_conversation_handoff?: boolean | null;
  latest_message_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadCustomers() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/customers", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load customers.");
      }

      setCustomers(result.customers || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load customers."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) => {
      const name = customer.name || "";
      const phone = customer.phone || "";
      const email = customer.email || "";
      const businessName = customer.business_name || "";

      return (
        name.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        businessName.toLowerCase().includes(query)
      );
    });
  }, [customers, searchQuery]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Users className="h-3.5 w-3.5" />
            Customer Directory
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Customers
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                View customers captured from WhatsApp conversations and quickly
                open their latest chat.
              </p>
            </div>

            <button
              onClick={loadCustomers}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </section>

        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="rounded-full bg-white/10 px-3 py-1">
                Total: {customers.length}
              </span>

              <span className="rounded-full bg-white/10 px-3 py-1">
                Showing: {filteredCustomers.length}
              </span>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, phone, email, business..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
              Loading customers...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
              No customers found.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCustomers.map((customer) => (
                <article
                  key={customer.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                          <User className="h-3.5 w-3.5" />
                          Customer
                        </span>

                        {customer.latest_conversation_handoff ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Handoff
                          </span>
                        ) : null}
                      </div>

                      <h3 className="truncate text-lg font-semibold text-white">
                        {customer.name || "Unknown Customer"}
                      </h3>

                      <div className="mt-3 grid gap-2 text-sm text-slate-400">
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-emerald-400" />
                          {customer.phone || "No phone"}
                        </p>

                        <p className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-emerald-400" />
                          {customer.email || "No email"}
                        </p>

                        <p className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-emerald-400" />
                          {customer.business_name || "Business"}
                        </p>

                        <p className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-emerald-400" />
                          {customer.conversation_count || 0} conversation
                          {(customer.conversation_count || 0) === 1 ? "" : "s"}
                        </p>

                        <p className="text-xs text-slate-500">
                          Last message: {formatDate(customer.latest_message_at)}
                        </p>
                      </div>
                    </div>

                    {customer.latest_conversation_id ? (
                      <Link
                        href={`/dashboard/conversations/${customer.latest_conversation_id}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                      >
                        Open Latest Chat
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-500">
                        No chat yet
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}