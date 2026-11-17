<?php
// Z7 Studio · pagamento do kit pela página da prévia (InfinitePay, Checkout Integrado). 17/11/2026.
// pagar.php cria o link de pagamento; pago.php recebe o aviso da InfinitePay (e a volta da pessoa) e confere o
// pagamento direto com a InfinitePay antes de guardar; pagamentos.php entrega ao app (admin) os pagamentos
// confirmados, e o app marca o aluno como Pago.
require_once __DIR__ . '/comum.php';
if (is_file(__DIR__ . '/segredo.php')) require_once __DIR__ . '/segredo.php'; // Z7_INFINITE_KEY (opcional)

const Z7_INFINITE_TAG = 'z7studiofotografico';
const Z7_API_INFINITE = 'https://api.checkout.infinitepay.io';
const Z7_CHAVE_PUBLICA = 'AIzaSyAoUcT2xsFR0BMBr7jKAzXPlgjogx2VSHU'; // a mesma da página da prévia (pública)

function z7_json_post($url, $dados, $comChave = false) {
  $h = ['Content-Type: application/json', 'Accept: application/json'];
  if ($comChave && defined('Z7_INFINITE_KEY')) $h[] = 'X-Api-Key: ' . Z7_INFINITE_KEY;
  $c = curl_init($url);
  curl_setopt_array($c, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $h,
    CURLOPT_POSTFIELDS => json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
  ]);
  $r = curl_exec($c);
  $st = curl_getinfo($c, CURLINFO_HTTP_CODE);
  curl_close($c);
  return [$st, json_decode((string) $r, true)];
}

// o link da prévia (previasSite/<código>), lido do Firestore como a página lê: nome, escola, kit, preço
function z7_link_previa($codigo) {
  if (!preg_match('/^[a-z0-9]{10,16}$/', $codigo)) return null;
  $url = 'https://firestore.googleapis.com/v1/projects/' . Z7_PROJETO . '/databases/(default)/documents/previasSite/' . $codigo . '?key=' . Z7_CHAVE_PUBLICA;
  $c = curl_init($url);
  curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
  $r = curl_exec($c);
  $st = curl_getinfo($c, CURLINFO_HTTP_CODE);
  curl_close($c);
  if ($st !== 200) return null;
  $f = (json_decode((string) $r, true) ?: [])['fields'] ?? [];
  $d = [];
  foreach ($f as $k => $v) $d[$k] = $v['stringValue'] ?? ($v['integerValue'] ?? null);
  return $d;
}

// "R$ 1.350,50 no cartão · até 10x" → 135050 (centavos); o primeiro valor em reais do texto
function z7_centavos($txt) {
  if (!preg_match('/R\$\s*([\d.]+(?:,\d{1,2})?)/u', (string) $txt, $m)) return 0;
  $v = str_replace(['.', ','], ['', '.'], $m[1]);
  return (int) round(((float) $v) * 100);
}

// pasta dos pagamentos confirmados (não abre pelo navegador)
function z7_pasta_pagamentos() {
  $p = dirname(__DIR__) . '/previas/pagamentos';
  if (!is_dir($p)) mkdir($p, 0755, true);
  if (!is_file($p . '/.htaccess')) file_put_contents($p . '/.htaccess', "Require all denied\n");
  return $p;
}
