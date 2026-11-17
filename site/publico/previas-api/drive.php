<?php
// Z7 Studio · a lista das pastas das prévias antigas (as que vieram do Google Drive), guardada no site pela cópia
// da madrugada (scripts/espelhar-previas.mjs). O app acha as fotos de cada aluno por aqui, sem perguntar ao Google.
// GET ?id=<pasta> (equipe) → { pastas: { id: [ {id, name, mimeType} ] }, nomes: { id: nome } } (o pedaço com a pasta)
// POST tirar=<id da foto>&pasta=<id da pasta> (equipe) → a foto sai da lista (o aluno não vê mais)
require __DIR__ . '/comum.php';
z7_cors();
z7_exigir('equipe');
$dir = dirname(__DIR__) . '/previas/drive';
$mapa = json_decode((string) @file_get_contents($dir . '/mapa.json'), true) ?: [];
$limpo = fn($s) => preg_replace('/[^A-Za-z0-9_-]/', '', (string) $s);

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $pasta = $limpo($_POST['pasta'] ?? '');
  $foto = $limpo($_POST['tirar'] ?? '');
  $g = $mapa['mapa'][$pasta] ?? '';
  if (!$g || !$foto) z7_resposta(404, ['erro' => 'Não achei essa foto.']);
  $f = $dir . '/' . $limpo($g) . '.json';
  $fp = fopen($f, 'c+');
  flock($fp, LOCK_EX);
  $j = json_decode((string) stream_get_contents($fp), true) ?: ['pastas' => [], 'nomes' => []];
  $j['pastas'][$pasta] = array_values(array_filter($j['pastas'][$pasta] ?? [], fn($x) => ($x['id'] ?? '') !== $foto));
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($j, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  flock($fp, LOCK_UN);
  fclose($fp);
  z7_resposta(200, ['ok' => true]);
}

$id = $limpo($_GET['id'] ?? '');
$g = $mapa['mapa'][$id] ?? '';
if (!$g || !is_file($dir . '/' . $limpo($g) . '.json')) z7_resposta(404, ['erro' => 'Esta pasta ainda não está no site.']);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=300');
readfile($dir . '/' . $limpo($g) . '.json');
