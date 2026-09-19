import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { BookOpen, Eye, FolderOpen, Clock, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum, timeAgo } from '@/lib/format';
import { EmptyState, SearchInput, Skeleton } from '@/components/ui';
import type { KbArticle } from '@/lib/types';

export function ArticleCard({ a }: { a: KbArticle }) {
  return (
    <Link to={`/kb/${a.slug}`} className="card flex gap-4 overflow-hidden p-4 transition hover:border-brand/40 hover:shadow-pop">
      {a.cover_image && <img src={a.cover_image} alt="" className="hidden h-24 w-36 shrink-0 rounded-xl object-cover sm:block" loading="lazy" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {a.category && <span className="chip bg-brand/10 text-brand">{a.category}</span>}
          {!!a.is_faq && <span className="chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><HelpCircle className="h-3 w-3" /> سوال متداول</span>}
          {(a.company_name || a.department_name) && <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{a.company_name}{a.department_name ? ` › ${a.department_name}` : ''}</span>}
          {!a.is_published && <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800">پیش‌نویس</span>}
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{faNum(a.views)} بازدید</span>
          <span className="mr-auto inline-flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(a.updated_at)}</span>
        </div>
        <h3 className="mt-1.5 font-bold leading-7">{a.title}</h3>
        {a.summary && <p className="mt-0.5 line-clamp-2 text-sm leading-6 text-slate-500">{a.summary}</p>}
      </div>
    </Link>
  );
}

export default function KbListPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const company = Number(params.get('company')) || 0;
  const setCompany = (id: number) => { const p = new URLSearchParams(params); id ? p.set('company', String(id)) : p.delete('company'); setParams(p, { replace: true }); setCat(''); };
  const { data, isLoading } = useQuery({ queryKey: ['kb', q, cat, company], queryFn: () => api.get<{ items: KbArticle[]; categories: { category: string; c: number }[]; companies: { id: number; name: string; logo?: string | null; c: number }[]; general: number }>('/kb', { q, category: cat, company_id: company || undefined }) });

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header: title/description on the right, search on the left */}
      <div className="card mb-5 flex flex-col gap-4 bg-gradient-to-l from-brand/10 to-transparent p-6 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-extrabold"><BookOpen className="h-6 w-6 text-brand" /> راهنما و پایگاه دانش</h1>
          <p className="mt-1 text-sm text-slate-500">پاسخ سوالات پرتکرار و راهنمای کار با نرم‌افزار را اینجا پیدا کنید.</p>
        </div>
        <div className="w-full md:w-80">
          <SearchInput value={q} onChange={setQ} placeholder="جستجو در مقالات…" />
        </div>
      </div>
      {/* Company filter: each brand has its own guide; «همه» shows everything */}
      {data && data.companies.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button className={clsx('chip border px-3 py-1.5 text-[13px] transition', !company ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300')} onClick={() => setCompany(0)}>همه راهنماها</button>
          {data.companies.map((c) => (
            <button key={c.id} className={clsx('chip border px-3 py-1.5 text-[13px] transition', company === c.id ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300')} onClick={() => setCompany(c.id)}>
              {c.logo && <img src={c.logo} alt="" className="logo-well h-4 w-auto rounded-sm px-0.5" />}
              {c.name}
              <span className={clsx('rounded-full px-1.5 text-[10px]', company === c.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700')}>{faNum(c.c + (data.general || 0))}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="card h-fit p-3">
          <div className="mb-1 px-2 text-xs font-bold text-slate-400">دسته‌بندی‌ها</div>
          <button className={clsx('nav-item w-full', !cat && 'active')} onClick={() => setCat('')}><FolderOpen className="h-4 w-4" /> همه مقالات</button>
          {data?.categories.map((c) => (
            <button key={c.category} className={clsx('nav-item w-full', cat === c.category && 'active')} onClick={() => setCat(c.category)}>
              <span className="flex-1 text-start">{c.category}</span>
              <span className="text-xs text-slate-400">{faNum(c.c)}</span>
            </button>
          ))}
        </aside>
        <div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : !data?.items.length ? (
            <div className="card"><EmptyState icon={<BookOpen />} title="مقاله‌ای یافت نشد" description="عبارت دیگری جستجو کنید یا تیکت ثبت کنید." action={<Link to="/tickets/new" className="btn-primary">ثبت تیکت</Link>} /></div>
          ) : (
            <div className="space-y-3">{data.items.map((a) => <ArticleCard key={a.id} a={a} />)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
