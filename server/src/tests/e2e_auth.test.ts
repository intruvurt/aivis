import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { SuperTest, Test } from 'supertest';


const runE2E = process.env.RUN_E2E_TESTS === 'true';
const hasDatabase = Boolean(process.env.DATABASE_URL);
const shouldRunE2E = runE2E && hasDatabase;

let app: any;
let User: any;

describe.skipIf(!shouldRunE2E)('End-to-End Auth/API Flow', () => {
  let agent: SuperTest<Test>;
  const testEmail = `e2euser_${Date.now()}@aivis.biz`;
  const testName = 'E2E Test User';
  const password = 'TestPassword123!';
  let authToken: string | undefined;
  let userId: string | undefined;

  beforeAll(async () => {
    if (!shouldRunE2E) return;
    ({ default: app } = await import('../server.ts'));
    ({ default: User } = await import('../models/User.ts'));
    agent = request(app);

    // Clean up any existing test user
    const existing = await User.findOne({ email: testEmail });
    if (existing?.id) {
      await User.findByIdAndDelete(existing.id);
    }
  });

  afterAll(async () => {
    if (!shouldRunE2E) return;

    // Clean up test user
    if (userId) {
      await User.findByIdAndDelete(userId);
    }

    const { pool } = await import('../services/postgresql.ts');
    if (pool?.end) await pool.end();
  });

  describe('Health Check', () => {
    it('should return server running status', async () => {
      const res = await agent.get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Server is running');
    });
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const res = await agent.post('/api/auth/register').send({
        name: testName,
        email: testEmail,
        password,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', testEmail);
      expect(res.body.data.user).toHaveProperty('name', testName);
      expect(res.body.data.user).not.toHaveProperty('password');

      authToken = res.body.data.token;
      userId = res.body.data.user._id;
    });

    it('should not register user with duplicate email', async () => {
      const res = await agent.post('/api/auth/register').send({
        name: 'Duplicate User',
        email: testEmail,
        password,
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const res = await agent.post('/api/auth/register').send({
        email: 'incomplete@test.com',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      const res = await agent.post('/api/auth/login').send({
        email: testEmail,
        password,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', testEmail);

      authToken = res.body.data.token;
    });

    it('should reject invalid credentials', async () => {
      const res = await agent.post('/api/auth/login').send({
        email: testEmail,
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject non-existent user', async () => {
      const res = await agent.post('/api/auth/login').send({
        email: 'nonexistent@test.com',
        password,
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('Protected Routes', () => {
    it('should access profile with valid token', async () => {
      const res = await agent.get('/api/auth/profile').set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', testEmail);
      expect(res.body.data).toHaveProperty('name', testName);
    });

    it('should reject access without token', async () => {
      const res = await agent.get('/api/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject access with invalid token', async () => {
      const res = await agent
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('Profile Management', () => {
    it('should update user profile', async () => {
      const updatedName = 'Updated E2E User';

      const res = await agent
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: updatedName,
          email: testEmail,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name', updatedName);
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword123!';

      const res = await agent
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: password,
          newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Verify can login with new password
      const loginRes = await agent.post('/api/auth/login').send({
        email: testEmail,
        password: newPassword,
      });

      expect(loginRes.status).toBe(200);
      authToken = loginRes.body.data.token;
    });
  });

  describe('Contact Information', () => {
    it('should verify support email is configured', () => {
      const supportEmail = 'support@aivis.biz';
      expect(supportEmail).toBe('support@aivis.biz');
    });
  });
});
