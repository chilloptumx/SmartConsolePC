const HIVE_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^HKLM(?=[:\\]|$)/i, canonical: 'HKEY_LOCAL_MACHINE' },
  { pattern: /^HKEY_LOCAL_MACHINE(?=[:\\]|$)/i, canonical: 'HKEY_LOCAL_MACHINE' },
  { pattern: /^HKCU(?=[:\\]|$)/i, canonical: 'HKEY_CURRENT_USER' },
  { pattern: /^HKEY_CURRENT_USER(?=[:\\]|$)/i, canonical: 'HKEY_CURRENT_USER' },
  { pattern: /^HKCR(?=[:\\]|$)/i, canonical: 'HKEY_CLASSES_ROOT' },
  { pattern: /^HKEY_CLASSES_ROOT(?=[:\\]|$)/i, canonical: 'HKEY_CLASSES_ROOT' },
  { pattern: /^HKU(?=[:\\]|$)/i, canonical: 'HKEY_USERS' },
  { pattern: /^HKEY_USERS(?=[:\\]|$)/i, canonical: 'HKEY_USERS' },
  { pattern: /^HKCC(?=[:\\]|$)/i, canonical: 'HKEY_CURRENT_CONFIG' },
  { pattern: /^HKEY_CURRENT_CONFIG(?=[:\\]|$)/i, canonical: 'HKEY_CURRENT_CONFIG' },
];

/**
 * Normalize a user-supplied registry path into a canonical "regedit-style" format:
 *   HKEY_LOCAL_MACHINE\SOFTWARE\Vendor\Key
 *
 * This accepts:
 * - HKLM:\SOFTWARE\...
 * - HKLM\SOFTWARE\...
 * - HKEY_LOCAL_MACHINE\SOFTWARE\...
 * - Registry::HKEY_LOCAL_MACHINE\SOFTWARE\...
 */
export function normalizeRegistryPathForStorage(input: string): string {
  let s = (input ?? '').trim();
  if (!s) return s;

  // Strip PowerShell provider prefix if present
  if (/^Registry::/i.test(s)) {
    s = s.replace(/^Registry::/i, '');
    s = s.trim();
  }

  // Normalize separators
  s = s.replace(/\//g, '\\');
  // Collapse multiple backslashes
  s = s.replace(/\\{2,}/g, '\\');

  // If it is HKLM:\... style, remove the colon for storage form
  s = s.replace(/^([A-Za-z_]+):\\/, '$1\\');

  // Canonicalize hive name
  for (const { pattern, canonical } of HIVE_ALIASES) {
    if (pattern.test(s)) {
      s = s.replace(pattern, canonical);
      break;
    }
  }

  // Ensure hive separator is a single backslash
  s = s.replace(/^(HKEY_[A-Z_]+)\\+/, '$1\\');

  // Trim trailing slashes
  s = s.replace(/\\+$/, '');

  return s;
}

/**
 * Convert stored regedit-style registry path to a PowerShell registry provider path.
 */
export function toPowerShellRegistryPath(storedOrInputPath: string): string {
  const stored = normalizeRegistryPathForStorage(storedOrInputPath);
  if (!stored) return stored;
  // If caller already provided Registry:: keep it (after normalization it won't, but safe)
  if (/^Registry::/i.test(stored)) return stored;
  return `Registry::${stored}`;
}

export function normalizeValueName(input: string | null | undefined): string | undefined {
  const s = (input ?? '').trim();
  return s ? s : undefined;
}

export function escapePsSingleQuotedString(value: string): string {
  // In PowerShell single-quoted strings, '' escapes a literal '
  return value.replace(/'/g, "''");
}


