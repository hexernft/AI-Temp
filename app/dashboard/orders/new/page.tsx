"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  name: string;
  quantity: string;
  unit_price: string;
};

type Conversation = {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  business_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
};

function toMoney(value: string | number) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return Number(numberValue.toFixed(2));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const conversationIdFromUrl = searchParams.get("conversation_id") || "";

  const [conversationId, setConversationId] = useState(conversationIdFromUrl);
  const [businessId, setBusinessId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [items, setItems] = useState<OrderItem[]>([
    {
      name: "",
      quantity: "1",
      unit_price: "",
    },
  ]);

  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [notes, setNotes] = useState("");

  const [status, setStatus] = useState("draft");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [deliveryStatus, setDeliveryStatus] = useState("not_required");

  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  async function loadConversation(id: string) {
    if (!id.trim()) return;

    try {
      setIsLoadingConversation(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch(`/api/conversations/${id.trim()}`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load conversation.");
      }

      const conversation = result.conversation as Conversation;

      setConversationId(conversation.id);
      setBusinessId(conversation.business_id || "");
      setCustomerId(conversation.customer_id || "");
      setCustomerName(conversation.customer_name || "");
      setCustomerPhone(conversation.customer_phone || "");

      setSuccessMessage("Conversation loaded. Customer details added.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load conversation."
      );
    } finally {
      setIsLoadingConversation(false);
    }
  }

  useEffect(() => {
    if (conversationIdFromUrl) {
      loadConversation(conversationIdFromUrl);
    }
  }, [conversationIdFromUrl]);

  const calculatedItems = useMemo(() => {
    return items
      .map((item) => {
        const name = item.name.trim();
        const quantity = Math.max(1, Number(item.quantity || 1));
        const unitPrice = toMoney(item.unit_price);
        const total = toMoney(quantity * unitPrice);

        return {
          name,
          quantity,
          unit_price: unitPrice,
          total,
        };
      })
      .filter((item) => item.name);
  }, [items]);

  const subtotal = useMemo(() => {
    return calculatedItems.reduce((sum, item) => sum + item.total, 0);
  }, [calculatedItems]);

  const deliveryFeeNumber = useMemo(() => {
    return toMoney(deliveryFee);
  }, [deliveryFee]);

  const total = useMemo(() => {
    return subtotal + deliveryFeeNumber;
  }, [subtotal, deliveryFeeNumber]);

  function updateItem(index: number, field: keyof OrderItem, value: string) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        name: "",
        quantity: "1",
        unit_price: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((currentItems) => {
      if (currentItems.length === 1) return currentItems;

      return currentItems.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId.trim()) {
      setErrorMessage(
        "Business ID is required. Load from a conversation or enter it manually."
      );
      return;
    }

    if (!customerName.trim() && !customerPhone.trim()) {
      setErrorMessage("Customer name or phone is required.");
      return;
    }

    if (calculatedItems.length === 0) {
      setErrorMessage("Add at least one order item.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          customer_id: customerId || null,
          conversation_id: conversationId || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: calculatedItems,
          notes,
          delivery_address: deliveryAddress,
          delivery_notes: deliveryNotes,
          delivery_fee: deliveryFeeNumber,
          status,
          payment_status: paymentStatus,
          delivery_status: deliveryStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create order.");
      }

      setSuccessMessage("Order created successfully.");

      window.setTimeout(() => {
        router.push("/dashboard/orders");
      }, 800);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create order."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard/orders"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <PackagePlus className="h-3.5 w-3.5" />
            New Order
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Create Order
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Create an order manually or load customer details from a WhatsApp
            conversation.
          </p>
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

        <form onSubmit={handleCreateOrder} className="grid gap-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">
              Conversation and customer
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Conversation ID
                </label>

                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    value={conversationId}
                    onChange={(event) => setConversationId(event.target.value)}
                    placeholder="Optional conversation ID"
                    className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />

                  <button
                    type="button"
                    onClick={() => loadConversation(conversationId)}
                    disabled={isLoadingConversation || !conversationId.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingConversation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading
                      </>
                    ) : (
                      "Load Conversation"
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Business ID
                </label>

                <input
                  value={businessId}
                  onChange={(event) => setBusinessId(event.target.value)}
                  placeholder="Business ID"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer ID
                </label>

                <input
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  placeholder="Optional customer ID"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer name
                </label>

                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer phone
                </label>

                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="234..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Order items</h2>

              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>

            <div className="grid gap-4">
              {items.map((item, index) => {
                const quantity = Math.max(1, Number(item.quantity || 1));
                const unitPrice = toMoney(item.unit_price);
                const itemTotal = quantity * unitPrice;

                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:grid-cols-[1fr_120px_160px_120px_44px]"
                  >
                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateItem(index, "name", event.target.value)
                      }
                      placeholder="Item name"
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                    />

                    <input
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, "quantity", event.target.value)
                      }
                      placeholder="Qty"
                      type="number"
                      min="1"
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                    />

                    <input
                      value={item.unit_price}
                      onChange={(event) =>
                        updateItem(index, "unit_price", event.target.value)
                      }
                      placeholder="Unit price"
                      type="number"
                      min="0"
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                    />

                    <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                      {formatMoney(itemTotal)}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="inline-flex items-center justify-center rounded-2xl border border-red-400/20 text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">Delivery and notes</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Delivery fee
                </label>

                <input
                  value={deliveryFee}
                  onChange={(event) => setDeliveryFee(event.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Delivery status
                </label>

                <select
                  value={deliveryStatus}
                  onChange={(event) => setDeliveryStatus(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  <option value="not_required">Not required</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Delivery address
                </label>

                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  rows={3}
                  placeholder="Delivery address"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Delivery notes
                </label>

                <textarea
                  value={deliveryNotes}
                  onChange={(event) => setDeliveryNotes(event.target.value)}
                  rows={4}
                  placeholder="Delivery instructions"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Order notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Internal order notes"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Order status
                </label>

                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="out_for_delivery">Out for delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Payment status
                </label>

                <select
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="awaiting_confirmation">
                    Awaiting confirmation
                  </option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total
                </p>

                <p className="mt-2 text-3xl font-black text-white">
                  {formatMoney(total)}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Subtotal {formatMoney(subtotal)} + delivery{" "}
                  {formatMoney(deliveryFeeNumber)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 md:w-fit"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Order
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Create Order
                </>
              )}
            </button>
          </section>
        </form>
      </div>
    </main>
  );
}

function NewOrderFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-2xl">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        <span className="text-sm text-slate-300">Loading new order...</span>
      </div>
    </main>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<NewOrderFallback />}>
      <NewOrderForm />
    </Suspense>
  );
}