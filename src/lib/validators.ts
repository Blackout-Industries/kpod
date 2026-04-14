/**
 * Kubernetes Network Policy validation utilities.
 * Covers: metadata, labels, CIDRs, ports, rule deduplication, policy warnings.
 */

import type { PolicyState, PolicyRule, PortRule } from '@/types/policy';

// ── Metadata ──

const DNS_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function validatePolicyName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Policy name is required';
  if (trimmed.length > 253) return 'Policy name must be 253 characters or fewer';
  if (!DNS_SUBDOMAIN_RE.test(trimmed)) {
    return 'Must be lowercase alphanumeric with hyphens (e.g. my-policy)';
  }
  return null;
}

export function validateNamespace(ns: string): string | null {
  const trimmed = ns.trim();
  if (!trimmed) return 'Namespace is required';
  if (trimmed.length > 63) return 'Namespace must be 63 characters or fewer';
  if (!DNS_SUBDOMAIN_RE.test(trimmed)) {
    return 'Must be lowercase alphanumeric with hyphens (e.g. default)';
  }
  return null;
}

// ── Labels ──

const LABEL_NAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
const LABEL_PREFIX_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const LABEL_VALUE_RE = /^([a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?)?$/;

export function validateLabelKey(key: string): string | null {
  if (!key) return 'Key is required';

  const parts = key.split('/');
  if (parts.length > 2) return 'Key can have at most one / separator';

  if (parts.length === 2) {
    const [prefix, name] = parts;
    if (prefix.length > 253) return 'Key prefix must be 253 chars or fewer';
    if (!LABEL_PREFIX_RE.test(prefix)) return 'Invalid key prefix (must be DNS subdomain)';
    if (!name || name.length > 63) return 'Key name must be 1-63 chars';
    if (!LABEL_NAME_RE.test(name)) return 'Invalid key name';
  } else {
    if (key.length > 63) return 'Key must be 63 chars or fewer';
    if (!LABEL_NAME_RE.test(key)) return 'Must start/end with alphanumeric, can contain . _ -';
  }

  return null;
}

export function validateLabelValue(value: string): string | null {
  if (value.length > 63) return 'Value must be 63 chars or fewer';
  if (!LABEL_VALUE_RE.test(value)) {
    return 'Must start/end with alphanumeric, can contain . _ -';
  }
  return null;
}

// ── CIDR ──

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = Number(p);
    return /^\d{1,3}$/.test(p) && n >= 0 && n <= 255;
  });
}

export function validateCidr(cidr: string): string | null {
  if (!cidr.trim()) return 'CIDR is required';

  const parts = cidr.split('/');
  if (parts.length !== 2) return 'Must include prefix length (e.g. 10.0.0.0/8)';

  const [ip, prefixStr] = parts;

  if (!isValidIPv4(ip)) return 'Invalid IPv4 address';

  const prefix = Number(prefixStr);
  if (!/^\d+$/.test(prefixStr) || prefix < 0 || prefix > 32) {
    return 'Prefix must be 0-32';
  }

  return null;
}

export function validateExceptCidr(exceptCidr: string, mainCidr: string | undefined): string | null {
  const baseErr = validateCidr(exceptCidr);
  if (baseErr) return baseErr;

  if (mainCidr && !cidrContains(mainCidr, exceptCidr)) {
    return 'Exception must be a subset of the main CIDR';
  }

  return null;
}

/** Check if outer CIDR contains inner CIDR (simplified check by prefix length). */
function cidrContains(outer: string, inner: string): boolean {
  const [outerIp, outerPrefix] = outer.split('/');
  const [innerIp, innerPrefix] = inner.split('/');

  if (!outerIp || !innerIp || !outerPrefix || !innerPrefix) return false;

  const outerPrefixNum = Number(outerPrefix);
  const innerPrefixNum = Number(innerPrefix);

  // Inner prefix must be >= outer prefix (more specific or equal)
  if (innerPrefixNum < outerPrefixNum) return false;

  // Check that the network bits match
  const outerNum = ipToNumber(outerIp);
  const innerNum = ipToNumber(innerIp);
  if (outerNum === null || innerNum === null) return false;

  const mask = outerPrefixNum === 0 ? 0 : (~0 << (32 - outerPrefixNum)) >>> 0;
  return (outerNum & mask) === (innerNum & mask);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// ── Ports ──

export function validatePort(port: string | number): string | null {
  if (typeof port === 'string') {
    if (!port.trim()) return 'Port is required';
    // Named port: must be valid K8s name
    if (/^\d+$/.test(port)) {
      const num = Number(port);
      if (num < 1 || num > 65535) return 'Port must be 1-65535';
    } else {
      // Named port validation
      if (port.length > 15) return 'Named port must be 15 chars or fewer';
      if (!/^[a-z]([a-z0-9-]*[a-z0-9])?$/.test(port)) {
        return 'Named port must be lowercase, start with letter, contain only a-z 0-9 -';
      }
    }
  } else {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return 'Port must be 1-65535';
    }
  }
  return null;
}

// ── Duplicate Detection ──

export function findDuplicateRules(rules: PolicyRule[]): Set<string> {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const rule of rules) {
    const key = ruleFingerprint(rule);
    const existingId = seen.get(key);
    if (existingId) {
      duplicates.add(existingId);
      duplicates.add(rule.id);
    } else {
      seen.set(key, rule.id);
    }
  }

  return duplicates;
}

function ruleFingerprint(rule: PolicyRule): string {
  const parts = [rule.type];

  if (rule.type === 'outside') {
    parts.push(`cidr:${rule.cidr ?? ''}`);
    parts.push(`except:${(rule.except ?? []).sort().join(',')}`);
  } else if (rule.type === 'namespace') {
    parts.push(`ns:${sortedLabels(rule.namespaceSelector)}`);
    parts.push(`pod:${sortedLabels(rule.podSelector)}`);
  } else {
    parts.push(`pod:${sortedLabels(rule.podSelector)}`);
  }

  const portKey = rule.ports
    .map(p => `${p.port}/${p.protocol}`)
    .sort()
    .join(';');
  parts.push(`ports:${portKey}`);

  return parts.join('|');
}

function sortedLabels(labels?: Record<string, string>): string {
  if (!labels) return '';
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

// ── Policy-Level Warnings ──

export interface PolicyWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
  ruleId?: string;
}

export function computeWarnings(state: PolicyState): PolicyWarning[] {
  const warnings: PolicyWarning[] = [];

  // Metadata
  const nameErr = validatePolicyName(state.policyName);
  if (nameErr) warnings.push({ level: 'error', message: `Policy name: ${nameErr}` });

  const nsErr = validateNamespace(state.namespace);
  if (nsErr) warnings.push({ level: 'error', message: `Namespace: ${nsErr}` });

  // No rules at all
  if (state.ingressRules.length === 0 && state.egressRules.length === 0) {
    warnings.push({ level: 'info', message: 'No rules defined — policy has no effect' });
  }

  // Check duplicate ingress
  const dupIngress = findDuplicateRules(state.ingressRules);
  if (dupIngress.size > 0) {
    warnings.push({ level: 'warning', message: `${dupIngress.size / 2} duplicate ingress rule(s)` });
  }

  // Check duplicate egress
  const dupEgress = findDuplicateRules(state.egressRules);
  if (dupEgress.size > 0) {
    warnings.push({ level: 'warning', message: `${dupEgress.size / 2} duplicate egress rule(s)` });
  }

  // Check individual rules
  const allRules = [
    ...state.ingressRules.map(r => ({ rule: r, dir: 'Ingress' })),
    ...state.egressRules.map(r => ({ rule: r, dir: 'Egress' })),
  ];

  for (const { rule, dir } of allRules) {
    // CIDR validation
    if (rule.type === 'outside') {
      if (rule.cidr) {
        const cidrErr = validateCidr(rule.cidr);
        if (cidrErr) {
          warnings.push({ level: 'error', message: `${dir} CIDR: ${cidrErr}`, ruleId: rule.id });
        }
        if (rule.cidr === '0.0.0.0/0') {
          warnings.push({ level: 'warning', message: `${dir}: 0.0.0.0/0 allows ALL traffic`, ruleId: rule.id });
        }
      }
      for (const exc of rule.except ?? []) {
        const excErr = validateExceptCidr(exc, rule.cidr);
        if (excErr) {
          warnings.push({ level: 'error', message: `${dir} exception "${exc}": ${excErr}`, ruleId: rule.id });
        }
      }
    }

    // Port validation
    for (const port of rule.ports) {
      const portErr = validatePort(port.port);
      if (portErr) {
        warnings.push({ level: 'error', message: `${dir} port ${port.port}: ${portErr}`, ruleId: rule.id });
      }
    }

    // Duplicate ports within same rule
    const portKeys = rule.ports.map(p => `${p.port}/${p.protocol}`);
    const uniquePorts = new Set(portKeys);
    if (uniquePorts.size < portKeys.length) {
      warnings.push({ level: 'warning', message: `${dir}: duplicate port/protocol entries`, ruleId: rule.id });
    }

    // Empty selectors warning
    if (rule.type === 'cluster' && Object.keys(rule.podSelector ?? {}).length === 0) {
      warnings.push({ level: 'warning', message: `${dir}: empty pod selector matches ALL pods in cluster`, ruleId: rule.id });
    }
    if (rule.type === 'namespace') {
      if (Object.keys(rule.namespaceSelector ?? {}).length === 0 && Object.keys(rule.podSelector ?? {}).length === 0) {
        warnings.push({ level: 'warning', message: `${dir}: empty selectors match ALL pods in ALL namespaces`, ruleId: rule.id });
      }
    }

    // Empty ports = all ports
    if (rule.ports.length === 0) {
      warnings.push({ level: 'info', message: `${dir}: no ports specified — allows ALL ports`, ruleId: rule.id });
    }

    // Label validation
    const labelSets: [string, Record<string, string> | undefined][] = [
      ['podSelector', rule.podSelector],
      ['namespaceSelector', rule.namespaceSelector],
    ];
    for (const [name, labels] of labelSets) {
      if (!labels) continue;
      for (const [k, v] of Object.entries(labels)) {
        const keyErr = validateLabelKey(k);
        if (keyErr) {
          warnings.push({ level: 'error', message: `${dir} ${name} key "${k}": ${keyErr}`, ruleId: rule.id });
        }
        const valErr = validateLabelValue(v);
        if (valErr) {
          warnings.push({ level: 'error', message: `${dir} ${name} value "${v}": ${valErr}`, ruleId: rule.id });
        }
      }
    }
  }

  // Target pod selector label validation
  for (const [k, v] of Object.entries(state.podSelector)) {
    const keyErr = validateLabelKey(k);
    if (keyErr) warnings.push({ level: 'error', message: `Pod selector key "${k}": ${keyErr}` });
    const valErr = validateLabelValue(v);
    if (valErr) warnings.push({ level: 'error', message: `Pod selector value "${v}": ${valErr}` });
  }

  return warnings;
}
