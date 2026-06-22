// /paul — Ultramarine gate. CSP-safe (external module, no inline handlers).
// Progressive enhancement: without JS the gate stays closed; content is in the DOM either way.
const body = document.body;
body.classList.add('js');

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
      // move focus into the page for keyboard + screen-reader users
      const page = document.getElementById('page');
      if (page) {
        page.setAttribute('tabindex', '-1');
        page.focus({ preventScroll: true });
      }
    } else {
      gate.classList.remove('shake');
      // reflow so the animation can replay on repeated wrong guesses
      void gate.offsetWidth;
      gate.classList.add('shake');
      input.select();
    }
  });
}
