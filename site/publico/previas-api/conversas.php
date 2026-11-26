<?php
// Z7 Studio · conversas do WhatsApp exportadas pelo vendedor (26/11/2026), para o Claude analisar depois
// (dúvidas, objeções, o que fez vender). Ficam FORA da parte pública do site; só o administrador baixa.
// POST (equipe): col, aluno, codigo, nome + arquivo (.txt ou .zip do "Exportar conversa", até 60 MB) → { id }
// GET ?lista (admin) → { conversas: [ {id, col, aluno, codigo, nome, em, tam, ext} ] }
// GET ?baixar=<id> (admin) → o arquivo
require __DIR__ . '/comum.php';
z7_cors();

function z7_conv_dir() {
  // de preferência fora da pasta do site (ninguém acessa pela internet); se não der, numa pasta trancada
  $fora = dirname(__DIR__, 2) . '/z7-conversas';
  if (is_dir($fora) || @mkdir($fora, 0700, true)) return $fora;
  $dentro = __DIR__ . '/conversas-guardadas';
  if (!is_dir($dentro)) mkdir($dentro, 0700, true);
  if (!is_file($dentro . '/.htaccess')) file_put_contents($dentro . '/.htaccess', "Require all denied\nOptions -Indexes\n");
  return $dentro;
}
function z7_conv_indice_mudar($dir, callable $mudar) {
  $fp = fopen($dir . '/indice.json', 'c+');
  flock($fp, LOCK_EX);
  $j = json_decode((string) stream_get_contents($fp), true) ?: ['conversas' => []];
  $j = $mudar($j);
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($j, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  flock($fp, LOCK_UN);
  fclose($fp);
}

$dir = z7_conv_dir();
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  z7_exigir('equipe');
  $col = (string) ($_POST['col'] ?? '');
  if (!in_array($col, ['repasse', 'paspatur', 'formaturaAlunos'], true)) z7_resposta(400, ['erro' => 'Lista inválida.']);
  $aluno = (string) ($_POST['aluno'] ?? '');
  if (!preg_match('/^[A-Za-z0-9_-]{1,150}$/', $aluno)) z7_resposta(400, ['erro' => 'Aluno inválido.']);
  $f = $_FILES['arquivo'] ?? null;
  $erro = $f['error'] ?? UPLOAD_ERR_NO_FILE;
  if ($erro === UPLOAD_ERR_INI_SIZE || $erro === UPLOAD_ERR_FORM_SIZE) z7_resposta(413, ['erro' => 'Arquivo grande demais para o site. Exporte sem mídia, ou mande em partes.']);
  if (!$f || $erro !== UPLOAD_ERR_OK) z7_resposta(400, ['erro' => 'O arquivo não chegou. Tente de novo.']);
  if ($f['size'] > 60 * 1024 * 1024) z7_resposta(413, ['erro' => 'Arquivo grande demais (até 60 MB).']);
  $orig = (string) ($f['name'] ?? '');
  $ini = (string) file_get_contents($f['tmp_name'], false, null, 0, 4);
  $ext = substr($ini, 0, 2) === 'PK' ? 'zip' : 'txt';
  if ($ext === 'txt' && !mb_check_encoding((string) file_get_contents($f['tmp_name'], false, null, 0, 4096), 'UTF-8'))
    z7_resposta(415, ['erro' => 'Use o arquivo do “Exportar conversa” do WhatsApp (.txt ou .zip).']);
  $id = date('Ym') . '-' . bin2hex(random_bytes(8));
  if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $id . '.' . $ext)) z7_resposta(500, ['erro' => 'Não consegui guardar. Tente de novo.']);
  $item = [
    'id' => $id,
    'col' => $col,
    'aluno' => $aluno,
    'codigo' => mb_substr(trim((string) ($_POST['codigo'] ?? '')), 0, 40),
    'nome' => mb_substr(trim((string) ($_POST['nome'] ?? '')), 0, 120),
    'orig' => mb_substr($orig, 0, 120),
    'em' => gmdate('c'),
    'tam' => (int) $f['size'],
    'ext' => $ext,
  ];
  z7_conv_indice_mudar($dir, function ($j) use ($item) {
    $j['conversas'][] = $item;
    return $j;
  });
  z7_resposta(200, ['id' => $id, 'ext' => $ext, 'tam' => $item['tam']]);
}

z7_exigir('admin');
if (isset($_GET['baixar'])) {
  $id = preg_replace('/[^0-9a-f-]/', '', (string) $_GET['baixar']);
  foreach (['zip', 'txt'] as $ext) {
    $arq = $dir . '/' . $id . '.' . $ext;
    if ($id !== '' && is_file($arq)) {
      header('Content-Type: ' . ($ext === 'zip' ? 'application/zip' : 'text/plain; charset=utf-8'));
      header('Content-Disposition: attachment; filename="conversa-' . $id . '.' . $ext . '"');
      header('Cache-Control: no-store');
      header('Content-Length: ' . filesize($arq));
      readfile($arq);
      exit;
    }
  }
  z7_resposta(404, ['erro' => 'Não achei essa conversa.']);
}
$j = json_decode((string) @file_get_contents($dir . '/indice.json'), true) ?: ['conversas' => []];
z7_resposta(200, ['conversas' => $j['conversas']]);
