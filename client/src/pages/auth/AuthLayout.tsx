import { CheckCircle2, FileUp, Mic, Video, Clock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useConfig } from '@/store/config';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { settings, departments } = useConfig();
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-black/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
            <Logo />
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-snug">{settings.site_title}</h2>
          <p className="mt-3 text-base leading-8 text-white/85">{settings.tagline}. درخواست خود را ثبت کنید، فایل و تصویر بفرستید، پیام صوتی ضبط کنید و پاسخ کارشناسان را به‌صورت لحظه‌ای دریافت کنید.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: <CheckCircle2 />, t: 'پیگیری لحظه‌ای وضعیت تیکت و اعلان پاسخ‌ها' },
              { icon: <FileUp />, t: 'ارسال فایل، تصویر، فایل پشتیبان و اسناد' },
              { icon: <Video />, t: 'ارسال ویدیو از صفحه برای توضیح بهتر مشکل' },
              { icon: <Mic />, t: 'ضبط و ارسال پیام صوتی مستقیم از مرورگر' },
              { icon: <Clock />, t: 'زمان‌بندی پاسخ‌گویی (SLA) برای هر بخش' },
            ].map((i, k) => (
              <li key={k} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 [&>svg]:h-4 [&>svg]:w-4">{i.icon}</span>
                {i.t}
              </li>
            ))}
          </ul>
          {departments.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {departments.map((d) => (
                <span key={d.id} className="rounded-full bg-white/15 px-3 py-1 text-xs">{d.name}</span>
              ))}
            </div>
          )}
        </div>
        <div className="relative text-xs text-white/70">
          {settings.website && <a href={settings.website} className="hover:underline">{settings.website.replace(/^https?:\/\//, '')}</a>}
          {settings.support_email && <span className="mx-2">•</span>}
          {settings.support_email}
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
