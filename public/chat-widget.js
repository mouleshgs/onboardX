// chat-widget.js — vanilla JS floating chat widget
(function () {
  const API = '/api/chat'; // backend endpoint

  // Create elements
  const fab = document.createElement('button');
  fab.className = 'rag-chat-fab';
  fab.setAttribute('aria-label', 'Open chat');
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const panel = document.createElement('div');
  panel.className = 'rag-chat-panel';

  panel.innerHTML = `
    <div class="rag-chat-header">
      <div class="rag-chat-title">Onboarding Assistant</div>
      <button class="rag-chat-close" aria-label="Close">✕</button>
    </div>
    <div class="rag-chat-body">
      <div class="rag-chat-messages" role="log" aria-live="polite"></div>
      <div class="rag-chat-footer">
        <div class="rag-chat-input"><textarea placeholder="Ask a question..." aria-label="Message"></textarea></div>
        <button class="rag-send-btn">Send</button>
      </div>
    </div>
  `;

  // Attach to document
  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(fab);
    // load css if not loaded
    if (!document.querySelector('link[data-rag-chat-css]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/chat-widget.css'; l.setAttribute('data-rag-chat-css', '1'); document.head.appendChild(l);
    }
    // fetch and show server-provided welcome message (non-blocking)
    (async function loadWelcome(){
      try {
        const resp = await fetch('/api/chat/welcome');
        if (!resp.ok) return;
        const j = await resp.json();
        if (j && j.welcome) appendMessage(j.welcome, 'bot');
      } catch (e) { /* ignore */ }
    })();
  }

  function qs(selector, root=document) { return root.querySelector(selector); }
  mount();

  const closeBtn = qs('.rag-chat-close', panel);
  const messagesEl = qs('.rag-chat-messages', panel);
  const textarea = qs('textarea', panel);
  const sendBtn = qs('.rag-send-btn', panel);

  let open = false;
  function setOpen(to) {
    open = !!to;
    if (open) {
      panel.classList.add('rag-open');
      fab.style.transform = 'scale(.92)';
      setTimeout(()=> fab.style.transform = '' , 180);
      textarea.focus();
    } else {
      panel.classList.remove('rag-open');
    }
  }

  fab.addEventListener('click', () => setOpen(!open));
  closeBtn.addEventListener('click', () => setOpen(false));

  function appendMessage(text, who='bot') {
    const row = document.createElement('div'); row.className = 'rag-msg-row ' + (who === 'user' ? 'user' : 'bot');
    const bubble = document.createElement('div'); bubble.className = 'rag-msg ' + (who === 'user' ? 'user' : 'bot');
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    autoScroll();
  }

  function autoScroll() {
    // scroll to bottom smoothly
    try {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
    } catch (e) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    appendMessage(text, 'user');
    textarea.value = '';
    sendBtn.disabled = true;
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ message: text }) });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      const reply = data && data.reply ? data.reply : 'Sorry, no reply.';
      appendMessage(reply, 'bot');
    } catch (e) {
      appendMessage('Error: ' + (e.message || e), 'bot');
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', () => sendMessage(textarea.value));
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      sendBtn.click();
    }
  });

  // expose helper for programmatic messages
  window.RagChat = { openPanel: ()=> setOpen(true), appendMessage };

})();
