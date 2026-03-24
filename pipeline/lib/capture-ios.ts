import { execSync } from 'child_process';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { CONFIG } from './config.js';

// Ensure xcrun can find simctl even when xcode-select points to CommandLineTools
const EXEC_ENV = { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };

function simctl(cmd: string, timeoutMs = 15000): void {
  execSync(`xcrun simctl ${cmd}`, { stdio: 'pipe', env: EXEC_ENV, timeout: timeoutMs });
}

export async function captureIOS(mode: 'light' | 'dark'): Promise<string> {
  const outputPath = resolve(
    import.meta.dirname, '..', CONFIG.outputDir, 'ios', `${mode}.png`
  );
  await mkdir(dirname(outputPath), { recursive: true });

  // Try fresh capture, fall back to existing reference if simulator/app unavailable
  try {
    // Boot simulator if not already running
    try {
      simctl(`boot "${CONFIG.iosDevice}"`);
      console.log(`  Booted ${CONFIG.iosDevice}`);
    } catch {
      // Already booted -- ignore
    }

    // Set appearance mode BEFORE launching the app so it picks up the scheme
    console.log(`  Setting iOS appearance to ${mode}...`);
    simctl(`ui booted appearance ${mode}`);

    // Terminate any running instance so it relaunches with the new appearance
    try {
      simctl('terminate booted com.glassreference.app');
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      // App wasn't running -- ignore
    }

    // Launch the GlassReference app (picks up current system appearance)
    simctl('launch booted com.glassreference.app');
    console.log('  Launched GlassReference app');

    // Override status bar for consistency
    simctl('status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --wifiBars 3 --operatorName ""');

    // Wait for rendering to settle after launch
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
  } catch (err) {
    // If fresh capture fails, reuse existing iOS reference screenshots
    if (existsSync(outputPath)) {
      console.log(`  Warning: Fresh iOS capture failed, reusing existing reference: ${outputPath}`);
      console.log(`  Error was: ${(err as Error).message}`);
    } else {
      throw new Error(`iOS capture failed and no existing reference at ${outputPath}: ${(err as Error).message}`);
    }
  }

  return outputPath;
}
