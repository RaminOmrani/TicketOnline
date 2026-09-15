import { db } from './db.js';
import { hashPassword } from './lib/auth.js';
import { setSetting, getSetting } from './lib/settings.js';
import { DEFAULT_BUSINESS_HOURS } from './lib/businessHours.js';

export function seed({ verbose = true } = {}) {
  const log = (...a) => verbose && console.log('[seed]', ...a);

  /* ---------- Companies / brands ---------- */
  const companyCount = db.prepare('SELECT COUNT(*) c FROM companies').get().c;
  if (companyCount === 0) {
    const ins = db.prepare('INSERT INTO companies (name, name_en, slug, description, color, sort_order, ticket_prefix, support_email, support_phone, website, business_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const hours = JSON.stringify(DEFAULT_BUSINESS_HOURS);
    const companies = [
      ['میلیونر', 'Millionaire', 'millionaire', 'نرم‌افزار حسابداری میلیونر', '#8B0000', 1, 'MLN', 'info@softmiliac.com', '051-38473801-4', 'https://softmiliac.com', hours],
      ['CRM میلیونر', 'Millionaire CRM', 'crm', 'نرم‌افزار مدیریت ارتباط با مشتری', '#8B0000', 2, 'CRM', 'info@softmiliac.com', '051-38473801-4', 'https://softmiliac.com', hours],
      ['منوکلاب', 'MenuClub', 'menuclub', 'منوی دیجیتال و باشگاه مشتریان', '#2F3F8F', 3, 'MNU', 'info@softmiliac.com', '051-38473801-4', '', hours],
      ['شاپ مجهز', 'Shop Mojahaz', 'shop-mojahaz', 'تجهیزات و سخت‌افزار فروشگاهی', '#1E6FD0', 4, 'SHM', 'info@softmiliac.com', '051-38473801-4', '', hours],
    ];
    companies.forEach((c) => ins.run(...c));
    const insP = db.prepare('INSERT INTO products (company_id, name, sort_order) VALUES (?, ?, ?)');
    const byslug = (slug) => db.prepare('SELECT id FROM companies WHERE slug = ?').get(slug).id;
    [['millionaire', ['نرم‌افزار حسابداری فروشگاهی', 'نرم‌افزار حسابداری شرکتی', 'نرم‌افزار حسابداری پخش مویرگی', 'نرم‌افزار حسابداری پخش مواد غذایی', 'سایر']],
     ['crm', ['CRM فروش', 'CRM پشتیبانی', 'سایر']],
     ['menuclub', ['منوی دیجیتال', 'باشگاه مشتریان', 'سایر']],
     ['shop-mojahaz', ['بارکدخوان', 'فیش‌پرینتر', 'صندوق فروشگاهی', 'کشوی پول', 'سایر']]].forEach(([slug, list]) => list.forEach((n, i) => insP.run(byslug(slug), n, i)));
    log('companies created');
  }

  // Brand colours taken from the official logos — applied once to companies still on the default colour
  const BRAND_COLORS = { menuclub: '#2F3F8F', 'shop-mojahaz': '#1E6FD0' };
  for (const [slug, color] of Object.entries(BRAND_COLORS)) {
    db.prepare("UPDATE companies SET color = ? WHERE slug = ? AND (color IS NULL OR color = '#8B0000')").run(color, slug);
  }

  // Articles tied to a department belong to that department's company
  db.prepare('UPDATE kb_articles SET company_id = (SELECT company_id FROM departments d WHERE d.id = kb_articles.department_id) WHERE company_id IS NULL AND department_id IS NOT NULL').run();

  // Attach legacy rows (created before multi-company) to the first company
  const firstCompany = db.prepare('SELECT id FROM companies ORDER BY sort_order, id LIMIT 1').get()?.id;
  if (firstCompany) {
    db.prepare('UPDATE departments SET company_id = ? WHERE company_id IS NULL').run(firstCompany);
    db.prepare('UPDATE tickets SET company_id = (SELECT company_id FROM departments d WHERE d.id = tickets.department_id) WHERE company_id IS NULL').run();
  }

  /* ---------- Departments: every company gets a default set if it has none ---------- */
  {
    const ins = db.prepare('INSERT INTO departments (name, slug, description, icon, color, sort_order, sla_first_response_minutes, sla_resolve_minutes, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const full = [
      ['پشتیبانی فنی', 'technical', 'مشکلات نصب، اجرا، خطاها و راهنمایی استفاده', 'wrench', 1, 120, 1440],
      ['مالی و حسابداری', 'finance', 'صورت‌حساب، فاکتور، تمدید اشتراک و پرداخت', 'calculator', 2, 240, 2880],
      ['برنامه‌نویسی و توسعه', 'development', 'گزارش باگ، درخواست قابلیت جدید، سفارشی‌سازی و یکپارچه‌سازی', 'code', 3, 480, 7200],
      ['فروش و تمدید', 'sales', 'خرید نسخه جدید، ارتقا، قیمت‌ها و مشاوره قبل از خرید', 'shopping-bag', 4, 120, 1440],
      ['آموزش', 'training', 'درخواست آموزش، ویدیوهای آموزشی و راهنمای کار با ماژول‌ها', 'graduation-cap', 5, 480, 4320],
      ['شکایات و پیشنهادات', 'feedback', 'انتقادات، شکایات و پیشنهادات برای بهبود خدمات', 'message-square-heart', 6, 480, 4320],
    ];
    const short = full.filter((d) => ['technical', 'finance', 'sales', 'feedback'].includes(d[1]));
    const hw = [
      ['پشتیبانی فنی و گارانتی', 'technical', 'خرابی دستگاه، راه‌اندازی، درایور و گارانتی', 'wrench', 1, 120, 2880],
      ['مالی', 'finance', 'فاکتور، پرداخت و مرجوعی', 'calculator', 2, 240, 2880],
      ['فروش', 'sales', 'استعلام قیمت، مشاوره خرید و سفارش', 'shopping-bag', 3, 120, 1440],
      ['شکایات و پیشنهادات', 'feedback', 'انتقادات و پیشنهادات', 'message-square-heart', 4, 480, 4320],
    ];
    let created = 0;
    for (const c of db.prepare('SELECT id, slug FROM companies ORDER BY sort_order').all()) {
      const has = db.prepare('SELECT COUNT(*) c FROM departments WHERE company_id = ?').get(c.id).c;
      if (has) continue;
      const list = c.slug === 'millionaire' ? full : c.slug === 'shop-mojahaz' ? hw : short;
      list.forEach((d) => {
        let slug = `${c.slug}-${d[1]}`;
        if (db.prepare('SELECT id FROM departments WHERE slug = ?').get(slug)) slug = `${slug}-${c.id}`;
        ins.run(d[0], slug, d[2], d[3], '#8B0000', d[4], d[5], d[6], c.id);
      });
      created++;
    }
    if (created) log(`departments created for ${created} companies`);
  }

  const adminCount = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;
  if (adminCount === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@softmiliac.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const info = db.prepare("INSERT INTO users (name, email, password_hash, role, title) VALUES (?, ?, ?, 'admin', ?)").run(process.env.ADMIN_NAME || 'مدیر سیستم', email, hashPassword(password), 'مدیر پشتیبانی');
    const allDepts = db.prepare('SELECT id FROM departments').all();
    const ins = db.prepare('INSERT OR IGNORE INTO agent_departments (user_id, department_id) VALUES (?, ?)');
    allDepts.forEach((d) => ins.run(info.lastInsertRowid, d.id));
    log(`admin created: ${email} / ${password}`);
  }

  const cannedCount = db.prepare('SELECT COUNT(*) c FROM canned_responses').get().c;
  if (cannedCount === 0) {
    const ins = db.prepare('INSERT INTO canned_responses (title, shortcut, body) VALUES (?, ?, ?)');
    [
      ['خوش‌آمدگویی و دریافت', 'hi', 'سلام {{customer_name}} عزیز،\nممنون از پیام شما. درخواست شما با شماره {{ticket_number}} در حال بررسی است و به‌زودی نتیجه را اطلاع می‌دهیم.\n\nبا احترام\n{{agent_name}} — پشتیبانی میلیونر'],
      ['درخواست اطلاعات بیشتر', 'info', 'سلام {{customer_name}} عزیز،\nبرای بررسی دقیق‌تر لطفاً موارد زیر را ارسال کنید:\n۱. نسخه نرم‌افزار (از منوی «درباره» قابل مشاهده است)\n۲. تصویر یا فیلم از خطا\n۳. مراحلی که منجر به بروز مشکل می‌شود\n\nبا تشکر'],
      ['درخواست دسترسی ریموت', 'remote', 'سلام {{customer_name}} عزیز،\nبرای رفع مشکل نیاز به اتصال از راه دور داریم. لطفاً نرم‌افزار AnyDesk را اجرا کرده و شناسه و رمز آن را همین‌جا ارسال کنید. تیم ما در ساعات کاری متصل خواهد شد.'],
      ['حل مشکل و جمع‌بندی', 'done', 'سلام {{customer_name}} عزیز،\nمشکل گزارش‌شده برطرف شد. در صورتی که همچنان مشکلی وجود دارد، با ارسال پیام در همین تیکت آن را مجدداً باز کنید. خوشحال می‌شویم به کیفیت پشتیبانی امتیاز دهید.\n\nبا احترام\n{{agent_name}}'],
      ['پشتیبان‌گیری قبل از عملیات', 'backup', 'پیش از انجام مراحل زیر، حتماً از پایگاه داده نرم‌افزار نسخه پشتیبان تهیه کنید (منوی «ابزار» → «پشتیبان‌گیری»). سپس مراحل را انجام دهید:\n'],
    ].forEach((c) => ins.run(...c));
    log('canned responses created');
  }

  const kbCount = db.prepare('SELECT COUNT(*) c FROM kb_articles').get().c;
  if (kbCount === 0) {
    const tech = db.prepare("SELECT id FROM departments WHERE slug = 'technical'").get()?.id || null;
    const fin = db.prepare("SELECT id FROM departments WHERE slug = 'finance'").get()?.id || null;
    const ins = db.prepare('INSERT INTO kb_articles (title, slug, summary, body, category, department_id) VALUES (?, ?, ?, ?, ?, ?)');
    ins.run(
      'چطور یک تیکت خوب ثبت کنم؟',
      'how-to-write-a-good-ticket',
      'با رعایت چند نکته ساده، پاسخ سریع‌تر و دقیق‌تری دریافت می‌کنید.',
      '## بخش درست را انتخاب کنید\nهر بخش کارشناسان مخصوص خودش را دارد. برای خطاهای نرم‌افزار «پشتیبانی فنی»، برای فاکتور و پرداخت «مالی» و برای درخواست قابلیت جدید «برنامه‌نویسی» را انتخاب کنید.\n\n## جزئیات را کامل بنویسید\n- نسخه نرم‌افزار\n- متن دقیق خطا (یا تصویر آن)\n- مراحلی که منجر به بروز مشکل می‌شود\n\n## از پیوست‌ها استفاده کنید\nمی‌توانید تصویر، فیلم کوتاه از صفحه، فایل پشتیبان یا حتی پیام صوتی ضبط کنید و ارسال کنید.\n\n## اولویت را واقع‌بینانه انتخاب کنید\nاولویت «فوری» فقط برای مواردی است که کار شرکت شما متوقف شده است.',
      'راهنمای سامانه',
      null
    );
    ins.run(
      'تهیه نسخه پشتیبان از نرم‌افزار حسابداری میلیونر',
      'backup-guide',
      'روش تهیه و بازیابی نسخه پشتیبان از پایگاه داده.',
      '## تهیه پشتیبان\n1. از منوی **ابزار** گزینه **پشتیبان‌گیری** را انتخاب کنید.\n2. مسیر ذخیره‌سازی را مشخص کنید (ترجیحاً روی درایوی غیر از ویندوز یا فضای ابری).\n3. روی «شروع» کلیک کنید و تا پایان عملیات صبر کنید.\n\n## بازیابی پشتیبان\n1. از منوی **ابزار** گزینه **بازیابی** را انتخاب کنید.\n2. فایل پشتیبان را انتخاب کنید.\n\n> توصیه می‌کنیم پشتیبان‌گیری به‌صورت روزانه و به‌صورت خودکار تنظیم شود.',
      'پشتیبانی فنی',
      tech
    );
    ins.run(
      'نحوه دریافت فاکتور رسمی و تمدید اشتراک',
      'invoice-and-renewal',
      'راهنمای دریافت فاکتور رسمی و مراحل تمدید اشتراک سالانه.',
      '## دریافت فاکتور\nپس از پرداخت، فاکتور رسمی به ایمیل شما ارسال می‌شود. در صورت نیاز به فاکتور با مشخصات حقوقی، در تیکت بخش **مالی** شناسه ملی و کد اقتصادی را ارسال کنید.\n\n## تمدید اشتراک\n۳۰ روز قبل از پایان اشتراک، پیامک یادآوری دریافت می‌کنید. برای تمدید، تیکتی در بخش **فروش و تمدید** ثبت کنید یا با شماره پشتیبانی تماس بگیرید.',
      'مالی',
      fin
    );
    log('knowledge base articles created');
  }

  if (!db.prepare("SELECT 1 FROM settings WHERE key = 'ticket_counter'").get()) {
    setSetting('ticket_counter', getSetting('ticket_counter'));
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed();
  console.log('seed complete');
}
