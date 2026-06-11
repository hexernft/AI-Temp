"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Banknote,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
};

type Order = {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  conversation_id: string | null;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: OrderItem[] | null;
  notes: string | null;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  total: number | string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  status: string | null;
  payment_status: string | null;
  delivery_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  business_name?: string | null;
  business_type?: string | null;
};

const orderStatusOptions = [
  "draft",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const paymentStatusOptions = [
  "unpaid",
  "awaiting_confirmation",
  "paid",
  "refunded",
];

const deliveryStatusOptions = [
  "not_required",
  "pending",
  "assigned",
  "out_for_delivery",
  "delivered",
];

const filters = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Draft",
    value: "draft",
  },
  {
    label: "Confirmed",
    value: "confirmed",
  },
  {
    label: "Preparing",
    value: "preparing",
  },
  {
    label: "Delivered",
    value: "delivered",
  },
  {
    label: "Cancelled",
    value: "cancelled",
  },
];

function formatDate(value?: string | null) {
  if (!value) return "No date";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value?: number | string | null) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatLabel(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusClasses(status?: string | null) {
  if (status === "delivered" || status === "paid") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "cancelled" || status === "refunded") {
    return "border-red-400/20 bg-red-400/10 text-red-300";
  }

  if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready" ||
    status === "out_for_delivery" ||
    status === "awaiting_confirmation" ||
    status === "pending" ||
    status === "assigned"
  ) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }

  return "border-white/10 bg-white/10 text-slate-300";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function loadOrders(filter = activeFilter) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const params = new URLSearchParams();

      if (filter !== "all") {
        params.set("status", filter);
      }

      const queryString = params.toString();

      const response = await fetch(
        `/api/orders${queryString ? `?${queryString}` : ""}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load orders.");
      }

      setOrders(result.orders || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load orders."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(activeFilter);
  }, [activeFilter]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return orders;

    return orders.filter((order) => {
      const orderNumber = order.order_number || "";
      const customerName = order.customer_name || "";
      const customerPhone = order.customer_phone || "";
      const businessName = order.business_name || "";
      const status = order.status || "";

      return (
        orderNumber.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query) ||
        customerPhone.toLowerCase().includes(query) ||
        businessName.toLowerCase().includes(query) ||
        status.toLowerCase().includes(query)
      );
    });
  }, [orders, searchQuery]);

  const totals = useMemo(() => {
    const revenue = orders.reduce((sum, order) => {
      if (order.status === "cancelled") return sum;
      return sum + Number(order.total || 0);
    }, 0);

    const paid = orders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    return {
      orders: orders.length,
      revenue,
      paid,
    };
  }, [orders]);

  async function handleUpdateOrder(
    orderId: string,
    payload: {
      status?: string;
      payment_status?: string;
      delivery_status?: string;
    }
  ) {
    try {
      setUpdatingId(orderId);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update order.");
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                ...result.order,
              }
            : order
        )
      );

      setSuccessMessage("Order updated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update order."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <ShoppingBag className="h-3.5 w-3.5" />
            Order Tracking
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Orders
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Track customer orders, payment confirmation, and delivery
                progress from one dashboard.
              </p>
            </div>

            <button
              onClick={() => loadOrders(activeFilter)}
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

        {successMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Archive className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold">{totals.orders}</p>
            <p className="mt-1 text-sm text-slate-400">Loaded orders</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Banknote className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold">{formatMoney(totals.revenue)}</p>
            <p className="mt-1 text-sm text-slate-400">Order value</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <PackageCheck className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold">{formatMoney(totals.paid)}</p>
            <p className="mt-1 text-sm text-slate-400">Paid value</p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const isActive = activeFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    onClick={() => setActiveFilter(filter.value)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-emerald-400 text-slate-950"
                        : "border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search order, customer, phone..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          {isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
              No orders found.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => {
                const items = Array.isArray(order.items) ? order.items : [];

                return (
                  <article
                    key={order.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                              order.status
                            )}`}
                          >
                            <Archive className="h-3.5 w-3.5" />
                            {formatLabel(order.status)}
                          </span>

                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                              order.payment_status
                            )}`}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {formatLabel(order.payment_status)}
                          </span>

                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                              order.delivery_status
                            )}`}
                          >
                            <Truck className="h-3.5 w-3.5" />
                            {formatLabel(order.delivery_status)}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-white">
                          {order.order_number}
                        </h3>

                        <div className="mt-3 grid gap-2 text-sm text-slate-400">
                          <p className="flex items-center gap-2">
                            <User className="h-4 w-4 text-emerald-400" />
                            {order.customer_name || "Unknown customer"}
                          </p>

                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-emerald-400" />
                            {order.customer_phone || "No phone"}
                          </p>

                          {order.delivery_address ? (
                            <p className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-emerald-400" />
                              {order.delivery_address}
                            </p>
                          ) : null}

                          <p className="text-xs text-slate-500">
                            Created: {formatDate(order.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-slate-950 p-4 xl:min-w-[260px]">
                        <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                          Total
                        </p>
                        <p className="text-3xl font-black text-white">
                          {formatMoney(order.total)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Subtotal {formatMoney(order.subtotal)} + delivery{" "}
                          {formatMoney(order.delivery_fee)}
                        </p>

                        {order.conversation_id ? (
                          <Link
                            href={`/dashboard/conversations/${order.conversation_id}`}
                            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            Open Conversation
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                        Items
                      </p>

                      {items.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No items added.
                        </p>
                      ) : (
                        <div className="grid gap-2">
                          {items.map((item, index) => (
                            <div
                              key={`${item.name}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                            >
                              <span className="text-slate-300">
                                {item.quantity || 1}× {item.name}
                              </span>
                              <span className="font-semibold text-white">
                                {formatMoney(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {order.notes ? (
                        <p className="mt-3 text-sm text-slate-400">
                          Notes: {order.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Order status
                        </label>
                        <select
                          value={order.status || "draft"}
                          onChange={(event) =>
                            handleUpdateOrder(order.id, {
                              status: event.target.value,
                            })
                          }
                          disabled={updatingId === order.id}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
                        >
                          {orderStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {formatLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Payment status
                        </label>
                        <select
                          value={order.payment_status || "unpaid"}
                          onChange={(event) =>
                            handleUpdateOrder(order.id, {
                              payment_status: event.target.value,
                            })
                          }
                          disabled={updatingId === order.id}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
                        >
                          {paymentStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {formatLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Delivery status
                        </label>
                        <select
                          value={order.delivery_status || "not_required"}
                          onChange={(event) =>
                            handleUpdateOrder(order.id, {
                              delivery_status: event.target.value,
                            })
                          }
                          disabled={updatingId === order.id}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60 disabled:opacity-50"
                        >
                          {deliveryStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {formatLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}