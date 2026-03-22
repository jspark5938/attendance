/**
 * Global modal component
 *
 * Usage:
 *   Modal.open({ title, body (HTML string), onConfirm, confirmText, cancelText, danger })
 *   Modal.close()
 *   Modal.confirm({ title, message }) → Promise<boolean>
 */

import { focusFirst } from '../utils/dom.js';

const Modal = {
  _backdrop: null,
  _onConfirm: null,
  _previousFocus: null,
  _closeTimer: null,

  _getBackdrop() {
    if (!this._backdrop) {
      this._backdrop = document.getElementById('modal-backdrop');
    }
    return this._backdrop;
  },

  /**
   * Open the modal.
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} opts.body      — HTML string for modal body
   * @param {Function} [opts.onConfirm]
   * @param {string} [opts.confirmText] default '확인'
   * @param {string} [opts.cancelText]  default '취소'
   * @param {boolean} [opts.danger]     red confirm button
   * @param {boolean} [opts.hideCancel]
   * @param {boolean} [opts.hideConfirm]
   */
  open({ title, body, onConfirm, confirmText = '확인', cancelText = '취소', danger = false, hideCancel = false, hideConfirm = false }) {
    const backdrop = this._getBackdrop();
    if (!backdrop) return;

    // 이전 닫기 애니메이션 타이머가 남아있으면 취소
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }

    this._onConfirm = onConfirm;
    this._previousFocus = document.activeElement;

    backdrop.querySelector('.modal-title').textContent = title;
    backdrop.querySelector('.modal-body').innerHTML = body;

    const confirmBtn = backdrop.querySelector('.modal-confirm');
    const cancelBtn  = backdrop.querySelector('.modal-cancel');
    const footer     = backdrop.querySelector('.modal-footer');

    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn modal-confirm ${danger ? 'btn-danger' : 'btn-primary'}`;
    cancelBtn.textContent  = cancelText;

    if (hideCancel)  cancelBtn.style.display = 'none';
    else             cancelBtn.style.display = '';

    if (hideConfirm) confirmBtn.style.display = 'none';
    else             confirmBtn.style.display = '';

    footer.style.display = (hideCancel && hideConfirm) ? 'none' : '';

    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('visible'));

    // Focus management
    setTimeout(() => {
      const body = backdrop.querySelector('.modal-body');
      focusFirst(body) || confirmBtn.focus();
    }, 150);

    // Trap focus
    this._trapFocus(backdrop);
  },

  close() {
    const backdrop = this._getBackdrop();
    if (!backdrop) return;

    backdrop.classList.remove('visible');
    this._closeTimer = setTimeout(() => {
      this._closeTimer = null;
      backdrop.style.display = 'none';
      // Restore focus
      if (this._previousFocus?.focus) this._previousFocus.focus();
    }, 200);

    this._onConfirm = null;
  },

  _confirm() {
    if (this._onConfirm) this._onConfirm();
    this.close();
  },

  /**
   * Simple confirm dialog. Returns Promise<boolean>.
   */
  confirm({ title, message, danger = false, confirmText = '확인' }) {
    return new Promise((resolve) => {
      this.open({
        title,
        body: `<p style="color: var(--color-text-muted); font-size: var(--font-size-base); white-space: pre-line;">${message}</p>`,
        danger,
        confirmText,
        onConfirm: () => resolve(true),
      });

      // Override cancel to resolve false
      const backdrop = this._getBackdrop();
      const cancelBtn = backdrop?.querySelector('.modal-cancel');
      if (cancelBtn) {
        cancelBtn._resolveRef = () => { resolve(false); this.close(); };
      }
    });
  },

  /**
   * Bind modal buttons (call once in app.js after DOM ready)
   */
  init() {
    const backdrop = this._getBackdrop();
    if (!backdrop) return;

    backdrop.querySelector('.modal-close').addEventListener('click', () => this.close());
    backdrop.querySelector('.modal-cancel').addEventListener('click', () => {
      const cancelBtn = backdrop.querySelector('.modal-cancel');
      if (cancelBtn._resolveRef) {
        cancelBtn._resolveRef();
        cancelBtn._resolveRef = null;
      } else {
        this.close();
      }
    });
    backdrop.querySelector('.modal-confirm').addEventListener('click', () => this._confirm());

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        const cancelBtn = backdrop.querySelector('.modal-cancel');
        if (cancelBtn._resolveRef) {
          cancelBtn._resolveRef();
          cancelBtn._resolveRef = null;
        } else {
          this.close();
        }
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('visible')) {
        const cancelBtn = backdrop.querySelector('.modal-cancel');
        if (cancelBtn._resolveRef) {
          cancelBtn._resolveRef();
          cancelBtn._resolveRef = null;
        } else {
          this.close();
        }
      }
    });
  },

  _trapFocus(container) {
    const focusables = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    container.addEventListener('keydown', handler);
    // Cleanup when modal closes
    container.addEventListener('transitionend', () => {
      if (!container.classList.contains('visible')) {
        container.removeEventListener('keydown', handler);
      }
    }, { once: true });
  },
};

export default Modal;
