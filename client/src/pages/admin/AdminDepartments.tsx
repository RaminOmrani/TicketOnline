import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Building2, PlusCircle, Pencil, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { faNum, formatMinutes } from '@/lib/format';
import { useConfig } from '@/store/config';
import { Avatar, ConfirmDialog, Field, Modal, Spinner, Toggle } from '@/components/ui';
import { DeptIcon, DEPT_ICONS } from '@/components/tickets/badges';
import type { Department, User } from '@/lib/types';

const ICONS = DEPT_ICONS;
const COLORS = ['#A31A1A', '#6D1212', '#9F1239', '#C2410C', '#B45309', '#8A1C1C', '#7c3aed', '#0f766e', '#2563eb', '#334155'];

type Form = { id?: number; name: string; description: string; icon: string; color: string; is_active: boolean; sort_order: number; sla_first_response_minutes: number; sla_resolve_minutes: number; auto_assign: boolean; agent_ids: number[] };
const empty: Form = { name: '', description: '', icon: 'life-buoy', color: '#A31A1A', is_active: true, sort_order: 0, sla_first_response_minutes: 240, sla_resolve_minutes: 2880, auto_assign: true, agent_ids: [] };

export default function AdminDepartments() {
  const qc = useQueryClient();
  const { reload } = useConfig();
  const [edit, setEdit] = useState<Form | null>(null);
  const [del, setDel] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const { data } = useQuery({ queryKey: ['admin-departments'], queryFn: () => api.get<{ items: Department[] }>('/admin/departments') });
  const { data: staff } = useQuery({ queryKey: ['staff'], queryFn: () => api.get<{ items: User[] }>('/admin/staff') });

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const { id, ...payload } = edit;
      if (id) await api.patch(`/admin/departments/${id}`, payload);
      else await api.post('/admin/departments', payload);
      qc.invalidateQueries({ queryKey: ['admin-departments'] });
      reload();
      setEdit(null);
      toast.success('ذخیره شد');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><Building2 className="h-5 w-5 text-brand" /> بخش‌های پشتیبانی</h1><p className="text-xs text-slate-500">بخش‌ها، کارشناسان هر بخش و زمان‌بندی پاسخ‌گویی (SLA)</p></div>
        <button className="btn-primary mr-auto" onClick={() => setEdit({ ...empty, sort_order: (data?.items.length || 0) + 1 })}><PlusCircle className="h-4 w-4" /> بخش جدید</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data?.items.map((d) => (
          <div key={d.id} className={clsx('card p-4', !d.is_active && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${d.color}1a`, color: d.color || undefined }}><DeptIcon name={d.icon} className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><h3 className="font-bold">{d.name}</h3>{!d.is_active && <span className="chip bg-slate-100 text-slate-500">غیرفعال</span>}{!d.auto_assign && <span className="chip bg-amber-50 text-amber-700">تخصیص دستی</span>}</div>
                <p className="mt-0.5 text-xs text-slate-500">{d.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>اولین پاسخ: {formatMinutes(d.sla_first_response_minutes)}</span>
                  <span>حل: {formatMinutes(d.sla_resolve_minutes)}</span>
                  <span>{faNum(d.open_tickets || 0)} تیکت باز</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {d.agents?.length ? d.agents.map((a) => <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-0.5 text-[11px] dark:bg-slate-800"><Avatar user={a} size="xs" />{a.name}</span>) : <span className="text-[11px] text-rose-500">بدون کارشناس — تیکت‌ها به مدیر اطلاع داده می‌شود</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn-icon h-8 w-8" onClick={() => setEdit({ id: d.id, name: d.name, description: d.description || '', icon: d.icon || 'life-buoy', color: d.color || '#A31A1A', is_active: !!d.is_active, sort_order: d.sort_order || 0, sla_first_response_minutes: d.sla_first_response_minutes || 240, sla_resolve_minutes: d.sla_resolve_minutes || 2880, auto_assign: !!d.auto_assign, agent_ids: (d.agents || []).map((a) => a.id) })}><Pencil className="h-4 w-4" /></button>
                <button className="btn-icon h-8 w-8 text-rose-500" onClick={() => setDel(d)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'ویرایش بخش' : 'بخش جدید'} size="lg" footer={<><button className="btn-secondary" onClick={() => setEdit(null)}>انصراف</button><button className="btn-primary" onClick={save} disabled={saving || !edit?.name}>{saving && <Spinner className="h-4 w-4" />} ذخیره</button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2"><Field label="نام بخش" required><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field></div>
              <Field label="ترتیب"><input className="input ltr" type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
            </div>
            <Field label="توضیح کوتاه" hint="به مشتری کمک می‌کند بخش درست را انتخاب کند."><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="آیکون">
                <div className="flex flex-wrap gap-1.5">
                  {ICONS.map((i) => <button key={i} type="button" onClick={() => setEdit({ ...edit, icon: i })} className={clsx('flex h-9 w-9 items-center justify-center rounded-lg border transition', edit.icon === i ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700')}><DeptIcon name={i} className="h-4 w-4" /></button>)}
                </div>
              </Field>
              <Field label="رنگ">
                <div className="flex flex-wrap items-center gap-1.5">
                  {COLORS.map((c) => <button key={c} type="button" onClick={() => setEdit({ ...edit, color: c })} className={clsx('h-8 w-8 rounded-full border-2 transition', edit.color === c ? 'border-slate-900 scale-110 dark:border-white' : 'border-transparent')} style={{ background: c }} />)}
                  <input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                </div>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="مهلت اولین پاسخ (دقیقه)" hint={formatMinutes(edit.sla_first_response_minutes)}><input className="input ltr" type="number" min={5} value={edit.sla_first_response_minutes} onChange={(e) => setEdit({ ...edit, sla_first_response_minutes: Number(e.target.value) })} /></Field>
              <Field label="مهلت حل تیکت (دقیقه)" hint={formatMinutes(edit.sla_resolve_minutes)}><input className="input ltr" type="number" min={15} value={edit.sla_resolve_minutes} onChange={(e) => setEdit({ ...edit, sla_resolve_minutes: Number(e.target.value) })} /></Field>
            </div>
            <Field label="کارشناسان این بخش">
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-2">
                {staff?.items.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type="checkbox" className="accent-[rgb(var(--brand-rgb))]" checked={edit.agent_ids.includes(u.id)} onChange={(e) => setEdit({ ...edit, agent_ids: e.target.checked ? [...edit.agent_ids, u.id] : edit.agent_ids.filter((x) => x !== u.id) })} />
                    <Avatar user={u} size="xs" /> {u.name} <span className="text-[10px] text-slate-400">{u.role === 'admin' ? 'مدیر' : 'کارشناس'}</span>
                  </label>
                ))}
                {!staff?.items.length && <span className="text-xs text-slate-400">کارشناسی تعریف نشده است.</span>}
              </div>
            </Field>
            <Toggle checked={edit.auto_assign} onChange={(v) => setEdit({ ...edit, auto_assign: v })} label="تخصیص خودکار" description="تیکت جدید به کارشناسی که کمترین تیکت باز را دارد تخصیص می‌یابد." />
            <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="فعال" description="بخش غیرفعال برای مشتریان نمایش داده نمی‌شود." />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="حذف بخش" message={`بخش «${del?.name}» حذف شود؟ اگر تیکتی دارد، حذف ممکن نیست و باید غیرفعال شود.`} confirmText="حذف" onConfirm={async () => { try { await api.del(`/admin/departments/${del!.id}`); qc.invalidateQueries({ queryKey: ['admin-departments'] }); reload(); toast.success('حذف شد'); } catch (e: any) { toast.error(e.message); } setDel(null); }} />
    </div>
  );
}
