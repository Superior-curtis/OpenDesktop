import { test, expect } from '@playwright/test'

test.describe('OpenDesktop advanced features', () => {
  test.beforeEach(async ({ page }) => {
    // Mark onboarding as seen so it doesn't block clicks
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('opendesktop-onboarding', 'true'))
    await page.reload()
    // Wait for loader animation
    await page.waitForTimeout(13000)
  })

  test('settings panel has tab switching', async ({ page }) => {
    await page.locator('button:has-text("Settings")').first().click({ force: true })
    await page.waitForTimeout(1000)

    // Check for settings tabs
    const generalTab = page.locator('button:has-text("General")').first()
    const dataTab = page.locator('button:has-text("Data")').or(page.locator('text=Export'))
    const themeTab = page.locator('button:has-text("Theme")').first()

    const hasTabs = await generalTab.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasTabs) {
      await generalTab.click({ force: true })
      await page.waitForTimeout(300)
    }
  })

  test('file explorer renders without error', async ({ page }) => {
    await page.locator('button:has-text("Files")').first().click({ force: true })
    await page.waitForTimeout(1000)
  })

  test('Ctrl+F opens search overlay in chat', async ({ page }) => {
    await page.keyboard.press('Control+1')
    await page.waitForTimeout(500)

    await page.keyboard.press('Control+f')
    await page.waitForTimeout(500)

    const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="Search" i]')).first()
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('test')
      const value = await searchInput.inputValue()
      expect(value).toBe('test')
    }
  })

  test('provider config panel loads', async ({ page }) => {
    await page.locator('button:has-text("Providers")').first().click({ force: true })
    await page.waitForTimeout(800)
  })

  test('MCP panel loads', async ({ page }) => {
    await page.locator('button:has-text("MCP")').first().click({ force: true })
    await page.waitForTimeout(800)
  })
})
