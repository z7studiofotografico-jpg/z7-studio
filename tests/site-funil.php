<?php
// Teste do código do site (rode: php tests/site-funil.php). Falha = sai com erro.
require __DIR__ . '/../site/funil-do-site.php';
$falhas = 0;
$ok = function ($c, $msg) use (&$falhas) { echo ($c ? "  ✓ " : "  ✗ ") . $msg . "\n"; if (!$c) $falhas++; };
$l = z7_lead_do_formulario(
	['_wpcf7' => '12', 'your-name' => '  Érica   Souza ', 'your-email' => 'Erica@Mail.com', 'telefone' => '(21) 98888-7777',
	 'servico' => ['Ensaio externo'], 'your-message' => "Quero orçamento\npara dezembro"],
	'Contato', '2026-10-28', '2026-10-28T12:00:00.000Z'
);
$ok($l['nome'] === 'Érica Souza' && $l['nomeBusca'] === 'ERICA SOUZA', 'nome limpo e nome de busca sem acento');
$ok($l['telefone'] === '(21) 98888-7777' && $l['email'] === 'erica@mail.com', 'telefone e e-mail');
$ok($l['servico'] === 'Formatura individual (externo)', 'serviço do app: externo');
$ok($l['origem'] === 'Site' && $l['etapa'] === 'NOVO LEAD' && $l['followup'] === '2026-10-28' && $l['resp'] === '' && $l['respEmail'] === '', 'lead novo do site, contato para hoje, sem responsável');
$ok(strpos($l['notas'], 'Mensagem: Quero orçamento para dezembro') !== false && strpos($l['notas'], 'E-mail: erica@mail.com') !== false, 'mensagem e e-mail nas notas');
$c = z7_lead_do_formulario(['nome' => 'Ana', 'whatsapp' => '21 9', 'empresa' => 'X'], 'Orçamento corporativo', '2026-10-28', 'x');
$ok($c['servico'] === 'Corporativo', 'formulário corporativo vira Corporativo');
$ok(z7_lead_do_formulario(['_wpcf7' => '1', 'aceite' => '1'], '', '2026-10-28', 'x') === null, 'formulário sem contato não cria lead');
$f = z7_campos_firestore($l);
$ok($f['fields']['valor'] === ['integerValue' => '0'] && $f['fields']['nome'] === ['stringValue' => 'Érica Souza'], 'formato da API do Firebase');
// formulário de contato do site hoje: name-p, mail, text
$k = z7_lead_do_formulario(['_wpcf7' => '5', 'name-p' => 'Rita Lima', 'mail' => 'rita@x.com', 'text' => 'Quero um ensaio corporativo'], 'Contato', '2026-10-28', 'x');
$ok($k['nome'] === 'Rita Lima' && $k['email'] === 'rita@x.com' && strpos($k['notas'], 'Mensagem: Quero um ensaio corporativo') !== false && $k['servico'] === 'Corporativo', 'formulário de contato do site (name-p, mail, text)');
$ok(count($l) === 15, 'só os 15 campos que as regras aceitam');
echo $falhas ? "$falhas falha(s)\n" : "Tudo certo\n";
exit($falhas ? 1 : 0);
