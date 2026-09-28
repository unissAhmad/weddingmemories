// Runs the API and the worker in one container, for hosts without a free background-worker
// plan (e.g. Render's free web service). In production prefer two services: see
// render.production.yaml.
//
// If either process exits, the other is stopped and this script exits with an error, so the
// host restarts the whole container instead of running half an app.
import { spawn } from 'node:child_process';

const children = [
  ['api', 'apps/api/dist/index.js'],
  ['worker', 'apps/worker/dist/index.js'],
].map(([name, entry]) => {
  const child = spawn(process.execPath, ['--enable-source-maps', entry], { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[start-all] ${name} exited (code ${code}, signal ${signal}); stopping`);
    shutdown(1);
  });
  return child;
});

let shuttingDown = false;
function shutdown(exitCode) {
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  // Give both processes time to finish in-flight requests and jobs.
  setTimeout(() => process.exit(exitCode), 25_000).unref();
  Promise.all(children.map((c) => new Promise((r) => (c.exitCode !== null ? r() : c.once('exit', r))))).then(() =>
    process.exit(exitCode),
  );
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
