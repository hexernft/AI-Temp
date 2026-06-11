"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Banknote,
  Building2,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UsersRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Analytics = {
  businesses: number;
  customers: number;
  conversations: number;
  handoffConversations: number;
  openConversations: number;
  closedConversations: number;
  archivedConversations: number;
  orders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  paidOrderValue: number;
  pendingPaymentValue: number;
  totalOrderValue: number;
};

const emptyAnalytics: Analytics = {
  businesses: 0,
  customers: 0,
  conversations: 0,
  handoffConversations: 0,
  openConversations: 0,
  closedConversations: 0,
  archivedConversations: 0,
  orders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  paidOrderValue: 0,
  pendingPaymentValue: 0,
  totalOrderValue: 0,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value || 0);
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  const [role, setRole] = useState<string | null>(null);

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

  async function loadAnalytics() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/analytics", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load analytics.");
      }

      setAnalytics(result.analytics || emptyAnalytics);
      setRole(result.profile?.role || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load analytics."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const conversationResolutionRate = useMemo(() => {
    if (!analytics.conversations) return 0;

    return Math.round(
      ((analytics.closedConversations + analytics.archivedConversations) /
        analytics.conversations) *
        100
    );
  }, [analytics]);

  const deliveryRate = useMemo(() => {
    if (!analytics.orders) return 0;

    return Math.round((analytics.deliveredOrders / analytics.orders) * 100);
  }, [analytics]);

  const cards = [
    {
      title: "Businesses",
      value: formatNumber(analytics.businesses),
      description:
        role === "super_admin"
          ? "Businesses managed on the platform"
          : "Assigned business access",
      icon: Building2,
    },
    {
      title: "Customers",
      value: formatNumber(analytics.customers),
      description: "Customers captured from WhatsApp",
      icon: UsersRound,
    },
    {
      title: "Conversations",
      value: formatNumber(analytics.conversations),
      description: "Customer chat records",
      icon: MessageCircle,
    },
    {
      title: "Human handoff",
      value: formatNumber(analytics.handoffConversations),
      description: "Chats needing manual attention",
      icon: AlertTriangle,
    },
    {
      title: "Orders",
      value: formatNumber(analytics.orders),
      description: "Orders created in dashboard",
      icon: ShoppingBag,
    },
    {
      title: "Delivered orders",
      value: formatNumber(analytics.deliveredOrders),
      description: `${deliveryRate}% delivery completion rate`,
      icon: PackageCheck,
    },
    {
      title: "Paid value",
      value: formatMoney(analytics.paidOrderValue),
      description: "Total value marked as paid",
      icon: Banknote,
    },
    {
      title: "Pending payment",
      value: formatMoney(analytics.pendingPaymentValue),
      description: "Unpaid or awaiting confirmation",
      icon: TrendingUp,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <TrendingUp className="h-3.5 w-3.5" />
            Business Analytics
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Analytics
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Track customer activity, conversations, handoffs, orders,
                payment progress, and delivery performance.
              </p>
            </div>

            <button
              onClick={loadAnalytics}
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

        {isLoading ? (
          <section className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.04] text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
            Loading analytics...
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => {
                const Icon = card.icon;

                return (
                  <article
                    key={card.title}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </div>

                    <p className="text-3xl font-black tracking-tight">
                      {card.value}
                    </p>

                    <p className="mt-2 text-sm font-semibold text-white">
                      {card.title}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {card.description}
                    </p>
                  </article>
                );
              })}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <MessageCircle className="h-5 w-5 text-emerald-400" />
                  Conversation status
                </h2>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Open</span>
                      <span className="font-bold text-emerald-300">
                        {formatNumber(analytics.openConversations)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Closed</span>
                      <span className="font-bold text-blue-300">
                        {formatNumber(analytics.closedConversations)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Archived</span>
                      <span className="font-bold text-slate-300">
                        {formatNumber(analytics.archivedConversations)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Resolution rate
                      </span>
                      <span className="font-bold text-white">
                        {conversationResolutionRate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <ShoppingBag className="h-5 w-5 text-emerald-400" />
                  Order summary
                </h2>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Total order value
                      </span>
                      <span className="font-bold text-white">
                        {formatMoney(analytics.totalOrderValue)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Paid order value
                      </span>
                      <span className="font-bold text-emerald-300">
                        {formatMoney(analytics.paidOrderValue)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Pending payment value
                      </span>
                      <span className="font-bold text-amber-200">
                        {formatMoney(analytics.pendingPaymentValue)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-slate-400">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Delivered
                      </span>
                      <span className="font-bold text-white">
                        {formatNumber(analytics.deliveredOrders)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-slate-400">
                        <Archive className="h-4 w-4 text-red-300" />
                        Cancelled
                      </span>
                      <span className="font-bold text-white">
                        {formatNumber(analytics.cancelledOrders)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}