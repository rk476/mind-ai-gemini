import { BrowserTools } from './browserTools';

/**
 * MCP Server — registry of all available browser tools.
 * Provides a dispatch method to execute any tool by name with structured input/output.
 */

export interface ToolInput {
  action: string;
  label?: string;
  placeholder?: string;
  text?: string;
  selector?: string;
  value?: string;
  url?: string;
}

export async function executeTool(
  tools: BrowserTools,
  input: ToolInput,
  stepId: string
) {
  switch (input.action) {
    case 'navigate':
      if (!input.url) throw new Error('navigate requires url');
      return tools.navigate(input.url, stepId);

    case 'fillByLabel':
      if (!input.label || input.value === undefined) throw new Error('fillByLabel requires label and value');
      return tools.fillByLabel(input.label, input.value, stepId);

    case 'fillByPlaceholder':
      if (!input.text || input.value === undefined) throw new Error('fillByPlaceholder requires text (placeholder) and value');
      return tools.fillByPlaceholder(input.text, input.value, stepId);

    case 'clickByText':
      if (!input.text) throw new Error('clickByText requires text');
      return tools.clickByText(input.text, stepId);

    case 'waitForSelector':
      if (!input.selector) throw new Error('waitForSelector requires selector');
      return tools.waitForSelector(input.selector, stepId);

    case 'assertVisible':
      if (!input.text) throw new Error('assertVisible requires text');
      return tools.assertVisible(input.text, stepId);

    case 'assertNotVisible':
      if (!input.text) throw new Error('assertNotVisible requires text');
      return tools.assertNotVisible(input.text, stepId);

    case 'assertTextPresent':
      if (!input.text) throw new Error('assertTextPresent requires text');
      return tools.assertTextPresent(input.text, stepId);

    case 'assertUrlChange':
      if (!input.url) throw new Error('assertUrlChange requires url');
      return tools.assertUrlChange(input.url, stepId);

    case 'extractText':
      if (!input.selector) throw new Error('extractText requires selector');
      return tools.extractText(input.selector, stepId);

    case 'screenshot':
      return tools.screenshot(stepId);

    default:
      throw new Error(`Unknown action: ${input.action}`);
  }
}

/** List all available tool names */
export const AVAILABLE_TOOLS = [
  'navigate',
  'fillByLabel',
  'fillByPlaceholder',
  'clickByText',
  'waitForSelector',
  'assertVisible',
  'assertNotVisible',
  'assertTextPresent',
  'assertUrlChange',
  'extractText',
  'screenshot',
  'getConsoleLogs',
  'getNetworkLogs',
] as const;
