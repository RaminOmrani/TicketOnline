import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuth } from './auth';
import type { Message, Notification, Ticket } from '@/lib/types';

let audioCtx: AudioContext | null = null;
export function playPing() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

export function useRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    const s = getSocket();
    if (!s.connected) s.connect();

    const onMessage = (m: Message) => {
      qc.invalidateQueries({ queryKey: ['ticket', m.ticket_id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      if (m.sender?.id !== userRef.current?.id) {
        playPing();
        const onPage = location.pathname === `/tickets/${m.ticket_id}`;
        if (!onPage) {
          toast(
            (t) => (
              <button className="text-start" onClick={() => { toast.dismiss(t.id); navigate(`/tickets/${m.ticket_id}`); }}>
                <div className="font-semibold text-sm">{m.sender?.name || 'سیستم'}</div>
                <div className="text-xs text-slate-500 line-clamp-2">{m.body || '📎 پیوست جدید'}</div>
              </button>
            ),
            { icon: '💬', duration: 6000 }
          );
        }
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const n = new Notification(m.sender?.name || 'پیام جدید', { body: m.body?.slice(0, 120) || 'پیوست جدید', tag: `msg-${m.id}` });
            n.onclick = () => {
              window.focus();
              navigate(`/tickets/${m.ticket_id}`);
            };
          } catch {}
        }
      }
    };
    const onTicket = (_t: Ticket) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['ticket', _t.id] });
    };
    const onTicketCreated = (t: Ticket) => {
      onTicket(t);
      if (t.customer?.id !== userRef.current?.id && userRef.current?.role !== 'customer') {
        playPing();
        toast(
          (tt) => (
            <button className="text-start" onClick={() => { toast.dismiss(tt.id); navigate(`/tickets/${t.id}`); }}>
              <div className="font-semibold text-sm">تیکت جدید {t.number}</div>
              <div className="text-xs text-slate-500 line-clamp-2">{t.customer?.name}: {t.subject}</div>
            </button>
          ),
          { icon: '🎫', duration: 7000 }
        );
      }
    };
    const onNotification = (_n: Notification) => qc.invalidateQueries({ queryKey: ['notifications'] });
    const onEvent = (e: any) => qc.invalidateQueries({ queryKey: ['ticket', e.ticket_id] });
    const onRead = (e: any) => qc.invalidateQueries({ queryKey: ['ticket', e.ticket_id] });
    const onDeleted = (e: any) => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.removeQueries({ queryKey: ['ticket', e.id] });
    };
    const onPresence = () => qc.invalidateQueries({ queryKey: ['staff'] });

    s.on('message:new', onMessage);
    s.on('message:updated', onEvent);
    s.on('ticket:updated', onTicket);
    s.on('ticket:created', onTicketCreated);
    s.on('ticket:event', onEvent);
    s.on('ticket:read', onRead);
    s.on('ticket:deleted', onDeleted);
    s.on('notification:new', onNotification);
    s.on('presence', onPresence);
    return () => {
      s.off('message:new', onMessage);
      s.off('message:updated', onEvent);
      s.off('ticket:updated', onTicket);
      s.off('ticket:created', onTicketCreated);
      s.off('ticket:event', onEvent);
      s.off('ticket:read', onRead);
      s.off('ticket:deleted', onDeleted);
      s.off('notification:new', onNotification);
      s.off('presence', onPresence);
    };
  }, [user?.id]);
}
