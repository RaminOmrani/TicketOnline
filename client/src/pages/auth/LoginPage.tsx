import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { AuthLayout } from './AuthLayout';
import { Field, Spinner } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useConfig();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      toast.success('خوش آمدید!');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="ورود به حساب کاربری" subtitle="برای ثبت و پیگیری تیکت‌ها وارد شوید.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="ایمیل یا شماره موبایل" required>
          <input className="input ltr text-right" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="example@mail.com یا 09123456789" autoComplete="username" autoFocus required dir="ltr" />
        </Field>
        <Field label="رمز عبور" required>
          <div className="relative">
            <input className="input ltr pl-10" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required dir="ltr" />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShow((s) => !s)} tabIndex={-1}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-brand hover:underline">رمز عبور را فراموش کرده‌اید؟</Link>
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          ورود
        </button>
        {settings.allow_registration && (
          <p className="text-center text-sm text-slate-500">
            حساب کاربری ندارید؟ <Link to="/register" className="font-semibold text-brand hover:underline">ثبت‌نام کنید</Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
