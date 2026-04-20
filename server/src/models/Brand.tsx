import { pool } from '../../services/postgresql.js';

export interface Brand {
  id: string;
  tenant_id: string;
  brand_name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  tier: number;
  custom_domain?: string;
  webhook_url?: string;
  api_keys?: string[];
  stripe_account?: string;
  created_at: Date;
  updated_at: Date;
}

export async function createBrand(brand: Omit<Brand, 'id' | 'created_at' | 'updated_at'>): Promise<Brand> {
  const result = await pool.query(
    `INSERT INTO brands (tenant_id, brand_name, logo_url, primary_color, secondary_color, tier, custom_domain, webhook_url, api_keys, stripe_account)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [brand.tenant_id, brand.brand_name, brand.logo_url, brand.primary_color, brand.secondary_color, brand.tier, brand.custom_domain, brand.webhook_url, JSON.stringify(brand.api_keys), brand.stripe_account]
  );
  return result.rows[0];
}

export async function getBrandById(id: string): Promise<Brand | null> {
  const result = await pool.query(
    `SELECT * FROM brands WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
// Neon DB migration complete. No mongoose code remains.
