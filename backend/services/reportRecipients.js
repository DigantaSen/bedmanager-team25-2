// backend/services/reportRecipients.js
// Managers decide who a report goes to, so any address is allowed - but it must look like a
// single, plain email address. The characters excluded below (whitespace, newlines, commas,
// angle brackets, quotes) are the ones that would otherwise let a recipient string smuggle
// extra headers or extra recipients into the outgoing message.
const EMAIL_FORMAT = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\]+\.[^\s@,;:<>"'\\]{2,}$/;
const MAX_LENGTH = 254;

/**
 * @desc    Clean up an address and confirm it is a single, well-formed one
 * @returns {string|null} the normalised address, or null if it is malformed
 */
const normalizeAddress = (email) => {
  if (typeof email !== 'string') return null;
  const address = email.trim().toLowerCase();
  if (!address || address.length > MAX_LENGTH || !EMAIL_FORMAT.test(address)) {
    return null;
  }
  return address;
};

/**
 * @desc    Split a list of addresses into the well-formed ones and the rest
 * @returns {{allowed: string[], rejected: string[]}}
 */
const splitAddresses = (emails = []) => {
  const list = Array.isArray(emails) ? emails : [emails];
  const allowed = [];
  const rejected = [];

  for (const email of list) {
    const address = normalizeAddress(email);
    if (address) {
      allowed.push(address);
    } else {
      rejected.push(typeof email === 'string' ? email.trim() : String(email));
    }
  }

  return { allowed, rejected };
};

module.exports = { normalizeAddress, splitAddresses, EMAIL_FORMAT };
