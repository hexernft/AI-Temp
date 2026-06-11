"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Store,
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
  updated_at: string | null;
};

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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

  async function loadBusinesses() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/admin/businesses", {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load businesses.");
      }

      setBusinesses(result.businesses || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load businesses."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  const filteredBusinesses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return businesses;

    return businesses.filter((business) => {
      return (
        (business.name || "").toLowerCase().includes(query) ||
        (business.type || "").toLowerCase().includes(query) ||
        (business.email || "").toLowerCase().includes(query) ||
        (business.phone || "").toLowerCase().includes(query) ||
        (business.whatsapp || "").toLowerCase().includes(query) ||
        (business.location || "").toLowerCase().includes(query)
      );
    });
  }, [businesses, searchQuery]);

  function resetForm() {
    setName("");
    setType("");
    setDescription("");
    setPhone("");
    setWhatsapp("");
    setEmail("");
    setLocation("");
  }

  async function handleCreateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const token = await getAccessToken();

      const response = await fetch("/api/admin/businesses", {
        method: "POST",
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
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create business.");
      }

      setSuccessMessage("Business created successfully.");
      resetForm();
      await loadBusinesses();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create business."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Building2 className="h-3.5 w-3.5" />
            Platform Businesses
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Businesses
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Create and manage businesses connected to the WhatsApp AI
                platform. Open each business setup page to configure details,
                assigned users, WhatsApp numbers, and readiness checks.
              </p>
            </div>

            <button
              onClick={loadBusinesses}
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

        <section className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={handleCreateBusiness}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Create business</h2>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Business name
                </label>

                <div className="relative">
                  <Store className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Business name"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Business type
                </label>

                <input
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  placeholder="Restaurant, fashion, real estate..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Phone
                  </label>

                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Phone"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    WhatsApp
                  </label>

                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                    <input
                      value={whatsapp}
                      onChange={(event) => setWhatsapp(event.target.value)}
                      placeholder="WhatsApp"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </label>

                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Location
                </label>

                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Location"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description / setup notes
                </label>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Short description or setup notes"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Business
                  </>
                )}
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Business list</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredBusinesses.length} of {businesses.length} businesses
                  shown
                </p>
              </div>

              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search businesses..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
                Loading businesses...
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-500">
                No businesses found yet. Create your first business to begin
                setup.
              </div>
            ) : (
              <div className="grid max-h-[680px] gap-3 overflow-y-auto pr-1">
                {filteredBusinesses.map((business) => (
                  <article
                    key={business.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {business.name || "Unnamed Business"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {business.type || "No business type"}
                        </p>

                        <div className="mt-4 grid gap-2 text-sm text-slate-400">
                          {business.email ? (
                            <p className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-emerald-400" />
                              {business.email}
                            </p>
                          ) : null}

                          {business.phone || business.whatsapp ? (
                            <p className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-emerald-400" />
                              {business.whatsapp || business.phone}
                            </p>
                          ) : null}

                          {business.location ? (
                            <p className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-emerald-400" />
                              {business.location}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/businesses/${business.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                      >
                        Open Setup
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}