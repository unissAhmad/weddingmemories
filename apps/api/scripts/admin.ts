/**
 * Break-glass admin tool for when nobody can sign in (lost phone, forgotten password).
 * Talks to the database directly, so it needs DATABASE_URL in the root .env.
 *
 *   pnpm admin list
 *   pnpm admin reset-2fa <login>              next sign-in shows a new QR code
 *   pnpm admin set-password <login> <password>
 *
 * Every change is recorded in the audit log.
 */
import argon2 from 'argon2';
import { prisma } from '@wm/db';

const [command, login, password] = process.argv.slice(2);

function usage(): never {
  console.log(`Usage:
  pnpm admin list
  pnpm admin reset-2fa <login>
  pnpm admin set-password <login> <new-password>`);
  process.exit(1);
}

async function findAdmin(value: string | undefined) {
  if (!value) usage();
  const admin = await prisma.admin.findUnique({ where: { email: value.trim().toLowerCase() } });
  if (!admin) {
    console.error(`No admin with login "${value}". Run "pnpm admin list" to see them.`);
    process.exit(1);
  }
  return admin;
}

async function main() {
  switch (command) {
    case 'list': {
      const admins = await prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
      for (const a of admins) {
        console.log(
          `${a.email.padEnd(32)} ${a.role.padEnd(10)} 2FA: ${a.totpEnabledAt ? 'set up' : 'not set up'}  last sign-in: ${a.lastLoginAt?.toISOString() ?? 'never'}`,
        );
      }
      break;
    }
    case 'reset-2fa': {
      const admin = await findAdmin(login);
      await prisma.admin.update({ where: { id: admin.id }, data: { totpSecret: null, totpEnabledAt: null } });
      await prisma.auditLog.create({
        data: { adminId: admin.id, action: 'team.reset_2fa', targetId: admin.id, meta: { email: admin.email, via: 'cli' } },
      });
      console.log(`2FA reset for "${admin.email}". Their next sign-in will show a new QR code to scan.`);
      break;
    }
    case 'set-password': {
      const admin = await findAdmin(login);
      if (!password || password.length < 8) {
        console.error('Give a new password of at least 8 characters (12+ recommended).');
        process.exit(1);
      }
      await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await argon2.hash(password) } });
      await prisma.auditLog.create({
        data: { adminId: admin.id, action: 'team.set_password', targetId: admin.id, meta: { email: admin.email, via: 'cli' } },
      });
      console.log(`Password changed for "${admin.email}".`);
      break;
    }
    default:
      usage();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
