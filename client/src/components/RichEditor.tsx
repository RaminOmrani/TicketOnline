import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Link2, ImagePlus, Heading2, Heading3, Pilcrow, AlignRight, AlignCenter, AlignLeft, Undo2, Redo2, Minus, Eraser, Code2, Table,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui';

interface Props {
  value: string;
  onChange: (html: string) => void;
  /** Uploads an image and resolves with its public URL. */
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

function ToolBtn({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep selection inside the editor
      onClick={onClick}
      className={clsx('flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 [&>svg]:h-4 [&>svg]:w-4', active && 'bg-brand/10 text-brand')}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />;

/**
 * Word-like WYSIWYG editor (contentEditable). Produces HTML which the server
 * sanitizes before storing.
 */
export function RichEditor({ value, onChange, onUploadImage, placeholder = 'متن مقاله را بنویسید…', className, minHeight = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, force] = useState(0);

  // Push external value into the editor only when it actually differs (avoids caret jumps while typing).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value && document.activeElement !== el) el.innerHTML = value || '';
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
    force((n) => n + 1);
  };
  const block = (tag: 'h2' | 'h3' | 'p' | 'blockquote' | 'pre') => exec('formatBlock', tag);
  const isActive = (cmd: string) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };
  const blockIs = (tag: string) => {
    try {
      return (document.queryCommandValue('formatBlock') || '').toLowerCase() === tag;
    } catch {
      return false;
    }
  };

  const insertLink = () => {
    const sel = window.getSelection();
    const current = sel && sel.anchorNode ? (sel.anchorNode.parentElement?.closest('a') as HTMLAnchorElement | null) : null;
    const url = window.prompt('آدرس لینک را وارد کنید:', current?.href || 'https://');
    if (url === null) return;
    if (!url || url === 'https://') return exec('unlink');
    if (sel && sel.isCollapsed && !current) {
      exec('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    } else exec('createLink', url);
  };

  const insertImages = async (files: File[]) => {
    if (!onUploadImage) return toast.error('بارگذاری تصویر در دسترس نیست.');
    setUploading(true);
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        const url = await onUploadImage(f);
        const alt = window.prompt('توضیح تصویر (اختیاری):', f.name.replace(/\.[^.]+$/, '')) || '';
        exec('insertHTML', `<figure><img src="${url}" alt="${alt.replace(/"/g, '&quot;')}" />${alt ? `<figcaption>${alt.replace(/</g, '&lt;')}</figcaption>` : ''}</figure><p><br></p>`);
      }
    } catch (e: any) {
      toast.error(e.message || 'خطا در بارگذاری تصویر');
    } finally {
      setUploading(false);
    }
  };

  const insertTable = () => {
    const rows = Number(window.prompt('تعداد سطرها:', '3')) || 0;
    const cols = Number(window.prompt('تعداد ستون‌ها:', '3')) || 0;
    if (!rows || !cols) return;
    const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th>ستون ${i + 1}</th>`).join('')}</tr>`;
    const body = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('');
    exec('insertHTML', `<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
  };

  return (
    <div className={clsx('rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900', className)}>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) insertImages(f); }} />
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800" dir="rtl">
        <ToolBtn title="واگرد" onClick={() => exec('undo')}><Undo2 /></ToolBtn>
        <ToolBtn title="از نو" onClick={() => exec('redo')}><Redo2 /></ToolBtn>
        <Sep />
        <ToolBtn title="عنوان بزرگ" onClick={() => block('h2')} active={blockIs('h2')}><Heading2 /></ToolBtn>
        <ToolBtn title="عنوان کوچک" onClick={() => block('h3')} active={blockIs('h3')}><Heading3 /></ToolBtn>
        <ToolBtn title="پاراگراف" onClick={() => block('p')} active={blockIs('p')}><Pilcrow /></ToolBtn>
        <Sep />
        <ToolBtn title="پررنگ (Ctrl+B)" onClick={() => exec('bold')} active={isActive('bold')}><Bold /></ToolBtn>
        <ToolBtn title="مورب (Ctrl+I)" onClick={() => exec('italic')} active={isActive('italic')}><Italic /></ToolBtn>
        <ToolBtn title="زیرخط (Ctrl+U)" onClick={() => exec('underline')} active={isActive('underline')}><Underline /></ToolBtn>
        <ToolBtn title="خط‌خورده" onClick={() => exec('strikeThrough')} active={isActive('strikeThrough')}><Strikethrough /></ToolBtn>
        <Sep />
        <ToolBtn title="فهرست نقطه‌ای" onClick={() => exec('insertUnorderedList')} active={isActive('insertUnorderedList')}><List /></ToolBtn>
        <ToolBtn title="فهرست شماره‌دار" onClick={() => exec('insertOrderedList')} active={isActive('insertOrderedList')}><ListOrdered /></ToolBtn>
        <ToolBtn title="نقل‌قول" onClick={() => block('blockquote')} active={blockIs('blockquote')}><Quote /></ToolBtn>
        <ToolBtn title="کد" onClick={() => block('pre')} active={blockIs('pre')}><Code2 /></ToolBtn>
        <Sep />
        <ToolBtn title="راست‌چین" onClick={() => exec('justifyRight')} active={isActive('justifyRight')}><AlignRight /></ToolBtn>
        <ToolBtn title="وسط‌چین" onClick={() => exec('justifyCenter')} active={isActive('justifyCenter')}><AlignCenter /></ToolBtn>
        <ToolBtn title="چپ‌چین" onClick={() => exec('justifyLeft')} active={isActive('justifyLeft')}><AlignLeft /></ToolBtn>
        <Sep />
        <ToolBtn title="لینک" onClick={insertLink}><Link2 /></ToolBtn>
        <ToolBtn title="درج تصویر" onClick={() => fileRef.current?.click()}>{uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus />}</ToolBtn>
        <ToolBtn title="جدول" onClick={insertTable}><Table /></ToolBtn>
        <ToolBtn title="خط جداکننده" onClick={() => exec('insertHorizontalRule')}><Minus /></ToolBtn>
        <Sep />
        <ToolBtn title="حذف قالب‌بندی" onClick={() => { exec('removeFormat'); block('p'); }}><Eraser /></ToolBtn>
      </div>
      <div
        ref={ref}
        className="rich-editor prose-fa max-w-none px-4 py-3 outline-none"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        dir="rtl"
        onInput={emit}
        onKeyUp={() => force((n) => n + 1)}
        onMouseUp={() => force((n) => n + 1)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files || []).filter((f) => f.type.startsWith('image/'));
          if (files.length) {
            e.preventDefault();
            insertImages(files);
            return;
          }
          // Paste as plain text keeps Word/HTML junk out; formatting is re-applied with the toolbar.
          const text = e.clipboardData.getData('text/plain');
          if (text) {
            e.preventDefault();
            document.execCommand('insertText', false, text);
            emit();
          }
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
          if (files.length) {
            e.preventDefault();
            insertImages(files);
          }
        }}
      />
      <div className="border-t border-slate-100 px-3 py-1 text-[10.5px] text-slate-400 dark:border-slate-800">می‌توانید تصویر را مستقیماً Paste یا Drag کنید. کلیدهای Ctrl+B / Ctrl+I / Ctrl+U کار می‌کنند.</div>
    </div>
  );
}
