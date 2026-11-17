<?php
// Z7 Studio · as prévias de um colégio que estão no site (a equipe logada no app).
// GET ?ano=2026&escola=CIEP 433 → { escola, ano, alunos: { chave: { nome, codigo, folhas: [url], fotos: [url] } } }
// POST (só admin) apagar=1&ano&escola&aluno=<chave> → tira o aluno da lista e apaga as fotos dele (enviar de novo).
require __DIR__ . '/comum.php';
z7_cors();
$apagar = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && ($_POST['apagar'] ?? '') === '1';
z7_exigir($apagar ? 'admin' : 'equipe');
$ano = (string) ($apagar ? ($_POST['ano'] ?? '') : ($_GET['ano'] ?? ''));
$escola = (string) ($apagar ? ($_POST['escola'] ?? '') : ($_GET['escola'] ?? ''));
if (trim($escola) === '') z7_resposta(400, ['erro' => 'Falta o colégio.']);
$pasta = z7_pasta_colegio($ano, $escola);
$base = 'https://z7studio.com.br' . substr($pasta, strlen(dirname(__DIR__)));

if ($apagar) {
  $chave = (string) ($_POST['aluno'] ?? '');
  z7_indice_mudar($pasta, function ($j) use ($chave, $pasta) {
    $a = $j['alunos'][$chave] ?? null;
    if ($a && preg_match('/^[A-Z0-9-]+$/', $a['pasta'])) {
      foreach (glob($pasta . '/' . $a['pasta'] . '/*.jpg') as $f) @unlink($f);
      @rmdir($pasta . '/' . $a['pasta']);
    }
    unset($j['alunos'][$chave]);
    return $j;
  });
  z7_resposta(200, ['ok' => true]);
}

$j = z7_indice_ler($pasta);
$out = ['escola' => $j['escola'] ?? $escola, 'ano' => $j['ano'] ?? $ano, 'alunos' => []];
foreach (($j['alunos'] ?? []) as $k => $a) {
  $url = function ($n) use ($base, $a) { return $base . '/' . $a['pasta'] . '/' . $n; };
  $out['alunos'][$k] = [
    'nome' => $a['nome'] ?? '',
    'codigo' => $a['codigo'] ?? '',
    'folhas' => array_map($url, $a['folhas'] ?? []),
    'fotos' => array_map($url, $a['fotos'] ?? []),
    'em' => $a['em'] ?? '',
  ];
}
z7_resposta(200, $out);
