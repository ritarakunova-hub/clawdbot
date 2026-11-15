const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;
const BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
];

function ipNumber(ip) {
  if (net.isIP(ip) !== 4) return null;
  return ip.split('.').reduce((n, part) => (n * 256) + Number(part), 0);
}

function inRange(ip, base, bits) {
  const value = ipNumber(ip);
  const start = ipNumber(base);
  if (value === null || start === null) return true;
  const size = 2 ** (32 - bits);
  return value >= start && value < start + size;
}

function isPublicIPv4(ip) {
  if (net.isIP(ip) !== 4) return false;
  return !BLOCKED.some(([base, bits]) => inRange(ip, base, bits));
}

function parsePublicHttpUrl(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  if (url.port && !((url.protocol === 'http:' && url.port === '80') ||
                    (url.protocol === 'https:' && url.port === '443'))) return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || net.isIP(hostname) !== 0 || hostname === 'localhost' ||
      hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      hostname.endsWith('.internal') || hostname.endsWith('.test') ||
      hostname.endsWith('.invalid') ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname)) return null;
  url.hostname = hostname;
  url.hash = '';
  return url;
}

async function resolvePublicIPv4(hostname, lookup = dns.lookup) {
  const records = await lookup(hostname, { all: true, family: 4, verbatim: true });
  if (!Array.isArray(records) || records.length === 0 ||
      records.some(record => !record || !isPublicIPv4(record.address))) return null;
  return records[0].address;
}

function requestHtml(url, address) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    let settled = false;
    let size = 0;
    const chunks = [];
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const request = transport.request(url, {
      method: 'GET',
      maxHeaderSize: 16 * 1024,
      lookup: (_hostname, options, callback) => {
        if (options && options.all) callback(null, [{ address, family: 4 }]);
        else callback(null, address, 4);
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TAINA-SalesEngine/1.0)',
        Accept: 'text/html',
        'Accept-Encoding': 'identity'
      }
    }, response => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location || '';
        response.resume();
        finish({ redirect: location });
        return;
      }
      const type = String(response.headers['content-type'] || '').toLowerCase();
      const encoding = String(response.headers['content-encoding'] || 'identity').toLowerCase();
      const declared = Number(response.headers['content-length'] || 0);
      if (status < 200 || status >= 300 || !type.includes('text/html') ||
          (encoding && encoding !== 'identity') || (declared && declared > MAX_BYTES)) {
        response.resume();
        finish(null);
        return;
      }
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          request.destroy(new Error('response_too_large'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => finish({ body: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error('request_timeout')));
    request.on('error', reject);
    request.end();
  });
}

function extractVisibleText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

async function fetchSiteText(site, dependencies = {}) {
  const lookup = dependencies.lookup || dns.lookup;
  const request = dependencies.request || requestHtml;
  let url = parsePublicHttpUrl(site);
  if (!url) return null;

  try {
    for (let count = 0; count <= MAX_REDIRECTS; count++) {
      const address = await resolvePublicIPv4(url.hostname, lookup);
      if (!address) return null;
      const response = await request(url, address);
      if (!response) return null;
      if (response.redirect) {
        if (count === MAX_REDIRECTS) return null;
        try {
          url = parsePublicHttpUrl(new URL(response.redirect, url).toString());
        } catch {
          return null;
        }
        if (!url) return null;
        continue;
      }
      const text = extractVisibleText(response.body);
      return text.length >= 50 ? text : null;
    }
  } catch {
    return null;
  }
  return null;
}

module.exports = {
  fetchSiteText,
  isPublicIPv4,
  parsePublicHttpUrl,
  resolvePublicIPv4,
  extractVisibleText
};
