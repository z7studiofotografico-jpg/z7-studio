<?php
// Z7 Studio · prévias direto no site (17/11/2026). Partes comuns do enviar.php e do lista.php.
// Quem pode: a pessoa logada no app. O app manda o "crachá" do login (token do Firebase) e este código pergunta ao
// próprio Firebase, com esse crachá, se a pessoa é da equipe (lê config/app) ou administradora (lê fichasPedidos,
// que só o admin lê). Nenhuma senha nem e-mail fica guardado aqui.
// As prévias ficam em public_html/previas/a/<ano>/<colégio>/<aluno>-<código aleatório>/ e a lista de cada colégio
// em .../<colégio>/indice.json, que só abre por este código (o .htaccess bloqueia o acesso direto).

const Z7_PROJETO = 'z7-funil-e-repasse';
const Z7_ORIGENS = ['https://app.z7studio.com.br', 'http://localhost:8790', 'http://localhost:8811'];

function z7_cors() {
  $o = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (in_array($o, Z7_ORIGENS, true)) {
    header('Access-Control-Allow-Origin: ' . $o);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  }
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
}

function z7_resposta($codigo, $dados) {
  http_response_code($codigo);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

// pergunta ao Firestore, com o crachá da pessoa, se ela consegue ler um documento (as regras decidem)
function z7_pode_ler($token, $caminho) {
  $url = 'https://firestore.googleapis.com/v1/projects/' . Z7_PROJETO . '/databases/(default)/documents/' . $caminho;
  $c = curl_init($url);
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
  ]);
  curl_exec($c);
  $st = curl_getinfo($c, CURLINFO_HTTP_CODE);
  curl_close($c);
  return $st === 200;
}

// $nivel: 'equipe' (qualquer pessoa ativa do app) ou 'admin'
function z7_exigir($nivel) {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  if (!$h && function_exists('apache_request_headers')) {
    foreach (apache_request_headers() as $k => $v) if (strtolower($k) === 'authorization') $h = $v;
  }
  if (!preg_match('/^Bearer\s+([A-Za-z0-9._-]{100,4000})$/', trim($h), $m)) z7_resposta(401, ['erro' => 'Entre no app de novo.']);
  $t = $m[1];
  $ok = $nivel === 'admin' ? z7_pode_ler($t, 'fichasPedidos?pageSize=1') : z7_pode_ler($t, 'config/app');
  if (!$ok) z7_resposta(403, ['erro' => $nivel === 'admin' ? 'Só o administrador envia prévias.' : 'Sem acesso.']);
}

// nome de pasta seguro: só letras, números e hífen, sem acento
function z7_chave($s, $max = 60) {
  $s = (string) $s;
  if (class_exists('Normalizer')) $s = preg_replace('/\p{Mn}+/u', '', Normalizer::normalize($s, Normalizer::FORM_D));
  elseif (function_exists('iconv')) $s = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
  $s = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', $s));
  return substr(trim($s, '-'), 0, $max) ?: 'SEM-NOME';
}

function z7_raiz() {
  return dirname(__DIR__) . '/previas/a';
}
function z7_pasta_colegio($ano, $escola) {
  $ano = preg_replace('/\D/', '', (string) $ano) ?: 'sem-ano';
  return z7_raiz() . '/' . $ano . '/' . z7_chave($escola);
}
// a lista do colégio (com trava, para dois envios ao mesmo tempo não se perderem)
function z7_indice_ler($pasta) {
  $f = $pasta . '/indice.json';
  if (!is_file($f)) return ['alunos' => []];
  $j = json_decode((string) file_get_contents($f), true);
  return is_array($j) ? $j : ['alunos' => []];
}
function z7_indice_mudar($pasta, callable $mudar) {
  if (!is_dir($pasta)) mkdir($pasta, 0755, true);
  $fp = fopen($pasta . '/indice.json', 'c+');
  flock($fp, LOCK_EX);
  $txt = stream_get_contents($fp);
  $j = json_decode((string) $txt, true);
  if (!is_array($j)) $j = ['alunos' => []];
  $j = $mudar($j);
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($j, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
  return $j;
}
// a pasta /previas/a: o índice não abre direto pelo navegador (só pelo lista.php); as fotos abrem
function z7_proteger() {
  $raiz = z7_raiz();
  if (!is_dir($raiz)) mkdir($raiz, 0755, true);
  $h = $raiz . '/.htaccess';
  if (!is_file($h)) file_put_contents($h, "Options -Indexes\n<Files \"indice.json\">\n  Require all denied\n</Files>\n");
}
