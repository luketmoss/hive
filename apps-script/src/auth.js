// #264: credential resolution for the two doors into the Apps Script API.
//
// `key` (API_KEY) is the existing door: full access, for the MCP server and
// anything else that can hold a secret out of a public bundle. `access_token`
// is the new one: a Google OAuth access token, read-only, for almanac — a
// public GitHub Pages bundle that cannot hold HIVE_API_KEY without handing
// read *and* write access to anyone who views the page source.
//
// The deployment stays ANYONE_ANONYMOUS, executing as the deployer (see
// CLAUDE.md, "Apps Script Deployment"). Google performs no check of its own
// on that setting, so the verification here is the real gate.

/** Actions an accepted token caller may run through doGet/doPost. Everything
 * else — every write, and any name not on this list, known or not — is
 * refused as `read_only`. */
var TOKEN_READ_ACTIONS = [
  'getItems',
  'getItem',
  'getOwners',
  'getLabels',
  'getBoards',
  'getStatuses',
  'getAuditLog',
];

var TOKEN_CACHE_NAMESPACE = 'hive_token_v1:';

/**
 * Which credential a request is making its case with. An `access_token`
 * present at all — even alongside a valid `key` — makes the caller a token
 * caller: adding a parameter never raises privilege (AC2).
 * @param {Object} params - `e.parameter`-shaped request parameters
 * @returns {{type: 'token', token: string}|{type: 'key', key: string}}
 */
function resolveCredential(params) {
  if (params.access_token) {
    return { type: 'token', token: params.access_token };
  }
  return { type: 'key', key: params.key };
}

/**
 * The envelope for a request an allow-listed check refused. `read_only`
 * carries the one required error shape (AC2); the token refusal codes carry
 * their own message.
 * @param {string} action
 * @returns {{success: false, code: 'read_only', error: string}}
 */
function readOnlyRefusal(action) {
  return {
    success: false,
    code: 'read_only',
    error: 'Read-only caller: action "' + action + '" is not permitted',
  };
}

var TOKEN_REFUSAL_MESSAGES = {
  token_invalid: 'Access token is invalid or expired',
  token_forbidden: 'Access token is not authorized',
  token_unavailable: 'Unable to verify access token right now',
};

/**
 * The envelope for a token verdict that isn't `'ok'`.
 * @param {string} code - one of `token_invalid`, `token_forbidden`, `token_unavailable`
 * @returns {{success: false, code: string, error: string}}
 */
function tokenRefusal(code) {
  return {
    success: false,
    code: code,
    error: TOKEN_REFUSAL_MESSAGES[code] || 'Access token rejected',
  };
}

/**
 * Hex-encode the signed byte array `Utilities.computeDigest` returns.
 * `& 0xff` recovers the unsigned byte before formatting, exactly as Apps
 * Script's own digest examples do.
 * @param {number[]} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var h = (bytes[i] & 0xff).toString(16);
    if (h.length < 2) h = '0' + h;
    hex += h;
  }
  return hex;
}

/**
 * The verdict cache key for a token under a given client/email pair. Keying
 * on all three means changing either script property misses the cache
 * instead of serving a verdict checked against the old configuration.
 * @param {string} token
 * @param {string} clientId
 * @param {string} allowedEmail
 * @returns {string}
 */
function tokenCacheKey(token, clientId, allowedEmail) {
  var raw = token + '|' + clientId + '|' + allowedEmail;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return TOKEN_CACHE_NAMESPACE + bytesToHex(digest);
}

/**
 * Read the verdict cache. Any failure — no CacheService, or `get` throwing —
 * is treated as a miss, never as a refusal (AC4).
 * @param {string} key
 * @returns {string|null}
 */
function cacheGetSafe(key) {
  try {
    return CacheService.getScriptCache().get(key);
  } catch (err) {
    return null;
  }
}

/**
 * Write the verdict cache. Any failure is swallowed — the request already
 * has its verdict; failing to cache it just means the next call re-checks.
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 */
function cachePutSafe(key, value, ttlSeconds) {
  try {
    CacheService.getScriptCache().put(key, value, ttlSeconds);
  } catch (err) {
    // Proceed uncached — see cacheGetSafe.
  }
}

/**
 * Call Google's tokeninfo endpoint and turn its answer into one of this
 * module's verdict codes. The token appears only in this outbound URL —
 * never in a return value, a cache entry, or a log line.
 * @param {string} token
 * @param {string} clientId
 * @param {string} allowedEmail
 * @returns {{code: 'ok', expiresIn: number}|{code: string}}
 */
function checkTokenWithGoogle(token, clientId, allowedEmail) {
  var response;
  try {
    response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token),
      { muteHttpExceptions: true }
    );
  } catch (err) {
    return { code: 'token_unavailable' };
  }

  var status = response.getResponseCode();
  if (status >= 500) {
    return { code: 'token_unavailable' };
  }
  if (status < 200 || status >= 300) {
    return { code: 'token_invalid' };
  }

  var body;
  try {
    body = JSON.parse(response.getContentText());
  } catch (err) {
    return { code: 'token_invalid' };
  }

  var expiresIn = Number(body.expires_in);
  if (body.expires_in === undefined || body.expires_in === null || isNaN(expiresIn) || expiresIn <= 0) {
    return { code: 'token_invalid' };
  }

  if (body.aud !== clientId) {
    return { code: 'token_forbidden' };
  }
  if (body.azp !== undefined && body.azp !== null && body.azp !== '' && body.azp !== clientId) {
    return { code: 'token_forbidden' };
  }

  var email = String(body.email || '').trim().toLowerCase();
  var expectedEmail = String(allowedEmail || '').trim().toLowerCase();
  if (!email || email !== expectedEmail) {
    return { code: 'token_forbidden' };
  }

  if (body.email_verified !== true && body.email_verified !== 'true') {
    return { code: 'token_forbidden' };
  }

  return { code: 'ok', expiresIn: expiresIn };
}

/**
 * Verify an access token, consulting and maintaining the verdict cache.
 *
 * `TOKEN_CLIENT_ID` / `TOKEN_ALLOWED_EMAIL` unset or blank is a setup error,
 * not a bad token: it returns `token_forbidden` without calling tokeninfo or
 * touching the cache at all.
 *
 * @param {string} token
 * @returns {'ok'|'token_invalid'|'token_forbidden'|'token_unavailable'}
 */
function verifyAccessToken(token) {
  var props = PropertiesService.getScriptProperties();
  var clientId = props.getProperty('TOKEN_CLIENT_ID');
  var allowedEmail = props.getProperty('TOKEN_ALLOWED_EMAIL');

  // Unset or blank (whitespace-only) is a setup error, not a bad token —
  // tokeninfo is never called and nothing is cached for it.
  if (!clientId || !clientId.trim() || !allowedEmail || !allowedEmail.trim()) {
    return 'token_forbidden';
  }

  var cacheKey = tokenCacheKey(token, clientId, allowedEmail);
  var cached = cacheGetSafe(cacheKey);
  if (cached === 'ok') return 'ok';
  if (cached && cached.indexOf('no:') === 0) return cached.slice(3);

  var verdict = checkTokenWithGoogle(token, clientId, allowedEmail);

  if (verdict.code === 'ok') {
    var ttl = Math.min(verdict.expiresIn - 60, 3600);
    if (ttl > 0) cachePutSafe(cacheKey, 'ok', ttl);
  } else if (verdict.code === 'token_invalid' || verdict.code === 'token_forbidden') {
    cachePutSafe(cacheKey, 'no:' + verdict.code, 300);
  }
  // token_unavailable is never cached.

  return verdict.code;
}
