import type { Page } from 'playwright';

/**
 * Self-healing selector engine.
 * When a primary selector fails, tries alternate strategies:
 *   1. Label-based (aria-label, associated label)
 *   2. Placeholder-based
 *   3. Role-based
 *   4. Text similarity
 * Retries once after healing attempt.
 */

export interface HealingResult {
  element: ReturnType<Page['locator']>;
  healed: boolean;
  strategy: string;
}

interface SelectorContext {
  label?: string;
  placeholder?: string;
  text?: string;
  selector?: string;
  role?: string;
}

export async function resolveSelector(
  page: Page,
  ctx: SelectorContext,
  timeoutMs = 10000
): Promise<HealingResult> {
  const strategies = buildStrategies(ctx);

  for (const strategy of strategies) {
    try {
      const locator = strategy.locate(page);
      await locator.first().waitFor({ state: 'visible', timeout: timeoutMs });
      return {
        element: locator.first(),
        healed: strategy.name !== strategies[0].name,
        strategy: strategy.name,
      };
    } catch {
      // try next strategy
    }
  }

  throw new Error(
    `Could not locate element with context: ${JSON.stringify(ctx)}. ` +
    `Tried strategies: ${strategies.map((s) => s.name).join(', ')}`
  );
}

interface Strategy {
  name: string;
  locate: (page: Page) => ReturnType<Page['locator']>;
}

function buildStrategies(ctx: SelectorContext): Strategy[] {
  const strategies: Strategy[] = [];

  // Primary: explicit selector
  if (ctx.selector) {
    strategies.push({
      name: 'selector',
      locate: (page) => page.locator(ctx.selector!),
    });
  }

  // Label-based
  if (ctx.label) {
    strategies.push({
      name: 'label',
      locate: (page) => page.getByLabel(ctx.label!, { exact: false }),
    });
    // Also try aria-label attribute
    strategies.push({
      name: 'aria-label',
      locate: (page) => page.locator(`[aria-label*="${escapeCss(ctx.label!)}"]`),
    });
  }

  // Placeholder-based
  if (ctx.placeholder) {
    strategies.push({
      name: 'placeholder',
      locate: (page) => page.getByPlaceholder(ctx.placeholder!, { exact: false }),
    });
  }

  // Role-based
  if (ctx.role) {
    strategies.push({
      name: 'role',
      locate: (page) => page.getByRole(ctx.role as any, { name: ctx.label || ctx.text }),
    });
  }

  // Text-based
  if (ctx.text) {
    strategies.push({
      name: 'text',
      locate: (page) => page.getByText(ctx.text!, { exact: false }),
    });
    strategies.push({
      name: 'text-role-button',
      locate: (page) => page.getByRole('button', { name: ctx.text }),
    });
    strategies.push({
      name: 'text-role-link',
      locate: (page) => page.getByRole('link', { name: ctx.text }),
    });
  }

  // Fallback: if we have a label, try it as placeholder too
  if (ctx.label && !ctx.placeholder) {
    strategies.push({
      name: 'label-as-placeholder',
      locate: (page) => page.getByPlaceholder(ctx.label!, { exact: false }),
    });
  }

  return strategies;
}

function escapeCss(str: string): string {
  return str.replace(/["\\]/g, '\\$&');
}
