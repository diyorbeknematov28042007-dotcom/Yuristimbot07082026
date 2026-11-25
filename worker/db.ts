export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  GEMINI_API_KEY?: string;
  ADMIN_IDS?: string;
  CHANNEL_ID?: string;
  USER_STATE: DurableObjectNamespace;
}

export interface User {
  telegram_id: number;
  full_name: string | null;
  username: string | null;
  role: 'user' | 'lawyer';
  is_accepted_offer: boolean;
  bio: string | null;
}
export interface Ad {
  request_code: string;
  user_id: number;
  category: string;
  description: string;
  price_type: 'agreed' | 'free' | 'exact';
  min_price: number | null;
  max_price: number | null;
  status: string;
  accepted_lawyer_id: number | null;
}
export interface Item { id: number; type: string; title: string; url_or_file_id: string }

export class Database {
  constructor(private readonly env: Env) {}
  private async request<T>(table: string, method: string, query = '', body?: object): Promise<T[]> {
    const base = new URL(this.env.SUPABASE_URL);
    if (base.protocol !== 'https:' || !/^[a-z_]+$/.test(table)) throw new Error('Invalid database configuration');
    const url = new URL(`/rest/v1/${table}?${query}`, base);
    const response = await fetch(url, {
      method,
      headers: {
        apikey: this.env.SUPABASE_KEY,
        Authorization: `Bearer ${this.env.SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' || method === 'PATCH' ? 'return=representation' : ''
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Supabase ${method} ${table}: ${response.status}`);
    return response.json() as Promise<T[]>;
  }
  async getUser(id: number): Promise<User | null> {
    return (await this.request<User>('users', 'GET', `telegram_id=eq.${id}&select=telegram_id,full_name,username,role,is_accepted_offer,bio&limit=1`))[0] ?? null;
  }
  async createUser(id: number, fullName: string, username: string | undefined): Promise<User> {
    // Unique telegram_id preserves existing users during a race or migration.
    return (await this.request<User>('users', 'POST', 'on_conflict=telegram_id', {
      telegram_id: id, full_name: fullName, username: username ?? null, role: 'user', is_accepted_offer: false
    }))[0]!;
  }
  async ensureUser(id: number, name: string, username?: string): Promise<User> {
    const current = await this.getUser(id);
    if (current) return current;
    try { return await this.createUser(id, name, username); }
    catch { const raced = await this.getUser(id); if (raced) return raced; throw new Error('Registration failed'); }
  }
  async updateUser(id: number, values: Partial<Pick<User, 'role' | 'bio' | 'is_accepted_offer'>>): Promise<User> {
    const rows = await this.request<User>('users', 'PATCH', `telegram_id=eq.${id}`, values);
    if (!rows[0]) throw new Error('User not found');
    return rows[0];
  }
  async createAd(ad: Omit<Ad, 'status' | 'accepted_lawyer_id'>): Promise<Ad> {
    const rows = await this.request<Ad>('requests', 'POST', '', { ...ad, status: 'active' });
    if (!rows[0]) throw new Error('Request not stored');
    return rows[0];
  }
  async getAd(code: string): Promise<Ad | null> {
    return (await this.request<Ad>('requests', 'GET', `request_code=eq.${encodeURIComponent(code)}&select=*&limit=1`))[0] ?? null;
  }
  async claimAd(code: string, lawyerId: number): Promise<Ad | null> {
    // Single conditional SQL UPDATE in PostgREST: exactly one concurrent claimant wins.
    return (await this.request<Ad>('requests', 'PATCH', `request_code=eq.${encodeURIComponent(code)}&status=eq.active`, {
      status: 'accepted', accepted_lawyer_id: lawyerId
    }))[0] ?? null;
  }
  async adsForUser(id: number): Promise<Ad[]> {
    return this.request<Ad>('requests', 'GET', `user_id=eq.${id}&select=*&order=created_at.desc&limit=20`);
  }
  async lawyerHistory(id: number): Promise<Ad[]> {
    return this.request<Ad>('requests', 'GET', `accepted_lawyer_id=eq.${id}&select=*&order=created_at.desc&limit=20`);
  }
  async items(type: string): Promise<Item[]> {
    return this.request<Item>('dynamic_content', 'GET', `type=eq.${encodeURIComponent(type)}&select=id,type,title,url_or_file_id&limit=30`);
  }
  async item(id: number): Promise<Item | null> {
    return (await this.request<Item>('dynamic_content', 'GET', `id=eq.${id}&select=id,type,title,url_or_file_id&limit=1`))[0] ?? null;
  }
  async addItem(type: string, title: string, value: string): Promise<Item> {
    const result = (await this.request<Item>('dynamic_content', 'POST', '', { type, title, url_or_file_id: value }))[0];
    if (!result) throw new Error('Content not stored');
    return result;
  }
}

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
export const price = (text: string): number | null => /^\d{1,12}$/.test(text.trim()) && Number.isSafeInteger(Number(text.trim())) && Number(text.trim()) > 0 ? Number(text.trim()) : null;
export const requestCode = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `#${[0,1,2].map(i => alphabet[bytes[i]! % 26]).join('')}${[3,4,5].map(i => bytes[i]! % 10).join('')}`;
};
