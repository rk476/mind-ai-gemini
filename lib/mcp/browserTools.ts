import type { Page, BrowserContext, CDPSession } from 'playwright';
import { resolveSelector, type HealingResult } from './selectorEngine';
import type { StepResult } from '@/lib/config';
import { uploadScreenshot } from '@/lib/storage/screenshot';

const STEP_TIMEOUT = 60000;

export interface ConsoleLogs {
  errors: string[];
  warnings: string[];
  info: string[];
}

export interface NetworkLog {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: number;
}

/**
 * MCP Browser Tools — structured abstraction over Playwright.
 * Each tool validates inputs, has a 60s timeout, auto-captures screenshots,
 * and returns a structured StepResult.
 */
export class BrowserTools {
  private consoleLogs: ConsoleLogs = { errors: [], warnings: [], info: [] };
  private networkLogs: NetworkLog[] = [];
  private runId: string;

  constructor(
    private page: Page,
    private context: BrowserContext,
    runId: string
  ) {
    this.runId = runId;
    this.setupConsoleCapture();
    this.setupNetworkCapture();
  }

  private setupConsoleCapture(): void {
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') this.consoleLogs.errors.push(text);
      else if (type === 'warning') this.consoleLogs.warnings.push(text);
      else this.consoleLogs.info.push(text);
    });

    this.page.on('pageerror', (err) => {
      this.consoleLogs.errors.push(`JS Exception: ${err.message}`);
    });
  }

  private setupNetworkCapture(): void {
    this.page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        this.networkLogs.push({
          url: response.url(),
          method: response.request().method(),
          status,
          statusText: response.statusText(),
          timestamp: Date.now(),
        });
      }
    });

    this.page.on('requestfailed', (request) => {
      this.networkLogs.push({
        url: request.url(),
        method: request.method(),
        status: 0,
        statusText: request.failure()?.errorText ?? 'Request failed',
        timestamp: Date.now(),
      });
    });
  }

  // ─── Core Tools ────────────────────────────────────────────────────

  async navigate(url: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      await this.page.goto(url, { timeout: STEP_TIMEOUT, waitUntil: 'domcontentloaded' });
    });
  }

  async fillByLabel(label: string, value: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      const { element, healed } = await resolveSelector(this.page, { label });
      await element.fill(value, { timeout: STEP_TIMEOUT });
      return healed;
    });
  }

  async fillByPlaceholder(placeholder: string, value: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      const { element, healed } = await resolveSelector(this.page, { placeholder });
      await element.fill(value, { timeout: STEP_TIMEOUT });
      return healed;
    });
  }

  async clickByText(text: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      const { element, healed } = await resolveSelector(this.page, { text });
      await element.click({ timeout: STEP_TIMEOUT });
      return healed;
    });
  }

  async waitForSelector(selector: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      await this.page.waitForSelector(selector, { timeout: STEP_TIMEOUT, state: 'visible' });
    });
  }

  async assertVisible(text: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      const locator = this.page.getByText(text, { exact: false });
      await locator.first().waitFor({ state: 'visible', timeout: STEP_TIMEOUT });
    });
  }

  async assertNotVisible(text: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      const locator = this.page.getByText(text, { exact: false });
      await locator.first().waitFor({ state: 'hidden', timeout: STEP_TIMEOUT });
    });
  }

  async assertTextPresent(text: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      const content = await this.page.textContent('body', { timeout: STEP_TIMEOUT });
      if (!content || !content.toLowerCase().includes(text.toLowerCase())) {
        throw new Error(`Text "${text}" not found on page`);
      }
    });
  }

  async assertUrlChange(expectedUrl: string, stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      // Wait a bit for navigation to settle
      await this.page.waitForTimeout(2000);
      const currentUrl = this.page.url();
      if (!currentUrl.includes(expectedUrl)) {
        throw new Error(`URL mismatch: expected "${expectedUrl}" in "${currentUrl}"`);
      }
    });
  }

  async extractText(selector: string, stepId: string): Promise<StepResult & { healed: boolean; text?: string }> {
    let extractedText: string | null = null;
    const result = await this.wrapAction(stepId, async () => {
      extractedText = await this.page.textContent(selector, { timeout: STEP_TIMEOUT });
    });
    return { ...result, text: extractedText ?? undefined };
  }

  async screenshot(stepId: string): Promise<StepResult & { healed: boolean }> {
    return this.wrapAction(stepId, async () => {
      // screenshot is already captured in wrapAction
    });
  }

  // ─── Log Access ────────────────────────────────────────────────────

  getConsoleLogs(): ConsoleLogs {
    return { ...this.consoleLogs };
  }

  getNetworkLogs(): NetworkLog[] {
    return [...this.networkLogs];
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private async wrapAction(
    stepId: string,
    fn: () => Promise<boolean | void>
  ): Promise<StepResult & { healed: boolean }> {
    const start = Date.now();
    let healed = false;
    try {
      const result = await fn();
      if (result === true) healed = true;
      const screenshotUrl = await this.captureScreenshot(stepId);
      return {
        status: 'passed',
        screenshotUrl,
        durationMs: Date.now() - start,
        healed,
      };
    } catch (err) {
      const screenshotUrl = await this.captureScreenshot(stepId);
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        screenshotUrl,
        durationMs: Date.now() - start,
        healed,
      };
    }
  }

  private async captureScreenshot(stepId: string): Promise<string> {
    try {
      await this.page.waitForTimeout(500);
      const buffer = await this.page.screenshot({ fullPage: false });
      return await uploadScreenshot(this.runId, stepId, buffer);
    } catch {
      return '';
    }
  }
}
