"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Building2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function NewBusinessPage() {
  const [profileId, setProfileId] = useState("");
  const [profileRole, setProfileRole] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [category, setCategory] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [location, setLocation] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("");
  const [humanHandoffPhone, setHumanHandoffPhone] = useState("");
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [knowledgeLimit, setKnowledgeLimit] = useState(50);
  const [isActive, setIsActive] = useState(false);
  const [toneInstructions, setToneInstructions] = useState(
    "Professional, friendly, helpful, clear, and sales-focused. Avoid overpromising. Hand over to a human when price confirmation or payment issues come up."
  );

  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isSuperAdmin = profileRole === "super_admin";

  useEffect(() => {
    async function loadUser() {
      try {
        setIsLoadingUser(true);
        setErrorMessage("");

        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          throw new Error("You must be logged in to create a business.");
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, role")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profileData) {
          throw new Error("Your profile could not be loaded.");
        }

        if (profileData.role !== "super_admin") {
          throw new Error("Only super admins can create new businesses.");
        }

        setProfileId(profileData.id);
        setProfileRole(profileData.role || "");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load your account."
        );
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  async function handleSaveBusiness() {
    setSuccessMessage("");
    setErrorMessage("");

    if (!profileId) {
      setErrorMessage("User session not found. Please login again.");
      return;
    }

    if (!isSuperAdmin) {
      setErrorMessage("Only super admins can create businesses.");
      return;
    }

    if (!businessName.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }

    try {
      setIsSaving(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("businesses").insert({
        name: businessName.trim(),
        type: businessType.trim() || category.trim() || null,
        description: toneInstructions.trim() || null,
        phone: null,
        whatsapp: humanHandoffPhone.trim() || null,
        email: ownerEmail.trim() || null,
        location: location.trim() || null,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage("Business saved successfully.");

      setBusinessName("");
      setBusinessType("");
      setCategory("");
      setOwnerEmail("");
      setLocation("");
      setOpeningHours("");
      setWhatsappPhoneNumberId("");
      setHumanHandoffPhone("");
      setWhatsappAccessToken("");
      setKnowledgeLimit(50);
      setIsActive(false);
      setToneInstructions(
        "Professional, friendly, helpful, clear, and sales-focused. Avoid overpromising. Hand over to a human when price confirmation or payment issues come up."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save business."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07131f] text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 size={20} className="animate-spin" />
          Loading account...
        </div>
      </main>
    );
  }

  if (errorMessage && !isSuperAdmin) {
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
            {errorMessage}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07131f] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/businesses"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Businesses
          </Link>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                New AI Assistant
              </p>
              <p className="text-xs text-slate-500">Business setup</p>
            </div>
          </div>
        </nav>

        <section className="mb-5 rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Building2 size={24} />
          </div>

          <p className="mb-3 text-sm font-medium text-emerald-300">
            Add business
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Set up a business profile for its WhatsApp AI assistant.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
            Create a client business profile, then add knowledge, connect
            WhatsApp credentials, and test the assistant before going live.
          </p>
        </section>

        {successMessage ? (
          <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <form className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                Business Information
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Basic details customers may ask about.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Business Name</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <Building2 size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="SleekStitch Atelier"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Business Type</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <Sparkles size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={businessType}
                    onChange={(event) => setBusinessType(event.target.value)}
                    placeholder="Fashion, food, apartment, church..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Category</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <Sparkles size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="Retail, food, real estate, fashion..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Owner Email</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <Mail size={18} className="text-slate-500" />
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="owner@email.com"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">
                  Business Location
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <MapPin size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Abuja, Nigeria"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">Opening Hours</span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <Clock size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={openingHours}
                    onChange={(event) => setOpeningHours(event.target.value)}
                    placeholder="Mon - Sat, 9:00 AM - 6:00 PM"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                WhatsApp Connection
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                These come from Meta WhatsApp Cloud API.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">
                  WhatsApp Phone Number ID
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <MessageCircle size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={whatsappPhoneNumberId}
                    onChange={(event) =>
                      setWhatsappPhoneNumberId(event.target.value)
                    }
                    placeholder="From Meta Developer Dashboard"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">
                  Human Handoff Phone
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#122338] px-4 py-3">
                  <Phone size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={humanHandoffPhone}
                    onChange={(event) =>
                      setHumanHandoffPhone(event.target.value)
                    }
                    placeholder="+234..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-slate-300">
                  WhatsApp Access Token
                </span>
                <textarea
                  value={whatsappAccessToken}
                  onChange={(event) =>
                    setWhatsappAccessToken(event.target.value)
                  }
                  placeholder="Paste access token here"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                AI Tone & Rules
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                This controls how the assistant speaks to customers.
              </p>
            </div>

            <label className="space-y-2">
              <span className="text-sm text-slate-300">
                Tone / Instructions
              </span>
              <textarea
                value={toneInstructions}
                onChange={(event) => setToneInstructions(event.target.value)}
                rows={5}
                placeholder="Professional, friendly, helpful, clear, and sales-focused."
                className="w-full resize-none rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
              />
            </label>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">
                  Knowledge Limit
                </span>

                <select
                  value={knowledgeLimit}
                  onChange={(event) =>
                    setKnowledgeLimit(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50"
                >
                  <option value={50} className="bg-[#122338]">
                    Starter - 50 knowledge items
                  </option>
                  <option value={100} className="bg-[#122338]">
                    Basic - 100 knowledge items
                  </option>
                  <option value={200} className="bg-[#122338]">
                    Business - 200 knowledge items
                  </option>
                  <option value={500} className="bg-[#122338]">
                    Premium - 500 knowledge items
                  </option>
                  <option value={1000} className="bg-[#122338]">
                    Enterprise - 1,000 knowledge items
                  </option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">
                  Assistant Status
                </span>

                <select
                  value={isActive ? "active" : "inactive"}
                  onChange={(event) =>
                    setIsActive(event.target.value === "active")
                  }
                  className="w-full rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50"
                >
                  <option value="inactive" className="bg-[#122338]">
                    Inactive
                  </option>
                  <option value="active" className="bg-[#122338]">
                    Active
                  </option>
                </select>
              </label>
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard/businesses"
              className="rounded-xl border border-white/10 bg-[#0d1b2a] px-6 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#122338]"
            >
              Cancel
            </Link>

            <button
              type="button"
              onClick={handleSaveBusiness}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Save Business
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}