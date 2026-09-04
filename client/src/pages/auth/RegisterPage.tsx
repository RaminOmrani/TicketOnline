import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { AuthLayout } from './AuthLayout';
import { Field, Spinner } from '@/components/ui';

export default function RegisterPage() {
  const { register } = useAuth();
  const { settings } = useConfig();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', company: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string }>({ message: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError({ message: 'تکرار رمز عبور مطابقت ندارد.', field: 'confirm' });
    setError({ message: '' });
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email || undefined, mobile: form.mobile || undefined, password: form.password, company: form.company || undefined });
      toast.success('ثبت‌نام با موفقیت انجام شد.');
      navigate('/', { replace: true });
    } catch (err: any) {
      setError({ message: err.message, field: err.field });
    } finally {
      setLoading(false);
    }
  };

  if (!settings.allow_registration) {
    return (
      <AuthLayout title="ثبت‌نام غیرفعال است" subtitle="برای دریافت حساب کاربری با پشتیبانی تماس بگیرید.">
        <Link to="/login" className="btn-primary w-full">بازگشت به ورود</Link>
      </AuthLayout>
    );
  }

  const err = (f: string) => (error.field === f ? error.message : undefined);

  return (
    <AuthLayout title="ایجاد حساب کاربری" subtitle="با ثبت‌نام می‌توانید تیکت ثبت کنید و پاسخ‌ها را پیگیری کنید.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="نام و نام خانوادگی" required error={err('name')}>
          <input className="input" value={form.name} onChange={set('name')} required minLength={2} autoFocus autoComplete="name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ایمیل" error={err('email')} hint="حداقل یکی از ایمیل یا موبایل">
            <input className="input ltr" type="email" value={form.email} onChange={set('email')} autoComplete="email" dir="ltr" />
          </Field>
          <Field label="شماره موبایل" error={err('mobile')}>
            <input className="input ltr" value={form.mobile} onChange={set('mobile')} placeholder="09123456789" autoComplete="tel" dir="ltr" />
          </Field>
        </div>
        <Field label="نام شرکت / مجموعه" error={err('company')}>
          <input className="input" value={form.company} onChange={set('company')} autoComplete="organization" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رمز عبور" required error={err('password')} hint="حداقل ۸ کاراکتر">
            <input className="input ltr" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" dir="ltr" />
          </Field>
          <Field label="تکرار رمز عبور" required error={err('confirm')}>
            <input className="input ltr" type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" dir="ltr" />
          </Field>
        </div>
        {error.message && !error.field && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error.message}</div>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          ثبت‌نام
        </button>
        <p className="text-center text-sm text-slate-500">
          قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login" className="font-semibold text-brand hover:underline">وارد شوید</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
