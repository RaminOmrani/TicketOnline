export type Role = 'customer' | 'agent' | 'admin';
export type Status = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type AttachmentKind = 'image' | 'video' | 'audio' | 'voice' | 'file';

export interface User {
  id: number;
  name: string;
  role: Role;
  avatar?: string | null;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  mobile?: string | null;
  is_active?: boolean;
  notify_email?: boolean;
  notify_sms?: boolean;
  last_seen_at?: string | null;
  created_at?: string;
  departments?: Department[];
  online?: boolean;
  load?: number;
  ticket_count?: number;
  open_count?: number;
}

export interface Department {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  is_active?: number | boolean;
  sort_order?: number;
  sla_first_response_minutes?: number;
  sla_resolve_minutes?: number;
  auto_assign?: number | boolean;
  agents?: { id: number; name: string; avatar?: string | null }[];
  open_tickets?: number;
}

export interface Attachment {
  id: number;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  url: string;
  thumb_url?: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  ticket_id: number;
  type: 'message' | 'note' | 'system';
  body: string;
  deleted: boolean;
  sender: User | null;
  attachments: Attachment[];
  created_at: string;
  edited_at?: string | null;
  read_by_customer_at?: string | null;
  read_by_agent_at?: string | null;
  pending?: boolean;
}

export interface TicketEvent {
  id: number;
  ticket_id: number;
  type: string;
  data: any;
  actor: User | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  number: string;
  subject: string;
  status: Status;
  status_label: string;
  priority: Priority;
  priority_label: string;
  product?: string | null;
  tags: string[];
  department: Department;
  customer: User;
  assignee: User | null;
  unread: number;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  due_at?: string | null;
  overdue: boolean;
  last_message_at?: string | null;
  last_customer_message_at?: string | null;
  last_agent_message_at?: string | null;
  last_message_preview?: string;
  rating?: number | null;
  rating_comment?: string | null;
  rated_at?: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
  attachment_count?: number;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  ticket_id?: number | null;
  is_read: number;
  created_at: string;
}

export interface PublicConfig {
  settings: {
    company_name: string;
    company_name_en: string;
    site_title: string;
    tagline: string;
    logo: string;
    brand_color: string;
    support_email: string;
    support_phone: string;
    website: string;
    working_hours: string;
    products: string[];
    max_upload_mb: number;
    max_attachments: number;
    allowed_extensions: string;
    allow_registration: boolean;
    welcome_message: string;
    reopen_window_days: number;
  };
  departments: Department[];
  channels: { email: boolean; sms: boolean };
  statuses: Record<Status, string>;
  priorities: Record<Priority, string>;
}

export interface CannedResponse {
  id: number;
  title: string;
  shortcut?: string | null;
  body: string;
  department_id?: number | null;
  department_name?: string | null;
}

export interface KbArticle {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
  category?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  is_published: number;
  views: number;
  updated_at: string;
  created_at?: string;
}
