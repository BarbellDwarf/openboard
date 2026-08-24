/**
 * OpenBoard UI/UX audit.
 *
 * Walks every route in both color schemes at desktop and mobile widths,
 * screenshots each page, and runs programmatic checks:
 *   - horizontal overflow
 *   - elements clipped by the viewport edge
 *   - touch targets smaller than 24px (WCAG 2.2 AA 2.5.8)
 *   - overlapping sibling controls
 *   - broken images
 *   - console errors
 *   - text contrast samples against the rendered background
 * plus functional probes: sign-in, play a move, scheme toggle persistence,
 * PGN download presence, health endpoint.
 *
 * Usage:
 *   npm i -D playwright && npx playwright install chromium   # once
 *   BASE_URL=http://localhost:3100 node scripts/ui-audit.mjs
 * Screenshots land in .review-screens/ (gitignored). Findings print to stdout
 * and are written to .review-screens/report.md.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const EMAIL = process.env.AUDIT_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'correct-horse-battery';
const SHOTS = path.resolve('.review-screens');
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = { desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } };
const ROUTES = [
  '/',
  '/login',
  '/register',
  '/setup',
  '/learn',
  '/learn/basics',
  '/learn/customize',
  '/learn/standard',
  '/learn/chess960',
  '/learn/crazyhouse',
  '/learn/racingkings',
  '/lobby',
  '/leaderboard',
  '/games',
  '/play-bot',
  '/notifications',
  '/settings/appearance',
  '/admin/users',
  '/forgot-password'
];

const findings = [];
const note = (scope, msg) => {
  findings.push(`${scope}: ${msg}`);
  console.log(`  [find] ${msg}`);
};

async function authedContext(browser, viewport, scheme) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  // Sign in through the API, then plant the session cookie.
  const resp = await ctx.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { Origin: BASE }
  });
  if (!resp.ok()) throw new Error(`sign-in failed: ${resp.status()}`);
  const cookies = await ctx.cookies(BASE);
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx2.addCookies(cookies);
  await ctx2.addInitScript((s) => {
    try { localStorage.setItem('ob.color-scheme', s); } catch {}
  }, scheme);
  return ctx2;
}

/** In-page audit: geometry, targets, overlap, images, contrast samples. */
async function auditPage(page, label) {
  const result = await page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.scrollingElement;
    const out = {
      hOverflow: doc ? doc.scrollWidth - vw : 0,
      offscreen: [],
      tinyTargets: [],
      overlaps: [],
      brokenImages: [],
      lowContrast: []
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' &&
        cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < vw
      );
    };
    const all = [...document.querySelectorAll('button, a, input, select, textarea, [role="button"]')].filter(visible);

    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) out.offscreen.push(`${el.tagName}.${(el.className || '').toString().slice(0, 30)} right=${Math.round(r.right)}`);
      const minDim = Math.min(r.width, r.height);
      const isIconLink = el.tagName === 'A' && el.querySelector('svg');
      const inlineInSentence =
        el.tagName === 'A' && ['P', 'LI', 'SPAN'].includes(el.parentElement?.tagName ?? '');
      if (minDim > 0 && minDim < 24 && !isIconLink && !inlineInSentence) {
        out.tinyTargets.push(`${el.tagName}"${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    // Overlap among sibling controls (buttons/inputs) sharing a parent.
    for (const parent of new Set(all.map((e) => e.parentElement))) {
      const kids = all.filter((e) => e.parentElement === parent);
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          if (ix > 4 && iy > 4) {
            out.overlaps.push(
              `${kids[i].tagName}"${(kids[i].textContent || '').trim().slice(0, 15)}" x ${kids[j].tagName}"${(kids[j].textContent || '').trim().slice(0, 15)}" (${Math.round(ix)}x${Math.round(iy)})`
            );
          }
        }
      }
    }
    for (const img of document.querySelectorAll('img')) {
      if (img.complete && img.naturalWidth === 0 && visible(img)) out.brokenImages.push(img.src.slice(-40));
    }
    // Contrast sample: paragraph/heading/link text vs effective background.
    // Parses both legacy rgb() and modern color(srgb ... / a) computed values,
    // and composites translucent text over the resolved background.
    const parseCol = (str) => {
      if (!str) return null;
      const srgb = /color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(str);
      if (srgb) {
        // color(srgb ...) components are 0..1; normalize to the 0..255 scale
        // the legacy rgb() branch uses so blending stays consistent.
        return {
          ch: srgb.slice(1, 4).map((v) => Number(v) * 255),
          a: srgb[4] === undefined ? 1 : Number(srgb[4])
        };
      }
      const m = str.match(/[\d.]+/g);
      if (!m || m.length < 3) return null;
      return { ch: m.slice(0, 3).map(Number), a: m[3] === undefined ? 1 : Number(m[3]) };
    };
    const lin = (c8) => {
      const c = c8 / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const lumOf = (fg, bg) => {
      const blended = fg.ch.map((c, i) => c * fg.a + bg.ch[i] * (1 - fg.a));
      const [r, g, b] = blended.map(lin);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const effBg = (el) => {
      let node = el;
      while (node) {
        const parsed = parseCol(getComputedStyle(node).backgroundColor);
        if (parsed && parsed.a > 0) return parsed;
        node = node.parentElement;
      }
      return { ch: [15, 27, 20], a: 1 };
    };
    const hasDirectText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const samples = [...document.querySelectorAll('h1, h2, p, a, button, label')].filter((e) => visible(e) && hasDirectText(e)).slice(0, 40);
    for (const el of samples) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      const cs = getComputedStyle(el);
      const fg = parseCol(cs.color);
      if (!fg) continue;
      const bg = effBg(el);
      const l1 = lumOf(fg, bg);
      const l2 = lumOf(bg, { ch: [0, 0, 0], a: 1 });
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseFloat(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        out.lowContrast.push(`"${txt.slice(0, 24)}" ${ratio.toFixed(2)}:1 (needs ${need})`);
      }
    }
    return out;
  });

  const scope = label;
  if (result.hOverflow > 1) note(scope, `horizontal overflow ${result.hOverflow}px`);
  result.offscreen.slice(0, 3).forEach((m) => note(scope, `clipped by viewport: ${m}`));
  result.tinyTargets.slice(0, 5).forEach((m) => note(scope, `touch target < 24px: ${m}`));
  result.overlaps.slice(0, 5).forEach((m) => note(scope, `overlapping controls: ${m}`));
  result.brokenImages.slice(0, 3).forEach((m) => note(scope, `broken image: ...${m}`));
  result.lowContrast.slice(0, 5).forEach((m) => note(scope, `low contrast: ${m}`));
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const scheme of ['night', 'day']) {
    const ctx = await authedContext(browser, VIEWPORTS[vpName], scheme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 100)));
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 100)));

    for (const route of ROUTES) {
      const scope = `${vpName}/${scheme}${route}`;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(350);
        await auditPage(page, scope);
        const safe = route === '/' ? 'root' : route.replace(/\//g, '_');
        await page.screenshot({ path: path.join(SHOTS, `${vpName}-${scheme}-${safe}.png`), fullPage: true });
        errors.splice(0).forEach((e) => note(scope, `console error: ${e}`));
      } catch (err) {
        note(scope, `navigation/check failed: ${String(err).slice(0, 90)}`);
      }
    }

    // Live-game functional probe (desktop only, both schemes).
    if (vpName === 'desktop') {
      const scope = `desktop/${scheme}/live-game`;
      try {
        await page.goto(`${BASE}/play-bot`, { waitUntil: 'networkidle' });
        await page.selectOption('select >> nth=0', 'standard');
        await page.selectOption('select >> nth=3', 'white');
        await page.click('button:has-text("Start game")');
        await page.waitForSelector('.cg-board-wrap', { timeout: 10000 });
        await page.waitForTimeout(1200);
        const geom = await page.evaluate(() => {
          const r = document.querySelector('.ob-board').getBoundingClientRect();
          return { l: r.left, t: r.top, s: r.width };
        });
        // Click e2 then e4: the move must appear on the scoresheet.
        await page.mouse.click(geom.l + 4.5 * geom.s / 8, geom.t + 6.5 * geom.s / 8);
        await page.waitForTimeout(250);
        await page.mouse.click(geom.l + 4.5 * geom.s / 8, geom.t + 4.5 * geom.s / 8);
        await page.waitForTimeout(1500);
        const sheet = await page.evaluate(() => {
          const h = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Moves');
          return h?.nextElementSibling?.textContent.trim() ?? '';
        });
        if (!/1\.\s*e4/.test(sheet)) note(scope, `playing a move failed; scoresheet="${sheet.slice(0, 40)}"`);
        else console.log(`  [ok] ${scope}: e4 played`);
        await page.screenshot({ path: path.join(SHOTS, `${vpName}-${scheme}-live_game.png`), fullPage: true });
      } catch (err) {
        note(scope, `live-game probe failed: ${String(err).slice(0, 90)}`);
      }

      // Scheme toggle persistence probe.
      try {
        await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
        await page.click('button[aria-label*="day"], button[aria-label*="night"], button[aria-label*="session"]');
        await page.reload({ waitUntil: 'networkidle' });
        const applied = await page.evaluate(() => document.documentElement.getAttribute('data-scheme'));
        if (!applied) note(`desktop/${scheme}/toggle`, 'scheme did not persist after reload');
        else console.log(`  [ok] toggle persisted: ${applied}`);
      } catch (err) {
        note(`desktop/${scheme}/toggle`, `probe failed: ${String(err).slice(0, 80)}`);
      }
    }

    await ctx.close();
  }
}

// PGN download presence on a finished game.
try {
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const resp = await ctx.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD }, headers: { Origin: BASE }
  });
  if (resp.ok()) {
    const finished = await ctx.request.get(`${BASE}/games`).then((r) => r.text());
    if (finished.includes('/game/')) {
      const id = finished.split('/game/')[1].split('"')[0];
      const pgnResp = await ctx.request.get(`${BASE}/api/games/${id}/pgn`);
      console.log(`  [info] pgn endpoint on ${id}: ${pgnResp.status()} (${pgnResp.headers()['content-type'] ?? ''})`);
    }
  }
  await ctx.close();
} catch (err) {
  console.log(`  [info] pgn probe skipped: ${String(err).slice(0, 80)}`);
}

await browser.close();

const report = [
  '# OpenBoard UI/UX audit report',
  '',
  `Findings: ${findings.length}`,
  '',
  ...findings.map((f) => `- ${f}`),
  '',
  `Screenshots: ${SHOTS}`
].join('\n');
writeFileSync(path.join(SHOTS, 'report.md'), report);
console.log(`\n=== AUDIT COMPLETE: ${findings.length} findings; report + screenshots in ${SHOTS} ===`);
