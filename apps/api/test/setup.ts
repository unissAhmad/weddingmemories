Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  CLOUDINARY_URL: 'cloudinary://123456789012345:test-secret-test-secret@test-cloud',
  CLOUDINARY_FOLDER: 'wm-test',
  JWT_SECRET_GUEST: 'test-guest-secret-test-guest-secret-00',
  JWT_SECRET_ADMIN: 'test-admin-secret-test-admin-secret-00',
  OTP_SECRET: 'test-otp-secret-test-otp-secret-000000',
  WEB_ORIGIN: 'http://localhost:5173',
});
