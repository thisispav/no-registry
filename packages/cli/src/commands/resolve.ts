import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { promises as dnsPromises } from 'dns';
import chalk from 'chalk';

type RecordType = 'A' | 'AAAA' | 'TXT' | 'CNAME' | 'MX';

export function registerResolve(program: Command): void {
  program
    .command('resolve')
    .description('Resolve a domain through pkdns')
    .argument('<domain>', 'Domain or public key to resolve')
    .option('-t, --type <type>', 'DNS record type: A, AAAA, TXT, CNAME, MX', 'A')
    .option('-s, --server <address>', 'DNS server to query (default: 127.0.0.1:53)')
    .option('--timeout <ms>', 'Query timeout in milliseconds', '5000')
    .action(async (domain: string, options: { type?: string; server?: string; timeout?: string }) => {
      const type = (options.type?.toUpperCase() ?? 'A') as RecordType;
      const server = options.server ?? '127.0.0.1';
      const timeout = parseInt(options.timeout ?? '5000', 10);

      const resolver = new dnsPromises.Resolver({ timeout });
      resolver.setServers([server.includes(':') ? server : `${server}:53`]);

      try {
        const records = await resolveRecords(resolver, domain, type);
        printRecords(domain, type, records);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') {
          log.error(`Could not reach DNS server at ${server}. Is pkdns running? Try \`pkdns status\``);
        } else {
          log.error(`Resolution failed: ${e.message}`);
        }
        process.exit(1);
      }
    });
}

async function resolveRecords(
  resolver: dnsPromises.Resolver,
  domain: string,
  type: RecordType
): Promise<string[]> {
  switch (type) {
    case 'A':
      return resolver.resolve4(domain);
    case 'AAAA':
      return resolver.resolve6(domain);
    case 'TXT': {
      const results = await resolver.resolveTxt(domain);
      return results.map((r) => r.join(''));
    }
    case 'CNAME':
      return resolver.resolveCname(domain);
    case 'MX': {
      const results = await resolver.resolveMx(domain);
      return results.map((r) => `${r.priority} ${r.exchange}`);
    }
  }
}

function printRecords(domain: string, type: RecordType, records: string[]): void {
  if (records.length === 0) {
    log.warn(`No ${type} records found for ${domain}`);
    return;
  }

  console.log(chalk.bold(`${type} records for ${chalk.cyan(domain)}:`));
  for (const record of records) {
    console.log(`  ${chalk.green('→')} ${record}`);
  }
}
