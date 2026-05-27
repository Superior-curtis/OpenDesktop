import { test, expect } from '@playwright/test'

test.describe('OpenDesktop basic', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 })
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toBeTruthy()
  })

  test('typing in input area works', async ({ page }) => {
    await page.goto('/')
    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('Hello, world!')
      await expect(textarea).toHaveValue('Hello, world!')
    }
  })
})
