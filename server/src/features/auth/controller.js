const service = require('./service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignUp({ email, password } = {}) {
  const errors = {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  return errors;
}

async function signUp(req, res, next) {
  const errors = validateSignUp(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const email = req.body.email.trim().toLowerCase();
    const user = await service.signUp(email, req.body.password);
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof service.EmailTakenError) {
      return res.status(409).json({ errors: { email: 'This email is already registered' } });
    }
    return next(err);
  }
}

module.exports = { signUp, validateSignUp };