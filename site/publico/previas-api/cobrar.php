<?php
// Z7 Studio · link de pagamento de uma cobrança do app (25/11/2026). Hoje: o sinal do ensaio (Funil de vendas).
// POST (equipe do app) c=<código da cobrança>&valor=<centavos>&desc=<texto> → { url } (a tela da InfinitePay)
// O aviso da InfinitePay volta para pago.php com o código; o app (ou o robô do GitHub) acha o lead com esse código
// ("linkSinal") e marca o sinal como pago. Nada de Pix Copia e Cola fixo: todo pagamento diz de quem é.
require __DIR__ . '/pagamento-comum.php';
z7_cors();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') z7_resposta(405, ['erro' => 'Use POST.']);
z7_exigir('equipe');
$codigo = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) ($_POST['c'] ?? '')));
if (!preg_match('/^[a-z0-9]{10,16}$/', $codigo)) z7_resposta(400, ['erro' => 'Código inválido.']);
$valor = (int) ($_POST['valor'] ?? 0);
if ($valor < 100 || $valor > 500000) z7_resposta(400, ['erro' => 'Valor inválido.']);
$desc = mb_substr(trim(preg_replace('/\s+/', ' ', (string) ($_POST['desc'] ?? 'Sinal do ensaio'))), 0, 120) ?: 'Sinal do ensaio';
$nsu = $codigo . '-' . base_convert((string) time(), 10, 36);
$base = [
  'handle' => Z7_INFINITE_TAG,
  'order_nsu' => $nsu,
  'redirect_url' => 'https://z7studio.com.br/',
  'webhook_url' => 'https://z7studio.com.br/previas-api/pago.php?c=' . $codigo,
  'items' => [['quantity' => 1, 'price' => $valor, 'description' => $desc]],
];
$r = null;
if (defined('Z7_INFINITE_KEY')) {
  [$st, $r] = z7_json_post(Z7_API_INFINITE . '/links', $base + ['options' => ['require_delivery_address' => false]], true);
  if ($st >= 300 || empty($r['url'])) $r = null;
}
if (!$r) [$st, $r] = z7_json_post(Z7_API_INFINITE . '/links', $base);
if (empty($r['url'])) z7_resposta(502, ['erro' => 'A InfinitePay não criou o link agora. Tente de novo em instantes.']);
z7_resposta(200, ['url' => $r['url']]);
