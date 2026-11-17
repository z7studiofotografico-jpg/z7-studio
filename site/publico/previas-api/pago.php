<?php
// Z7 Studio · aviso de pagamento da InfinitePay (webhook) e a volta da pessoa para a página da prévia.
// O aviso não tem assinatura, então nada é aceito sem conferir direto com a InfinitePay (payment_check).
// Pagamento confirmado fica guardado em previas/pagamentos/<transação>.json, até o app marcar o aluno como Pago.
require __DIR__ . '/pagamento-comum.php';
$j = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($j)) $j = [];
$pega = function ($k, $alt = null) use ($j) {
  $v = $j[$k] ?? ($_POST[$k] ?? ($_GET[$k] ?? ''));
  if ($v === '' && $alt) $v = $j[$alt] ?? ($_POST[$alt] ?? ($_GET[$alt] ?? ''));
  return preg_replace('/[^A-Za-z0-9._-]/', '', (string) $v);
};
$nsu = $pega('order_nsu');
$transacao = $pega('transaction_nsu');
$slug = $pega('slug', 'invoice_slug');
// o código da prévia: vem no nosso order_nsu ("<código>-<hora>") ou, quando a InfinitePay troca o order_nsu pelo
// dela (17/11/2026, com a chave da API), no endereço de volta da página (?c=<código>)
$c = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) ($j['c'] ?? ($_POST['c'] ?? ($_GET['c'] ?? '')))));
if (preg_match('/^([a-z0-9]{10,16})-[a-z0-9]+$/', $nsu, $m)) $codigo = $m[1];
elseif (preg_match('/^[a-z0-9]{10,16}$/', $c)) $codigo = $c;
else $codigo = '';
if (!$codigo || !$transacao) z7_resposta(400, ['erro' => 'Dados incompletos.']);

[$st, $r] = z7_json_post(Z7_API_INFINITE . '/payment_check', [
  'handle' => Z7_INFINITE_TAG,
  'order_nsu' => $nsu,
  'transaction_nsu' => $transacao,
  'slug' => $slug,
]);
if ($st !== 200 || empty($r['success']) || empty($r['paid'])) z7_resposta(200, ['pago' => false]);

$pasta = z7_pasta_pagamentos();
$arq = $pasta . '/' . substr(preg_replace('/[^A-Za-z0-9-]/', '', $transacao), 0, 60) . '.json';
if (!is_file($arq) && !is_file($arq . '.feito')) {
  $recibo = (string) ($j['receipt_url'] ?? ($_GET['receipt_url'] ?? ''));
  file_put_contents($arq, json_encode([
    'codigo' => $codigo,
    'order_nsu' => $nsu,
    'transaction_nsu' => $transacao,
    'slug' => $slug,
    'valor' => (int) ($r['paid_amount'] ?? ($r['amount'] ?? 0)),
    'forma' => ($r['capture_method'] ?? '') === 'pix' ? 'pix' : 'cartao',
    'parcelas' => (int) ($r['installments'] ?? 1),
    'recibo' => preg_match('#^https://#', $recibo) ? substr($recibo, 0, 300) : '',
    'em' => gmdate('c'),
  ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
}
z7_resposta(200, ['pago' => true]);
