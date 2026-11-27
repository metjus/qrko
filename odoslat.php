<?php
/*
  Kontaktný formulár qrko.net — odoslanie e-mailu priamo z hostingu.

  ── NASTAVENIE ───────────────────────────────────────────────────────────
  $PRIJEMCA     kam má správa prísť
  $ODOSIELATEL  adresa v poli „Od". MUSÍ na hostingu reálne existovať
                (schránka vo WebSupporte), inak server e-mail odmietne
                alebo skončí v spame.
  Na zákazníka sa dá odpovedať priamo tlačidlom „Odpovedať" — jeho
  adresa je v hlavičke Reply-To.

  ── DIAGNOSTIKA ──────────────────────────────────────────────────────────
  Repo je verejné, preto je diagnostika predvolene vypnutá ($DIAG_KLUC je
  prázdny). Keď ju potrebuješ, na serveri (nie v repe) dočasne vpíš do
  $DIAG_KLUC vlastný náhodný reťazec a otvor v prehliadači:
      https://qrko.net/odoslat.php?diag=<ten reťazec>
  Vypíše, či hosting povoľuje odosielanie e-mailov, a pošle skúšobný
  e-mail na $PRIJEMCA. Potom kľúč na serveri znova vymaž (ďalší deploy
  ho aj tak prepíše prázdnym).

  Chyby sa zapisujú do odoslat-chyby.log vedľa skriptu (bez osobných
  údajov — len čas a typ chyby). Súbor je cez .htaccess chránený pred
  prístupom z webu.

  ── ZMENY (október 2026) ─────────────────────────────────────────────────
  - Web je len po anglicky, preto z e-mailu zmizol riadok o jazyku verzie.
    Pole "jazyk", ktoré posiela contact.js, sa ignoruje (nechaj ho tam).
  - Ak hosting odmietne e-mail s parametrom -f (nastavenie odosielateľa),
    skript to skúsi ešte raz bez neho.
  ─────────────────────────────────────────────────────────────────────────
*/

$PRIJEMCA    = 'info@qrko.net';
$ODOSIELATEL = 'info@qrko.net';
$DIAG_KLUC   = ''; // prázdny = diagnostika vypnutá
$LOG_SUBOR   = __DIR__ . '/odoslat-chyby.log';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function odpoved($status, $data) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function zapis_chybu($kod) {
    global $LOG_SUBOR;
    @file_put_contents($LOG_SUBOR, date('Y-m-d H:i:s') . "  " . $kod . "\n", FILE_APPEND | LOCK_EX);
}

// Orezanie a dĺžka textu s diakritikou. Použije mbstring, ak ho hosting má,
// inak záložné riešenie — formulár tak nezávisí od konkrétneho nastavenia PHP.
function orez($text, $max) {
    if (function_exists('mb_substr')) return mb_substr($text, 0, $max, 'UTF-8');
    return preg_match('/^.{0,' . (int)$max . '}/us', $text, $m) ? $m[0] : substr($text, 0, $max);
}
function dlzka($text) {
    if (function_exists('mb_strlen')) return mb_strlen($text, 'UTF-8');
    return (int)preg_match_all('/./us', $text);
}

// Kódovanie hlavičky (predmet, meno) do UTF-8, aby diakritika prešla správne
function hlavicka_utf8($text) {
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

// Odstráni zalomenia riadkov — ochrana proti podvrhnutiu hlavičiek e-mailu
function jeden_riadok($text) {
    return trim(str_replace(["\r", "\n", "\0"], ' ', $text));
}

function posli($prijemca, $predmet, $telo, $odosielatel, $reply_to = null) {
    $hlavicky  = "From: " . hlavicka_utf8('qrko.net') . " <{$odosielatel}>\r\n";
    if ($reply_to) $hlavicky .= "Reply-To: {$reply_to}\r\n";
    $hlavicky .= "MIME-Version: 1.0\r\n";
    $hlavicky .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $hlavicky .= "Content-Transfer-Encoding: 8bit\r\n";
    $hlavicky .= "X-Mailer: qrko.net\r\n";
    $predmet_kodovany = hlavicka_utf8($predmet);

    // 1. pokus: s explicitným odosielateľom (-f) — na väčšine hostingov je to správne
    if (@mail($prijemca, $predmet_kodovany, $telo, $hlavicky, '-f' . $odosielatel)) {
        return true;
    }
    // 2. pokus: bez -f — niektoré hostingy parameter odmietnu a použijú hlavičku From
    return @mail($prijemca, $predmet_kodovany, $telo, $hlavicky);
}

// ── Diagnostika ─────────────────────────────────────────────────────────
if (isset($_GET['diag'])) {
    if ($DIAG_KLUC === '' || !hash_equals($DIAG_KLUC, (string)$_GET['diag'])) odpoved(404, ['ok' => false]);
    header('Content-Type: text/plain; charset=utf-8');
    $zakazane = array_map('trim', explode(',', (string)ini_get('disable_functions')));
    $mail_povolene = function_exists('mail') && !in_array('mail', $zakazane, true);
    echo "qrko.net — diagnostika formulára\n\n";
    echo "PHP verzia:        " . PHP_VERSION . "\n";
    echo "mail():            " . ($mail_povolene ? "povolená" : "ZAKÁZANÁ hostingom") . "\n";
    echo "sendmail_path:     " . (ini_get('sendmail_path') ?: '(predvolené)') . "\n";
    echo "Príjemca:          {$PRIJEMCA}\n";
    echo "Odosielateľ:       {$ODOSIELATEL}\n";
    echo "Log zapisovateľný: " . (is_writable(__DIR__) ? "áno" : "NIE") . "\n\n";
    if ($mail_povolene) {
        $ok = posli($PRIJEMCA, 'qrko.net — skúšobný e-mail z diagnostiky',
                    "Ak čítaš tento e-mail, odosielanie z formulára funguje.\n\nČas: " . date('Y-m-d H:i:s') . "\n",
                    $ODOSIELATEL);
        echo "Skúšobný e-mail:   " . ($ok ? "prijatý serverom na odoslanie — skontroluj schránku aj spam" : "server ho ODMIETOL") . "\n";
    }
    exit;
}

// ── Prijatie formulára ──────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    odpoved(405, ['ok' => false, 'chyba' => 'metoda']);
}

$vstup = json_decode(file_get_contents('php://input'), true);
if (!is_array($vstup)) $vstup = $_POST;   // záloha, keby niečo poslalo klasický formulár

// Pasca na roboty: skutočný človek skryté pole nevyplní.
// Tvárime sa, že je všetko v poriadku, aby robot nezistil, že bol odhalený.
if (!empty($vstup['_gotcha'])) {
    odpoved(200, ['ok' => true]);
}

$meno   = jeden_riadok(orez((string)($vstup['meno'] ?? ''), 120));
$email  = jeden_riadok(orez((string)($vstup['email'] ?? ''), 200));
$sprava = trim(orez((string)($vstup['sprava'] ?? ''), 5000));
$suhlas = !empty($vstup['suhlas']);
$cas_suhlasu = jeden_riadok(orez((string)($vstup['suhlas_udeleny'] ?? ''), 40));

if ($meno === '' || $sprava === '' || dlzka($sprava) < 10) {
    zapis_chybu('VALIDACIA: chýbajúce alebo príliš krátke polia');
    odpoved(400, ['ok' => false, 'chyba' => 'validacia']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    zapis_chybu('VALIDACIA: neplatný e-mail');
    odpoved(400, ['ok' => false, 'chyba' => 'email']);
}
if (!$suhlas) {
    zapis_chybu('VALIDACIA: chýba súhlas so spracovaním údajov');
    odpoved(400, ['ok' => false, 'chyba' => 'suhlas']);
}

$predmet = "Správa z qrko.net — {$meno}";
$telo  = "Nová správa z kontaktného formulára na qrko.net\n";
$telo .= str_repeat('-', 50) . "\n\n";
$telo .= "Meno:     {$meno}\n";
$telo .= "E-mail:   {$email}\n";
$telo .= "Súhlas so spracovaním osobných údajov udelený: " . ($cas_suhlasu !== '' ? $cas_suhlasu : date('c')) . "\n\n";
$telo .= "Správa:\n{$sprava}\n\n";
$telo .= str_repeat('-', 50) . "\n";
$telo .= "Odpovedať môžeš priamo — odpoveď pôjde na {$email}.\n";

if (!posli($PRIJEMCA, $predmet, $telo, $ODOSIELATEL, $email)) {
    zapis_chybu('MAIL: server odmietol odoslať e-mail');
    odpoved(500, ['ok' => false, 'chyba' => 'mail']);
}

odpoved(200, ['ok' => true]);
