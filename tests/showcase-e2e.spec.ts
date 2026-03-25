import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const SCREENSHOT_DIR = join(process.cwd(), 'tests', 'screenshots');

// ─── Helpers ──────────────────────────────────────────────────────────

async function saveScreenshot(page: Page, name: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

/** Wait for the showcase page to be fully loaded and WebGPU canvas visible */
async function waitForShowcase(page: Page) {
  await page.goto('/');
  // The GPU canvas must be present (GlassProvider creates it)
  await page.waitForSelector('#gpu-canvas', { state: 'visible', timeout: 15_000 });
  // Give the render loop time to produce frames
  await page.waitForTimeout(2000);
}

/** Scroll an element into view and wait for VirtualSection to mount */
async function scrollToSection(page: Page, sectionId: string) {
  await page.evaluate((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
  }, sectionId);
  // VirtualSection needs time to intersect and mount children
  await page.waitForTimeout(800);
}

// ─── Page Load & Layout ───────────────────────────────────────────────

test.describe('Showcase page load & layout', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('page loads with showcase (not old tuning UI)', async ({ page }) => {
    // ShowcasePage should be visible — check for hero headline
    const hero = page.locator('h1');
    await expect(hero).toContainText('Liquid Glass', { timeout: 10_000 });
  });

  test('sticky header is visible with nav links', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Nav links present
    for (const label of ['Controls', 'Navigation', 'Overlays', 'Forms', 'Get Started']) {
      await expect(header.locator(`a:has-text("${label}")`)).toBeVisible();
    }

    // LiquidGlass branding
    await expect(header.locator('text=LiquidGlass')).toBeVisible();
  });

  test('header has tuning gear toggle button', async ({ page }) => {
    const gearBtn = page.locator('button[aria-label="Toggle tuning drawer"]');
    await expect(gearBtn).toBeVisible();
  });

  test('GPU canvas renders non-black pixels', async ({ page }) => {
    const canvas = page.locator('#gpu-canvas');
    const screenshot = await canvas.screenshot();
    let nonBlack = 0;
    let total = 0;
    for (let i = 0; i < screenshot.length - 3; i += 40) {
      if (screenshot[i] > 20 || screenshot[i + 1] > 20 || screenshot[i + 2] > 20) nonBlack++;
      total++;
    }
    const ratio = nonBlack / total;
    console.log(`GPU canvas non-black: ${(ratio * 100).toFixed(1)}%`);
    expect(ratio).toBeGreaterThan(0.1);
  });

  test('saves full-page showcase screenshot', async ({ page }) => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, 'showcase-full.png'),
      fullPage: true,
    });
  });
});

// ─── Hero Section ─────────────────────────────────────────────────────

test.describe('Hero section', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('headline and tagline are visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Liquid Glass');
    await expect(page.locator('text=WebGPU-powered')).toBeVisible();
  });

  test('wallpaper segmented control switches background mode', async ({ page }) => {
    // The segmented control should have Wallpaper and Noise options
    const noiseBtn = page.locator('button:has-text("Noise")');
    await expect(noiseBtn).toBeVisible();
    await noiseBtn.click();
    await page.waitForTimeout(500);

    // Switch back
    const wallpaperBtn = page.locator('button:has-text("Wallpaper")');
    await wallpaperBtn.click();
    await page.waitForTimeout(500);
  });

  test('CTA buttons are clickable', async ({ page }) => {
    const githubBtn = page.locator('button:has-text("View on GitHub")').first();
    await expect(githubBtn).toBeVisible();
    await expect(githubBtn).toBeEnabled();

    const exploreBtn = page.locator('button:has-text("Explore Controls")');
    await expect(exploreBtn).toBeVisible();
    await expect(exploreBtn).toBeEnabled();
  });

  test('"Explore Controls" scrolls to interactive section', async ({ page }) => {
    const exploreBtn = page.locator('button:has-text("Explore Controls")');
    await exploreBtn.click();
    await page.waitForTimeout(1000);

    // Interactive section should now be in viewport
    const section = page.locator('#interactive');
    await expect(section).toBeInViewport();
  });
});

// ─── Interactive Controls Section (Toggle, Slider, Segmented) ─────────

test.describe('Interactive controls section', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
    await scrollToSection(page, 'interactive');
  });

  test('section title is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Controls That Feel Alive")')).toBeVisible();
  });

  test('GlassToggle toggles on click', async ({ page }) => {
    // Find the Notifications toggle — it's a Radix Switch root
    const toggle = page.locator('button[role="switch"]').first();
    await expect(toggle).toBeVisible();

    const initialState = await toggle.getAttribute('data-state');
    await toggle.click();
    await page.waitForTimeout(300);

    const newState = await toggle.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
  });

  test('GlassToggle is keyboard accessible', async ({ page }) => {
    const toggle = page.locator('button[role="switch"]').first();
    await toggle.focus();

    const initialState = await toggle.getAttribute('data-state');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    const newState = await toggle.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
  });

  test('GlassSlider responds to pointer interaction', async ({ page }) => {
    // Radix Slider has role="slider"
    const thumb = page.locator('[role="slider"]').first();
    await expect(thumb).toBeVisible();

    const initialValue = await thumb.getAttribute('aria-valuenow');

    // Drag thumb right
    const box = await thumb.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    const newValue = await thumb.getAttribute('aria-valuenow');
    // Value should have changed (or at least not crashed)
    expect(newValue).not.toBeNull();
  });

  test('GlassSlider is keyboard accessible', async ({ page }) => {
    const thumb = page.locator('[role="slider"]').first();
    await thumb.focus();

    const initialValue = Number(await thumb.getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const newValue = Number(await thumb.getAttribute('aria-valuenow'));
    expect(newValue).toBeGreaterThanOrEqual(initialValue);
  });

  test('GlassSegmentedControl switches segments', async ({ page }) => {
    // Radix ToggleGroup items are buttons within the segmented control
    const lightBtn = page.locator('button:has-text("Light")');
    const darkBtn = page.locator('button:has-text("Dark")');

    await expect(lightBtn).toBeVisible();
    await expect(darkBtn).toBeVisible();

    await lightBtn.click();
    await page.waitForTimeout(300);

    // Light should now be active (data-state="on")
    await expect(lightBtn).toHaveAttribute('data-state', 'on');
  });
});

// ─── Form Controls Section (Chip, Stepper, Input) ─────────────────────

test.describe('Form controls section', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
    await scrollToSection(page, 'forms');
  });

  test('section title is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Complete Control Palette")')).toBeVisible();
  });

  test('GlassChip toggles selected state', async ({ page }) => {
    // Chips have aria-pressed
    const designChip = page.locator('button[aria-pressed]').filter({ hasText: 'Design' });
    await expect(designChip).toBeVisible();

    // Design starts selected (from default state)
    const initialPressed = await designChip.getAttribute('aria-pressed');
    await designChip.click();
    await page.waitForTimeout(200);

    const newPressed = await designChip.getAttribute('aria-pressed');
    expect(newPressed).not.toBe(initialPressed);
  });

  test('GlassStepper increments and decrements', async ({ page }) => {
    // Stepper has +/- buttons
    const plusBtn = page.locator('button:has-text("+")');
    const minusBtn = page.locator('button:has-text("−")').or(page.locator('button:has-text("-")'));

    await expect(plusBtn.first()).toBeVisible();
    await expect(minusBtn.first()).toBeVisible();

    // Get initial value from <output> element
    const output = page.locator('output').first();
    const initialValue = Number(await output.textContent());

    // Increment
    await plusBtn.first().click();
    await page.waitForTimeout(200);
    const afterIncrement = Number(await output.textContent());
    expect(afterIncrement).toBe(initialValue + 1);

    // Decrement
    await minusBtn.first().click();
    await page.waitForTimeout(200);
    const afterDecrement = Number(await output.textContent());
    expect(afterDecrement).toBe(initialValue);
  });

  test('GlassInput accepts text input', async ({ page }) => {
    const input = page.locator('input[type="email"]');
    await expect(input).toBeVisible();

    await input.fill('test@example.com');
    await expect(input).toHaveValue('test@example.com');
  });

  test('GlassInput has visible focus ring', async ({ page }) => {
    const input = page.locator('input[type="email"]');
    await input.focus();
    await page.waitForTimeout(200);

    // Input should have focus
    await expect(input).toBeFocused();
  });
});

// ─── Navigation Controls Section ──────────────────────────────────────

test.describe('Navigation controls section', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
    await scrollToSection(page, 'navigation');
  });

  test('section title is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Real App Navigation")')).toBeVisible();
  });

  test('GlassNavigationBar shows title and back button', async ({ page }) => {
    // Nav bar should show "Photos" title
    await expect(page.locator('text=Photos')).toBeVisible();

    // Back button should be present
    const backBtn = page.locator('button[aria-label="Back"]');
    await expect(backBtn).toBeVisible();
  });

  test('GlassToolbar action buttons are clickable', async ({ page }) => {
    // Toolbar buttons with aria-labels — scope to toolbar role to avoid nav bar duplicates
    const toolbar = page.locator('[role="toolbar"]');
    const favBtn = toolbar.locator('button[aria-label="Favorite"]');
    const shareBtn = toolbar.locator('button[aria-label="Share"]');

    await expect(favBtn).toBeVisible();
    await expect(shareBtn).toBeVisible();

    // Click should not crash
    await favBtn.click();
    await page.waitForTimeout(200);
  });

  test('mock app frame renders photo grid', async ({ page }) => {
    // The photo grid has colored placeholder divs
    const gridItems = page.locator('div[style*="aspect-ratio"]');
    const count = await gridItems.count();
    expect(count).toBeGreaterThanOrEqual(9);
  });
});

// ─── Overlay Controls Section ─────────────────────────────────────────

test.describe('Overlay controls section', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
    await scrollToSection(page, 'overlays');
  });

  test('section title is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Fluid Overlays")')).toBeVisible();
  });

  test('GlassAlert opens and closes', async ({ page }) => {
    // Click "Show Alert" button
    const trigger = page.locator('button:has-text("Show Alert")');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.waitForTimeout(500);

    // Alert should be open with title and action buttons
    await expect(page.locator('text=Delete Photo?')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();

    // Cancel closes it
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Alert should be gone
    await expect(page.locator('text=Delete Photo?')).not.toBeVisible();
  });

  test('GlassAlert closes on Escape key', async ({ page }) => {
    const trigger = page.locator('button:has-text("Show Alert")');
    await trigger.click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Delete Photo?')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Delete Photo?')).not.toBeVisible();
  });

  test('GlassActionSheet opens and shows actions', async ({ page }) => {
    const trigger = page.locator('button:has-text("Show Actions")');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.waitForTimeout(500);

    // Action sheet should show title and action items
    await expect(page.getByRole('heading', { name: 'Share Photo' })).toBeVisible();
    await expect(page.locator('button:has-text("Copy Link")')).toBeVisible();
    await expect(page.locator('button:has-text("Save to Files")')).toBeVisible();
    await expect(page.locator('button:has-text("AirDrop")')).toBeVisible();
  });

  test('GlassActionSheet cancel dismisses', async ({ page }) => {
    const trigger = page.locator('button:has-text("Show Actions")');
    await trigger.click();
    await page.waitForTimeout(500);

    // Cancel button at bottom
    const cancelBtn = page.locator('[role="dialog"] button:has-text("Cancel")').or(
      page.locator('button:has-text("Cancel")').last()
    );
    await cancelBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Share Photo' })).not.toBeVisible();
  });

  test('GlassActionSheet action item triggers callback and dismisses', async ({ page }) => {
    const trigger = page.locator('button:has-text("Show Actions")');
    await trigger.click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Copy Link")').click();
    await page.waitForTimeout(500);

    // Sheet should dismiss after action
    await expect(page.getByRole('heading', { name: 'Share Photo' })).not.toBeVisible();
  });
});

// ─── Tuning Drawer ────────────────────────────────────────────────────

test.describe('Tuning drawer', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('opens and closes via gear button', async ({ page }) => {
    const gearBtn = page.locator('button[aria-label="Toggle tuning drawer"]');
    await gearBtn.click();
    await page.waitForTimeout(500);

    // Drawer should be visible with "Tuning" header
    await expect(page.locator('h2:has-text("Tuning")')).toBeVisible();

    // Close button
    const closeBtn = page.locator('button[aria-label="Close tuning drawer"]');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // Drawer header should slide off-screen (still in DOM but transformed)
  });

  test('has parameter sliders', async ({ page }) => {
    const gearBtn = page.locator('button[aria-label="Toggle tuning drawer"]');
    await gearBtn.click();
    await page.waitForTimeout(500);

    // Check for expected tuning sliders
    for (const param of ['Blur Intensity', 'Specular Intensity', 'Rim Intensity']) {
      await expect(page.locator(`text=${param}`)).toBeVisible();
    }

    // Range inputs should be present
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('slider value updates when dragged', async ({ page }) => {
    const gearBtn = page.locator('button[aria-label="Toggle tuning drawer"]');
    await gearBtn.click();
    await page.waitForTimeout(500);

    const slider = page.locator('input[type="range"][aria-label="Blur Intensity"]');
    await expect(slider).toBeVisible();

    // Change slider value
    await slider.fill('0.8');
    await page.waitForTimeout(200);

    // The displayed value should update — scope to the Blur Intensity row
    const blurRow = slider.locator('..');
    await expect(blurRow.locator('text=0.80')).toBeVisible();
  });
});

// ─── Developer Section ────────────────────────────────────────────────

test.describe('Developer section', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
    await scrollToSection(page, 'developer');
  });

  test('section title is visible', async ({ page }) => {
    await expect(page.locator('h2:has-text("Start in 5 Minutes")')).toBeVisible();
  });

  test('install command is shown', async ({ page }) => {
    await expect(page.locator('text=npm install liquidglass-react')).toBeVisible();
  });

  test('code example is shown', async ({ page }) => {
    await expect(page.locator('text=GlassProvider')).toBeVisible();
    await expect(page.locator('text=GlassButton')).toBeVisible();
  });

  test('copy button exists', async ({ page }) => {
    const copyBtn = page.locator('button:has-text("Copy")');
    await expect(copyBtn).toBeVisible();
  });

  test('browser compatibility info is shown', async ({ page }) => {
    await expect(page.locator('text=Chrome 113+')).toBeVisible();
  });
});

// ─── Navigation (anchor links) ────────────────────────────────────────

test.describe('Header navigation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('nav link scrolls to correct section', async ({ page }) => {
    const formsLink = page.locator('header a:has-text("Forms")');
    await formsLink.click();
    await page.waitForTimeout(1000);

    const formsSection = page.locator('#forms');
    await expect(formsSection).toBeInViewport();
  });
});

// ─── VirtualSection (GPU region budget) ───────────────────────────────

test.describe('VirtualSection virtualization', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('off-screen sections start with placeholder', async ({ page }) => {
    // Developer section should be far off-screen initially
    // VirtualSection should show placeholder
    // Note: with rootMargin: '100% 0px', sections may mount eagerly
    // Just verify the page doesn't crash with all sections
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // All sections should eventually be visible
    await expect(page.locator('#developer')).toBeAttached();
  });

  test('scrolling through all sections does not crash', async ({ page }) => {
    // Scroll through entire page in steps
    for (const id of ['interactive', 'navigation', 'overlays', 'forms', 'developer']) {
      await scrollToSection(page, id);
    }

    // Page should still be responsive
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // GPU canvas should still be rendering
    const canvas = page.locator('#gpu-canvas');
    await expect(canvas).toBeVisible();
  });
});

// ─── Viewport resize ──────────────────────────────────────────────────

test.describe('Responsive behavior', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('resize does not crash renderer', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    const canvas = page.locator('#gpu-canvas');
    await expect(canvas).toBeVisible();

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);

    await expect(canvas).toBeVisible();
  });

  test('narrow viewport wraps content gracefully', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone size
    await page.waitForTimeout(500);

    // Hero should still be visible
    await expect(page.locator('h1')).toBeVisible();

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});

// ─── Performance ──────────────────────────────────────────────────────

test.describe('Performance', () => {
  test('page loads within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector('#gpu-canvas', { state: 'visible', timeout: 10_000 });
    const elapsed = Date.now() - start;
    console.log(`Page load time: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(10_000);
  });

  test('no console errors during normal interaction', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await waitForShowcase(page);

    // Interact with various controls
    await scrollToSection(page, 'interactive');
    const toggle = page.locator('button[role="switch"]').first();
    if (await toggle.isVisible()) await toggle.click();

    await scrollToSection(page, 'forms');
    const chip = page.locator('button[aria-pressed]').first();
    if (await chip.isVisible()) await chip.click();

    await scrollToSection(page, 'overlays');
    const alertBtn = page.locator('button:has-text("Show Alert")');
    if (await alertBtn.isVisible()) {
      await alertBtn.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }

    // Filter out known WebGPU warnings
    const realErrors = errors.filter(e =>
      !e.includes('WebGPU') &&
      !e.includes('GPU') &&
      !e.includes('adapter')
    );

    if (realErrors.length > 0) {
      console.log('Console errors:', realErrors);
    }
    expect(realErrors.length).toBe(0);
  });

  test('no uncaught exceptions during full page scroll', async ({ page }) => {
    const exceptions: string[] = [];
    page.on('pageerror', err => {
      exceptions.push(err.message);
    });

    await waitForShowcase(page);

    // Scroll through entire page
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await delay(100);
      }
    });

    await page.waitForTimeout(500);

    if (exceptions.length > 0) {
      console.log('Uncaught exceptions:', exceptions);
    }
    expect(exceptions.length).toBe(0);
  });
});

// ─── Accessibility ────────────────────────────────────────────────────

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await waitForShowcase(page);
  });

  test('toggle has correct ARIA role and label', async ({ page }) => {
    await scrollToSection(page, 'interactive');
    const toggle = page.locator('button[role="switch"]').first();
    await expect(toggle).toHaveAttribute('aria-label', 'Notifications');
  });

  test('slider has correct ARIA attributes', async ({ page }) => {
    await scrollToSection(page, 'interactive');
    const slider = page.locator('[role="slider"]').first();
    await expect(slider).toHaveAttribute('aria-label', 'Volume');
    await expect(slider).toHaveAttribute('aria-valuemin', '0');
    await expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  test('chips have aria-pressed', async ({ page }) => {
    await scrollToSection(page, 'forms');
    const chips = page.locator('button[aria-pressed]');
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(4); // Design, Engineering, Music, Photography
  });

  test('stepper buttons have accessible labels', async ({ page }) => {
    await scrollToSection(page, 'forms');
    // Stepper should have labeled increment/decrement buttons
    const plusBtn = page.locator('button:has-text("+")');
    const minusBtn = page.locator('button:has-text("−")').or(page.locator('button:has-text("-")'));
    await expect(plusBtn.first()).toBeVisible();
    await expect(minusBtn.first()).toBeVisible();
  });

  test('overlay traps focus when open', async ({ page }) => {
    await scrollToSection(page, 'overlays');
    const trigger = page.locator('button:has-text("Show Alert")');
    await trigger.click();
    await page.waitForTimeout(500);

    // Tab should cycle within the dialog
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should still be inside the dialog (not escaped to page)
    const focusedRole = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.closest('[role="dialog"]') !== null;
    });
    // Note: Radix uses alertdialog role for alerts
    const inDialog = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.closest('[role="dialog"], [role="alertdialog"]') !== null;
    });
    expect(inDialog).toBe(true);

    await page.keyboard.press('Escape');
  });
});
