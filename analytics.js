/*
  Meranie návštevnosti — Cloudflare Web Analytics.

  ── NASTAVENIE ───────────────────────────────────────────────────────────
  1. Vytvorte si účet na dash.cloudflare.com (zdarma, doménu tam
     presúvať nemusíte)
  2. V ľavom menu: Analytics & Logs → Web Analytics → Add a site
  3. Zadajte qrko.net. Cloudflare vygeneruje úryvok kódu, v ktorom je
     token v tvare "token": "abc123..."
  4. Ten token (len samotný reťazec) vložte nižšie do CF_TOKEN

  Kým je CF_TOKEN prázdny, nenačíta sa nič a stránka funguje bez zmeny.

  ── PREČO NIE JE ZA SÚHLASOM ─────────────────────────────────────────────
  Cloudflare Web Analytics neukladá cookies ani nič iné do zariadenia
  návštevníka, nevytvára jeho profil a nesleduje ho naprieč webmi.
  Nevzťahuje sa naň preto povinnosť žiadať súhlas s cookies a načítava
  sa priamo. Ak by ste ho chceli aj tak podmieniť súhlasom, presuňte
  volanie loadAnalytics() do funkcie loadOptionalScripts()
  v cookie-consent.js.
  ─────────────────────────────────────────────────────────────────────────
*/
var CF_TOKEN = '3e9161f5cb66451ca07c60f3c1ad7eca';

(function () {
  function loadAnalytics() {
    if (!CF_TOKEN) return;
    if (document.getElementById('cf-analytics')) return;
    var s = document.createElement('script');
    s.id = 'cf-analytics';
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.defer = true;
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAnalytics);
  } else {
    loadAnalytics();
  }
})();
