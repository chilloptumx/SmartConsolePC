import { describe, expect, it } from 'vitest';
import { evaluateFileCheckResult, evaluateRegistryCheckResult, parseResultData } from './check-evaluators.js';

describe('parseResultData', () => {
  it('parses JSON objects', () => {
    expect(parseResultData('{"a":1}')).toEqual({ a: 1 });
  });

  it('falls back to booleans and numbers', () => {
    expect(parseResultData('true')).toBe(true);
    expect(parseResultData('FALSE')).toBe(false);
    expect(parseResultData('42')).toBe(42);
  });

  it('returns raw string for non-JSON', () => {
    expect(parseResultData('not-json')).toBe('not-json');
  });
});

describe('evaluateRegistryCheckResult', () => {
  it('treats exists=false as FAILED even when PowerShell executed successfully', () => {
    const ps = { success: true, output: JSON.stringify({ exists: false, path: 'HKLM\\X', valueName: 'Y' }), duration: 10 };
    const r = evaluateRegistryCheckResult({ registryPath: 'HKEY_LOCAL_MACHINE\\X', valueName: 'Y', expectedValue: null }, ps);
    expect(r.status).toBe('FAILED');
  });

  it('does not downgrade FAILED->WARNING when expectedValue is set but the value is missing', () => {
    const ps = { success: true, output: JSON.stringify({ exists: false, value: undefined }), duration: 10 };
    const r = evaluateRegistryCheckResult({ registryPath: 'HKEY_LOCAL_MACHINE\\X', valueName: 'Y', expectedValue: '1' }, ps);
    expect(r.status).toBe('FAILED');
  });

  it('produces WARNING on expectedValue mismatch when exists=true and valueName is present', () => {
    const ps = { success: true, output: JSON.stringify({ exists: true, valueName: 'Enabled', value: 0 }), duration: 10 };
    const r = evaluateRegistryCheckResult({ registryPath: 'HKEY_LOCAL_MACHINE\\X', valueName: 'Enabled', expectedValue: '1' }, ps);
    expect(r.status).toBe('WARNING');
    expect(r.message).toContain('Expected');
  });
});

describe('evaluateFileCheckResult', () => {
  it('treats exists=false as FAILED when checkExists=true', () => {
    const ps = { success: true, output: JSON.stringify({ exists: false, path: 'C:\\missing.txt' }), duration: 5 };
    const r = evaluateFileCheckResult({ filePath: 'C:\\missing.txt', checkExists: true }, ps);
    expect(r.status).toBe('FAILED');
  });

  it('treats exists=false as SUCCESS when checkExists=false (expect missing)', () => {
    const ps = { success: true, output: JSON.stringify({ exists: false, path: 'C:\\missing.txt' }), duration: 5 };
    const r = evaluateFileCheckResult({ filePath: 'C:\\missing.txt', checkExists: false }, ps);
    expect(r.status).toBe('SUCCESS');
  });

  it('treats exists=true as FAILED when checkExists=false (expect missing)', () => {
    const ps = { success: true, output: JSON.stringify({ exists: true, path: 'C:\\present.txt' }), duration: 5 };
    const r = evaluateFileCheckResult({ filePath: 'C:\\present.txt', checkExists: false }, ps);
    expect(r.status).toBe('FAILED');
  });
});


