export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  GEMINI_API_KEY?: string;
  ADMIN_IDS?: string;
  CHANNEL_ID?: string;
  USER_STATE: DurableObjectNamespace;
  DB: D1Database;
}

export interface User {
  telegram_id: number;
  full_name: string | null;
  username: string | null;
  role: 'user' | 'lawyer';
  is_accepted_offer: boolean;
  bio: string | null;
}
interface UserRow extends Omit<User, 'is_accepted_offer'> { is_accepted_offer: number }
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
export class DuplicateRequestCodeError extends Error {}

export class Database {
  constructor(private readonly db: D1Database) {}
  private asUser(row: UserRow | null): User | null {
    return row ? { ...row, is_accepted_offer: Boolean(row.is_accepted_offer) } : null;
  }
  async getUser(id: number): Promise<User | null> {
    return this.asUser(await this.db.prepare('SELECT telegram_id,full_name,username,role,bio,is_accepted_offer FROM users WHERE telegram_id=?').bind(id).first<UserRow>());
  }
  async createUser(id: number, fullName: string, username: string | undefined): Promise<User> {
    // The unique telegram_id is also the idempotency key for registration.
    await this.db.prepare("INSERT INTO users (telegram_id,full_name,username,role,is_accepted_offer) VALUES (?,?,?,'user',0) ON CONFLICT(telegram_id) DO NOTHING").bind(id,fullName,username??null).run();
    const user=await this.getUser(id);
    if(!user) throw new Error('Registration failed');
    return user;
  }
  async ensureUser(id: number,name: string,username?: string): Promise<User> {
    return await this.getUser(id) ?? this.createUser(id,name,username);
  }
  async updateUser(id: number, values: Partial<Pick<User,'role'|'bio'|'is_accepted_offer'>>): Promise<User> {
    // Column names are a fixed allowlist; all values are bound.
    const keys=(['role','bio','is_accepted_offer'] as const).filter(k=>values[k]!==undefined);
    if(!keys.length) throw new Error('No user fields');
    const params=keys.map(k=>k==='is_accepted_offer' ? (values[k]?1:0) : values[k]);
    const row=await this.db.prepare(`UPDATE users SET ${keys.map(k=>`${k}=?`).join(',')} WHERE telegram_id=? RETURNING telegram_id,full_name,username,role,bio,is_accepted_offer`).bind(...params,id).first<UserRow>();
    const user=this.asUser(row);
    if(!user) throw new Error('User not found');
    return user;
  }
  async createAd(ad: Omit<Ad,'status'|'accepted_lawyer_id'>, updateId: number): Promise<Ad> {
    const byUpdate = () => this.db.prepare('SELECT request_code,user_id,category,description,price_type,min_price,max_price,status,accepted_lawyer_id FROM requests WHERE source_update_id=?').bind(updateId).first<Ad>();
    // The Telegram update ID persists across webhook retries, even if the random code changes.
    const existing=await byUpdate();
    if(existing) return existing;
    const row=await this.db.prepare("INSERT INTO requests (request_code,source_update_id,user_id,category,description,price_type,min_price,max_price,status) VALUES (?,?,?,?,?,?,?,?,'active') ON CONFLICT DO NOTHING RETURNING request_code,user_id,category,description,price_type,min_price,max_price,status,accepted_lawyer_id")
      .bind(ad.request_code,updateId,ad.user_id,ad.category,ad.description,ad.price_type,ad.min_price,ad.max_price).first<Ad>();
    if(row) return row;
    const raced=await byUpdate();
    if(raced) return raced;
    throw new DuplicateRequestCodeError('Request code collision');
  }
  async getAd(code:string): Promise<Ad|null> {
    return this.db.prepare('SELECT * FROM requests WHERE request_code=?').bind(code).first<Ad>();
  }
  async claimAd(code:string,lawyerId:number): Promise<Ad|null> {
    // One SQLite UPDATE with a status predicate: only the first concurrent claimant succeeds.
    return this.db.prepare("UPDATE requests SET status='accepted',accepted_lawyer_id=? WHERE request_code=? AND status='active' RETURNING request_code,user_id,category,description,price_type,min_price,max_price,status,accepted_lawyer_id")
      .bind(lawyerId,code).first<Ad>();
  }
  async adsForUser(id:number): Promise<Ad[]> {
    return (await this.db.prepare('SELECT * FROM requests WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(id).all<Ad>()).results;
  }
  async lawyerHistory(id:number): Promise<Ad[]> {
    return (await this.db.prepare('SELECT * FROM requests WHERE accepted_lawyer_id=? ORDER BY created_at DESC LIMIT 20').bind(id).all<Ad>()).results;
  }
  async items(type:string): Promise<Item[]> {
    return (await this.db.prepare('SELECT id,type,title,url_or_file_id FROM dynamic_content WHERE type=? LIMIT 30').bind(type).all<Item>()).results;
  }
  async item(id:number): Promise<Item|null> {
    return this.db.prepare('SELECT id,type,title,url_or_file_id FROM dynamic_content WHERE id=?').bind(id).first<Item>();
  }
  async addItem(type:string,title:string,value:string): Promise<Item> {
    const row=await this.db.prepare('INSERT INTO dynamic_content (type,title,url_or_file_id) VALUES (?,?,?) RETURNING id,type,title,url_or_file_id').bind(type,title,value).first<Item>();
    if(!row) throw new Error('Content not stored');
    return row;
  }
}

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
export const price = (text: string): number | null => /^\d{1,12}$/.test(text.trim()) && Number.isSafeInteger(Number(text.trim())) && Number(text.trim()) > 0 ? Number(text.trim()) : null;
export const requestCode = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `#${[0,1,2].map(i => alphabet[bytes[i]! % 26]).join('')}${[3,4,5].map(i => bytes[i]! % 10).join('')}`;
};
