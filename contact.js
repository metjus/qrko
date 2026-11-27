/*
  Kontaktný formulár.

  Správy spracúva odoslat.php priamo na hostingu qrko.net — žiadna
  externá služba. Server pošle jeden e-mail na info@qrko.net.
  Nastavenie príjemcu a odosielateľa je v odoslat.php.

  Ak by bol FORM_ENDPOINT prázdny, formulár nezostane nefunkčný — otvorí
  používateľovi jeho e-mailový program s predvyplnenou správou.
*/
var FORM_ENDPOINT = '/odoslat.php';
var FALLBACK_EMAIL = 'info@qrko.net';

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  // Texty hlásení (web je len po anglicky)
  var m = {
    name: 'Please enter your name.',
    emailEmpty: 'Please enter your email so we can reply.',
    emailBad: 'Please check the format of the email address.',
    msgEmpty: 'Please write your message.',
    msgShort: 'That message is very short — please tell us a bit more.',
    consent: 'We cannot reply without your consent to process the data.',
    check: 'Please check the highlighted fields.',
    sending: 'Sending your message…',
    sendingBtn: 'Sending…',
    sent: 'Thank you, your message has been sent. We will get back to you soon.',
    failed: 'The message could not be sent. Please try again, or email us directly at ',
    mailOpened: 'We opened your email app with the message ready. Just hit send.',
    subject: 'Message from qrko.net',
    fName: 'Name', fEmail: 'Email'
  };

  var nameEl = document.getElementById('cf-name');
  var emailEl = document.getElementById('cf-email');
  var msgEl = document.getElementById('cf-message');
  var consentEl = document.getElementById('cf-consent');
  var trapEl = document.getElementById('cf-website');
  var submitEl = document.getElementById('cf-submit');
  var statusEl = document.getElementById('cf-status');

  function showError(inputEl, errId, text) {
    var el = document.getElementById(errId);
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    inputEl.setAttribute('aria-invalid', 'true');
    inputEl.classList.add('has-error');
  }

  function clearError(inputEl, errId) {
    var el = document.getElementById(errId);
    if (el) { el.textContent = ''; el.hidden = true; }
    inputEl.removeAttribute('aria-invalid');
    inputEl.classList.remove('has-error');
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.hidden = !text;
    statusEl.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  if (consentEl) {
    consentEl.addEventListener('change', function () {
      var cErr = document.getElementById('err-consent');
      if (cErr) { cErr.textContent = ''; cErr.hidden = true; }
      consentEl.removeAttribute('aria-invalid');
    });
  }

  // Vyčistiť chybu hneď, ako používateľ začne opravovať
  [[nameEl, 'err-name'], [emailEl, 'err-email'], [msgEl, 'err-message']].forEach(function (pair) {
    pair[0].addEventListener('input', function () { clearError(pair[0], pair[1]); });
  });

  function validate() {
    var ok = true;
    if (!nameEl.value.trim()) {
      showError(nameEl, 'err-name', m.name); ok = false;
    }
    var email = emailEl.value.trim();
    if (!email) {
      showError(emailEl, 'err-email', m.emailEmpty); ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showError(emailEl, 'err-email', m.emailBad); ok = false;
    }
    if (!msgEl.value.trim()) {
      showError(msgEl, 'err-message', m.msgEmpty); ok = false;
    } else if (msgEl.value.trim().length < 10) {
      showError(msgEl, 'err-message', m.msgShort); ok = false;
    }
    if (consentEl && !consentEl.checked) {
      var cErr = document.getElementById('err-consent');
      if (cErr) { cErr.textContent = m.consent; cErr.hidden = false; }
      consentEl.setAttribute('aria-invalid', 'true');
      ok = false;
    }
    if (!ok) {
      var first = form.querySelector('.has-error') || (consentEl && consentEl.getAttribute('aria-invalid') ? consentEl : null);
      if (first) first.focus();
    }
    return ok;
  }

  function openMailClient() {
    var subject = m.subject;
    var body = m.fName + ': ' + nameEl.value.trim() + '\n'
             + m.fEmail + ': ' + emailEl.value.trim() + '\n\n'
             + msgEl.value.trim();
    window.location.href = 'mailto:' + FALLBACK_EMAIL
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
    setStatus(m.mailOpened, 'info');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Ak je pasca vyplnená, ide o robota — tvárime sa, že sa odoslalo
    if (trapEl && trapEl.value) {
      setStatus(m.sent, 'success');
      return;
    }

    if (!validate()) {
      setStatus(m.check, 'error');
      return;
    }

    if (!FORM_ENDPOINT) {
      openMailClient();
      return;
    }

    submitEl.disabled = true;
    var original = submitEl.textContent;
    submitEl.textContent = m.sendingBtn;
    setStatus(m.sending, 'info');

    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        meno: nameEl.value.trim(),
        email: emailEl.value.trim(),
        sprava: msgEl.value.trim(),
        suhlas: !!(consentEl && consentEl.checked),
        suhlas_udeleny: new Date().toISOString(),
        jazyk: 'en',  // pole číta odoslat.php na serveri - nemeniť
        _gotcha: trapEl ? trapEl.value : ''
      })
    })
    .then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.ok) throw new Error('HTTP ' + res.status);
      });
    })
    .then(function () {
      form.reset();
      if (consentEl) consentEl.checked = false;
      setStatus(m.sent, 'success');
    })
    .catch(function () {
      setStatus(m.failed + FALLBACK_EMAIL + '.', 'error');
    })
    .then(function () {
      submitEl.disabled = false;
      submitEl.textContent = original;
    });
  });
});
