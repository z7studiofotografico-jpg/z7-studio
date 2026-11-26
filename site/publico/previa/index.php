<?php
// Z7 Studio · a página da prévia com a foto do próprio aluno na pré-visualização do WhatsApp (26/11/2026).
// O WhatsApp não roda o JavaScript da página: ele só lê as etiquetas og:* do HTML. Este arquivo entrega o mesmo
// index.html, trocando a foto do mostruário pela 1ª prévia do aluno (a cópia com marca d'água em /previas/) e o
// título pelo nome dele. Sem o código, link vencido ou foto ainda não copiada: fica o mostruário, como antes.
$html = (string) file_get_contents(__DIR__ . '/index.html');
$c = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) ($_GET['c'] ?? '')));
if (preg_match('/^[a-z0-9]{10,16}$/', $c)) {
  $url = 'https://firestore.googleapis.com/v1/projects/z7-funil-e-repasse/databases/(default)/documents/previasSite/' . $c
    . '?key=AIzaSyAoUcT2xsFR0BMBr7jKAzXPlgjogx2VSHU';
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
  $r = curl_exec($ch);
  $st = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  $f = $st === 200 ? ((json_decode((string) $r, true) ?: [])['fields'] ?? []) : [];
  $fotos = $f['fotos']['arrayValue']['values'] ?? [];
  $img = '';
  foreach ($fotos as $v) {
    $id = (string) ($v['stringValue'] ?? '');
    if (preg_match('#^https://z7studio\.com\.br/[A-Za-z0-9/_.-]+\.jpg$#', $id)) { $img = $id; break; }
    if (preg_match('/^[A-Za-z0-9_-]{10,80}$/', $id) && is_file(dirname(__DIR__) . '/previas/' . $id . '.jpg')) {
      $img = 'https://z7studio.com.br/previas/' . $id . '.jpg';
      break;
    }
  }
  $nome = trim((string) ($f['nome']['stringValue'] ?? ''));
  $primeiro = $nome !== '' ? explode(' ', $nome)[0] : '';
  if ($img !== '') {
    $html = preg_replace('#<meta property="og:image" content="[^"]*" />#',
      '<meta property="og:image" content="' . htmlspecialchars($img, ENT_QUOTES) . '" />', $html, 1);
  }
  if ($primeiro !== '') {
    $html = preg_replace('#<meta property="og:title" content="[^"]*" />#',
      '<meta property="og:title" content="' . htmlspecialchars('As fotos de ' . $primeiro . ' estão prontas', ENT_QUOTES) . '" />', $html, 1);
  }
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
echo $html;
