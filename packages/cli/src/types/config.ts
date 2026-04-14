export type RunMode = 'binary' | 'docker';

/** Our own CLI metadata — stored in ~/.pkdns/pkdns-cli.json */
export interface CliMeta {
  mode: RunMode;
}

/** The actual pkdns TOML config schema (pkdns.toml) */
export interface PkdnsConfig {
  general?: {
    socket?: string;
    forward?: string;
    dns_over_http_socket?: string;
    verbose?: boolean;
  };
  dns?: {
    min_ttl?: number;
    max_ttl?: number;
    query_rate_limit?: number;
    query_rate_limit_burst?: number;
    disable_any_queries?: boolean;
    icann_cache_mb?: number;
    max_recursion_depth?: number;
  };
  dht?: {
    dht_cache_mb?: number;
    dht_query_rate_limit?: number;
    dht_query_rate_limit_burst?: number;
    top_level_domain?: string;
  };
}
