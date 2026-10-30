# qrko.net — kompletný balík (v2.1, len angličtina, priamo v koreni)

Web je od októbra 2026 len v angličtine a beží priamo na koreni:
qrko.net, qrko.net/guides, qrko.net/privacy ... (bez /en).

## Obsah balíka
/.htaccess           HTTPS, www, čisté adresy, presmerovania, 404/410,
                     bezpečnostné hlavičky, cache
/index.html          generátor QR kódov (adresa qrko.net)
/barcodes.html       generátor čiarových kódov (EAN-13, UPC-A, CODE128)
/qr-reader.html      čítačka QR kódov z obrázka (nové vo v2.1)
/guides.html         rozcestník návodov
/guides/*.html       8 návodov
/about.html, /contact.html, /privacy.html, /cookies.html
/404.html            vlastná chybová stránka (zobrazí sa aj pri 410)
/script.js           generátor QR kódov
/barcode.js          generátor čiarových kódov (+ jsbarcode.min.js)
/qr-reader.js        čítačka QR kódov (+ jsqr.min.js, licencia v jsqr-LICENSE.txt)
/banner.js           cookie lišta + načítanie reklám po súhlase
/contact.js          kontaktný formulár (odosiela na /odoslat.php)
/odoslat.php         spracovanie formulára: pošle e-mail na info@qrko.net
/analytics.js        Cloudflare Web Analytics (token vyplnený)
/sitemap.xml         16 adries (bez hreflang)
/llms.txt, /robots.txt, /ads.txt, /style.css, logo, favicony,
/qrcode.min.js, /site.webmanifest

## Adresy a presmerovania
Súbory na serveri sa volajú napr. privacy.html, ale navonok je čistá
adresa qrko.net/privacy.

  - /en/..., napr. /en/privacy, /en/guides/x   -> 301 na /privacy, /guides/x
  - /en a /en/                                 -> 301 na /
  - /nieco.html, /index.html, /index           -> 301 na čistú adresu
  - staré slovenské adresy (o-nas, kontakt, ochrana-sukromia, navody,
    navody/..., ciarove-kody)                  -> 410 Gone (bez presmerovania)
  - /cookies je teraz anglická stránka (kedysi slovenská)

Presmerovania z /en/... a z .html NEMAŽ ani v budúcnosti: Google aj ľudia
môžu mať staré odkazy uložené.

## Čítačka QR kódov (nové vo v2.1)
Stránka /qr-reader načíta obrázok (pustením, výberom súboru alebo vložením
zo schránky) a ukáže, čo QR kód obsahuje: odkaz, Wi-Fi, vizitku, e-mail,
telefón, SMS, polohu alebo text. Obrázok sa nikam neodosiela, číta sa v
prehliadači cez knižnicu jsQR 1.4.0 (licencia Apache 2.0, text licencie je
v jsqr-LICENSE.txt a nemá sa mazať).

Súbory: qr-reader.html, qr-reader.js, jsqr.min.js, jsqr-LICENSE.txt, plus
štýly na konci style.css (sekcia "Čítačka QR kódov").

Na pamätať pri úpravách:
  - Obsah kódu je cudzí vstup. Do stránky sa vkladá len cez textContent
    (nikdy innerHTML), odkaz vzniká len pre http/https a nič sa neotvára
    automaticky. Tieto tri pravidlá zachovaj.
  - jsQR nevie prečítať viac kódov vedľa seba naraz. Preto sa po každom
    nájdenom kóde ten kód v obrázku zakryje a hľadá sa znova, najprv v celom
    obrázku a potom po výrezoch (komentáre v qr-reader.js).
  - Režim 'onlyInvert' vo verzii jsQR 1.4.0 padá (chyba knižnice),
    preto sa používa 'attemptBoth'. Pri aktualizácii knižnice to over.
  - Čítačka číta len QR kódy, nie EAN/UPC.
  - Odkaz na čítačku je v päte všetkých stránok, na hlavnej stránke a v
    dvoch návodoch. Do hlavného menu nepatrí: šiesta položka by sa na
    tabletoch nezmestila do jedného riadka (viď breakpoint 880px nižšie).
  - Zásady súkromia a stránka o projekte spomínajú, že obrázky sa
    nenahrávajú. Ak by sa to niekedy zmenilo, treba ich upraviť.

## Čo sa zmenilo vo v2.0
  - Zmazaná celá slovenská verzia, prepínač jazyka, lang.js, hreflang.
  - Anglické stránky sa presunuli z /en/ priamo do koreňa.
  - Slovenské texty zmizli zo script.js, barcode.js, contact.js, banner.js.
  - Právne stránky už nespomínajú voľbu jazyka (web ju neukladá).
    Dátum poslednej aktualizácie: 18. október 2026.
  - odoslat.php: z e-mailu zmizol riadok o jazyku a ak hosting odmietne
    odoslanie s parametrom -f, skúsi to ešte raz bez neho.

POZOR: skripty make_guides.py a guides1-3.py (mimo tohto balíka) píšu do
starej štruktúry (en/..., navody/...) a generujú aj slovenské návody.
Nespúšťaj ich v pôvodnej podobe, vytvorili by znova zmazané súbory.

## Po nahratí
1. Nahraj celý obsah priečinka web/ do koreňa webu. .htaccess je skrytý
   súbor - vo FTP klientovi zapni zobrazovanie skrytých súborov.
2. Na serveri nesmú ostať staré súbory: priečinky en/ a navody/, slovenské
   stránky (kontakt.html, o-nas.html, ochrana-sukromia.html, navody.html,
   ciarove-kody.html) a lang.js. Nahratie zipu ich neodstráni.
   Nemaž overovacie súbory pre Search Console / Bing, ak nejaké máš.
3. Over v prehliadači: qrko.net (anglická stránka), qrko.net/en/privacy
   (-> qrko.net/privacy), qrko.net/privacy.html (-> qrko.net/privacy),
   qrko.net/o-nas (chybová stránka), qrko.net/guides.
4. Otvor qrko.net/odoslat.php?diag=qrko-diag a pošli skúšobnú správu cez
   formulár. Odosielateľ (info@qrko.net) musí existovať ako schránka.
5. V Google Search Console aj Bing Webmaster Tools odošli sitemap znova:
   https://qrko.net/sitemap.xml
6. Aktualizuj odkazy v reklamách a profiloch (napr. Facebook), ak ešte
   mieria na /en/... (presmerujú sa, ale priama adresa je lepšia).

## Na čo pamätať
- .htaccess: DirectorySlash Off je nutné (existuje guides.html aj
  priečinok guides/, bez toho vznikne slučka presmerovaní).
- Content-Security-Policy je zatiaľ len Report-Only. Kým je aktívna
  Adsterra, neprepínaj ju na ostrú (viď komentár v .htaccess).
- Reklamy Adsterra (Native Banner) sa načítajú až po súhlase s cookies.
  Bez reklám sú zámerne /contact a /404 (značka data-no-ads).
- Kontaktný formulár posiela na /odoslat.php polia meno, email, sprava,
  suhlas, suhlas_udeleny, jazyk (vždy "en", server ho ignoruje) a
  _gotcha. Názvy polí nemeň, číta ich server. Chyby sa zapisujú do
  odoslat-chyby.log (z webu nedostupný).
- jsbarcode.min.js (3.12.1) má vnútornú chybu: po EAN13/UPC zlyhá
  CODE128. barcode.js to obchádza načítaním knižnice pred každým
  generovaním. Pri aktualizácii knižnice over sekvenciu EAN13 -> UPC ->
  CODE128 s bežným textom, skôr než obchádzku odstrániš.
- Hlavička má vlastný breakpoint na 880px. Ak pridáš ďalšiu položku do
  menu, over responzívnosť okolo tejto hranice.
- Dátum "Naposledy aktualizované" na stránkach privacy a cookies je
  písaný ručne - pri zmene textu ho prepíš.
- Fakty o GS1 registrácii v návode o získaní EAN boli overené v septembri
  2026 (gs1sk.org). Ak sa proces zmení, návod aktualizuj.
