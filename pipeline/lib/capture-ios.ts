import { execSync } from 'child_process';
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { CONFIG } from './config.js';

export async function captureIOS(mode: 'light' | 'dark'): Promise<string> {
  const outputPath = resolve(
    import.meta.dirname, '..', CONFIG.outputDir, 'ios', `${mode}.png`
  );
  await mkdir(dirname(outputPath), { recursive: true });

  // Boot simulator if not already running
  try {
    execSync(`xcrun simctl boot "${CONFIG.iosDevice}"`, { stdio: 'pipe' });
    console.log(`  Booted ${CONFIG.iosDevice}`);
  } catch {
    // Already booted -- ignore
  }

  // Launch the GlassReference app (ensures it's in foreground, not home screen)
  // Pitfall 5 from RESEARCH.md: without this, a freshly booted sim captures the home screen
  try {
    execSync(`xcrun simctl launch booted com.glassreference.app`, { stdio: 'pipe' });
    console.log('  Launched GlassReference app');
  } catch {
    console.warn('  Warning: Could not launch GlassReference app -- ensure it is installed');
  }

  // Override status bar for consistency (matching capture.sh pattern)
  execSync(`xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --wifiBars 3 --operatorName ""`, { stdio: 'pipe' });

  // Set appearance mode
  console.log(`  Setting iOS appearance to ${mode}...`);
  execSync(`xcrun simctl ui booted appearance ${mode}`, { stdio: 'pipe' });

  // Wait for rendering to settle after appearance change
  console.log('  Waiting 3s for iOS rendering to settle...');
  await new Promise(r => setTimeout(r, 3000));

  // Capture full screenshot to temp file
  const rawPath = '/tmp/glass_pipeline_ios_raw.png';
  execSync(`xcrun simctl io booted screenshot --type=png --mask=ignored "${rawPath}"`, { stdio: 'pipe' });

  // Crop to glass panel region using sharp
  const { left, top, width, height } = CONFIG.iosCropRegion;
  await sharp(rawPath)
    .extract({ left, top, width, height })
    .toFile(outputPath);

  console.log(`  Saved iOS screenshot: ${outputPath}`);

  // Clear status bar overrides
  try {
    execSync('xcrun simctl status_bar booted clear', { stdio: 'pipe' });
  } catch { /* ignore */ }

  return outputPath;
}
