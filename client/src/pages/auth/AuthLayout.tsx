import { CheckCircle2, FileUp, Mic, Video, Clock, MapPin, Phone, Mail } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useConfig } from '@/store/config';
import { faNum } from '@/lib/format';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { settings, departments } = useConfig();
  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* Brand panel — maroon like the softmiliac.com footer */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-deep via-[#5a0f0f] to-brand p-10 text-white lg:flex">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-black/20 blur-3xl" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-snug">{settings.slogan || settings.site_title}</h2>
          <p className="mt-2 text-lg font-semibold text-white/90">{settings.tagline}</p>
          <p className="mt-3 text-[15px] leading-8 text-white/80">درخواست خود را ثبت کنید، فایل و تصویر بفرستید، پیام صوتی ضبط کنید و پاسخ کارشناسان {settings.company_name} را به‌صورت لحظه‌ای دریافت کنید.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: <CheckCircle2 />, t: 'پیگیری لحظه‌ای وضعیت تیکت و اعلان پاسخ‌ها' },
              { icon: <FileUp />, t: 'ارسال فایل، تصویر، فایل پشتیبان و اسناد' },
              { icon: <Video />, t: 'ارسال ویدیو از صفحه برای توضیح بهتر مشکل' },
              { icon: <Mic />, t: 'ضبط و ارسال پیام صوتی مستقیم از مرورگر' },
              { icon: <Clock />, t: 'زمان‌بندی پاسخ‌گویی (SLA) برای هر بخش' },
            ].map((i, k) => (
              <li key={k} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 [&>svg]:h-4 [&>svg]:w-4">{i.icon}</span>
                {i.t}
              </li>
            ))}
          </ul>
          {departments.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {departments.map((d) => (
                <span key={d.id} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">{d.name}</span>
              ))}
            </div>
          )}
        </div>
        <div className="relative space-y-1.5 text-xs text-white/75">
          {settings.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{settings.address}</div>}
          {settings.support_phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span className="num">{faNum(settings.support_phone)}</span></div>}
          {settings.support_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{settings.support_email}</div>}
          {settings.working_hours && <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{settings.working_hours}</div>}
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
        {settings.website && (
          <a href={settings.website} className="mt-10 text-xs text-slate-400 hover:text-brand">{settings.website.replace(/^https?:\/\//, '')}</a>
        )}
      </div>
    </div>
  );
}
