import { Skill, SkillResult } from '../types'
import { chromium, Browser, Page, BrowserContext } from 'playwright'

class BrowserController {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null

  async launch(headless: boolean = false): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless })
      this.context = await this.browser.newContext()
      this.page = await this.context.newPage()
    }
  }

  async navigate(url: string): Promise<string> {
    await this.launch()
    await this.page!.goto(url, { waitUntil: 'domcontentloaded' })
    return this.page!.url()
  }

  async screenshot(path?: string): Promise<string> {
    await this.launch()
    const screenshot = await this.page!.screenshot({ fullPage: true })
    return screenshot.toString('base64')
  }

  async getContent(): Promise<string> {
    await this.launch()
    return await this.page!.evaluate('document.body.innerText') as string
  }

  async click(selector: string): Promise<void> {
    await this.launch()
    await this.page!.click(selector)
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.launch()
    await this.page!.fill(selector, value)
  }

  async press(key: string): Promise<void> {
    await this.launch()
    await this.page!.keyboard.press(key)
  }

  async evaluate(script: string): Promise<any> {
    await this.launch()
    return await this.page!.evaluate(script)
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.context = null
      this.page = null
    }
  }

  getPage(): Page | null {
    return this.page
  }
}

export const browserController = new BrowserController()

export const browserSkills: Skill[] = [
  {
    id: 'browser-navigate',
    name: 'Navigate URL',
    description: 'Open a webpage in the controlled browser',
    icon: 'Globe',
    category: 'browser',
    params: [{ name: 'url', type: 'string', description: 'URL to navigate to', required: true }],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        const url = await browserController.navigate(params.url)
        return { success: true, output: `Navigated to ${url}` }
      } catch (error) {
        return { success: false, output: '', error: `Navigation failed: ${error}` }
      }
    },
  },
  {
    id: 'browser-screenshot',
    name: 'Browser Screenshot',
    description: 'Take screenshot of current browser page',
    icon: 'Camera',
    category: 'browser',
    execute: async (): Promise<SkillResult> => {
      try {
        const screenshot = await browserController.screenshot()
        return { success: true, output: 'Screenshot captured', data: { image: screenshot.slice(0, 100) + '...' } }
      } catch (error) {
        return { success: false, output: '', error: `Screenshot failed: ${error}` }
      }
    },
  },
  {
    id: 'browser-content',
    name: 'Extract Page Content',
    description: 'Extract text content from current page',
    icon: 'FileText',
    category: 'browser',
    execute: async (): Promise<SkillResult> => {
      try {
        const content = await browserController.getContent()
        return { success: true, output: content.slice(0, 3000) }
      } catch (error) {
        return { success: false, output: '', error: `Content extraction failed: ${error}` }
      }
    },
  },
  {
    id: 'browser-click',
    name: 'Click Element',
    description: 'Click an element on the page',
    icon: 'MousePointerClick',
    category: 'browser',
    params: [{ name: 'selector', type: 'string', description: 'CSS selector', required: true }],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        await browserController.click(params.selector)
        return { success: true, output: `Clicked: ${params.selector}` }
      } catch (error) {
        return { success: false, output: '', error: `Click failed: ${error}` }
      }
    },
  },
  {
    id: 'browser-fill',
    name: 'Fill Form Field',
    description: 'Fill a form field',
    icon: 'Type',
    category: 'browser',
    params: [
      { name: 'selector', type: 'string', description: 'CSS selector', required: true },
      { name: 'value', type: 'string', description: 'Value to fill', required: true },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        await browserController.fill(params.selector, params.value)
        return { success: true, output: `Filled ${params.selector} with "${params.value}"` }
      } catch (error) {
        return { success: false, output: '', error: `Fill failed: ${error}` }
      }
    },
  },
  {
    id: 'browser-evaluate',
    name: 'Execute JavaScript',
    description: 'Run JavaScript in the browser context',
    icon: 'Code',
    category: 'browser',
    params: [{ name: 'script', type: 'string', description: 'JavaScript code', required: true }],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        const result = await browserController.evaluate(params.script)
        return { success: true, output: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }
      } catch (error) {
        return { success: false, output: '', error: `Evaluate failed: ${error}` }
      }
    },
  },
  {
    id: 'browser-close',
    name: 'Close Browser',
    description: 'Close the controlled browser',
    icon: 'X',
    category: 'browser',
    execute: async (): Promise<SkillResult> => {
      try {
        await browserController.close()
        return { success: true, output: 'Browser closed' }
      } catch (error) {
        return { success: false, output: '', error: `Close failed: ${error}` }
      }
    },
  },
]
