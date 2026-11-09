const prisma = require('../../lib/prisma');

const PROFILE_FIELDS = { id: true, name: true, program: true, bio: true, createdAt: true };

// US-12: Get my profile. A row is created the first time, since signing up
// only creates the Supabase Auth account.
async function getProfile(userId) {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
    select: PROFILE_FIELDS
  });
}

// US-12: Update my name, program and bio.
async function updateProfile(userId, data) {
  return prisma.user.upsert({
    where: { id: userId },
    update: data,
    create: { id: userId, ...data },
    select: PROFILE_FIELDS
  });
}

module.exports = { getProfile, updateProfile };
