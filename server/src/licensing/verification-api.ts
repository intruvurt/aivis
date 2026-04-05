// src/licensing/verification-api.ts
import express from 'express';
import crypto from 'crypto';
import { Resend } from 'resend';
import { getPool } from '../services/postgresql.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'licenses@intruvurtlabs.com';
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface GumroadWebhookPayload {
  seller_id: string;
  product_id: string;
  product_name: string;
  permalink: string;
  product_permalink: string;
  email: string;
  price: number;
  gumroad_fee: number;
  currency: string;
  quantity: number;
  discover_fee_charged: boolean;
  can_contact: boolean;
  referrer: string;
  card: {
    visual: string;
    type: string;
    bin: string;
    expiry_month: string;
    expiry_year: string;
  };
  order_number: number;
  sale_id: string;
  sale_timestamp: string;
  purchaser_id: string;
  subscription_id?: string;
  license_key: string;
  ip_country: string;
  recurrence: string;
  is_gift_receiver_purchase: boolean;
  refunded: boolean;
  disputed: boolean;
  dispute_won: boolean;
  test: boolean;
}

interface License {
  id: string;
  licenseKey: string;
  email: string;
  productId: string;
  productName: string;
  orderNumber: number;
  saleId: string;
  purchaseDate: Date;
  isActive: boolean;
  activationCount: number;
  maxActivations: number;
  metadata: Record<string, any>;
}

export class LicenseVerificationService {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = this.deriveEncryptionKey();
  }
  
  private deriveEncryptionKey(): Buffer {
    const secret = process.env.LICENSE_ENCRYPTION_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: LICENSE_ENCRYPTION_SECRET must be set in production');
      }
      console.warn('[Licensing] LICENSE_ENCRYPTION_SECRET not set - using dev fallback');
    }
    return crypto.scryptSync(secret || 'dev-only-insecure-key', 'salt', 32);
  }
  
  /**
   * Generate secure license key
   */
  generateLicenseKey(email: string, productId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(`${email}-${productId}-${timestamp}-${random}`)
      .digest('hex')
      .substring(0, 32)
      .toUpperCase();
    
    // Format: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
    return hash.match(/.{1,4}/g)?.join('-') || hash;
  }
  
  /**
   * Verify Gumroad webhook signature
   */
  verifyGumroadWebhook(payload: string, signature: string): boolean {
    const secret = process.env.GUMROAD_WEBHOOK_SECRET;
    if (!secret) {
      console.error('GUMROAD_WEBHOOK_SECRET not configured');
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
  
  /**
   * Process Gumroad webhook - create license
   */
  async processGumroadPurchase(payload: GumroadWebhookPayload): Promise<License> {
    // Use Gumroad's license_key directly so it matches what the customer
    // receives on their purchase receipt and in Gumroad's confirmation email.
    const licenseKey = payload.license_key;

    const license: License = {
      id: `lic_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      licenseKey,
      email: payload.email,
      productId: payload.product_id,
      productName: payload.product_name,
      orderNumber: payload.order_number,
      saleId: payload.sale_id,
      purchaseDate: new Date(payload.sale_timestamp),
      isActive: true,
      activationCount: 0,
      maxActivations: 3,
      metadata: {
        ipCountry: payload.ip_country,
        price: payload.price,
        currency: payload.currency,
        isTest: payload.test,
      },
    };
    
    // Store in database
    await this.storeLicense(license);
    
    // Send email with license key
    await this.sendLicenseEmail(license);
    
    return license;
  }
  
  /**
   * Store license in database
   */
  private async storeLicense(license: License): Promise<void> {
    // Using the database schema from earlier
    const query = `
      INSERT INTO licenses (
        id, license_key, email, product_id, product_name,
        order_number, sale_id, purchase_date, is_active,
        activation_count, max_activations, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    
    await getPool().query(query, [
      license.id,
      license.licenseKey,
      license.email,
      license.productId,
      license.productName,
      license.orderNumber,
      license.saleId,
      license.purchaseDate,
      license.isActive,
      license.activationCount,
      license.maxActivations,
      JSON.stringify(license.metadata),
    ]);
  }
  
  /**
   * Verify license key
   */
  async verifyLicense(licenseKey: string, metadata?: {
    machineId?: string;
    ipAddress?: string;
  }): Promise<{
    valid: boolean;
    license?: License;
    reason?: string;
  }> {
    try {
      const license = await this.getLicenseByKey(licenseKey);
      
      if (!license) {
        return { valid: false, reason: 'License key not found' };
      }
      
      if (!license.isActive) {
        return { valid: false, reason: 'License has been deactivated' };
      }
      
      // Check activation limit
      if (license.activationCount >= license.maxActivations && metadata?.machineId) {
        const hasActivation = await this.checkExistingActivation(
          license.id,
          metadata.machineId
        );
        
        if (!hasActivation) {
          return {
            valid: false,
            reason: `Maximum activations (${license.maxActivations}) reached`,
          };
        }
      }
      
      // Log verification
      await this.logVerification(license.id, metadata);
      
      return { valid: true, license };
      
    } catch (error) {
      console.error('License verification error:', error);
      return { valid: false, reason: 'Verification failed' };
    }
  }
  
  /**
   * Activate license on a machine
   */
  async activateLicense(
    licenseKey: string,
    machineId: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    activationId?: string;
    reason?: string;
  }> {
    const verification = await this.verifyLicense(licenseKey, { machineId });
    
    if (!verification.valid || !verification.license) {
      return { success: false, reason: verification.reason };
    }
    
    const license = verification.license;
    
    // Check if already activated on this machine
    const existingActivation = await this.checkExistingActivation(
      license.id,
      machineId
    );
    
    if (existingActivation) {
      return {
        success: true,
        activationId: existingActivation,
        reason: 'Already activated on this machine',
      };
    }
    
    // Check activation limit
    if (license.activationCount >= license.maxActivations) {
      return {
        success: false,
        reason: `Maximum activations (${license.maxActivations}) reached`,
      };
    }
    
    // Create activation
    const activationId = await this.createActivation(
      license.id,
      machineId,
      metadata
    );
    
    // Increment activation count
    await this.incrementActivationCount(license.id);
    
    return { success: true, activationId };
  }
  
  /**
   * Deactivate license on a machine
   */
  async deactivateLicense(
    licenseKey: string,
    machineId: string
  ): Promise<{ success: boolean; reason?: string }> {
    const license = await this.getLicenseByKey(licenseKey);
    
    if (!license) {
      return { success: false, reason: 'License not found' };
    }
    
    const removed = await this.removeActivation(license.id, machineId);
    
    if (removed) {
      await this.decrementActivationCount(license.id);
      return { success: true };
    }
    
    return { success: false, reason: 'Activation not found' };
  }
  
  /**
   * Get license details
   */
  async getLicenseDetails(licenseKey: string): Promise<License | null> {
    return this.getLicenseByKey(licenseKey);
  }
  
  /**
   * Revoke/disable license
   */
  async revokeLicense(licenseKey: string, reason: string): Promise<boolean> {
    const query = `
      UPDATE licenses
      SET is_active = false,
          metadata = jsonb_set(metadata, '{revocationReason}', $2)
      WHERE license_key = $1
    `;
    
    await getPool().query(query, [licenseKey, JSON.stringify(reason)]);
    return true;
  }
  
  // Private helper methods
  
  private async getLicenseByKey(licenseKey: string): Promise<License | null> {
    const query = `
      SELECT * FROM licenses WHERE license_key = $1
    `;
    
    const result = await getPool().query(query, [licenseKey]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      licenseKey: row.license_key,
      email: row.email,
      productId: row.product_id,
      productName: row.product_name,
      orderNumber: row.order_number,
      saleId: row.sale_id,
      purchaseDate: new Date(row.purchase_date),
      isActive: row.is_active,
      activationCount: row.activation_count,
      maxActivations: row.max_activations,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
  
  private async checkExistingActivation(
    licenseId: string,
    machineId: string
  ): Promise<string | null> {
    const query = `
      SELECT id FROM license_activations
      WHERE license_id = $1 AND machine_id = $2 AND is_active = true
    `;
    
    const result = await getPool().query(query, [licenseId, machineId]);
    return result.rows[0]?.id || null;
  }
  
  private async createActivation(
    licenseId: string,
    machineId: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const activationId = `act_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const query = `
      INSERT INTO license_activations (
        id, license_id, machine_id, activated_at, is_active, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await getPool().query(query, [
      activationId,
      licenseId,
      machineId,
      new Date(),
      true,
      JSON.stringify(metadata || {}),
    ]);
    
    return activationId;
  }
  
  private async removeActivation(
    licenseId: string,
    machineId: string
  ): Promise<boolean> {
    const query = `
      UPDATE license_activations
      SET is_active = false, deactivated_at = $3
      WHERE license_id = $1 AND machine_id = $2 AND is_active = true
    `;
    
    const result = await getPool().query(query, [
      licenseId,
      machineId,
      new Date(),
    ]);
    
    return (result.rowCount ?? 0) > 0;
  }
  
  private async incrementActivationCount(licenseId: string): Promise<void> {
    const query = `
      UPDATE licenses
      SET activation_count = activation_count + 1
      WHERE id = $1
    `;
    
    await getPool().query(query, [licenseId]);
  }
  
  private async decrementActivationCount(licenseId: string): Promise<void> {
    const query = `
      UPDATE licenses
      SET activation_count = GREATEST(0, activation_count - 1)
      WHERE id = $1
    `;
    
    await getPool().query(query, [licenseId]);
  }
  
  private async logVerification(
    licenseId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const query = `
      INSERT INTO license_verifications (
        id, license_id, verified_at, metadata
      ) VALUES ($1, $2, $3, $4)
    `;
    
    await getPool().query(query, [
      `ver_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      licenseId,
      new Date(),
      JSON.stringify(metadata || {}),
    ]);
  }
  
  private async sendLicenseEmail(license: License): Promise<void> {
    const verifyUrl = `${FRONTEND_URL}/verify-license`;
    const purchaseDateStr = license.purchaseDate.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    if (!resend) {
      console.log('[License] RESEND_API_KEY not set - license email logged only:');
      console.log(`  To:      ${license.email}`);
      console.log(`  Product: ${license.productName}`);
      console.log(`  Key:     ${license.licenseKey}`);
      return;
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: license.email,
      subject: `Your ${license.productName} License Key`,
      html: licenseEmailHtml(license, verifyUrl, purchaseDateStr),
      text: licenseEmailText(license, verifyUrl, purchaseDateStr),
    });

    if (error) {
      console.error('[License] Failed to send license email:', error);
      throw new Error(`Failed to send license email: ${error.message}`);
    }
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

function licenseEmailHtml(license: License, verifyUrl: string, purchaseDateStr: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your License Key</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#db2777);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#e9d5ff;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Intruvurt Labs</p>
              <h1 style="margin:8px 0 0;font-size:24px;color:#fff;font-weight:700;">Your License Key</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Thank you for purchasing <strong style="color:#fff;">${license.productName}</strong>.
                Your license key is below - keep it somewhere safe.
              </p>

              <!-- License key box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#0f172a;border:1px solid #7c3aed;border-radius:10px;padding:20px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:11px;color:#a78bfa;letter-spacing:2px;text-transform:uppercase;font-weight:600;">License Key</p>
                    <p style="margin:0;font-size:15px;color:#e2e8f0;font-family:monospace;letter-spacing:1px;word-break:break-all;">${license.licenseKey}</p>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;border:1px solid #334155;border-radius:10px;overflow:hidden;">
                <tr style="background:#0f172a;">
                  <td style="padding:12px 16px;font-size:13px;color:#64748b;width:40%;">Product</td>
                  <td style="padding:12px 16px;font-size:13px;color:#e2e8f0;font-weight:500;">${license.productName}</td>
                </tr>
                <tr style="background:#1e293b;">
                  <td style="padding:12px 16px;font-size:13px;color:#64748b;">Order</td>
                  <td style="padding:12px 16px;font-size:13px;color:#e2e8f0;font-weight:500;">#${license.orderNumber}</td>
                </tr>
                <tr style="background:#0f172a;">
                  <td style="padding:12px 16px;font-size:13px;color:#64748b;">Purchase Date</td>
                  <td style="padding:12px 16px;font-size:13px;color:#e2e8f0;font-weight:500;">${purchaseDateStr}</td>
                </tr>
                <tr style="background:#1e293b;">
                  <td style="padding:12px 16px;font-size:13px;color:#64748b;">Activations</td>
                  <td style="padding:12px 16px;font-size:13px;color:#e2e8f0;font-weight:500;">Up to ${license.maxActivations} machines</td>
                </tr>
              </table>

              <!-- Verify CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}"
                       style="display:inline-block;background:#7c3aed;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;">
                      Verify Your License
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">
                Questions? Reply to this email or contact
                <a href="mailto:support@intruurt.space" style="color:#a78bfa;">support@intruurt.space</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">Intruvurt Labs &mdash; sent to ${license.email}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function licenseEmailText(license: License, verifyUrl: string, purchaseDateStr: string): string {
  return `Thank you for purchasing ${license.productName}!

Your License Key
----------------
${license.licenseKey}

Order:        #${license.orderNumber}
Purchase Date: ${purchaseDateStr}
Activations:  Up to ${license.maxActivations} machines

Verify your license at: ${verifyUrl}

Keep this email - it is the only record of your license key.

Questions? Contact support@intruurt.space
Intruvurt Labs`;
}

// Express API endpoints
export function createLicenseAPI(): express.Router {
  const router = express.Router();
  const licenseService = new LicenseVerificationService();
  
  // Gumroad webhook endpoint
  router.post('/webhook/gumroad', async (req, res) => {
    try {
      const signature = req.headers['x-gumroad-signature'] as string;
      // rawBody is captured by the express.json verify callback in server.ts
      const payload = (req as any).rawBody as string | undefined;

      if (!payload) {
        return res.status(400).json({ error: 'Missing request body' });
      }

      if (!licenseService.verifyGumroadWebhook(payload, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const data: GumroadWebhookPayload = JSON.parse(payload);
      
      // Process purchase
      const license = await licenseService.processGumroadPurchase(data);
      
      res.json({ success: true, licenseKey: license.licenseKey });
      
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  
  // Verify license endpoint (public)
  router.post('/verify', express.json(), async (req, res) => {
    try {
      const { licenseKey, machineId, ipAddress } = req.body;
      
      if (!licenseKey) {
        return res.status(400).json({ error: 'License key required' });
      }
      
      const result = await licenseService.verifyLicense(licenseKey, {
        machineId,
        ipAddress: ipAddress || req.ip,
      });
      
      if (!result.valid) {
        return res.status(403).json({
          valid: false,
          reason: result.reason,
        });
      }
      
      const lic = result.license!;
      res.json({
        valid: true,
        license: {
          productName: lic.productName,
          purchaseDate: lic.purchaseDate,
          activationCount: lic.activationCount,
          maxActivations: lic.maxActivations,
        },
      });
      
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  });
  
  // Activate license endpoint
  router.post('/activate', express.json(), async (req, res) => {
    try {
      const { licenseKey, machineId, metadata } = req.body;
      
      if (!licenseKey || !machineId) {
        return res.status(400).json({ error: 'License key and machine ID required' });
      }
      
      const result = await licenseService.activateLicense(
        licenseKey,
        machineId,
        metadata
      );
      
      if (!result.success) {
        return res.status(403).json({
          success: false,
          reason: result.reason,
        });
      }
      
      res.json({
        success: true,
        activationId: result.activationId,
      });
      
    } catch (error) {
      console.error('Activation error:', error);
      res.status(500).json({ error: 'Activation failed' });
    }
  });
  
  // Deactivate license endpoint
  router.post('/deactivate', express.json(), async (req, res) => {
    try {
      const { licenseKey, machineId } = req.body;
      
      if (!licenseKey || !machineId) {
        return res.status(400).json({ error: 'License key and machine ID required' });
      }
      
      const result = await licenseService.deactivateLicense(licenseKey, machineId);
      
      res.json(result);
      
    } catch (error) {
      console.error('Deactivation error:', error);
      res.status(500).json({ error: 'Deactivation failed' });
    }
  });
  
  // Get license details endpoint
  router.get('/details/:licenseKey', async (req, res) => {
    try {
      const { licenseKey } = req.params;
      
      const license = await licenseService.getLicenseDetails(licenseKey);
      
      if (!license) {
        return res.status(404).json({ error: 'License not found' });
      }
      
      res.json({
        productName: license.productName,
        email: license.email,
        purchaseDate: license.purchaseDate,
        isActive: license.isActive,
        activationCount: license.activationCount,
        maxActivations: license.maxActivations,
      });
      
    } catch (error) {
      console.error('Details error:', error);
      res.status(500).json({ error: 'Failed to get license details' });
    }
  });
  
  return router;
}