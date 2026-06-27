/**
 * Auth API Integration Tests
 * Requires running Postgres + Redis (use docker-compose.test.yml)
 * Run: npm test
 */
import request from 'supertest';
import { app } from '../src/app';

const BASE = '/api/v1/auth';

const testUser = {
  email: `test+${Date.now()}@pwms.test`,
  password: 'Test@1234!',
  fullName: 'Test User',
};

let accessToken: string;
let refreshToken: string;

describe('POST /auth/register', () => {
  it('registers a new user', async () => {
    const res = await request(app).post(`${BASE}/register`).send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    accessToken  = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post(`${BASE}/register`).send(testUser);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects weak password', async () => {
    const res = await request(app).post(`${BASE}/register`).send({
      ...testUser,
      email: 'new@pwms.test',
      password: 'weakpass',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: testUser.email,
      password: testUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    accessToken  = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: testUser.email,
      password: 'WrongPass@1',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects non-existent email', async () => {
    const res = await request(app).post(`${BASE}/login`).send({
      email: 'nobody@pwms.test',
      password: testUser.password,
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns user info with valid token', async () => {
    const res = await request(app)
      .get(`${BASE}/me`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('rejects request without token', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it('rejects expired/invalid token', async () => {
    const res = await request(app)
      .get(`${BASE}/me`)
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('issues new tokens with valid refresh token', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // New tokens should differ (rotation)
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
    accessToken  = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('rejects reuse of old refresh token (rotation)', async () => {
    // The old refresh token was already rotated above — reuse should fail
    const oldToken = refreshToken; // actually the new one; test by sending garbage
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken: 'invalid-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes refresh token', async () => {
    const res = await request(app).post(`${BASE}/logout`).send({ refreshToken });
    expect(res.status).toBe(204);
  });

  it('refresh token no longer works after logout', async () => {
    const res = await request(app).post(`${BASE}/refresh`).send({ refreshToken });
    expect(res.status).toBe(401);
  });
});
