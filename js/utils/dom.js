/**
 * DOM helper utilities
 */

/**
 * Shorthand querySelector
 */
export function qs(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Shorthand querySelectorAll as array
 */
export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Create element with optional attrs, classes, and children
 * @param {string} tag
 * @param {object} [attrs]
 * @param {string|Node|Array} [children]
 */
export function el(tag, attrs = {}, children = null) {
  const elem = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class' || key === 'className') {
      elem.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(elem.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      elem.addEventListener(event, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(elem.dataset, value);
    } else if (key === 'html') {
      elem.innerHTML = value;
    } else {
      elem.setAttribute(key, value);
    }
  }

  if (children !== null) {
    if (Array.isArray(children)) {
      children.forEach(child => {
        if (child == null) return;
        elem.append(typeof child === 'string' ? child : child);
      });
    } else {
      elem.append(typeof children === 'string' ? children : children);
    }
  }

  return elem;
}

/**
 * Set innerHTML of a container safely (clears first)
 */
export function setHTML(container, html) {
  container.innerHTML = html;
}

/**
 * Escape HTML to prevent XSS when inserting user data into innerHTML
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Delegate event listener (handles dynamically added children)
 */
export function delegate(root, selector, event, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) {
      handler(e, target);
    }
  });
}

/**
 * Show/hide element by toggling display
 */
export function show(elem) { if (elem) elem.style.display = ''; }
export function hide(elem) { if (elem) elem.style.display = 'none'; }

/**
 * Append class if not present, remove if present
 */
export function toggleClass(elem, cls, force) {
  if (elem) elem.classList.toggle(cls, force);
}

/**
 * Removes all children from an element
 */
export function clearChildren(elem) {
  while (elem.firstChild) elem.removeChild(elem.firstChild);
}

/**
 * Smooth scroll to element
 */
export function scrollTo(elem) {
  if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Focus first focusable element in container
 */
export function focusFirst(container) {
  const focusable = container.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable) focusable.focus();
}

/**
 * Creates a document fragment from an HTML string
 */
export function htmlToFragment(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content;
}
