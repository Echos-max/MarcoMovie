import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import http from 'node:http';
import https from 'node:https';

const REQUEST_TIMEOUT_MS = 15_000;
const DNS_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_SITES = 1000;

const blockedIPv4 = new BlockList();

for (const subnet of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  blockedIPv4.addSubnet(subnet[0], subnet[1], 'ipv4');
}

const blockedIPv6 = new BlockList();

for (const subnet of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
]) {
  blockedIPv6.addSubnet(subnet[0], subnet[1], 'ipv6');
}

const globalIPv6 = new BlockList();
globalIPv6.addSubnet('2000::', 3, 'ipv6');

function assertPublicAddress(address) {
  const family = isIP(address);

  if (family === 4) {
    if (blockedIPv4.check(address, 'ipv4')) {
      throw new Error(`订阅服务器解析到了禁止访问的 IPv4 地址：${address}`);
    }
    return family;
  }

  if (family === 6) {
    if (
      !globalIPv6.check(address, 'ipv6') ||
      blockedIPv6.check(address, 'ipv6')
    ) {
      throw new Error(`订阅服务器解析到了禁止访问的 IPv6 地址：${address}`);
    }
    return family;
  }

  throw new Error('DNS 返回了无效的 IP 地址');
}

function validateUrl(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    throw new Error('订阅地址格式不正确');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('订阅地址只允许使用 HTTP 或 HTTPS');
  }

  if (url.username || url.password) {
    throw new Error('订阅地址不允许包含用户名或密码');
  }

  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  const actualPort = url.port || expectedPort;

  if (actualPort !== expectedPort) {
    throw new Error('订阅地址只允许使用 HTTP 80 或 HTTPS 443 端口');
  }

  const hostname = url.hostname
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase()
    .replace(/\.$/, '');

  if (
    !hostname ||
    hostname === 'localhost' ||
    /\.(localhost|local|internal|lan|home|test|invalid)$/.test(hostname)
  ) {
    throw new Error('订阅地址包含不允许访问的本地域名');
  }

  url.hash = '';

  return { url, hostname, port: Number(actualPort) };
}

async function resolvePublicAddress(hostname) {
  const literalFamily = isIP(hostname);

  if (literalFamily) {
    assertPublicAddress(hostname);
    return { address: hostname, family: literalFamily };
  }

  let timer;

  try {
    const records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('订阅域名 DNS 解析超时')),
          DNS_TIMEOUT_MS,
        );
      }),
    ]);

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('订阅域名没有可用的 DNS 解析结果');
    }

    // 混合返回公网和内网 IP 时也拒绝，避免利用 DNS 多记录绕过检查。
    const validated = records.map(record => ({
      address: record.address,
      family: assertPublicAddress(record.address),
    }));

    return validated[0];
  } finally {
    clearTimeout(timer);
  }
}

function requestOnce(url, hostname, port, pinnedAddress) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const family = pinnedAddress.family;

    const pinnedLookup = (_hostname, options, callback) => {
      if (options?.all) {
        callback(null, [{
          address: pinnedAddress.address,
          family,
        }]);
      } else {
        callback(null, pinnedAddress.address, family);
      }
    };

    const requestOptions = {
      protocol: url.protocol,
      hostname,
      port,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
        'Accept-Encoding': 'identity',
        'User-Agent': 'MarcoMovie2-Subscription/1.0',
        Connection: 'close',
      },
      lookup: pinnedLookup,
    };

    const request = transport.request(requestOptions, response => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location || '';

      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        response.resume();
        resolve({ statusCode, location });
        return;
      }

      const encoding = String(
        response.headers['content-encoding'] || 'identity',
      ).toLowerCase();

      if (encoding !== 'identity') {
        response.destroy();
        reject(new Error('订阅服务器返回了不支持的压缩响应'));
        return;
      }

      const contentLength = Number(response.headers['content-length'] || 0);

      if (contentLength > MAX_RESPONSE_BYTES) {
        response.destroy();
        reject(new Error('订阅配置超过 5 MB 大小限制'));
        return;
      }

      const contentType = String(
        response.headers['content-type'] || '',
      ).toLowerCase();

      if (contentType.includes('text/html')) {
        response.destroy();
        reject(new Error('订阅服务器返回了 HTML 页面，不是 JSON 配置'));
        return;
      }

      const chunks = [];
      let totalBytes = 0;

      response.on('data', chunk => {
        totalBytes += chunk.length;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          response.destroy(new Error('订阅配置超过 5 MB 大小限制'));
          return;
        }

        chunks.push(chunk);
      });

      response.on('end', () => {
        resolve({
          statusCode,
          body: Buffer.concat(chunks),
        });
      });

      response.on('error', reject);
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('获取订阅配置超时'));
    });

    request.on('error', reject);
    request.end();
  });
}

export function validateSubscriptionConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
  ) {
    throw new Error('订阅配置必须是 JSON 对象');
  }

  if (!Array.isArray(config.sites) || config.sites.length === 0) {
    throw new Error('订阅配置缺少有效的 sites 数组');
  }

  if (config.sites.length > MAX_SITES) {
    throw new Error(`订阅站点数量不能超过 ${MAX_SITES}`);
  }

  const keys = new Set();

  for (let index = 0; index < config.sites.length; index += 1) {
    const site = config.sites[index];

    if (!site || typeof site !== 'object' || Array.isArray(site)) {
      throw new Error(`第 ${index + 1} 个站点格式不正确`);
    }

    for (const field of ['key', 'name', 'api']) {
      if (
        typeof site[field] !== 'string' ||
        !site[field].trim()
      ) {
        throw new Error(`第 ${index + 1} 个站点缺少有效的 ${field} 字段`);
      }

      if (site[field].length > 2048) {
        throw new Error(`第 ${index + 1} 个站点的 ${field} 字段过长`);
      }
    }

    const key = site.key.trim();

    if (keys.has(key)) {
      throw new Error(`订阅配置存在重复站点 key：${key}`);
    }

    keys.add(key);
  }

  return config;
}

export async function fetchSubscriptionConfig(inputUrl) {
  let currentUrl = String(inputUrl || '').trim();

  if (!currentUrl) {
    throw new Error('订阅地址不能为空');
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const validated = validateUrl(currentUrl);
    const pinnedAddress = await resolvePublicAddress(validated.hostname);

    const result = await requestOnce(
      validated.url,
      validated.hostname,
      validated.port,
      pinnedAddress,
    );

    if ([301, 302, 303, 307, 308].includes(result.statusCode)) {
      if (!result.location) {
        throw new Error('订阅服务器重定向缺少目标地址');
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new Error('订阅服务器重定向次数超过限制');
      }

      currentUrl = new URL(result.location, validated.url).toString();
      continue;
    }

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`获取订阅配置失败：HTTP ${result.statusCode}`);
    }

    let config;

    try {
      const content = result.body.toString('utf8').replace(/^\uFEFF/, '');
      config = JSON.parse(content);
    } catch {
      throw new Error('订阅服务器返回的内容不是有效 JSON');
    }

    validateSubscriptionConfig(config);

    return {
      config,
      sourceCount: config.sites.length,
      finalUrl: validated.url.toString(),
    };
  }

  throw new Error('订阅获取失败');
}