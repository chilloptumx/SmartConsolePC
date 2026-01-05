export type CheckStatus = 'SUCCESS' | 'FAILED' | 'WARNING';

export type PowerShellResultLike = {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
};

export function parseResultData(output: string | undefined) {
  const trimmed = (output ?? '').trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const lower = trimmed.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;

    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber) && trimmed !== '') return asNumber;

    // Prisma Json can store strings; keep the raw output rather than failing the check.
    return trimmed;
  }
}

type RegistryCheckLike = {
  registryPath: string;
  valueName?: string | null;
  expectedValue?: string | null;
};

export function evaluateRegistryCheckResult(
  check: RegistryCheckLike,
  ps: PowerShellResultLike
): { status: CheckStatus; message?: string; data: any } {
  const data = parseResultData(ps.output);

  // Default: "did PowerShell execute?"
  let status: CheckStatus = ps.success ? 'SUCCESS' : 'FAILED';
  let message: string | undefined = ps.error?.trim() || undefined;

  // If resultData indicates existence, treat missing as FAILED regardless of ps.success.
  const exists =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as any).exists : undefined;

  if (exists === false) {
    status = 'FAILED';
    message = message || 'Registry path/value not found';
  }

  const expectedValue = check.expectedValue;
  const hasValueName = !!(check.valueName ?? '').toString().trim();

  // Only compare expected value when we actually have a value name and the key/value exists.
  if (status !== 'FAILED' && expectedValue !== null && expectedValue !== undefined && hasValueName && exists === true) {
    const actual = (data as any)?.value;
    if (String(actual) !== String(expectedValue)) {
      status = 'WARNING';
      message = `Expected "${expectedValue}" but got "${actual}"`;
    }
  }

  return { status, message, data };
}

type FileCheckLike = {
  filePath: string;
  checkExists?: boolean | null;
};

export function evaluateFileCheckResult(
  check: FileCheckLike,
  ps: PowerShellResultLike
): { status: CheckStatus; message?: string; data: any } {
  const data = parseResultData(ps.output);

  let status: CheckStatus = ps.success ? 'SUCCESS' : 'FAILED';
  let message: string | undefined = ps.error?.trim() || undefined;

  const exists =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as any).exists : undefined;

  const expectExists = check.checkExists !== false; // default true
  if (exists === true && !expectExists) {
    status = 'FAILED';
    message = message || 'Expected path to be missing, but it exists';
  } else if (exists === false && expectExists) {
    status = 'FAILED';
    message = message || 'File/path not found';
  }

  return { status, message, data };
}


