/*
  Jednoduchá správa súhlasu s cookies.
  - Reklamné skripty (Google AdSense, keď sa zapne) sa načítajú AŽ PO súhlase používateľa.
  - Súhlas sa ukladá lokálne v prehliadači (localStorage), nie na serveri.
  - Na stránke Kontakt (SK aj EN) sa reklamy zámerne nenačítavajú vôbec —
    pozri KONTAKT_CESTY nižšie. Lišta so súhlasom tam funguje normálne,
    len sa po kliknutí "Prijať" nespustí načítanie reklám.
*/
(function () {
  const CONSENT_KEY = 'cookie_consent_status'; // 'accepted' | 'rejected'

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }

  function setConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* súkromný režim a pod. */ }
  }

  // Stránky bez reklám (Kontakt SK/EN a 404) majú v HTML značku
  // <html data-no-ads="1">. Kontrola cez značku funguje spoľahlivo aj
  // pre 404, ktorej adresa sa mení podľa toho, čo návštevník zadal —
  // porovnávanie konkrétnych ciest by ju nezachytilo.
  function jeStrankaBezReklam() {
    return document.documentElement.hasAttribute('data-no-ads');
  }

  function loadOptionalScripts() {
    // Sem patria neesenciálne skripty (reklamy, analytika), ktoré sa smú
    // načítať IBA po súhlase používateľa. Táto funkcia sa volá po kliknutí
    // na "Prijať", alebo automaticky pri opätovnej návšteve, ak už súhlas existuje.
    if (jeStrankaBezReklam()) return; // Kontakt zámerne bez reklám

    // --- GOOGLE ADSENSE, automatické reklamy (Adsterra bola 27. 11. 2026 úplne
    // odstránená). Odkomentovať PO schválení webu v AdSense, spolu s úpravou
    // stránok Privacy a Cookies. Reklamy si Google umiestni sám (Auto ads),
    // žiadne pevné reklamné polia v HTML netreba. ---
    // if (!document.getElementById('adsense-script')) {
    //   const ads = document.createElement('script');
    //   ads.id = 'adsense-script';
    //   ads.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3790654186148741';
    //   ads.async = true;
    //   ads.crossOrigin = 'anonymous';
    //   document.head.appendChild(ads);
    // }
    //
    // --- GOOGLE ANALYTICS (voliteľné) ---
    // if (!document.getElementById('ga-script')) {
    //   const ga = document.createElement('script');
    //   ga.id = 'ga-script';
    //   ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX';
    //   ga.async = true;
    //   document.head.appendChild(ga);
    //   window.dataLayer = window.dataLayer || [];
    //   function gtag(){dataLayer.push(arguments);}
    //   gtag('js', new Date());
    //   gtag('config', 'G-XXXXXXX');
    // }
  }

  function hideBanner(banner) {
    if (banner) banner.remove();
  }

  function texts() {
    return {
      text: 'We use cookies to run the site and — with your consent — to show advertising. More in our ',
      link: 'cookie policy',
      href: '/cookies',
      reject: 'Decline',
      accept: 'Accept',
      aria: 'Cookie consent'
    };
  }

  function showBanner() {
    if (document.getElementById('cookie-banner')) return;
    var t = texts();
    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', t.aria);
    banner.innerHTML =
      '<p>' + t.text + '<a href="' + t.href + '">' + t.link + '</a>.</p>' +
      '<div class="cookie-actions">' +
      '<button type="button" id="cookie-reject">' + t.reject + '</button>' +
      '<button type="button" id="cookie-accept">' + t.accept + '</button>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      loadOptionalScripts();
      hideBanner(banner);
    });
    document.getElementById('cookie-reject').addEventListener('click', function () {
      setConsent('rejected');
      hideBanner(banner);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const consent = getConsent();
    if (consent === 'accepted') {
      loadOptionalScripts();
    } else if (consent !== 'rejected') {
      showBanner();
    }
  });
})();
