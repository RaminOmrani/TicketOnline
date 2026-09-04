import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { AuthLayout } from './AuthLayout';
import { Field, Spinner } from '@/components/ui';

export default function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('تکرار رمز عبور مطابقت ندارد.');
    setLoading(true);
    setError('');
    try {
      const r = await api.post('/auth/reset', { token, password });
      setUser(r.user);
      toast.success('رمز عبور با موفقیت تغییر کرد.');
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="لینک نامعتبر" subtitle="لینک بازیابی ناقص است.">
        <Link to="/forgot-password" className="btn-primary w-full">درخواست لینک جدید</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="تعیین رمز عبور جدید">
      <form onSubmit={submit} className="space-y-4">
        <Field label="رمز عبور جدید" required hint="حداقل ۸ کاراکتر">
          <input className="input ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus dir="ltr" />
        </Field>
        <Field label="تکرار رمز عبور" required>
          <input className="input ltr" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required dir="ltr" />
        </Field>
        {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          ذخیره رمز عبور
        </button>
      </form>
    </AuthLayout>
  );
}
