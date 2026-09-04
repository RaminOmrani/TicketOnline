import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Field, Spinner } from '@/components/ui';

export default function ForgotPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot', { identifier: identifier.trim() });
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="بازیابی رمز عبور" subtitle="ایمیل یا شماره موبایل حساب خود را وارد کنید تا لینک بازیابی ارسال شود.">
      {done ? (
        <div className="card p-6 text-center">
          <MailCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">در صورت وجود حساب کاربری، لینک بازیابی رمز عبور ارسال شد. لطفاً صندوق ورودی (و پوشه اسپم) را بررسی کنید.</p>
          <Link to="/login" className="btn-secondary mt-4">بازگشت به ورود</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="ایمیل یا شماره موبایل" required>
            <input className="input ltr" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus dir="ltr" />
          </Field>
          {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            ارسال لینک بازیابی
          </button>
          <p className="text-center text-sm text-slate-500">
            <Link to="/login" className="text-brand hover:underline">بازگشت به ورود</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
