import { note } from '@clack/prompts';
import { navigableConfirm, navigableText } from './navigable.js';
import type { PkdnsConfig } from '../types/config.js';

function validateAddress(value: string | undefined): string | undefined {
  if (!value || !value.includes(':')) return 'Must be in the format host:port (e.g. 8.8.8.8:53)';
}

function validateNumber(value: string | undefined): string | undefined {
  if (!value || isNaN(Number(value))) return 'Must be a number';
}

export async function runConfigPrompt(existing: PkdnsConfig = {}): Promise<PkdnsConfig> {
  const forward = await navigableText({
    message: 'ICANN fallback DNS server:',
    placeholder: '8.8.8.8:53',
    defaultValue: existing.general?.forward ?? '8.8.8.8:53',
    validate: validateAddress,
  });

  const socket = await navigableText({
    message: 'DNS bind socket (address:port):',
    placeholder: '0.0.0.0:53',
    defaultValue: existing.general?.socket ?? '0.0.0.0:53',
    validate: validateAddress,
  });

  const enableDoh = await navigableConfirm({
    message: 'Enable DNS-over-HTTPS (DoH)?',
    initialValue: Boolean(existing.general?.dns_over_http_socket),
  });

  let dns_over_http_socket: string | undefined;
  if (enableDoh) {
    dns_over_http_socket = await navigableText({
      message: 'DoH listen address:',
      placeholder: '127.0.0.1:3000',
      defaultValue: existing.general?.dns_over_http_socket ?? '127.0.0.1:3000',
      validate: validateAddress,
    });
  }

  const enableDnsOptions = await navigableConfirm({
    message: 'Configure DNS caching & rate limiting options?',
    initialValue: Boolean(existing.dns),
  });

  let dns: PkdnsConfig['dns'];
  if (enableDnsOptions) {
    const maxTtlStr = await navigableText({
      message: 'Max TTL for ICANN responses (seconds):',
      placeholder: '86400',
      defaultValue: String(existing.dns?.max_ttl ?? 86400),
      validate: validateNumber,
    });
    const minTtlStr = await navigableText({
      message: 'Min TTL for ICANN responses (seconds):',
      placeholder: '60',
      defaultValue: String(existing.dns?.min_ttl ?? 60),
      validate: validateNumber,
    });
    const cacheMbStr = await navigableText({
      message: 'ICANN response cache size (MB):',
      placeholder: '100',
      defaultValue: String(existing.dns?.icann_cache_mb ?? 100),
      validate: validateNumber,
    });
    const rateStr = await navigableText({
      message: 'Query rate limit per IP (requests/sec):',
      placeholder: '100',
      defaultValue: String(existing.dns?.query_rate_limit ?? 100),
      validate: validateNumber,
    });
    dns = {
      max_ttl: Number(maxTtlStr),
      min_ttl: Number(minTtlStr),
      icann_cache_mb: Number(cacheMbStr),
      query_rate_limit: Number(rateStr),
    };
  }

  const config: PkdnsConfig = {
    general: {
      forward,
      socket,
      ...(dns_over_http_socket ? { dns_over_http_socket } : {}),
    },
    ...(dns ? { dns } : {}),
  };

  note(
    [
      `Forward DNS:  ${forward}`,
      `Bind socket:  ${socket}`,
      dns_over_http_socket ? `DoH socket:   ${dns_over_http_socket}` : '',
      dns
        ? `Cache TTL:    ${dns.min_ttl}s – ${dns.max_ttl}s  |  Cache: ${dns.icann_cache_mb}MB  |  Rate: ${dns.query_rate_limit} req/s`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    'Configuration summary'
  );

  return config;
}
