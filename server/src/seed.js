import { db } from './db.js';
import { hashPassword } from './lib/auth.js';
import { setSetting, getSetting } from './lib/settings.js';

export function seed({ verbose = true } = {}) {
  const log = (...a) => verbose && console.log('[seed]', ...a);

  const deptCount = db.prepare('SELECT COUNT(*) c FROM departments').get().c;
  if (deptCount === 0) {
    const ins = db.prepare('INSERT INTO departments (name, slug, description, icon, color, sort_order, sla_first_response_minutes, sla_resolve_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const depts = [
      ['پشتیبانی فنی', 'technical', 'مشکلات نصب، اجرا، خطاها و راهنمایی استفاده از نرم‌افزار حسابداری میلیونر', 'wrench', '#A31A1A', 1, 120, 1440],
      ['مالی و حسابداری', 'finance', 'سوالات حسابداری، صورت‌حساب، فاکتور، تمدید اشتراک و پرداخت', 'calculator', '#B45309', 2, 240, 2880],
      ['برنامه‌نویسی و توسعه', 'development', 'گزارش باگ، درخواست قابلیت جدید، سفارشی‌سازی، API و یکپارچه‌سازی', 'code', '#6D1212', 3, 480, 7200],
      ['فروش و تمدید', 'sales', 'خرید نسخه جدید، ارتقا، قیمت‌ها و مشاوره قبل از خرید', 'shopping-bag', '#C2410C', 4, 120, 1440],
      ['آموزش', 'training', 'درخواست آموزش، ویدیوهای آموزشی و راهنمای کار با ماژول‌ها', 'graduation-cap', '#8A1C1C', 5, 480, 4320],
      ['شکایات و پیشنهادات', 'feedback', 'انتقادات، شکایات و پیشنهادات برای بهبود خدمات', 'message-square-heart', '#9F1239', 6, 480, 4320],
    ];
    depts.forEach((d) => ins.run(...d));
    log('departments created');
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
