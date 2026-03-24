/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// In vitest/node environment, read the .wgsl file directly from disk
// (Vite's ?raw import works in browser/build only)
const __dirname = dirname(fileURLToPath(import.meta.url));
const glassWgsl = readFileSync(resolve(__dirname, '../../renderer/glass.wgsl'), 'utf-8');

describe('glass.wgsl', () => {
  it('is a non-empty string', () => {
    expect(typeof glassWgsl).toBe('string');
    expect(glassWgsl.length).toBeGreaterThan(100);
  });
  it('contains GlassUniforms struct', () => {
    expect(glassWgsl).toContain('GlassUniforms');
  });
  it('has vertex and fragment entry points', () => {
    expect(glassWgsl).toContain('vs_main');
    expect(glassWgsl).toContain('fs_main');
  });
  it('uniform is at @group(1) @binding(0) — not group 0', () => {
    expect(glassWgsl).toContain('@group(1)');
    expect(glassWgsl).toContain('@binding(0) var<uniform> glass');
  });
});
