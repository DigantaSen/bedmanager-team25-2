// backend/config/jwt.js
// Central JWT helpers - the signing secret must come from the environment (no fallback)

const jwt = require('jsonwebtoken');

const MIN_SECRET_LENGTH = 32;
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * @desc    Get the JWT secret, throwing if it is missing or too weak
 * @returns {string} JWT secret
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long`
    );
  }

  return secret;
}

/**
 * @desc    Sign an auth token for a user
 * @param   {Object} user - User document
 * @returns {string} Signed JWT
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      ward: user.ward,
      assignedWards: user.assignedWards,
      department: user.department
    },
    getJwtSecret(),
    { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * @desc    Verify an auth token (only HS256 tokens signed with our secret are accepted)
 * @param   {string} token - JWT from the client
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });
}

module.exports = {
  getJwtSecret,
  signToken,
  verifyToken
};
