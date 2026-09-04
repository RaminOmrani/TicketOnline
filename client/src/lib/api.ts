export class ApiError extends Error {
  status: number;
  field?: string;
  issues?: { path: string; message: string }[];
  constructor(status: number, message: string, field?: string, issues?: any) {
    super(message);
    this.status = status;
    this.field = field;
    this.issues = issues;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function handle(res: Response) {
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    const msg = (data && (data as any).error) || (res.status === 429 ? 'تعداد درخواست‌ها بیش از حد مجاز است.' : 'خطایی رخ داد.');
    throw new ApiError(res.status, msg, (data as any)?.field, (data as any)?.issues);
  }
  return data;
}

const base = '/api';
const headers = () => ({ 'X-Requested-With': 'XMLHttpRequest' });

export const api = {
  get: <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
    const qs = params
      ? '?' +
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return fetch(base + url + qs, { headers: headers(), credentials: 'include' }).then(handle);
  },
  post: <T = any>(url: string, body?: any): Promise<T> =>
    fetch(base + url, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body ?? {}) }).then(handle),
  patch: <T = any>(url: string, body?: any): Promise<T> =>
    fetch(base + url, { method: 'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body ?? {}) }).then(handle),
  put: <T = any>(url: string, body?: any): Promise<T> =>
    fetch(base + url, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body ?? {}) }).then(handle),
  del: <T = any>(url: string): Promise<T> => fetch(base + url, { method: 'DELETE', headers: headers(), credentials: 'include' }).then(handle),

  /** Multipart upload with progress (XHR). */
  upload: <T = any>(url: string, form: FormData, onProgress?: (pct: number) => void, method: 'POST' | 'PATCH' = 'POST'): Promise<T> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, base + url);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data: any = {};
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          if (xhr.status === 401 && onUnauthorized) onUnauthorized();
          reject(new ApiError(xhr.status, data?.error || 'خطا در ارسال.', data?.field));
        }
      };
      xhr.onerror = () => reject(new ApiError(0, 'ارتباط با سرور برقرار نشد.'));
      xhr.send(form);
    }),
};
