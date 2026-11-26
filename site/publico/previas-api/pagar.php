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
// o aviso da InfinitePay já leva o código da prévia no endereço: mesmo se a família fechar a tela antes de voltar
// para a página, o site sabe de qual aluno é o pagamento
$aviso = 'https://z7studio.com.br/previas-api/pago.php?c=' . $codigo;
$base = ['handle' => Z7_INFINITE_TAG, 'order_nsu' => $nsu, 'redirect_url' => $volta, 'webhook_url' => $aviso];

// parcelas sem juros que você escolheu no app para este colégio ("até 5x sem juros" no texto do cartão):
// dessas para cima, os juros ficam por conta de quem paga
$semJuros = preg_match('/(\d{1,2})\s*x\s*sem juros/i', (string) ($d['cartao'] ?? ''), $pm) ? max(1, min(12, (int) $pm[1])) : 1;
$r = null;
// com a chave da API: um link só, no valor do cartão, com o desconto do Pix e as parcelas sem juros do app
if (defined('Z7_INFINITE_KEY')) {
  // sem o passo "Entrega" (o kit é retirado ou combinado pelo WhatsApp): a família só põe o contato e paga
  $opcoes = ['assured_installments' => $semJuros, 'require_delivery_address' => false];
  // (26/11/2026) a família tocou em "Pagar no Pix": o link já sai no valor do Pix (antes saía no valor do cartão,
  // com o desconto só dentro da tela da InfinitePay, e a família via R$ 377 em vez de R$ 350)
  [$st, $r] = z7_json_post(Z7_API_INFINITE . '/links', $base + [
    'items' => [['quantity' => 1, 'price' => $forma === 'pix' ? $pix : $cartao, 'description' => $desc]],
    'options' => $opcoes,
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
