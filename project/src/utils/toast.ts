// Lightweight DOM toast utility usable from React components
export type ToastType = 'info' | 'success' | 'error' | 'warn';

export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
  try {
    const id = '__onboardx_toast_container';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.style.position = 'fixed';
      container.style.right = '20px';
      container.style.top = '20px';
      container.style.zIndex = '999999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = '__onboardx_toast';
    el.textContent = message;
    el.style.maxWidth = '360px';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
    el.style.color = '#0f172a';
    el.style.fontSize = '14px';
    el.style.lineHeight = '1.2';
    el.style.opacity = '0';
    el.style.transition = 'opacity 180ms ease, transform 220ms ease';
    el.style.transform = 'translateY(-6px)';

    switch (type) {
      case 'success': el.style.background = '#dcfce7'; el.style.border = '1px solid #86efac'; break;
      case 'error': el.style.background = '#fee2e2'; el.style.border = '1px solid #fca5a5'; break;
      case 'warn': el.style.background = '#fff7ed'; el.style.border = '1px solid #fcd34d'; break;
      default: el.style.background = '#f3f4f6'; el.style.border = '1px solid #e6e9ef'; break;
    }

    container.appendChild(el);
    // force reflow then show
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetWidth;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';

    setTimeout(() => {
      try {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => { try { el.remove(); } catch (e) {} }, 250);
      } catch (e) {}
    }, duration);
  } catch (e) {
    // Fallback to alert only if toast creation fails
    try { alert(message); } catch (e) {}
  }
}

export default showToast;
