Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  R2_ACCOUNT_ID: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  R2_BUCKET: 'test',
  JWT_SECRET_GUEST: 'test-guest-secret-test-guest-secret-00',
  JWT_SECRET_ADMIN: 'test-admin-secret-test-admin-secret-00',
  OTP_SECRET: 'test-otp-secret-test-otp-secret-000000',
  WEB_ORIGIN: 'http://localhost:5173',
});
