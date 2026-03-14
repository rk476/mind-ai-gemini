import type { Page } from 'playwright';

/**
 * DOM Analyzer — explores a page and extracts structured information
 * about forms, inputs, buttons, links, and their attributes.
 * This summary is fed to the AI test planner.
 */

export interface DomElement {
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  href?: string;
}

export interface DomSummary {
  url: string;
  title: string;
  forms: {
    id?: string;
    action?: string;
    method?: string;
    fields: DomElement[];
    buttons: DomElement[];
  }[];
  standaloneInputs: DomElement[];
  buttons: DomElement[];
  links: DomElement[];
  headings: { level: number; text: string }[];
}

export async function analyzeDom(page: Page): Promise<DomSummary> {
  // Use a string-based evaluate to avoid bundler issues with __name
  return page.evaluate(`(() => {
    const getText = (el) => {
      return (el.textContent ?? '').trim().slice(0, 200);
    };

    const getLabel = (el) => {
      const id = el.getAttribute('id');
      if (id) {
        const label = document.querySelector('label[for="' + id + '"]');
        if (label) return getText(label);
      }
      const parent = el.closest('label');
      if (parent) return getText(parent);
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      return undefined;
    };

    const elementInfo = (el) => {
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') ?? undefined,
        name: el.getAttribute('name') ?? undefined,
        id: el.getAttribute('id') ?? undefined,
        label: getLabel(el),
        placeholder: el.getAttribute('placeholder') ?? undefined,
        role: el.getAttribute('role') ?? undefined,
        text: getText(el) || undefined,
        ariaLabel: el.getAttribute('aria-label') ?? undefined,
        href: el.getAttribute('href') ?? undefined,
      };
    };

    const forms = Array.from(document.querySelectorAll('form')).map((form) => {
      const fields = Array.from(
        form.querySelectorAll('input, textarea, select')
      ).map(elementInfo);
      const buttons = Array.from(
        form.querySelectorAll('button, input[type="submit"], [role="button"]')
      ).map(elementInfo);
      return {
        id: form.getAttribute('id') ?? undefined,
        action: form.getAttribute('action') ?? undefined,
        method: form.getAttribute('method') ?? undefined,
        fields,
        buttons,
      };
    });

    const allFormInputs = new Set();
    document.querySelectorAll('form input, form textarea, form select').forEach((el) =>
      allFormInputs.add(el)
    );
    const standaloneInputs = Array.from(
      document.querySelectorAll('input, textarea, select')
    )
      .filter((el) => !allFormInputs.has(el))
      .map(elementInfo);

    const allFormButtons = new Set();
    document
      .querySelectorAll('form button, form input[type="submit"], form [role="button"]')
      .forEach((el) => allFormButtons.add(el));
    const buttons = Array.from(
      document.querySelectorAll('button, [role="button"]')
    )
      .filter((el) => !allFormButtons.has(el))
      .map(elementInfo);

    const links = Array.from(document.querySelectorAll('a[href]'))
      .slice(0, 30)
      .map(elementInfo);

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
      .slice(0, 20)
      .map((el) => ({
        level: parseInt(el.tagName[1], 10),
        text: getText(el),
      }));

    return {
      url: window.location.href,
      title: document.title,
      forms,
      standaloneInputs,
      buttons,
      links,
      headings,
    };
  })()`);
}
