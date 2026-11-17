<?php
// Z7 Studio · cria o link de pagamento do kit (InfinitePay) para a página da prévia.
// POST c=<código do link da prévia>&forma=pix|cartao → { url } (a tela de pagamento da InfinitePay)
// O valor vem do próprio link da prévia (o mesmo que a família vê), nunca do navegador.
require __DIR__ . '/pagamento-comum.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') z7_resposta(405, ['erro' => 'Use POST.']);
$codigo = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) ($_POST['c'] ?? '')));
$forma = ($_POST['forma'] ?? '') === 'cartao' ? 'cartao' : 'pix';
$d = z7_link_previa($codigo);
if (!$d) z7_resposta(404, ['erro' => 'Não achamos estas fotos. Chame a gente no WhatsApp.']);
if (!empty($d['ate']) && strtotime($d['ate']) < time()) z7_resposta(410, ['erro' => 'Este link expirou. Chame a gente no WhatsApp.']);
$pix = z7_centavos($d['preco'] ?? '');
$cartao = z7_centavos($d['cartao'] ?? '') ?: $pix;
if ($pix < 100) z7_resposta(409, ['erro' => 'O valor deste kit ainda não foi informado. Chame a gente no WhatsApp.']);

$kit = ($d['kit'] ?? '') === 'paspatur' ? 'Kit Paspatur' : 'Kit Quadro';
$desc = mb_substr($kit . ' · ' . ($d['nome'] ?? '') . ' · ' . ($d['escola'] ?? ''), 0, 120);
$nsu = $codigo . '-' . base_convert((string) time(), 10, 36);
$volta = 'https://z7studio.com.br/previa/?c=' . $codigo . '&pago=1';
$aviso = 'https://z7studio.com.br/previas-api/pago.php';
$base = ['handle' => Z7_INFINITE_TAG, 'order_nsu' => $nsu, 'redirect_url' => $volta, 'webhook_url' => $aviso];

$r = null;
// com a chave da API: um link só, no valor do cartão, com o desconto do Pix (a pessoa escolhe lá)
if (defined('Z7_INFINITE_KEY') && $cartao > $pix) {
  $pct = round((1 - $pix / $cartao) * 100, 2);
  [$st, $r] = z7_json_post(Z7_API_INFINITE . '/links', $base + [
    'items' => [['quantity' => 1, 'price' => $cartao, 'description' => $desc]],
    'options' => ['discounts' => ['pix' => $pct]],
  ], true);
  if ($st >= 300 || empty($r['url'])) $r = null; // se recusar, faz o link simples abaixo
}
// sem a chave: o link no valor da forma escolhida
if (!$r) {
  [$st, $r] = z7_json_post(Z7_API_INFINITE . '/links', $base + [
    'items' => [['quantity' => 1, 'price' => $forma === 'cartao' ? $cartao : $pix, 'description' => $desc]],
  ]);
}
if (empty($r['url'])) z7_resposta(502, ['erro' => 'Não consegui abrir o pagamento agora. Tente de novo em instantes ou chame a gente no WhatsApp.']);
z7_resposta(200, ['url' => $r['url']]);
