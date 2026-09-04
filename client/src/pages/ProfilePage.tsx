import { useState } from 'react';
import { Save, KeyRound, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { Avatar, Field, Spinner, Toggle } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { channels } = useConfig();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', mobile: user?.mobile || '', company: user?.company || '', title: user?.title || '' });
  const [prefs, setPrefs] = useState({ notify_email: !!user?.notify_email, notify_sms: !!user?.notify_sms });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<{ message: string; field?: string }>({ message: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('profile');
    setErr({ message: '' });
    try {
      const r = await api.patch('/auth/me', form);
      setUser(r.user);
      toast.success('پروفایل ذخیره شد');
    } catch (e: any) {
      setErr({ message: e.message, field: e.field });
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };
  const savePrefs = async (p: typeof prefs) => {
    setPrefs(p);
    try {
      const r = await api.patch('/auth/me', p);
      setUser(r.user);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) return toast.error('تکرار رمز عبور مطابقت ندارد.');
    setSaving('pw');
    try {
      await api.post('/auth/me/password', { current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast.success('رمز عبور تغییر کرد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };
  const fe = (f: string) => (err.field === f ? err.message : undefined);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-4">
        <Avatar user={user} size="xl" />
        <div>
          <h1 className="text-xl font-extrabold">{user?.name}</h1>
          <p className="text-sm text-slate-500">{user?.role === 'admin' ? 'مدیر سیستم' : user?.role === 'agent' ? 'کارشناس پشتیبانی' : 'مشتری'}{user?.created_at && ` — عضو از ${formatDateTime(user.created_at)}`}</p>
          {user?.departments && user.departments.length > 0 && <p className="mt-1 text-xs text-slate-500">بخش‌ها: {user.departments.map((d) => d.name).join('، ')}</p>}
        </div>
      </div>

      <form onSubmit={saveProfile} className="card space-y-4 p-5">
        <h2 className="font-bold">اطلاعات حساب</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام و نام خانوادگی" required error={fe('name')}><input className="input" value={form.name} onChange={set('name')} required /></Field>
          <Field label={user?.role === 'customer' ? 'نام شرکت' : 'سمت'} error={fe(user?.role === 'customer' ? 'company' : 'title')}>
            {user?.role === 'customer' ? <input className="input" value={form.company} onChange={set('company')} /> : <input className="input" value={form.title} onChange={set('title')} placeholder="مثلاً کارشناس فنی" />}
          </Field>
          <Field label="ایمیل" error={fe('email')}><input className="input ltr" type="email" value={form.email} onChange={set('email')} dir="ltr" /></Field>
          <Field label="شماره موبایل" error={fe('mobile')}><input className="input ltr" value={form.mobile} onChange={set('mobile')} dir="ltr" placeholder="09123456789" /></Field>
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={saving === 'profile'}>{saving === 'profile' ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} ذخیره</button></div>
      </form>

      <div className="card p-5">
        <h2 className="mb-2 flex items-center gap-2 font-bold"><Bell className="h-4 w-4" /> اعلان‌ها</h2>
        <Toggle checked={prefs.notify_email} onChange={(v) => savePrefs({ ...prefs, notify_email: v })} label="اعلان ایمیلی" description={channels.email ? 'دریافت ایمیل هنگام پاسخ جدید و تغییر وضعیت' : 'ارسال ایمیل روی سرور فعال نشده است'} />
        <Toggle checked={prefs.notify_sms} onChange={(v) => savePrefs({ ...prefs, notify_sms: v })} label="اعلان پیامکی" description={channels.sms ? 'دریافت پیامک هنگام پاسخ جدید' : 'ارسال پیامک روی سرور فعال نشده است'} />
        {'Notification' in window && Notification.permission !== 'granted' && (
          <button className="btn-secondary btn-sm mt-2" onClick={() => Notification.requestPermission().then((p) => p === 'granted' && toast.success('اعلان مرورگر فعال شد'))}>فعال‌سازی اعلان مرورگر</button>
        )}
      </div>

      <form onSubmit={savePw} className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4" /> تغییر رمز عبور</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="رمز فعلی" required><input className="input ltr" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required dir="ltr" autoComplete="current-password" /></Field>
          <Field label="رمز جدید" required hint="حداقل ۸ کاراکتر"><input className="input ltr" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
          <Field label="تکرار رمز جدید" required><input className="input ltr" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required dir="ltr" autoComplete="new-password" /></Field>
        </div>
        <div className="flex justify-end"><button className="btn-secondary" disabled={saving === 'pw'}>{saving === 'pw' && <Spinner className="h-4 w-4" />} تغییر رمز</button></div>
      </form>
    </div>
  );
}
