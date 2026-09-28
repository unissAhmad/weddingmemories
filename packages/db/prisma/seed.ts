import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'owner@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Set SEED_ADMIN_PASSWORD (at least 12 characters) before seeding.');
  }

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await argon2.hash(password), role: 'OWNER' },
  });

  const slug = process.env.SEED_EVENT_SLUG ?? 'demo-wedding';
  const event = await prisma.event.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: process.env.SEED_EVENT_NAME ?? 'Aisha & Omar',
      date: new Date(process.env.SEED_EVENT_DATE ?? '2026-12-12T16:00:00Z'),
      settings: {
        autoApprove: false,
        moderateBeforePublish: false,
        uploadsOpen: true,
        familyCodeHash: null,
      },
    },
  });

  await prisma.eventAdmin.upsert({
    where: { adminId_eventId: { adminId: admin.id, eventId: event.id } },
    update: {},
    create: { adminId: admin.id, eventId: event.id },
  });

  console.log(`Owner admin: ${admin.email}`);
  console.log(`Event: ${event.name} → /e/${event.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
