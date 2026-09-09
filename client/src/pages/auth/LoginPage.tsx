import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Eye, EyeOff, LogIn, Smartphone, KeyRound, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useConfig } from '@/store/config';
import { AuthLayout } from './AuthLayout';
import { Field, Spinner } from '@/components/ui';

function PasswordForm() {
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
    <form onSubmit={submit} className="space-y-4">
      <Field label="ایمیل یا شماره موبایل" required>
        <input className="input ltr text-left" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="example@mail.com یا 09123456789" autoComplete="username" autoFocus required dir="ltr" />
      </Field>
      <Field label="رمز عبور" required>
        <div className="relative">
          <input className="input ltr pl-10 text-left" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required dir="ltr" />
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
  );
}

function OtpForm() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<'identifier' | 'code' | 'name'>('identifier');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(0);
  const [devCode, setDevCode] = useState<string | undefined>();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [left]);

  const request = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await api.post('/auth/otp/request', { identifier: identifier.trim() });
      setDevCode(r.dev_code);
      setLeft(60);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
      toast.success(r.channel === 'mobile' ? 'کد ورود پیامک شد' : 'کد ورود ایمیل شد');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (withName = false) => {
    setError('');
    setLoading(true);
    try {
      const r = await api.post('/auth/otp/verify', { identifier: identifier.trim(), code: code.trim(), name: withName ? name.trim() : undefined, company: withName ? company.trim() || undefined : undefined });
      setUser(r.user);
      toast.success('خوش آمدید!');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (e: any) {
      if (e.status === 404) setStep('name');
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); step === 'identifier' ? request() : verify(step === 'name'); }} className="space-y-4">
      <Field label="شماره موبایل یا ایمیل" required hint="کد ۶ رقمی به همین شماره/ایمیل ارسال می‌شود.">
        <input className="input ltr text-left" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="09123456789" autoFocus required dir="ltr" disabled={step !== 'identifier'} inputMode="tel" />
      </Field>
      {step !== 'identifier' && (
        <Field label="کد تأیید" required>
          <input ref={codeRef} className="input text-center text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9۰-۹]/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" required dir="ltr" />
          {devCode && <p className="mt-1 text-xs text-amber-600">حالت آزمایشی: کد {faNum(devCode)}</p>}
        </Field>
      )}
      {step === 'name' && (
        <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">حسابی با این مشخصات وجود ندارد. برای ساخت حساب جدید نام خود را وارد کنید.</p>
          <Field label="نام و نام خانوادگی" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus /></Field>
          <Field label="نام شرکت / مجموعه"><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
        </div>
      )}
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? <Spinner className="h-4 w-4" /> : step === 'identifier' ? <Smartphone className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {step === 'identifier' ? 'ارسال کد' : step === 'name' ? 'ساخت حساب و ورود' : 'ورود'}
      </button>
      {step !== 'identifier' && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button type="button" className="hover:text-brand" onClick={() => { setStep('identifier'); setCode(''); setError(''); }}>تغییر شماره</button>
          <button type="button" className="flex items-center gap-1 hover:text-brand disabled:opacity-50" disabled={left > 0 || loading} onClick={request}>
            <RotateCcw className="h-3.5 w-3.5" /> {left > 0 ? `ارسال مجدد تا ${faNum(left)} ثانیه` : 'ارسال مجدد کد'}
          </button>
        </div>
      )}
    </form>
  );
}

export default function LoginPage() {
  const { settings } = useConfig();
  const otp = settings.otp_login_enabled !== false;
  const pw = settings.password_login_enabled !== false;
  const [mode, setMode] = useState<'otp' | 'password'>(otp ? 'otp' : 'password');
  useEffect(() => setMode(otp ? 'otp' : 'password'), [otp]);

  return (
    <AuthLayout title="ورود به حساب کاربری" subtitle="برای ثبت و پیگیری تیکت‌ها وارد شوید.">
      {otp && pw && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" onClick={() => setMode('otp')} className={clsx('flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition', mode === 'otp' ? 'bg-white text-brand shadow-sm dark:bg-slate-900' : 'text-slate-500')}><Smartphone className="h-4 w-4" /> کد یک‌بارمصرف</button>
          <button type="button" onClick={() => setMode('password')} className={clsx('flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition', mode === 'password' ? 'bg-white text-brand shadow-sm dark:bg-slate-900' : 'text-slate-500')}><KeyRound className="h-4 w-4" /> رمز عبور</button>
        </div>
      )}
      {mode === 'otp' && otp ? <OtpForm /> : <PasswordForm />}
    </AuthLayout>
  );
}
