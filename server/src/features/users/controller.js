const service = require('./service');

const LIMITS = { name: 60, program: 80, bio: 300 };

// US-12: Check the profile fields. Returns { errors } or { data }.
function validateProfile(body = {}) {
  const errors = {};
  const data = {};

  if (typeof body.name !== 'string' || !body.name.trim()) {
    errors.name = 'Name is required';
  }

  for (const [field, max] of Object.entries(LIMITS)) {
    if (body[field] == null) continue;
    if (typeof body[field] !== 'string') {
      errors[field] = `${field} must be text`;
      continue;
    }
    const value = body[field].trim();
    if (value.length > max) {
      errors[field] = `${field} must be ${max} characters or less`;
    } else {
      data[field] = value || null;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { data };
}

async function getMe(req, res, next) {
  try {
    const profile = await service.getProfile(req.user.id);
    return res.json({ profile: { ...profile, email: req.user.email } });
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  const { errors, data } = validateProfile(req.body);
  if (errors) return res.status(400).json({ errors });

  try {
    const profile = await service.updateProfile(req.user.id, data);
    return res.json({ profile: { ...profile, email: req.user.email } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getMe, updateMe, validateProfile };
