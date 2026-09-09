import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { applyBrandColor } from '@/lib/format';
import type { PublicConfig } from '@/lib/types';

const fallback: PublicConfig = {
  settings: {
    company_name: 'میلیونر',
    company_name_en: 'Millionaire',
    site_title: 'مرکز پشتیبانی میلیونر',
    tagline: 'پیشگام در حسابداری هوشمند ایران',
    slogan: 'میلیونر؛ هوشمندتر از همیشه',
    address: '',
    logo: '',
    brand_color: '#8B0000',
    support_email: '',
    support_phone: '',
    website: '',
    working_hours: '',
    products: [],
    max_upload_mb: 100,
    max_attachments: 10,
    allowed_extensions: '',
    allow_registration: true,
    welcome_message: '',
    reopen_window_days: 30,
    otp_login_enabled: true,
    password_login_enabled: true,
  },
  departments: [],
  companies: [],
  channels: { email: false, sms: false },
  statuses: { open: 'باز', in_progress: 'در حال بررسی', waiting_customer: 'در انتظار پاسخ مشتری', resolved: 'حل شده', closed: 'بسته شده' },
  priorities: { low: 'کم', normal: 'عادی', high: 'زیاد', urgent: 'فوری' },
};

interface ConfigCtx extends PublicConfig {
  reload: () => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Ctx = createContext<ConfigCtx>(null as any);

function initialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<PublicConfig>(fallback);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);

  const reload = async () => {
    try {
      const c = await api.get<PublicConfig>('/public/config');
      setCfg(c);
    } catch {}
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    applyBrandColor(cfg.settings.brand_color);
    document.title = cfg.settings.site_title;
  }, [cfg.settings.brand_color, cfg.settings.site_title]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  const value = useMemo<ConfigCtx>(() => ({ ...cfg, reload, theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [cfg, theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);
