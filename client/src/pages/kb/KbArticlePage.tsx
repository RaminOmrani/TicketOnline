import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Eye, Pencil, MessageSquarePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { faNum, formatDate, renderMarkdown } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { EmptyState, PageLoader } from '@/components/ui';
import type { KbArticle } from '@/lib/types';

export default function KbArticlePage() {
  const { slug } = useParams();
  const { isStaff } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['kb-article', slug], queryFn: () => api.get<{ article: KbArticle; related: { id: number; title: string; slug: string }[] }>(`/kb/${slug}`) });
  if (isLoading) return <PageLoader />;
  if (error || !data) return <EmptyState title="مقاله یافت نشد" action={<Link to="/kb" className="btn-primary">بازگشت</Link>} />;
  const a = data.article;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Link to="/kb" className="btn-icon"><ArrowRight className="h-5 w-5" /></Link>
        <Link to="/kb" className="text-slate-500 hover:text-brand">راهنما</Link>
        {a.category && <><span className="text-slate-300">/</span><span className="text-slate-500">{a.category}</span></>}
        {isStaff && <Link to={`/admin/kb?edit=${a.id}`} className="btn-ghost btn-sm mr-auto"><Pencil className="h-3.5 w-3.5" /> ویرایش</Link>}
      </div>
      <article className="card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold leading-9">{a.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span>به‌روزرسانی: {formatDate(a.updated_at)}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{faNum(a.views)} بازدید</span>
          {a.department_name && <span>بخش: {a.department_name}</span>}
        </div>
        {a.summary && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{a.summary}</p>}
        <div className="prose-fa mt-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.body) }} />
      </article>
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-sm text-slate-600 dark:text-slate-300">پاسخ خود را پیدا نکردید؟</span>
        <Link to={`/tickets/new${a.department_id ? `?department=${a.department_id}` : ''}`} className="btn-primary btn-sm"><MessageSquarePlus className="h-4 w-4" /> ثبت تیکت</Link>
      </div>
      {data.related.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-slate-500">مقالات مرتبط</h2>
          <ul className="space-y-1">{data.related.map((r) => <li key={r.id}><Link to={`/kb/${r.slug}`} className="text-sm text-brand hover:underline">{r.title}</Link></li>)}</ul>
        </div>
      )}
    </div>
  );
}
