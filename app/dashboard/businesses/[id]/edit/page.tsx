"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  UserCog,
} from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "super_admin" | "business_owner" | "staff" | string;
};

type Business = {
  id: string;
  name: string | null;
  type: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  location: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function getRoleLabel(role: string | null | undefined) {
  if (role === "super_admin") return "Super Admin";
  if (role === "business_owner") return "Business Owner";
  if (role === "staff") return "Staff";
  if (role === "school_admin") return "School Admin";
  if (role === "teacher") return "Teacher";
  return "User";
}

function getBusinessName(business: Business | null) {
  if (!business) return "Business profile";
  return business.name || business.type || "Business profile";
}

export default function EditBusinessPage() {
  const params = useParams();
  const businessId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function fetchBusiness() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch("/api/dashboard/businesses", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load business.");
        }

        const loadedProfile = data.profile as Profile | null;
        const businesses = (data.businesses || []) as Business[];
        const foundBusiness = businesses.find((item) => item.id === businessId);

        if (!loadedProfile) {
          throw new Error("Your user profile was not found.");
        }

        if (!foundBusiness) {
          throw new Error("Business not found or you do not have access.");
        }

        if (loadedProfile.role === "staff") {
          throw new Error("Staff cannot edit business settings.");
        }

        setProfile(loadedProfile);
        setBusiness(foundBusiness);
        setName(foundBusiness.name || "");
        setType(foundBusiness.type || "");
        setDescription(foundBusiness.description || "");
        setPhone(foundBusiness.phone || "");
        setWhatsapp(foundBusiness.whatsapp || "");
        setEmail(foundBusiness.email || "");
        setLocation(foundBusiness.location || "");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Business could not be loaded."
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (businessId) {
      fetchBusiness();
    }
  }, [businessId]);

  async function updateBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!business) {
      setErrorMessage("Business could not be loaded.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(
        `/api/dashboard/businesses/${business.id}/update`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            type: type.trim() || null,
            description: description.trim() || null,
            phone: phone.trim() || null,
            whatsapp: whatsapp.trim() || null,
            email: email.trim() || null,
            location: location.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update business.");
      }

      setSuccessMessage(result.message || "Business updated successfully.");
      setBusiness(result.business || business);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the business."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07131f] text-white">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 size={20} className="animate-spin" />
          Loading business...
        </div>
      </main>
    );
  }

  if (errorMessage && !business) {
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
            href={`/dashboard/businesses/${businessId}`}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Business
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {profile ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2 text-sm text-slate-300">
                <UserCog size={16} />
                {getRoleLabel(profile.role)}
              </div>
            ) : null}

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1b2a] px-4 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Building2 size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Edit Business</p>
                <p className="text-xs text-slate-500">{getBusinessName(business)}</p>
              </div>
            </div>
          </div>
        </nav>

        {errorMessage ? (
          <section className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </section>
        ) : null}

        {successMessage ? (
          <section className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            {successMessage}
          </section>
        ) : null}

        <section className="mb-5 rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
          <p className="mb-3 text-sm font-medium text-emerald-300">
            Business profile
          </p>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Update business details.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
            These fields match the current Supabase businesses table: name, type,
            description, phone, WhatsApp, email, and location.
          </p>
        </section>

        <form onSubmit={updateBusiness} className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-[#0d1b2a] p-5 shadow-xl">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Business Name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ZCAS TastyBites"
                  className="w-full rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Business Type
                </label>
                <input
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  placeholder="Food, retail, fashion, school..."
                  className="w-full rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="234XXXXXXXXXX"
                    className="w-full rounded-2xl border border-white/10 bg-[#122338] px-11 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    placeholder="234XXXXXXXXXX"
                    className="w-full rounded-2xl border border-white/10 bg-[#122338] px-11 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@email.com"
                    className="w-full rounded-2xl border border-white/10 bg-[#122338] px-11 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Abuja, Nigeria"
                    className="w-full rounded-2xl border border-white/10 bg-[#122338] px-11 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-slate-300">
                  Description / Assistant context
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder="Briefly describe what the business sells, who it serves, and any important assistant context."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#122338] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href={`/dashboard/businesses/${businessId}`}
              className="rounded-xl border border-white/10 bg-[#0d1b2a] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-red-400/40 hover:text-red-300"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
