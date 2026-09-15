// backend/middleware/rateLimit.js
// Limits on the endpoints an attacker can hammer: sign-in guessing and account creation.
const rateLimit = require('express-rate-limit');

const MINUTE = 60 * 1000;

/**
 * @desc    Slows down password guessing against a single account or across many.
 * @note    Only failed attempts add to the count (skipSuccessfulRequests), so the repeated
 *          sign-ins of a normal shift never approach the limit. Once the limit is reached,
 *          though, the window refuses everything from that address until it expires - a
 *          correct password included. That is what makes guessing expensive, and it means a
 *          user behind the same address as an attacker waits out the window too.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed sign-in attempts. Please wait a few minutes and try again.'
  }
});

/**
 * @desc    Caps how many accounts one address can create, so the approval queue cannot be
 *          flooded. Generous enough for a hospital onboarding staff in a single session.
 */
const signupLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many accounts created from this address. Please try again later.'
  }
});

module.exports = { loginLimiter, signupLimiter };
