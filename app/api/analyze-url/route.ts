import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { callGeminiFlashWithImage, callGeminiJson } from '@/lib/ai/geminiClient';

/**
 * POST /api/analyze-url — Takes a URL, opens it in headless Playwright,
 * captures a screenshot, and sends the screenshot image to Gemini Flash
 * (multimodal) for a rich visual analysis of what can be tested.
 */

interface AnalysisResult {
  description: string;
  suggestedFlows: string[];
  pageTitle: string;
  elements: string[];
}

const ANALYSIS_SYSTEM_INSTRUCTION = `You are a QA analyst reviewing a website screenshot. Based ONLY on what you can see in the screenshot, provide:
1. A brief 1-2 sentence description of what this website/app is 
2. A focused list of 3-6 testable user flows visible in this screenshot (e.g. "Login flow", "Search flow", "Password reset")
3. Key interactive elements you can see (buttons, forms, inputs)

Be specific to what is VISIBLE in the screenshot, not generic.

RESPONSE FORMAT (JSON only):
{
  "description": "Brief 1-2 sentence description of the website",
  "suggestedFlows": ["flow1", "flow2", ...],
  "pageTitle": "Page title",
  "elements": ["element1", "element2", ...]
}`;

export async function POST(req: NextRequest) {
  let browser = null;
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('[AnalyzeURL] Analyzing:', url);

    // Launch headless browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    // Navigate and wait for rendering
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500); // Let JS render

    // Get page title for context
    const title = await page.title();

    // Take a full-quality viewport screenshot
    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    await browser.close();
    browser = null;

    // Send screenshot IMAGE to Gemini Flash (multimodal) for visual analysis
    let analysis: AnalysisResult;
    try {
      const prompt = `Analyse this screenshot of "${title}" at ${url}. Identify the key UI elements and testable flows.`;
      const response = await callGeminiFlashWithImage(
        prompt,
        screenshotBase64,
        'image/png',
        ANALYSIS_SYSTEM_INSTRUCTION
      );

      let cleaned = response.text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      analysis = JSON.parse(cleaned);
    } catch (err) {
      console.warn('[AnalyzeURL] Multimodal analysis failed, falling back to text-based:', err);
      // Fallback: DOM-based analysis
      const bodyText = await page.evaluate?.(() => document.body?.innerText?.substring(0, 1500) || '').catch(() => '');
      analysis = await callGeminiJson<AnalysisResult>(
        `Page title: ${title}\nURL: ${url}\nPage text: ${bodyText}\nSuggest testable flows.`,
        ANALYSIS_SYSTEM_INSTRUCTION,
        'flash'
      ).catch(() => ({
        description: `Website at ${url} (${title})`,
        suggestedFlows: ['Page load and navigation', 'Form interactions', 'Link verification'],
        pageTitle: title,
        elements: [],
      }));
    }

    console.log('[AnalyzeURL] Analysis complete:', analysis.description);

    return NextResponse.json({
      url,
      screenshot: `data:image/png;base64,${screenshotBase64}`,
      analysis,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    console.error('[AnalyzeURL] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
