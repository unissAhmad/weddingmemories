// Local S3-compatible storage for development, so the app runs without a Cloudflare account.
// Point the API/worker at it with R2_ENDPOINT=http://127.0.0.1:4569 and R2_ACCESS_KEY_ID /
// R2_SECRET_ACCESS_KEY = S3RVER. Files live in .dev-storage/ (git-ignored).
//
// Limitation: no ListParts/AbortMultipartUpload, so resuming an interrupted upload after a
// page reload only works against real R2.
import S3rver from 's3rver';

const bucket = process.env.R2_BUCKET || 'wedding-memories-dev';
const port = Number(process.env.DEV_STORAGE_PORT || 4569);

// Same CORS rules as the production bucket: browsers PUT parts directly and must read ETag.
const cors = `<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

await new S3rver({
  port,
  address: '127.0.0.1',
  directory: '.dev-storage',
  silent: true,
  configureBuckets: [{ name: bucket, configs: [cors] }],
}).run();

console.log(`Local storage on http://127.0.0.1:${port} (bucket "${bucket}")`);
