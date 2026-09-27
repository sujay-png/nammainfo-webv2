"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  User,
  Building2,
  Briefcase,
  Phone,
  Globe,
  MapPin,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [form, setForm] = useState({
    owner_name: "",
    business_name: "",
    job_title: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    username: "",
    bio: "",
  });

  useEffect(() => {
    // Pre-fill email from auth
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setForm((f) => ({ ...f, email: user.email! }));
      }
    })();
  }, []);

  // Check username availability
  useEffect(() => {
    if (!form.username || form.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setCheckingUsername(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", form.username.toLowerCase())
        .maybeSingle();
      setUsernameAvailable(!data);
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [form.username]);

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const username = form.username.toLowerCase().replace(/[^a-z0-9-]/g, "");

    const { error } = await supabase
      .from("profiles")
      .update({
        owner_name: form.owner_name.trim(),
        business_name: form.business_name.trim() || null,
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        username: username || null,
        bio: form.bio.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("Onboarding error:", error);
      alert("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Create a default card for the user
    await supabase.from("cards").insert({
      profile_id: user.id,
      public_slug: username || slugify(form.owner_name || form.business_name || "card"),
      is_active: true,
    });

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-ink-950" : "bg-ink-100"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-400">Step {step} of 3</p>
        </div>

        {/* Step 1: Personal */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="mb-1 text-xl font-semibold text-ink-950">
              Tell us about you
            </h2>
            <p className="mb-6 text-sm text-ink-400">
              This appears on your digital business card
            </p>

            <div className="space-y-3">
              <InputField
                icon={<User size={16} />}
                placeholder="Your full name *"
                value={form.owner_name}
                onChange={(v) => updateField("owner_name", v)}
                required
              />
              <InputField
                icon={<Building2 size={16} />}
                placeholder="Business name"
                value={form.business_name}
                onChange={(v) => updateField("business_name", v)}
              />
              <InputField
                icon={<Briefcase size={16} />}
                placeholder="Job title / designation"
                value={form.job_title}
                onChange={(v) => updateField("job_title", v)}
              />
            </div>

            <button
              onClick={() => {
                if (!form.owner_name.trim()) return;
                setStep(2);
              }}
              disabled={!form.owner_name.trim()}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-950 py-3.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-40"
            >
              Continue
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="mb-1 text-xl font-semibold text-ink-950">
              Contact details
            </h2>
            <p className="mb-6 text-sm text-ink-400">
              How people can reach you
            </p>

            <div className="space-y-3">
              <InputField
                icon={<Phone size={16} />}
                placeholder="Phone number"
                value={form.phone}
                onChange={(v) => updateField("phone", v)}
                type="tel"
              />
              <InputField
                icon={<Globe size={16} />}
                placeholder="Website (optional)"
                value={form.website}
                onChange={(v) => updateField("website", v)}
                type="url"
              />
              <InputField
                icon={<MapPin size={16} />}
                placeholder="Business address (optional)"
                value={form.address}
                onChange={(v) => updateField("address", v)}
              />
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl border border-ink-200 py-3.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-950 py-3.5 text-sm font-semibold text-white transition hover:bg-ink-800"
              >
                Continue
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Username + Bio */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="mb-1 text-xl font-semibold text-ink-950">
              Claim your URL
            </h2>
            <p className="mb-6 text-sm text-ink-400">
              This is your unique profile link
            </p>

            <div className="space-y-3">
              <div>
                <div className="flex items-center rounded-2xl border border-ink-200 bg-white transition focus-within:border-ink-400 focus-within:ring-1 focus-within:ring-ink-400">
                  <span className="pl-4 text-sm text-ink-300">
                    nammainfo.in/
                  </span>
                  <input
                    value={form.username}
                    onChange={(e) =>
                      updateField(
                        "username",
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    placeholder="yourname"
                    className="w-full rounded-r-2xl bg-transparent py-3.5 pr-4 text-sm outline-none placeholder:text-ink-300"
                  />
                </div>
                {form.username && form.username.length >= 3 && (
                  <div className="mt-1.5 flex items-center gap-1 px-1">
                    {checkingUsername ? (
                      <Loader2 size={12} className="animate-spin text-ink-400" />
                    ) : usernameAvailable ? (
                      <>
                        <CheckCircle2
                          size={12}
                          className="text-emerald-500"
                        />
                        <span className="text-xs text-emerald-600">
                          Available
                        </span>
                      </>
                    ) : usernameAvailable === false ? (
                      <span className="text-xs text-red-500">
                        Already taken — try another
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <textarea
                  value={form.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  placeholder="Short bio about you or your business (optional)"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-ink-200 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-ink-300 focus:border-ink-400 focus:ring-1 focus:ring-ink-400"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl border border-ink-200 py-3.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  loading ||
                  !form.owner_name.trim() ||
                  (form.username.length > 0 &&
                    (form.username.length < 3 || usernameAvailable === false))
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-950 py-3.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Launch Profile
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function InputField({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
  required,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 transition focus-within:border-ink-400 focus-within:ring-1 focus-within:ring-ink-400">
      <span className="text-ink-400">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-ink-300"
      />
    </div>
  );
}
