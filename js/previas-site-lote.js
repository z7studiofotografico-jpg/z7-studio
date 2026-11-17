// Prévias do colégio inteiro direto no site (17/11/2026). Na janela do colégio, aba Alunos, "📤 Enviar prévias
// para o site": o admin escolhe a pasta do colégio no servidor (uma pasta por aluno) e o app faz a prévia de cada
// aluno, igual ao gerador, e grava no site, já ligada ao aluno do app. Não precisa mais salvar no computador e
// arrastar para o Google Drive.
// Para reaproveitar o gerador (previas-lote.js) sem duplicar, o site faz o papel da "pasta de destino": a folha
// vai como "folha" e as fotos da pasta do aluno vão como "foto".
import { acharAluno } from "./drive-fotos.js";
import { enviarParaSite, apagarDoSite, listaDoSite, chaveAlunoSite, esquecerSite } from "./site-previas.js";

// liga cada pasta do servidor a um aluno do app (pelo número do ID e pelo nome): Map(pasta → aluno)
export function ligarPastas(pastas, alunosApp) {
  const itens = pastas.map(a => ({ name: a.nome, a }));
  const usadas = new Set();
  const out = new Map();
  alunosApp.forEach(st => {
    const f = acharAluno(
      itens.filter(x => !usadas.has(x.a)),
      st
    );
    if (f) {
      usadas.add(f.a);
      out.set(f.a, st);
    }
  });
  return out;
}

// quem já tem prévia no site (chaves dos alunos), por colégio do app
export async function jaNoSite(C, alunosApp) {
  esquecerSite();
  const tem = new Set();
  const escolas = [...new Set(alunosApp.map(st => st.escola + "|" + st.ano))];
  for (const e of escolas) {
    const [escola, ano] = e.split("|");
    try {
      const j = await listaDoSite(C, ano, escola);
      Object.keys(j.alunos || {}).forEach(k => tem.add(escola + "|" + k));
    } catch (_) {
      // sem a lista: segue (no pior caso, a prévia é enviada de novo)
    }
  }
  return st => tem.has(st.escola + "|" + chaveAlunoSite(st));
}

// a "pasta de destino" que grava no site. nomes[i] = o nome de saída do aluno alunos[i]; porAluno = Map(pasta → aluno)
export function pastaNoSite(C, alunos, nomes, porAluno, substituir = false) {
  const porNome = new Map(alunos.map((a, i) => [nomes[i], porAluno.get(a)]));
  const doNome = nome => {
    let ach = null;
    for (const [n, st] of porNome)
      if ((nome === n + ".jpg" || nome.startsWith(n + " - ")) && (!ach || n.length > ach[0].length)) ach = [n, st];
    return ach && ach[1];
  };
  const iniciado = new Set(),
    jaEnviado = new Set();
  // antes da 1ª foto do aluno nesta vez: apaga a prévia anterior (se for para substituir, ou se é uma nova tentativa)
  const antes = async st => {
    if (iniciado.has(st)) return;
    iniciado.add(st);
    if (substituir || jaEnviado.has(st)) await apagarDoSite(C, st).catch(() => {});
    jaEnviado.add(st);
  };
  const arquivo = (st, tipo) => ({
    createWritable: async () => {
      let blob = null;
      return {
        write: async b => (blob = b),
        close: async () => {
          if (!st) throw new Error("aluno não encontrado no app");
          await antes(st);
          await enviarParaSite(C, st, blob, tipo);
        }
      };
    }
  });
  return {
    name: "site do Z7",
    noSite: true,
    // o gerador chama no começo de cada aluno (e em cada nova tentativa)
    novaVez: nome => iniciado.delete(porNome.get(nome)),
    getDirectoryHandle: async nome => ({ name: nome, getFileHandle: async () => arquivo(porNome.get(nome), "foto") }),
    getFileHandle: async nome => arquivo(doNome(nome), "folha"),
    removeEntry: async nome => {
      const st = porNome.get(nome);
      if (st) await apagarDoSite(C, st).catch(() => {});
    }
  };
}
