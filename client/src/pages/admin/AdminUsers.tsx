import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Users, PlusCircle, Pencil, Trash2, Copy, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, timeAgo } from '@/lib/format';
import { useConfig } from '@/store/config';
import { useAuth } from '@/store/auth';
import { Avatar, ConfirmDialog, Field, Modal, Pagination, SearchInput, Spinner, Tabs, Toggle } from '@/components/ui';
import type { Role, User } from '@/lib/types';

type Form = { id?: number; name: string; email: string; mobile: string; password: string; role: Role; company: string; title: string; is_active: boolean; department_ids: number[]; send_welcome: boolean };
const empty: Form = { name: '', email: '', mobile: '', password: '', role: 'customer', company: '', title: '', is_active: true, department_ids: [], send_welcome: true };

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { departments } = useConfig();
  const [params, setParams] = useSearchParams();
  const role = (params.get('role') || '') as Role | '';
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Form | null>(null);
  const [del, setDel] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [err, setErr] = useState<{ message: string; field?: string }>({ message: '' });

  useEffect(() => {
    const t = setTimeout(() => { setDq(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const n = params.get('new');
    if (n) setEdit({ ...empty, role: (n as Role) || 'customer' });
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ['admin-users', role, dq, page], queryFn: () => api.get<{ items: User[]; total: number; pages: number }>('/admin/users', { role, q: dq, page }), placeholderData: (p) => p });

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    setErr({ message: '' });
    try {
      const { id, ...payload } = edit;
      let r;
      if (id) r = await api.patch(`/admin/users/${id}`, payload);
      else r = await api.post('/admin/users', payload);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      setEdit(null);
      if (r.generated_password) setGenerated(`${r.user.email || r.user.mobile} / ${r.generated_password}`);
      toast.success('ذخیره شد');
    } catch (e: any) {
      setErr({ message: e.message, field: e.field });
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const fe = (f: string) => (err.field === f ? err.message : undefined);
  const roleLabel: Record<Role, string> = { customer: 'مشتری', agent: 'کارشناس', admin: 'مدیر' };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><Users className="h-5 w-5 text-brand" /> کاربران و کارشناسان</h1><p className="text-xs text-slate-500">{data ? `${faNum(data.total)} کاربر` : ''}</p></div>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          <Tabs value={role} onChange={(v) => { setParams(v ? { role: v } : {}); setPage(1); }} items={[{ value: '', label: 'همه' }, { value: 'customer', label: 'مشتریان' }, { value: 'agent', label: 'کارشناسان' }, { value: 'admin', label: 'مدیران' }]} />
          <SearchInput value={q} onChange={setQ} className="w-56" />
          <button className="btn-primary" onClick={() => { setErr({ message: '' }); setEdit({ ...empty, role: role || 'customer' }); }}><PlusCircle className="h-4 w-4" /> کاربر جدید</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3 text-start font-medium">کاربر</th><th className="px-4 py-3 text-start font-medium">نقش</th><th className="px-4 py-3 text-start font-medium">تماس</th><th className="px-4 py-3 text-start font-medium">بخش‌ها</th><th className="px-4 py-3 text-center font-medium">تیکت</th><th className="px-4 py-3 text-start font-medium">آخرین فعالیت</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && !data && <tr><td colSpan={7} className="p-8 text-center"><Spinner className="mx-auto h-6 w-6 text-brand" /></td></tr>}
              {data?.items.map((u) => (
                <tr key={u.id} className={clsx('hover:bg-slate-50/60 dark:hover:bg-slate-800/40', !u.is_active && 'opacity-50')}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar user={u} size="sm" showStatus={u.role !== 'customer'} online={u.online} /><div><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">{u.company || u.title}</div></div></div></td>
                  <td className="px-4 py-3"><span className={clsx('chip', u.role === 'admin' ? 'bg-violet-50 text-violet-700' : u.role === 'agent' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800')}>{roleLabel[u.role]}</span>{!u.is_active && <span className="chip mr-1 bg-rose-50 text-rose-600">غیرفعال</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-500"><div className="ltr text-right">{u.email}</div><div className="ltr text-right num">{faNum(u.mobile || '')}</div></td>
                  <td className="px-4 py-3 text-xs">{u.departments?.length ? u.departments.map((d) => <span key={d.id} className="chip mb-0.5 ml-0.5 border" style={{ color: d.color || undefined, borderColor: `${d.color}44` }}>{d.name}</span>) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-center num">{faNum(u.ticket_count || 0)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{u.last_seen_at ? timeAgo(u.last_seen_at) : '—'}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><button className="btn-icon h-8 w-8" onClick={() => { setErr({ message: '' }); setEdit({ id: u.id, name: u.name, email: u.email || '', mobile: u.mobile || '', password: '', role: u.role, company: u.company || '', title: u.title || '', is_active: !!u.is_active, department_ids: (u.departments || []).map((d) => d.id), send_welcome: false }); }}><Pencil className="h-4 w-4" /></button>{u.id !== me?.id && <button className="btn-icon h-8 w-8 text-rose-500" onClick={() => setDel(u)}><Trash2 className="h-4 w-4" /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <div className="border-t border-slate-100 p-3 dark:border-slate-800"><Pagination page={page} pages={data.pages} total={data.total} onChange={setPage} /></div>}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'ویرایش کاربر' : 'کاربر جدید'} size="lg" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button><button className="btn-primary" onClick={save} disabled={saving || !edit?.name}>{saving && <Spinner className="h-4 w-4" />} ذخیره</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="نام و نام خانوادگی" required error={fe('name')}><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="نقش">
                <select className="input" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })} disabled={edit.id === me?.id}>
                  <option value="customer">مشتری</option><option value="agent">کارشناس پشتیبانی</option><option value="admin">مدیر سیستم</option>
                </select>
              </Field>
              <Field label="ایمیل" error={fe('email')}><input className="input ltr" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} dir="ltr" /></Field>
              <Field label="موبایل" error={fe('mobile')}><input className="input ltr" value={edit.mobile} onChange={(e) => setEdit({ ...edit, mobile: e.target.value })} dir="ltr" placeholder="09123456789" /></Field>
              {edit.role === 'customer' ? <Field label="شرکت"><input className="input" value={edit.company} onChange={(e) => setEdit({ ...edit, company: e.target.value })} /></Field> : <Field label="سمت"><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="مثلاً کارشناس فنی" /></Field>}
              <Field label={edit.id ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} hint={edit.id ? 'برای تغییر رمز پر کنید' : 'خالی بگذارید تا رمز تصادفی ساخته شود'} error={fe('password')}>
                <div className="relative"><input className="input ltr" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} dir="ltr" autoComplete="new-password" /><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" /></div>
              </Field>
            </div>
            {edit.role !== 'customer' && (
              <Field label="بخش‌های کارشناس" hint="کارشناس تیکت‌های این بخش‌ها را می‌بیند و اعلان می‌گیرد.">
                <div className="flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <label key={d.id} className={clsx('flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition', edit.department_ids.includes(d.id) ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 dark:border-slate-700')}>
                      <input type="checkbox" className="hidden" checked={edit.department_ids.includes(d.id)} onChange={(e) => setEdit({ ...edit, department_ids: e.target.checked ? [...edit.department_ids, d.id] : edit.department_ids.filter((x) => x !== d.id) })} />
                      {d.name}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {edit.id !== me?.id && <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="حساب فعال" description="کاربر غیرفعال نمی‌تواند وارد شود." />}
            {!edit.id && <Toggle checked={edit.send_welcome} onChange={(v) => setEdit({ ...edit, send_welcome: v })} label="ارسال ایمیل خوش‌آمد با اطلاعات ورود" />}
            {err.message && !err.field && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{err.message}</div>}
          </div>
        )}
      </Modal>

      <Modal open={!!generated} onClose={() => setGenerated(null)} title="اطلاعات ورود کاربر" size="sm" footer={<button className="btn-primary" onClick={() => setGenerated(null)}>متوجه شدم</button>}>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">رمز عبور تصادفی ساخته شد. این اطلاعات فقط یک‌بار نمایش داده می‌شود:</p>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-3 font-mono text-sm dark:bg-slate-800 ltr"><span className="flex-1 select-all">{generated}</span><button className="btn-icon h-8 w-8" onClick={() => navigator.clipboard.writeText(generated || '').then(() => toast.success('کپی شد'))}><Copy className="h-4 w-4" /></button></div>
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="حذف کاربر" message={`کاربر «${del?.name}» حذف شود؟ اگر تیکت دارد، به‌جای حذف باید غیرفعال شود.`} confirmText="حذف" onConfirm={async () => { try { await api.del(`/admin/users/${del!.id}`); qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('حذف شد'); } catch (e: any) { toast.error(e.message); } setDel(null); }} />
    </div>
  );
}
