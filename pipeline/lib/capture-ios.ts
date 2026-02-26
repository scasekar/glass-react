import { execSync } from 'child_process';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { CONFIG } from './config.js';

// Ensure xcrun can find simctl even when xcode-select points to CommandLineTools
const EXEC_ENV = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };

function simctl(cmd: string): void {
  execSync(`xcrun simctl ${cmd}`, { stdio: 'pipe', env: EXEC_ENV });
}

export async function captureIOS(mode: 'light' | 'dark'): Promise<string> {
  const outputPath = resolve(
    import.meta.dirname, '..', CONFIG.outputDir, 'ios', `${mode}.png`
  );
  await mkdir(dirname(outputPath), { recursive: true });

  // Boot simulator if not already running
  try {
    simctl(`boot "${CONFIG.iosDevice}"`);
    console.log(`  Booted ${CONFIG.iosDevice}`);
  } catch {
    // Already booted -- ignore
  }

  // Launch the GlassReference app (ensures it's in foreground, not home screen)
  try {
    simctl('launch booted com.glassreference.app');
    console.log('  Launched GlassReference app');
  } catch {
    console.warn('  Warning: Could not launch GlassReference app -- ensure it is installed');
  }

  // Override status bar for consistency
  simctl('status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --wifiBars 3 --operatorName ""');

  // Set appearance mode
  console.log(`  Setting iOS appearance to ${mode}...`);
  simctl(`ui booted appearance ${mode}`);

  // Wait for rendering to settle after appearance change
  console.log('  Waiting 3s for iOS rendering to settle...');
  await new Promise(r => setTimeout(r, 3000));

  // Capture full screenshot to temp file
  const rawPath = '/tmp/glass_pipeline_ios_raw.png';
  simctl(`io booted screenshot --type=png --mask=ignored "${rawPath}"`);

  // Crop to glass panel region using sharp
  const { left, top, width, height } = CONFIG.iosCropRegion;
  await sharp(rawPath)
    .extract({ left, top, width, height })
    .toFile(outputPath);

  console.log(`  Saved iOS screenshot: ${outputPath}`);

  // Clear status bar overrides
  try {
    simctl('status_bar booted clear');
  } catch { /* ignore */ }

  return outputPath;
}
