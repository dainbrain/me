// /paul — boots the live gold particle field and runs the Ultramarine gate.
// CSP-safe (external module, no inline handlers). Progressive enhancement.
import { initBackground } from '/paul-gl.js';

const body = document.body;
body.classList.add('js');

const canvas = document.getElementById('gl');
if (canvas) { try { initBackground(canvas); } catch (err) { console.error(err); } }

// play the gate entrance after the hidden state has painted
requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('loaded')));

const gate = document.getElementById('gate');
const form = document.getElementById('gate-form');
const input = document.getElementById('gate-input');
const WORD = 'ultramarine';

if (input) input.focus();

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (input.value || '').trim().toLowerCase();
    if (value === WORD) {
      body.classList.add('open');
      window.scrollTo(0, 0);
      const page = document.getElementById('page');
      if (page) { page.setAttribute('tabindex', '-1'); page.focus({ preventScroll: true }); }
    } else {
      gate.classList.remove('shake');
      void gate.offsetWidth;
      gate.classList.add('shake');
      input.select();
    }
  });
}
