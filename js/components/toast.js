/**
 * Toast notification component
 * Usage: Toast.show('저장되었습니다.', 'success')
 * Types: 'success' | 'error' | 'warning' | 'info' (default)
 */

const Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
    }
    return this._container;
  },

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration ms (default 3000)
   */
  show(message, type = 'info', duration = 3000) {
    const container = this._getContainer();
    if (!container) return;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${message}</span>`;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      // Fallback remove
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
    }, duration);
  },

  success(msg, duration) { this.show(msg, 'success', duration); },
  error(msg, duration)   { this.show(msg, 'error', duration); },
  warning(msg, duration) { this.show(msg, 'warning', duration); },
  info(msg, duration)    { this.show(msg, 'info', duration); },
};

export default Toast;
