const form = document.querySelector('#interest-form');
const button = form.querySelector('button');
const message = document.querySelector('#form-message');

async function refreshCount() {
  try {
    const response = await fetch('/api/waitlist', { cache: 'no-store' });
    if (!response.ok) return;
    const { count } = await response.json();
    if (!Number.isSafeInteger(count) || count < 0) return;
    document.querySelector('#count').textContent = count.toLocaleString('en-IN');
    document.querySelector('#count-label').textContent = count === 1 ? 'person has joined the waitlist' : 'people have joined the waitlist';
    document.querySelector('#tally').hidden = false;
  } catch {
    // The signup stays usable if the count is temporarily unavailable.
  }
}

function showMessage(text, state) {
  message.textContent = text;
  message.dataset.state = state;
  message.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  button.disabled = true;
  button.firstChild.textContent = 'Joining… ';
  message.hidden = true;
  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fields.get('email'),
        interest: fields.get('interest'),
        consent: fields.get('consent') === 'on',
        website: fields.get('website'),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      showMessage(result.error || 'We couldn’t save your signup. Please try again.', 'error');
    } else {
      showMessage('Thanks! This email is on the PLAN-IT waitlist.', 'success');
      form.reset();
      void refreshCount();
    }
  } catch {
    showMessage('We couldn’t save your signup. Check your connection and try again.', 'error');
  } finally {
    button.disabled = false;
    button.firstChild.textContent = 'Join the waitlist ';
    message.focus({ preventScroll: true });
  }
});

document.querySelectorAll('[data-interest]').forEach((link) => {
  link.addEventListener('click', () => {
    form.elements.interest.value = link.dataset.interest;
  });
});

document.querySelectorAll('a[href="#privacy"]').forEach((link) => {
  link.addEventListener('click', () => { document.querySelector('#privacy').open = true; });
});

void refreshCount();
