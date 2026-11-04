import { analyze } from './analyzer.cjs';
import { Lens } from './lens.js';
import { DEFAULTS, readSettings } from './settings.js';

if (!globalThis.__wordLensLoaded) {
  globalThis.__wordLensLoaded = true;
  start();
}

function start() {
  let settings = { ...DEFAULTS };
  let mouseSelection = null;
  const lens = new Lens({
    onClose: dismiss,
    onWaterChange: (value) => {
      settings.highlightWater = value;
      try { chrome.storage.local.set({ highlightWater: value }); } catch { /* Standalone demo. */ }
    },
  });
  function dismiss() {
    const focused = lens.shadow.activeElement;
    lens.hide();
    if (focused && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  let previousFocus = null;
  function ignored(target) {
    return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], script, style, noscript, word-lens-overlay'));
  }
  function selectedText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
    const node = selection.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (ignored(element)) return '';
    return selection.toString();
  }
  function hasSelection() {
    const selection = window.getSelection();
    return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
  }
  function show(text, mode) {
    if (!settings.enabled || !text.trim()) return;
    const result = analyze(text);
    if (!result.stats.words) { lens.hide(); return; }
    previousFocus = document.activeElement;
    lens.show(result, mode, settings.highlightWater);
  }
  function paragraphAt(target, x, y) {
    if (!(target instanceof Element) || ignored(target)) return null;
    const semantic = target.closest('p, li, blockquote, figcaption, dd, dt, td, th');
    if (semantic && !ignored(semantic)) return semantic;
    // Many sites use styled divs for paragraphs. Start at the actual text under
    // the pointer, so clicking an empty container never analyzes an entire page.
    const caret = document.caretRangeFromPoint?.(x, y);
    if (!caret || caret.startContainer.nodeType !== Node.TEXT_NODE || !caret.startContainer.textContent.trim()) return null;
    const textRange = document.createRange();
    textRange.selectNodeContents(caret.startContainer);
    if (!Array.from(textRange.getClientRects()).some((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)) return null;
    let element = caret.startContainer.parentElement;
    if (!element || ignored(element) || !target.contains(element)) return null;
    while (element && !['BODY', 'HTML', 'MAIN', 'ARTICLE', 'SECTION', 'NAV'].includes(element.tagName)) {
      const style = getComputedStyle(element);
      if (style.display !== 'inline' && style.display !== 'contents') return element;
      element = element.parentElement;
    }
    return null;
  }
  document.addEventListener('click', (event) => {
    if (!event.detail || event.button !== 0 || event.defaultPrevented || lens.contains(event) || hasSelection()) return;
    if (event.target instanceof Element && event.target.closest('a, button, label, summary, [role="button"], [role="link"]')) return;
    const paragraph = paragraphAt(event.target, event.clientX, event.clientY);
    if (paragraph) show(paragraph.innerText, 'paragraph');
  });
  document.addEventListener('pointerdown', (event) => {
    if (lens.contains(event)) {
      // Clicking a control should not clear the page selection. Text inside the
      // map remains selectable and copyable.
      if (event.composedPath().some((node) => node instanceof HTMLButtonElement) && event.button === 0) event.preventDefault();
      return;
    }
    if (event.pointerType === 'mouse' && event.button === 0) mouseSelection = selectedText();
    if (lens.visible) dismiss();
  }, true);
  document.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || mouseSelection === null) return;
    const before = mouseSelection;
    mouseSelection = null;
    if (lens.contains(event)) return;
    const text = selectedText();
    if (text !== before) show(text, 'selection');
  }, { passive: true });
  document.addEventListener('pointercancel', () => { mouseSelection = null; });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lens.visible) { dismiss(); return; }
    if (lens.visible && !lens.contains(event)) dismiss();
    if (lens.contains(event) && event.key === 'Tab') {
      const controls = Array.from(lens.shadow.querySelectorAll('button, [tabindex="0"]'));
      const first = controls[0], last = controls.at(-1), active = lens.shadow.activeElement;
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    }
  }, true);
  function viewportChanged() {
    if (lens.visible) lens.position();
  }
  window.addEventListener('resize', viewportChanged, { passive: true });
  document.addEventListener('scroll', viewportChanged, { passive: true, capture: true });
  window.visualViewport?.addEventListener('resize', viewportChanged, { passive: true });
  window.visualViewport?.addEventListener('scroll', viewportChanged, { passive: true });
  window.addEventListener('blur', () => { mouseSelection = null; });
  readSettings().then((value) => { settings = value; });
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const key of Object.keys(DEFAULTS)) if (changes[key]) settings[key] = changes[key].newValue ?? DEFAULTS[key];
      if (!settings.enabled) lens.hide();
      else if (lens.visible) { lens.highlightWater = settings.highlightWater; lens.render(); }
    });
  } catch { /* Standalone demo has no Chrome extension API. */ }
}
