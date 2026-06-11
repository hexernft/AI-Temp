"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  Send,
  Webhook,
  XCircle,
} from "lucide-react";

export default function WebhookTestPage() {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("2348141283179");
  const [customerName, setCustomerName] = useState("Test Customer");
  const [message, setMessage] = useState(
    "Hi, how much is meat pie and do you deliver?"
  );

  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rawResponse, setRawResponse] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanPhoneNumberId = phoneNumberId.trim();
    const cleanCustomerPhone = customerPhone.replace(/[^\d]/g, "");
    const cleanCustomerName = customerName.trim() || "Test Customer";
    const cleanMessage = message.trim();

    if (!cleanPhoneNumberId || !cleanCustomerPhone || !cleanMessage) {
      setErrorMessage("Phone Number ID, customer phone, and message are required.");
      return;
    }

    try {
      setIsSending(true);
      setSuccessMessage("");
      setErrorMessage("");
      setRawResponse("");

      const fakeMessageId = `wamid.TEST_${Date.now()}`;

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "test_waba_id",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: customerPhone,
                    phone_number_id: cleanPhoneNumberId,
                  },
                  contacts: [
                    {
                      profile: {
                        name: cleanCustomerName,
                      },
                      wa_id: cleanCustomerPhone,
                    },
                  ],
                  messages: [
                    {
                      from: cleanCustomerPhone,
                      id: fakeMessageId,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: "text",
                      text: {
                        body: cleanMessage,
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await fetch("/api/webhook/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      setRawResponse(JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.error || "Webhook test failed.");
      }

      setSuccessMessage(
        "Webhook test sent. Check Conversations to confirm the customer message and AI reply were saved."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Webhook test failed."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Webhook className="h-3.5 w-3.5" />
            WhatsApp Webhook Test
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Webhook Tester
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Simulate an incoming WhatsApp message and test the full automation
            flow before connecting Meta webhook verification.
          </p>
        </section>

        {successMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MessageCircle className="h-5 w-5 text-emerald-400" />
              Fake incoming message
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Meta Phone Number ID
                </label>
                <input
                  value={phoneNumberId}
                  onChange={(event) => setPhoneNumberId(event.target.value)}
                  placeholder="Example: 123456789012345"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  This must match the phone_number_id saved in your
                  business_phone_numbers table.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer WhatsApp number
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="2348141283179"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Use country code format. Example: 2348141283179.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer name
                </label>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Test Customer"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Incoming message
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  placeholder="Hi, how much is meat pie?"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <button
                type="submit"
                disabled={
                  isSending ||
                  !phoneNumberId.trim() ||
                  !customerPhone.trim() ||
                  !message.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing webhook
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Test Webhook
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Webhook className="h-5 w-5 text-emerald-400" />
              Result
            </h2>

            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
              This test can send a real WhatsApp reply if your WhatsApp Cloud API
              token and phone number setup are valid.
            </div>

            {isSending ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                Sending fake webhook...
              </div>
            ) : rawResponse ? (
              <pre className="min-h-[280px] overflow-auto rounded-2xl border border-white/10 bg-slate-900 p-4 text-xs leading-5 text-slate-300">
                {rawResponse}
              </pre>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                The webhook response will appear here.
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}