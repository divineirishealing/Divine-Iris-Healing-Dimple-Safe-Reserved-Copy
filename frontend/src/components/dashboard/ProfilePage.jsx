import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { User, MapPin, Calendar, Briefcase, GraduationCap, Heart, Mail } from 'lucide-react';
import axios from 'axios';
import { getAuthHeaders } from '../../lib/authHeaders';
import { getApiUrl } from '../../lib/config';
import { PHONE_DIAL_OPTIONS, PHONE_DIAL_PREFIXES_SORTED, splitStoredPhone } from '../../lib/phoneDialCodes';

const MARITAL_STATUS_OPTIONS = [
  '',
  'Single',
  'Married',
  'Unmarried',
  'Separated',
  'Divorced',
  'Widowed',
  'Prefer not to say',
  'Other',
];

const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

function toDateInputValue(iso) {
  if (!iso) return '';
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const ProfilePage = () => {
  const { user, checkAuth } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const [formData, setFormData] = useState({
    full_name: '',
    gender: '',
    marital_status: '',
    city: '',
    state: '',
    country: '',
    qualification: '',
    profession: '',
    phone: '',
    phone_code: '+91',
    joined_divine_iris_at: '',
  });

  useEffect(() => {
    if (!user) return;
    const { code, national } = splitStoredPhone(user.phone, user.phone_code);
    setFormData({
      full_name: user.name || user.full_name || '',
      gender: user.gender || '',
      marital_status: user.marital_status || '',
      city: user.city || '',
      state: user.state || '',
      country: user.country || '',
      qualification: user.qualification || '',
      profession: user.profession || '',
      phone: national,
      phone_code: code || '+91',
      joined_divine_iris_at: toDateInputValue(user.joined_divine_iris_at),
    });
  }, [user]);
  const [loading, setLoading] = useState(false);

  const dialOptionsForSelect = useMemo(() => {
    const cur = (formData.phone_code || '').trim();
    if (cur && !PHONE_DIAL_PREFIXES_SORTED.includes(cur)) {
      return [{ value: cur, label: cur }, ...PHONE_DIAL_OPTIONS];
    }
    return PHONE_DIAL_OPTIONS;
  }, [formData.phone_code]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const apiRoot = getApiUrl();
    if (!apiRoot) {
      toast({
        title: "Cannot save profile",
        description: "This site build is missing the API URL. Please contact support.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const national = String(formData.phone || '').replace(/\D/g, '');
      const code = String(formData.phone_code || '+91').trim();
      const dial = code.startsWith('+') ? code : `+${code.replace(/\D/g, '')}`;
      const payload = {
        ...formData,
        phone: national,
        phone_code: dial,
      };
      await axios.put(`${apiRoot.replace(/\/$/, "")}/student/profile`, payload, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      await checkAuth();
      toast({
        title: "Profile saved",
        description: "Your details are updated. Our team can review changes anytime in the admin log.",
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d?.msg || d).join(" ")
            : err?.message || "Failed to update profile.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="max-w-3xl mx-auto space-y-8 font-lato text-stone-800 pb-12 px-2 sm:px-0"
      style={{ fontFamily: "'Lato', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div
        className="relative overflow-hidden rounded-3xl border border-amber-100/60 bg-gradient-to-br from-[#faf8ff] via-[#fff9f5] to-[#f3f6f4] p-8 shadow-[0_20px_50px_-20px_rgba(91,63,147,0.25)]"
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#d4af37]/15 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#7c69d4] to-[#84a98c] p-0.5 shadow-md">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#fffaf6]">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="text-violet-700" size={36} strokeWidth={1.5} />
                )}
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-800/80">Your presence</p>
            <h1 className="text-2xl font-light tracking-tight text-stone-900 sm:text-3xl">{user?.name || 'Welcome'}</h1>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-violet-200/80 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-800">
                Tier {user?.tier}
              </span>
              {user?.pending_profile_update && (
                <span className="rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                  Legacy update pending review
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="relative mt-6 text-center text-xs leading-relaxed text-stone-600 sm:text-left">
          <Heart className="mr-1 inline-block text-amber-700/70" size={14} strokeWidth={1.75} aria-hidden />
          Take a breath — adjust what feels true today. Your story matters here.
        </p>
      </div>

      <Card className="overflow-hidden rounded-3xl border-stone-200/80 bg-white/90 shadow-lg shadow-stone-200/40 backdrop-blur-sm">
        <CardHeader className="space-y-2 border-b border-stone-100 bg-gradient-to-r from-white to-stone-50/50 pb-6">
          <CardTitle className="text-xl font-normal tracking-tight text-stone-900">Detailed profile</CardTitle>
          <p className="text-xs font-normal leading-relaxed text-stone-600">
            Values from <strong className="font-semibold text-stone-700">Iris Garden</strong> may pre-fill these fields when your portal is linked. Save to update your record — changes are timestamped for our team.
          </p>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit} className="grid gap-7 md:grid-cols-2">
            <div className="space-y-2 border-b border-stone-100 pb-6 md:col-span-2">
              <Label className="text-stone-700">Email</Label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-3 text-stone-400" aria-hidden />
                <Input
                  readOnly
                  value={user?.email || ''}
                  className="border-stone-200 bg-stone-50/80 pl-10 text-stone-700"
                  aria-label="Account email"
                />
              </div>
              <p className="text-[11px] text-stone-500">
                Your sign-in address and Iris Garden contact email. To change it, update your Google account or reach out to your host.
              </p>
            </div>

            <div className="space-y-2 border-b border-stone-100 pb-6 md:col-span-2">
              <Label htmlFor="joined-divine-iris" className="text-stone-700">
                Date of joining Divine Iris
              </Label>
              <div className="relative">
                <Calendar size={16} className="pointer-events-none absolute left-3 top-3 text-stone-400" aria-hidden />
                <Input
                  id="joined-divine-iris"
                  type="date"
                  name="joined_divine_iris_at"
                  value={formData.joined_divine_iris_at}
                  onChange={handleChange}
                  className="border-stone-200 bg-white/80 pl-10"
                  aria-describedby="joined-divine-iris-hint"
                />
              </div>
              <p id="joined-divine-iris-hint" className="text-[11px] text-stone-500">
                This anchors your journey with us. You can refine it if our records were incomplete.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">Full name</Label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3 text-stone-400" aria-hidden />
                <Input name="full_name" value={formData.full_name} onChange={handleChange} className="border-stone-200 bg-white/80 pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">Phone</Label>
              <div className="flex gap-2">
                <select
                  name="phone_code"
                  value={formData.phone_code}
                  onChange={handleChange}
                  className="w-[6.5rem] shrink-0 rounded-md border border-stone-200 bg-white/80 px-2 py-2 text-sm"
                  aria-label="Country calling code"
                >
                  {dialOptionsForSelect.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Local number (no country code)"
                  className="min-w-0 flex-1 border-stone-200 bg-white/80"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">Gender</Label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full rounded-md border border-stone-200 bg-white/80 px-3 py-2 text-sm"
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">Status</Label>
              <select
                name="marital_status"
                value={formData.marital_status}
                onChange={handleChange}
                className="w-full rounded-md border border-stone-200 bg-white/80 px-3 py-2 text-sm"
                aria-label="Marital or relationship status"
              >
                {MARITAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt || 'unset'} value={opt}>
                    {opt || 'Select status'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-stone-700">Location</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative sm:col-span-1">
                  <MapPin size={16} className="pointer-events-none absolute left-3 top-3 text-stone-400" aria-hidden />
                  <Input name="city" value={formData.city} onChange={handleChange} className="border-stone-200 bg-white/80 pl-10" placeholder="City" />
                </div>
                <Input name="state" value={formData.state} onChange={handleChange} className="border-stone-200 bg-white/80" placeholder="State / region" />
                <Input name="country" value={formData.country} onChange={handleChange} className="border-stone-200 bg-white/80" placeholder="Country" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">Academic qualification</Label>
              <div className="relative">
                <GraduationCap size={16} className="absolute left-3 top-3 text-stone-400" aria-hidden />
                <Input name="qualification" value={formData.qualification} onChange={handleChange} className="border-stone-200 bg-white/80 pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">Profession</Label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3 top-3 text-stone-400" aria-hidden />
                <Input name="profession" value={formData.profession} onChange={handleChange} className="border-stone-200 bg-white/80 pl-10" />
              </div>
            </div>

            <div className="mt-2 md:col-span-2">
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-700 to-violet-600 text-[15px] font-medium tracking-wide text-white shadow-md shadow-violet-900/20 transition hover:from-violet-800 hover:to-violet-700"
              >
                {loading ? 'Saving…' : 'Save profile'}
              </Button>
              <p className="mt-3 text-center text-[11px] text-stone-500">
                Saves apply immediately. Each update is logged with a time stamp for our admin team.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
