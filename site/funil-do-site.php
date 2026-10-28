<?php
/**
 * Z7 Studio · Formulário do site → Funil do app
 *
 * Onde colar: WordPress → Snippets (plugin Code Snippets) → Adicionar novo
 *   Título: "Formulário do site no Funil"   ·   Tipo: PHP   ·   "Executar em todo lugar"   ·   Salvar e ativar.
 *
 * O que faz: toda vez que alguém envia um formulário do Contact Form 7 e o e-mail sai normalmente,
 * este código cria um "Novo lead" no Funil do app (origem "Site", contato para hoje, sem responsável).
 * Não muda o formulário nem o e-mail que vocês já recebem. Se o Funil estiver fora do ar, o site não trava.
 * Não guarda nenhuma senha: o Firebase só aceita, sem login, um lead novo do site com estes campos.
 */

if (!function_exists('z7_sem_acento')) {
	function z7_sem_acento($s) {
		$de = ['á','à','â','ã','ä','é','è','ê','ë','í','ì','î','ï','ó','ò','ô','õ','ö','ú','ù','û','ü','ç','ñ',
		       'Á','À','Â','Ã','Ä','É','È','Ê','Ë','Í','Ì','Î','Ï','Ó','Ò','Ô','Õ','Ö','Ú','Ù','Û','Ü','Ç','Ñ'];
		$pa = ['a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o','u','u','u','u','c','n',
		       'A','A','A','A','A','E','E','E','E','I','I','I','I','O','O','O','O','O','U','U','U','U','C','N'];
		return str_replace($de, $pa, (string) $s);
	}
}

// Monta o lead a partir dos campos do formulário (os nomes dos campos variam: acha pelo jeito do nome)
if (!function_exists('z7_lead_do_formulario')) {
	function z7_lead_do_formulario(array $d, $titulo_form, $hoje, $agora) {
		$pega = function ($re) use ($d) {
			foreach ($d as $k => $v) {
				if (strpos((string) $k, '_') === 0) continue; // campos internos do Contact Form 7
				if (!preg_match($re, (string) $k)) continue;
				$v = is_array($v) ? implode(', ', $v) : (string) $v;
				$v = trim(preg_replace('/\s+/u', ' ', strip_tags($v)));
				if ($v !== '') return $v;
			}
			return '';
		};
		$corta = function ($s, $n) { return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n); };
		$nome  = $corta($pega('/nome|name/i'), 120);
		$tel   = $corta($pega('/tel|fone|phone|whats|celular|contato/i'), 30);
		$email = $corta(strtolower($pega('/mail/i')), 120);
		$msg   = $pega('/mensag|message|^text|assunto|duvida|obs|coment/i'); // (no formulário de contato do site: "text")
		$serv0 = $pega('/servi|ensaio|tipo|interesse/i');
		if ($nome === '' && $tel === '' && $email === '') return null; // formulário sem contato: não cria lead

		// serviço no mesmo nome do app
		$s = strtolower(z7_sem_acento($serv0 . ' ' . $titulo_form . ' ' . $msg));
		if (preg_match('/corporat|empresa|linkedin/', $s)) $servico = 'Corporativo';
		elseif (preg_match('/turma|colegio|escola|formandos/', $s)) $servico = 'Turma';
		elseif (preg_match('/extern/', $s)) $servico = 'Formatura individual (externo)';
		elseif (preg_match('/estudio|formatura/', $s)) $servico = 'Formatura individual (estúdio)';
		elseif (preg_match('/retrato/', $s)) $servico = 'Retrato';
		else $servico = 'Outro';

		$notas = trim(implode("\n", array_filter([
			'Pelo site' . ($titulo_form ? ' (' . $titulo_form . ')' : '') . '.',
			$serv0 !== '' ? 'Interesse: ' . $serv0 : '',
			$msg !== '' ? 'Mensagem: ' . $msg : '',
			$email !== '' ? 'E-mail: ' . $email : '',
		])));
		$nomeFinal = $nome !== '' ? $nome : 'Contato do site';
		return [
			'nome'         => $nomeFinal,
			'telefone'     => $tel,
			'email'        => $email,
			'servico'      => $servico,
			'origem'       => 'Site',
			'etapa'        => 'NOVO LEAD',
			'followup'     => $hoje,
			'notas'        => $corta($notas, 1500),
			'resp'         => '',
			'respEmail'    => '',
			'nomeBusca'    => $corta(trim(preg_replace('/\s+/', ' ', strtoupper(z7_sem_acento($nomeFinal)))), 120),
			'criadoEm'     => $agora,
			'atualizadoEm' => $agora,
			'tentativas'   => 0,
			'valor'        => 0,
		];
	}
}

// Formato que a API do Firebase espera
if (!function_exists('z7_campos_firestore')) {
	function z7_campos_firestore(array $lead) {
		$f = [];
		foreach ($lead as $k => $v) $f[$k] = is_int($v) ? ['integerValue' => (string) $v] : ['stringValue' => (string) $v];
		return ['fields' => $f];
	}
}

if (function_exists('add_action')) {
	add_action('wpcf7_mail_sent', function ($form) {
		if (!class_exists('WPCF7_Submission')) return;
		$sub = WPCF7_Submission::get_instance();
		if (!$sub) return;
		$lead = z7_lead_do_formulario(
			(array) $sub->get_posted_data(),
			is_object($form) && method_exists($form, 'title') ? (string) $form->title() : '',
			wp_date('Y-m-d'),
			gmdate('Y-m-d\TH:i:s.000\Z')
		);
		if (!$lead) return;
		wp_remote_post(
			'https://firestore.googleapis.com/v1/projects/z7-funil-e-repasse/databases/(default)/documents/leads?key=AIzaSyAoUcT2xsFR0BMBr7jKAzXPlgjogx2VSHU',
			[
				'headers'  => ['Content-Type' => 'application/json'],
				'body'     => wp_json_encode(z7_campos_firestore($lead)),
				'timeout'  => 8,
				'blocking' => false, // não segura o envio do formulário esperando o Firebase
			]
		);
	});
}
