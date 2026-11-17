<?php
// Z7 Studio · recebe a prévia de um aluno (só o administrador), direto no site, sem passar pelo Google Drive.
// POST multipart: ano, escola, codigo, nome, chave, tipo ("folha" | "foto"), arquivo (JPG, até 3 MB)
// Responde { url } com o endereço da foto no site.
require __DIR__ . '/comum.php';
z7_cors();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') z7_resposta(405, ['erro' => 'Use POST.']);
z7_exigir('admin');

$ano = (string) ($_POST['ano'] ?? '');
$escola = trim((string) ($_POST['escola'] ?? ''));
$nome = trim((string) ($_POST['nome'] ?? ''));
$codigo = trim((string) ($_POST['codigo'] ?? ''));
$tipo = ($_POST['tipo'] ?? '') === 'folha' ? 'folha' : 'foto';
if ($escola === '' || $nome === '') z7_resposta(400, ['erro' => 'Falta o colégio ou o nome do aluno.']);
$f = $_FILES['arquivo'] ?? null;
if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) z7_resposta(400, ['erro' => 'A foto não chegou. Tente de novo.']);
if ($f['size'] > 3 * 1024 * 1024) z7_resposta(413, ['erro' => 'Foto grande demais (até 3 MB).']);
$info = @getimagesize($f['tmp_name']);
if (!$info || $info[2] !== IMAGETYPE_JPEG) z7_resposta(415, ['erro' => 'Só JPG.']);

z7_proteger();
$pasta = z7_pasta_colegio($ano, $escola);
// a chave do aluno vem pronta do app (a mesma que ele procura depois); se faltar, faz aqui
$chaveAluno = (string) ($_POST['chave'] ?? '');
if (!preg_match('/^[A-Z0-9-]{1,40}$/', $chaveAluno)) $chaveAluno = $codigo !== '' ? z7_chave($codigo, 30) : z7_chave($nome, 40);
$feito = null;
z7_indice_mudar($pasta, function ($j) use ($chaveAluno, $nome, $codigo, $escola, $ano, $tipo, $f, $pasta, &$feito) {
  $j['escola'] = $escola;
  $j['ano'] = $ano;
  $a = $j['alunos'][$chaveAluno] ?? null;
  if (!$a) {
    // a pasta do aluno leva um código aleatório: ninguém acha as fotos só sabendo o nome
    $a = ['nome' => $nome, 'codigo' => $codigo, 'pasta' => $chaveAluno . '-' . bin2hex(random_bytes(5)), 'folhas' => [], 'fotos' => []];
  }
  $a['nome'] = $nome;
  $a['codigo'] = $codigo;
  $dir = $pasta . '/' . $a['pasta'];
  if (!is_dir($dir)) mkdir($dir, 0755, true);
  $lista = $tipo === 'folha' ? 'folhas' : 'fotos';
  $n = count($a[$lista]) + 1;
  $arquivo = ($tipo === 'folha' ? 'folha-' : 'foto-') . str_pad((string) $n, 2, '0', STR_PAD_LEFT) . '.jpg';
  if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $arquivo)) return $j;
  $a[$lista][] = $arquivo;
  $a['em'] = gmdate('c');
  $j['alunos'][$chaveAluno] = $a;
  $feito = substr($dir, strlen(dirname(__DIR__))) . '/' . $arquivo;
  return $j;
});
if (!$feito) z7_resposta(500, ['erro' => 'Não consegui gravar a foto no site.']);
z7_resposta(200, ['url' => 'https://z7studio.com.br' . $feito]);
