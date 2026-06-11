"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  Calculator,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Route,
  Save,
  Smartphone,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  role: string | null;
  business_id: string | null;
  school_id: string | null;
};

type AiAssistantNumber = {
  id: string;
  business_id: string;
  phone_number: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  is_active: boolean | null;
};

type BusinessProfile = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  public_whatsapp_number: string | null;
  public_whatsapp_label: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_base_fee: number | null;
  delivery_fee_per_km: number | null;
  delivery_free_radius_km: number | null;
  delivery_minimum_fee: number | null;
  delivery_max_radius_km: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type PaymentAccount = {
  id: string;
  business_id: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  payment_note: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type DeliveryCalculationResult = {
  business: {
    id: string;
    name: string | null;
    location: string | null;
    latitude: number;
    longitude: number;
  };
  customer_location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  route: {
    distance_km: number;
    duration_minutes: number;
  };
  pricing: {
    currency: "NGN";
    base_fee: number;
    fee_per_km: number;
    free_radius_km: number;
    minimum_delivery_fee: number;
    max_radius_km: number | null;
    billable_km: number;
    calculated_delivery_fee: number;
    delivery_fee: number;
    is_outside_delivery_radius: boolean;
  };
};

function valueToInput(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatNaira(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) return "₦0";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatNumber(value: string | number | null | undefined) {
  const numberValue = Number(value || 0);

  if (!Number.isFinite(numberValue)) return "0";

  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 2,
  }).format(numberValue);
}

export default function BusinessProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [aiAssistantNumber, setAiAssistantNumber] =
    useState<AiAssistantNumber | null>(null);
  const [aiAssistantLink, setAiAssistantLink] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");

  const [publicWhatsappNumber, setPublicWhatsappNumber] = useState("");
  const [publicWhatsappLabel, setPublicWhatsappLabel] = useState("");

  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentNote, setPaymentNote] = useState(
    "After payment, please send proof of payment here."
  );

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [deliveryBaseFee, setDeliveryBaseFee] = useState("");
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState("");
  const [deliveryFreeRadiusKm, setDeliveryFreeRadiusKm] = useState("");
  const [deliveryMinimumFee, setDeliveryMinimumFee] = useState("");
  const [deliveryMaxRadiusKm, setDeliveryMaxRadiusKm] = useState("");

  const [testAddress, setTestAddress] = useState("");
  const [deliveryResult, setDeliveryResult] =
    useState<DeliveryCalculationResult | null>(null);
  const [isCalculatingDelivery, setIsCalculatingDelivery] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canEdit = profile?.role === "business_owner";

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not logged in.");
    }

    return session.access_token;
  }

  async function parseJsonResponse(response: Response) {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `API did not return JSON. Status: ${
          response.status
        }. Response starts with: ${text.slice(0, 120)}`
      );
    }
  }

  function fillForm(nextBusiness: BusinessProfile) {
    setBusiness(nextBusiness);

    setName(nextBusiness.name || "");
    setType(nextBusiness.type || "");
    setDescription(nextBusiness.description || "");
    setPhone(nextBusiness.phone || "");
    setWhatsapp(nextBusiness.whatsapp || "");
    setEmail(nextBusiness.email || "");
    setLocation(nextBusiness.location || "");

    setPublicWhatsappNumber(nextBusiness.public_whatsapp_number || "");
    setPublicWhatsappLabel(
      nextBusiness.public_whatsapp_label || "Main WhatsApp / Status number"
    );

    setLatitude(valueToInput(nextBusiness.latitude));
    setLongitude(valueToInput(nextBusiness.longitude));
    setDeliveryBaseFee(valueToInput(nextBusiness.delivery_base_fee));
    setDeliveryFeePerKm(valueToInput(nextBusiness.delivery_fee_per_km));
    setDeliveryFreeRadiusKm(valueToInput(nextBusiness.delivery_free_radius_km));
    setDeliveryMinimumFee(valueToInput(nextBusiness.delivery_minimum_fee));
    setDeliveryMaxRadiusKm(valueToInput(nextBusiness.delivery_max_radius_km));
  }

  function fillPaymentForm(paymentAccount: PaymentAccount | null) {
    setBankName(paymentAccount?.bank_name || "");
    setAccountName(paymentAccount?.account_name || "");
    setAccountNumber(paymentAccount?.account_number || "");
    setPaymentNote(
      paymentAccount?.payment_note ||
        "After payment, please send proof of payment here."
    );
  }

  async function loadPaymentAccount() {
    const token = await getAccessToken();

    const response = await fetch("/api/business-payment-account", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(result.error || "Failed to load payment account.");
    }

    fillPaymentForm(result.payment_account || null);
  }

  async function loadBusinessProfile() {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/business-profile", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to load business profile.");
      }

      setProfile(result.profile || null);
      setAiAssistantNumber(result.ai_assistant_number || null);
      setAiAssistantLink(result.ai_assistant_link || null);
      fillForm(result.business);

      await loadPaymentAccount();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load business profile."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBusinessProfile();
  }, []);

  async function handleCopyAiLink() {
    if (!aiAssistantLink) {
      setErrorMessage("No AI assistant link is available yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(aiAssistantLink);
      setSuccessMessage("AI assistant link copied.");
      setErrorMessage("");
    } catch {
      setErrorMessage("Could not copy link. Please copy it manually.");
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage("Only business owners can update the business profile.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }

    try {
      setIsSavingProfile(true);
      setErrorMessage("");
      setSuccessMessage("");
      setDeliveryResult(null);

      const token = await getAccessToken();

      const response = await fetch("/api/business-profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          type,
          description,
          phone,
          whatsapp,
          email,
          location,
          public_whatsapp_number: publicWhatsappNumber,
          public_whatsapp_label: publicWhatsappLabel,
          latitude,
          longitude,
          delivery_base_fee: deliveryBaseFee,
          delivery_fee_per_km: deliveryFeePerKm,
          delivery_free_radius_km: deliveryFreeRadiusKm,
          delivery_minimum_fee: deliveryMinimumFee,
          delivery_max_radius_km: deliveryMaxRadiusKm,
        }),
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to save business profile.");
      }

      fillForm(result.business);
      setSuccessMessage("Business profile and delivery settings saved.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save business profile."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSavePaymentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage("Only business owners can update payment details.");
      return;
    }

    try {
      setIsSavingPayment(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/business-payment-account", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
          payment_note: paymentNote,
        }),
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to save payment account.");
      }

      fillPaymentForm(result.payment_account || null);
      setSuccessMessage(result.message || "Payment account saved.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save payment account."
      );
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleCalculateDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!testAddress.trim()) {
      setErrorMessage("Enter a customer delivery address to test.");
      return;
    }

    try {
      setIsCalculatingDelivery(true);
      setErrorMessage("");
      setSuccessMessage("");
      setDeliveryResult(null);

      const token = await getAccessToken();

      const response = await fetch("/api/maps/calculate-delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: business?.id,
          customer_address: testAddress,
        }),
      });

      const result = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.error || "Failed to calculate delivery.");
      }

      setDeliveryResult(result);
      setSuccessMessage("Delivery fee calculated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to calculate delivery."
      );
    } finally {
      setIsCalculatingDelivery(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)] px-4 text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-4 shadow-2xl backdrop-blur">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span className="text-sm text-slate-300">
            Loading business profile...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_30%),linear-gradient(135deg,#020617_0%,#05251c_45%,#111827_100%)] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-5 flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Store className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
                Business Center
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Business Profile
              </h1>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-400">
            {canEdit ? "Editable by business owner" : "View-only for staff"}
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

        <form
          onSubmit={handleSaveProfile}
          className="grid gap-5 lg:grid-cols-[1fr_0.9fr]"
        >
          <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Building2 className="h-5 w-5 text-emerald-300" />
              Profile details
            </h2>

            <div className="grid gap-4">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEdit}
                placeholder="Business name"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <input
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={!canEdit}
                placeholder="Business type e.g. Restaurant, fashion, pharmacy"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={!canEdit}
                    placeholder="Phone"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    disabled={!canEdit}
                    placeholder="General WhatsApp / contact number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!canEdit}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  disabled={!canEdit}
                  placeholder="Business address or location"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEdit}
                rows={5}
                placeholder="Business description or operating notes"
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Smartphone className="h-5 w-5 text-emerald-300" />
              WhatsApp setup
            </h2>

            <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
              Keep the owner’s normal WhatsApp number for Status posts. Use the
              AI Assistant number/link for automated orders and customer
              replies.
            </div>

            <div className="grid gap-4">
              <input
                value={publicWhatsappLabel}
                onChange={(event) => setPublicWhatsappLabel(event.target.value)}
                disabled={!canEdit}
                placeholder="Label e.g. Main WhatsApp / Status number"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <input
                value={publicWhatsappNumber}
                onChange={(event) => setPublicWhatsappNumber(event.target.value)}
                disabled={!canEdit}
                placeholder="Public WhatsApp / Status number e.g. 2348012345678"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  AI Assistant Number
                </p>

                <p className="mt-2 text-sm font-semibold text-white">
                  {aiAssistantNumber?.display_phone_number ||
                    aiAssistantNumber?.phone_number ||
                    "No AI assistant number connected yet"}
                </p>

                {aiAssistantNumber?.verified_name ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Verified name: {aiAssistantNumber.verified_name}
                  </p>
                ) : null}

                {aiAssistantLink ? (
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                      {aiAssistantLink}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handleCopyAiLink}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
                      >
                        <Copy className="h-4 w-4" />
                        Copy AI Link
                      </button>

                      <a
                        href={aiAssistantLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Link
                      </a>
                    </div>

                    <p className="text-xs leading-5 text-slate-500">
                      Use this in WhatsApp Status posts: “Order faster here 👇”
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Add an active AI Assistant number from the WhatsApp Numbers
                    page to generate a shareable wa.me link.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Truck className="h-5 w-5 text-emerald-300" />
              Delivery settings
            </h2>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="relative">
                <Navigation className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  disabled={!canEdit}
                  placeholder="Latitude"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="relative">
                <Navigation className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  disabled={!canEdit}
                  placeholder="Longitude"
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <input
                value={deliveryBaseFee}
                onChange={(event) => setDeliveryBaseFee(event.target.value)}
                disabled={!canEdit}
                placeholder="Delivery base fee e.g. 500"
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <input
                value={deliveryFeePerKm}
                onChange={(event) => setDeliveryFeePerKm(event.target.value)}
                disabled={!canEdit}
                placeholder="Delivery fee per km e.g. 150"
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <input
                value={deliveryFreeRadiusKm}
                onChange={(event) =>
                  setDeliveryFreeRadiusKm(event.target.value)
                }
                disabled={!canEdit}
                placeholder="Free delivery radius in km"
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <input
                value={deliveryMinimumFee}
                onChange={(event) => setDeliveryMinimumFee(event.target.value)}
                disabled={!canEdit}
                placeholder="Minimum delivery fee in naira"
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <input
                value={deliveryMaxRadiusKm}
                onChange={(event) => setDeliveryMaxRadiusKm(event.target.value)}
                disabled={!canEdit}
                placeholder="Maximum delivery radius in km"
                inputMode="decimal"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
              />

              {canEdit ? (
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </section>
        </form>

        <form
          onSubmit={handleSavePaymentAccount}
          className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Banknote className="h-5 w-5 text-emerald-300" />
            Payment account
          </h2>

          <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
            These details will be used later on order summary images so
            customers can pay directly after confirming an order.
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <input
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              disabled={!canEdit}
              placeholder="Bank name e.g. GTBank"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              disabled={!canEdit}
              placeholder="Account name"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <input
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              disabled={!canEdit}
              placeholder="Account number"
              inputMode="numeric"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <textarea
              value={paymentNote}
              onChange={(event) => setPaymentNote(event.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="Payment note"
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-2"
            />

            {canEdit ? (
              <button
                type="submit"
                disabled={isSavingPayment}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Payment
                  </>
                )}
              </button>
            ) : null}
          </div>
        </form>

        <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Calculator className="h-5 w-5 text-emerald-300" />
            Test delivery fee
          </h2>

          <form onSubmit={handleCalculateDelivery} className="grid gap-4">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

              <input
                value={testAddress}
                onChange={(event) => {
                  setTestAddress(event.target.value);
                  setDeliveryResult(null);
                }}
                placeholder="Customer delivery address e.g. Wuse 2, Abuja"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <button
              type="submit"
              disabled={isCalculatingDelivery}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCalculatingDelivery ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating
                </>
              ) : (
                <>
                  <Route className="h-4 w-4" />
                  Calculate Delivery Fee
                </>
              )}
            </button>
          </form>

          {deliveryResult ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <Route className="mb-3 h-5 w-5 text-emerald-300" />
                <p className="text-2xl font-black">
                  {formatNumber(deliveryResult.route.distance_km)} km
                </p>
                <p className="mt-1 text-xs text-slate-500">Distance</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <Clock className="mb-3 h-5 w-5 text-emerald-300" />
                <p className="text-2xl font-black">
                  {deliveryResult.route.duration_minutes} min
                </p>
                <p className="mt-1 text-xs text-slate-500">Duration</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <Truck className="mb-3 h-5 w-5 text-emerald-300" />
                <p className="text-2xl font-black">
                  {formatNaira(deliveryResult.pricing.delivery_fee)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Final fee</p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  deliveryResult.pricing.is_outside_delivery_radius
                    ? "border-red-400/20 bg-red-400/10"
                    : "border-emerald-400/20 bg-emerald-400/10"
                }`}
              >
                <CheckCircle2
                  className={`mb-3 h-5 w-5 ${
                    deliveryResult.pricing.is_outside_delivery_radius
                      ? "text-red-300"
                      : "text-emerald-300"
                  }`}
                />
                <p
                  className={`text-sm font-semibold ${
                    deliveryResult.pricing.is_outside_delivery_radius
                      ? "text-red-200"
                      : "text-emerald-200"
                  }`}
                >
                  {deliveryResult.pricing.is_outside_delivery_radius
                    ? "Outside radius"
                    : "Within radius"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Max:{" "}
                  {deliveryResult.pricing.max_radius_km
                    ? `${deliveryResult.pricing.max_radius_km} km`
                    : "No max"}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}