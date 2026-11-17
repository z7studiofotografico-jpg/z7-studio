<?php
// Z7 Studio · os pagamentos do kit confirmados pela InfinitePay, para o app (só o administrador).
// GET → { pagamentos: [...] } (os que o app ainda não registrou)
// POST feito=<transação> → o app já marcou o aluno como Pago (o arquivo vira .feito e sai da lista)
require __DIR__ . '/pagamento-comum.php';
z7_cors();
z7_exigir('admin');
$pasta = z7_pasta_pagamentos();
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $t = substr(preg_replace('/[^A-Za-z0-9-]/', '', (string) ($_POST['feito'] ?? '')), 0, 60);
  if ($t && is_file("$pasta/$t.json")) rename("$pasta/$t.json", "$pasta/$t.json.feito");
  z7_resposta(200, ['ok' => true]);
}
$out = [];
foreach (glob($pasta . '/*.json') as $f) {
  $p = json_decode((string) file_get_contents($f), true);
  if (is_array($p)) $out[] = $p;
}
z7_resposta(200, ['pagamentos' => $out]);
