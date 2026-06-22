"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function WelcomePage() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    whatsapp: "",
    gender: "",
    age_range: "",
    location: "",
    invited_by: "",
    how_heard: "",
    prayer_request: "",
    preferred_contact_method: "",
    has_been_baptized: "",
    baptized_when: "",
    baptized_where: "",
  });

  function updateField(name: string, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleBaptismChange(value: string) {
    setForm((current) => ({
      ...current,
      has_been_baptized: value,
      baptized_when: value === "yes" ? current.baptized_when : "",
      baptized_where: value === "yes" ? current.baptized_where : "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const hasBeenBaptized =
      form.has_been_baptized === "yes"
        ? true
        : form.has_been_baptized === "no"
          ? false
          : null;

    const { error } = await supabase.from("first_timers").insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || form.phone.trim(),
      gender: form.gender,
      age_range: form.age_range,
      location: form.location.trim(),
      invited_by: form.invited_by.trim(),
      how_heard: form.how_heard,
      prayer_request: form.prayer_request.trim(),
      preferred_contact_method: form.preferred_contact_method,
      has_been_baptized: hasBeenBaptized,
      baptized_when: hasBeenBaptized === true ? form.baptized_when.trim() : "",
      baptized_where:
        hasBeenBaptized === true ? form.baptized_where.trim() : "",
      wants_contact: true,
      interested_foundation_school: false,
      interested_baptism: hasBeenBaptized === false,
      status: "new",
      stage: "first_visit",
      source: "qr_form",
    });

    setLoading(false);

    if (error) {
      alert("Sorry, something went wrong. Please try again.");
      console.error("First timer submit error:", error);
      return;
    }

    window.location.href = "/thank-you";
  }

  return (
    <main className="public-form-page min-h-screen px-4 py-6">
      <section className="mx-auto max-w-3xl">
        <div className="public-form-header mb-4 rounded-2xl border p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="public-form-logo relative h-10 w-10 overflow-hidden rounded-xl border">
                <Image
                  src="/image/welcare-logo.png"
                  alt="WelCare logo"
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                  priority
                />
              </div>

              <div>
                <p className="font-display text-sm font-black leading-none tracking-tight">
                  WelCare
                </p>
                <p className="public-form-muted mt-0.5 text-[10px] font-medium">
                  Welcome form
                </p>
              </div>
            </div>


          </div>

          <div className="mt-5">
            <p className="public-form-muted text-[11px] font-bold uppercase tracking-[0.18em]">
              First Timer
            </p>

            <h1 className="mt-1 font-display text-[1.8rem] font-black leading-tight tracking-[-0.05em] md:text-[2rem]">
              We’re glad you worshipped with us today.
            </h1>

            <p className="public-form-muted mt-2 max-w-xl text-[0.9rem] leading-6">
              Kindly fill this short form so we can stay connected with you and
              support your growth journey.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="public-form-card rounded-2xl border p-4 shadow-sm md:p-5"
        >
          <div className="grid gap-4">
            <div>
              <h2 className="font-display text-[1rem] font-black">
                Contact details
              </h2>
              <p className="public-form-muted mt-0.5 text-[0.78rem]">
                Tell us how to identify and reach you.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Full name *">
                <input
                  required
                  value={form.full_name}
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  className="input-compact"
                  placeholder="Enter your full name"
                />
              </Field>

              <Field label="Phone number *">
                <input
                  required
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="input-compact"
                  placeholder="080..."
                />
              </Field>

              <Field label="WhatsApp number">
                <input
                  value={form.whatsapp}
                  onChange={(event) =>
                    updateField("whatsapp", event.target.value)
                  }
                  className="input-compact"
                  placeholder="Leave empty if same as phone"
                />
              </Field>

              <Field label="Preferred way we can reach you">
                <select
                  value={form.preferred_contact_method}
                  onChange={(event) =>
                    updateField("preferred_contact_method", event.target.value)
                  }
                  className="input-compact"
                >
                  <option value="">Select preferred method</option>
                  <option value="phone_call">Phone call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </Field>
            </div>

            <div className="public-form-divider my-1 border-t" />

            <div>
              <h2 className="font-display text-[1rem] font-black">
                Personal information
              </h2>
              <p className="public-form-muted mt-0.5 text-[0.78rem]">
                These details help the welcome team follow up properly.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Gender">
                <select
                  value={form.gender}
                  onChange={(event) => updateField("gender", event.target.value)}
                  className="input-compact"
                >
                  <option value="">Select</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </Field>

              <Field label="Age range">
                <select
                  value={form.age_range}
                  onChange={(event) =>
                    updateField("age_range", event.target.value)
                  }
                  className="input-compact"
                >
                  <option value="">Select</option>
                  <option value="under_18">Under 18</option>
                  <option value="18_25">18 - 25</option>
                  <option value="26_35">26 - 35</option>
                  <option value="36_45">36 - 45</option>
                  <option value="46_plus">46+</option>
                </select>
              </Field>

              <Field label="Area / location *">
                <input
                  required
                  value={form.location}
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  className="input-compact"
                  placeholder="Example: Gwarimpa, Kubwa, Wuse"
                />
              </Field>

              <Field label="Who invited you?">
                <input
                  value={form.invited_by}
                  onChange={(event) =>
                    updateField("invited_by", event.target.value)
                  }
                  className="input-compact"
                  placeholder="Name of person, if any"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="How did you hear about us?">
                  <select
                    value={form.how_heard}
                    onChange={(event) =>
                      updateField("how_heard", event.target.value)
                    }
                    className="input-compact"
                  >
                    <option value="">Select</option>
                    <option value="invited_by_someone">
                      Invited by someone
                    </option>
                    <option value="social_media">Social media</option>
                    <option value="walked_in">Walked in</option>
                    <option value="event">Church event</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="public-form-divider my-1 border-t" />

            <div className="public-form-panel rounded-2xl p-4">
              <h2 className="font-display text-[1rem] font-black">
                Baptism information
              </h2>

              <p className="public-form-muted mt-0.5 text-[0.78rem] leading-5">
                This helps us understand your spiritual growth journey better.
              </p>

              <div className="mt-3 grid gap-3">
                <Field label="Have you been baptized? *">
                  <select
                    required
                    value={form.has_been_baptized}
                    onChange={(event) =>
                      handleBaptismChange(event.target.value)
                    }
                    className="input-compact"
                  >
                    <option value="">Select</option>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>

                {form.has_been_baptized === "yes" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="When were you baptized? *">
                      <input
                        required
                        value={form.baptized_when}
                        onChange={(event) =>
                          updateField("baptized_when", event.target.value)
                        }
                        className="input-compact"
                        placeholder="Example: 2022, last year"
                      />
                    </Field>

                    <Field label="Where were you baptized? *">
                      <input
                        required
                        value={form.baptized_where}
                        onChange={(event) =>
                          updateField("baptized_where", event.target.value)
                        }
                        className="input-compact"
                        placeholder="Church/location"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>

            <Field label="Prayer request">
              <textarea
                value={form.prayer_request}
                onChange={(event) =>
                  updateField("prayer_request", event.target.value)
                }
                className="input-compact min-h-24 resize-y"
                placeholder="You can share a prayer request here"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="public-form-submit rounded-lg px-4 py-2.5 text-[11px] font-black transition disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit My Details"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="public-form-label text-[0.76rem] font-black">{label}</span>
      {children}
    </label>
  );
}
