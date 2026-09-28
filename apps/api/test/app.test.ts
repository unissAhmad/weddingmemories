import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CSRF_HEADER } from '@wm/shared';
import { createApp } from '../src/app';

const app = createApp();

describe('api skeleton', () => {
  it('responds to health checks', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('blocks mutations without the CSRF header', async () => {
    const res = await request(app).post('/api/guest/otp/request').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF');
  });

  it('blocks mutations from a foreign origin', async () => {
    const res = await request(app)
      .post('/api/guest/otp/request')
      .set(CSRF_HEADER, '1')
      .set('Origin', 'https://evil.example')
      .send({});
    expect(res.status).toBe(403);
  });

  it('validates the OTP request body with the shared schema', async () => {
    const res = await request(app)
      .post('/api/guest/otp/request')
      .set(CSRF_HEADER, '1')
      .send({ slug: 'demo-wedding', name: 'A', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('email');
  });

  it('rejects photo routes without a session', async () => {
    const res = await request(app).get('/api/photos/mine');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a forged session cookie', async () => {
    const res = await request(app).get('/api/photos/mine').set('Cookie', 'wm_guest=abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('sets CORS headers only for the web origin', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');

    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
