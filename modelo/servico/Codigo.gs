/**
 * ONS · EI · Workbook do encontro extra (Missão e visão 2028)
 * Serviço que grava e devolve as respostas de cada participante na planilha da turma.
 * Implantação: Implantar > Nova implantação > App da Web; executar como: eu; acesso: qualquer pessoa.
 * Atualização: Implantar > Gerenciar implantações > editar > Nova versão (o endereço não muda).
 */
var PLANILHA_ID = 'ID_DA_PLANILHA_PRIVADA_DA_TURMA';
var ABA_PART = 'Participantes';
var CAB_PART = ['E-mail', 'Nome', 'Código (protegido)', 'Sessão', 'Primeiro acesso', 'Último acesso', 'Tentativas sem sucesso'];
var ENCONTROS = {1: 'Encontro 1 · dd-mm', 2: 'Encontro 2 · dd-mm'};   // uma aba por encontro
var NOME_ENC = {};
var SAL = 'SAL-PROPRIO-DA-TURMA';

function doGet() { return saida({ok: true, servico: 'ons-ei-workbook'}); }

function doPost(e) {
  var trava = LockService.getScriptLock();
  try {
    trava.waitLock(25000);
    var req = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    if (req.acao === 'entrar') return saida(entrar(ss, req));
    if (req.acao === 'chave') return saida(enviarChave());
    if (req.acao === 'painel' || req.acao === 'responder') {
      if (!admin(req)) return saida({ok: false, erro: 'chave'});
      return saida(req.acao === 'painel' ? painel(ss) : responder(ss, req));
    }
    var p = autenticar(ss, req);
    if (!p) return saida({ok: false, erro: 'sessao'});
    if (req.acao === 'imagem') return saida(pedirImagem(ss, p, req, trava));
    if (req.acao === 'imagem_ver') return saida(verImagem(ss, p, req));
    if (req.acao === 'carregar') return saida(carregar(ss, p, req));
    if (req.acao === 'salvar') return saida(salvar(ss, p, req));
    if (req.acao === 'mapa') return saida(mapa(ss, p));
    if (req.acao === 'duvida') return saida(registrarDuvida(ss, p, req));
    if (req.acao === 'duvidas') return saida(minhasDuvidas(ss, p));
    if (req.acao === 'pendentes') return saida(pendentes(ss, p));
    if (req.acao === 'lidas') return saida(marcarLidas(ss, p, req));
    return saida({ok: false, erro: 'acao'});
  } catch (err) {
    return saida({ok: false, erro: 'servico', detalhe: String(err).slice(0, 200)});
  } finally {
    try { trava.releaseLock(); } catch (x) {}
  }
}

function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function agora() { return Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'); }
function normEmail(s) { return String(s || '').trim().toLowerCase(); }
function hash(email, codigo) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SAL + '|' + email + '|' + codigo, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function seguro(v) { v = String(v == null ? '' : v).slice(0, 20000); return /^[=+\-@]/.test(v) ? "'" + v : v; }

function abaPart(ss) {
  var a = ss.getSheetByName(ABA_PART);
  if (!a) {
    var p = ss.getSheets()[0];
    if (p && String(p.getRange(1, 1).getValue()) === 'E-mail') { a = p; a.setName(ABA_PART); }
    else { a = ss.insertSheet(ABA_PART, 0); }
    a.getRange(1, 1, 1, CAB_PART.length).setValues([CAB_PART]).setFontWeight('bold').setBackground('#2A211C').setFontColor('#FBEEE5');
    a.setFrozenRows(1); a.hideColumns(3, 2); a.setColumnWidth(1, 300); a.setColumnWidth(2, 220);
  }
  return a;
}

function linhaDe(aba, email, primeira) {
  var n = aba.getLastRow();
  if (n < primeira) return 0;
  var col = aba.getRange(primeira, 1, n - primeira + 1, 1).getValues();
  for (var i = 0; i < col.length; i++) if (normEmail(col[i][0]) === email) return primeira + i;
  return 0;
}

function entrar(ss, req) {
  var email = normEmail(req.email), codigo = String(req.codigo || '').trim(), nome = String(req.nome || '').trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return {ok: false, erro: 'email'};
  if (!/^\d{4}$/.test(codigo)) return {ok: false, erro: 'codigo_formato'};
  var a = abaPart(ss), r = linhaDe(a, email, 2), h = hash(email, codigo);
  if (!r) {
    var tk = Utilities.getUuid();
    a.appendRow([email, seguro(nome), h, tk, agora(), agora(), 0]);
    return {ok: true, token: tk, nome: nome, novo: true, instrutor: email === normEmail(AVISO)};
  }
  var v = a.getRange(r, 1, 1, CAB_PART.length).getValues()[0];
  var falhas = Number(v[6] || 0);
  if (falhas >= 8) return {ok: false, erro: 'bloqueado'};
  if (!v[2]) { a.getRange(r, 3).setValue(h); v[2] = h; }
  if (v[2] !== h) { a.getRange(r, 7).setValue(falhas + 1); return {ok: false, erro: 'codigo'}; }
  var token = v[3] || Utilities.getUuid();
  if (nome && !v[1]) a.getRange(r, 2).setValue(seguro(nome));
  a.getRange(r, 4, 1, 4).setValues([[token, v[4] || agora(), agora(), 0]]);
  return {ok: true, token: token, nome: v[1] || nome, novo: false, instrutor: email === normEmail(AVISO)};
}

function autenticar(ss, req) {
  var email = normEmail(req.email), tk = String(req.token || '');
  if (!email || !tk) return null;
  var a = abaPart(ss), r = linhaDe(a, email, 2);
  if (!r) return null;
  var v = a.getRange(r, 1, 1, 4).getValues()[0];
  if (v[3] !== tk) return null;
  a.getRange(r, 6).setValue(agora());
  return {email: email, nome: v[1], linha: r};
}

function abaEnc(ss, n) {
  var nome = ENCONTROS[n];
  if (!nome) throw new Error('encontro');
  var a = ss.getSheetByName(nome);
  if (!a) {
    a = ss.insertSheet(nome);
    a.getRange(1, 1, 2, 3).setValues([['E-mail', 'Nome', 'Atualizado em'], ['email', 'nome', 'atualizado']]);
    a.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#2A211C').setFontColor('#FBEEE5');
    a.setFrozenRows(2); a.setFrozenColumns(2); a.hideRows(2);
  }
  return a;
}

function chaves(a) {
  var c = a.getLastColumn();
  var k = a.getRange(2, 1, 1, c).getValues()[0], m = {};
  for (var i = 0; i < k.length; i++) if (k[i]) m[k[i]] = i + 1;
  return m;
}

function carregar(ss, p, req) {
  var a = abaEnc(ss, Number(req.encontro)), r = linhaDe(a, p.email, 3), out = {};
  if (r) {
    var c = a.getLastColumn(), k = a.getRange(2, 1, 1, c).getValues()[0], v = a.getRange(r, 1, 1, c).getValues()[0];
    for (var i = 3; i < c; i++) if (k[i] && v[i] !== '') out[k[i]] = String(v[i]).replace(/^'/, '');
  }
  return {ok: true, respostas: out, nome: p.nome};
}

function salvar(ss, p, req) {
  var a = abaEnc(ss, Number(req.encontro)), resp = req.respostas || {}, rot = req.rotulos || {};
  var m = chaves(a), c = a.getLastColumn(), novas = [];
  Object.keys(resp).forEach(function (k) {
    if (!/^[\w.\-:]{1,80}$/.test(k)) return;
    if (!m[k]) { c += 1; m[k] = c; novas.push([c, k, String(rot[k] || k).slice(0, 200)]); }
  });
  novas.forEach(function (x) {
    a.getRange(1, x[0]).setValue(x[2]).setFontWeight('bold').setBackground('#2A211C').setFontColor('#FBEEE5').setWrap(true);
    a.getRange(2, x[0]).setValue(x[1]);
    a.setColumnWidth(x[0], 260);
  });
  var r = linhaDe(a, p.email, 3);
  if (!r) { r = Math.max(a.getLastRow() + 1, 3); a.getRange(r, 1, 1, 2).setValues([[p.email, p.nome || '']]); }
  Object.keys(resp).forEach(function (k) { if (m[k]) a.getRange(r, m[k]).setValue(seguro(resp[k])); });
  a.getRange(r, 3).setValue(agora());
  return {ok: true, gravado: agora()};
}

function mapa(ss, p) {
  var out = {};
  Object.keys(ENCONTROS).forEach(function (n) {
    var a = ss.getSheetByName(ENCONTROS[n]);
    if (!a) { out[n] = 0; return; }
    var r = linhaDe(a, p.email, 3);
    if (!r) { out[n] = 0; return; }
    var v = a.getRange(r, 4, 1, Math.max(a.getLastColumn() - 3, 1)).getValues()[0];
    out[n] = v.filter(function (x) { return String(x).trim() !== ''; }).length;
  });
  return {ok: true, mapa: out, nome: p.nome};
}

/** Executar uma vez, pelo editor, para criar as abas e autorizar o acesso à planilha. */
function preparar() {
  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  // A planilha nova pode nascer com outro fuso na API (America/Los_Angeles), mesmo com São Paulo na tela de configurações;
  // com fusos diferentes, os horários gravados voltam deslocados. O fuso fica fixado aqui.
  if (ss.getSpreadsheetTimeZone() !== 'America/Sao_Paulo') ss.setSpreadsheetTimeZone('America/Sao_Paulo');
  abaPart(ss);
  Object.keys(ENCONTROS).forEach(function (n) { abaEnc(ss, Number(n)); });
  var s1 = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
}


// ---------- Dúvidas: o participante pergunta, o mentor responde no painel ----------
var ABA_DUV = 'Dúvidas';
var CAB_DUV = ['ID', 'Recebida em', 'E-mail', 'Nome', 'Encontro', 'Atividade', 'Pergunta', 'Situação', 'Resposta', 'Respondida em', 'Lida em'];
var AVISO = 'EMAIL_DO_INSTRUTOR';   // recebe o aviso de cada dúvida e a chave do painel
var SITE = 'https://USUARIO.github.io/REPOSITORIO/';

function abaDuv(ss) {
  var a = ss.getSheetByName(ABA_DUV);
  if (!a) {
    a = ss.insertSheet(ABA_DUV);
    a.getRange(1, 1, 1, CAB_DUV.length).setValues([CAB_DUV]).setFontWeight('bold').setBackground('#2A211C').setFontColor('#FBEEE5');
    a.setFrozenRows(1); a.setColumnWidth(6, 260); a.setColumnWidth(7, 420); a.setColumnWidth(9, 420);
  } else if (String(a.getRange(1, CAB_DUV.length).getValue()) !== CAB_DUV[CAB_DUV.length - 1]) {
    a.getRange(1, CAB_DUV.length).setValue(CAB_DUV[CAB_DUV.length - 1]).setFontWeight('bold').setBackground('#2A211C').setFontColor('#FBEEE5');
  }
  return a;
}
// A planilha converte o texto 'dd/MM/yyyy HH:mm:ss' em data no fuso dela; a leitura devolve o mesmo horário, sem os segundos.
var FUSO_PLAN = null;
function dataTxt(x) {
  if (x instanceof Date) return Utilities.formatDate(x, FUSO_PLAN || 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  return String(x == null ? '' : x).replace(/^(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}):\d{2}$/, '$1');
}
function linhasDuv(a) {
  var n = a.getLastRow();
  if (n < 2) return [];
  if (!FUSO_PLAN) FUSO_PLAN = a.getParent().getSpreadsheetTimeZone();
  return a.getRange(2, 1, n - 1, CAB_DUV.length).getValues().map(function (v, i) {
    return {linha: i + 2, id: String(v[0]), recebida: dataTxt(v[1]), email: String(v[2]), nome: String(v[3]).replace(/^'/, ''), encontro: Number(v[4]),
            atividade: String(v[5]).replace(/^'/, ''), pergunta: String(v[6]).replace(/^'/, ''), situacao: String(v[7]),
            resposta: String(v[8]).replace(/^'/, ''), respondida: dataTxt(v[9]), lida: dataTxt(v[10])};
  });
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }

function registrarDuvida(ss, p, req) {
  var perg = String(req.pergunta || '').trim().slice(0, 3000), ativ = String(req.atividade || '').trim().slice(0, 200), enc = Number(req.encontro) || 0;
  if (perg.length < 3) return {ok: false, erro: 'pergunta'};
  var id = 'D' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var a = abaDuv(ss), quando = agora();
  a.appendRow([id, quando, p.email, seguro(p.nome || ''), enc, seguro(ativ), seguro(perg), 'Aguardando', '', '']);
  try {
    MailApp.sendEmail({to: AVISO, name: 'Workbook ONS · EI',
      subject: 'Workbook ONS · Nova dúvida de ' + (p.nome || p.email) + (ativ ? ' · ' + ativ : ''),
      htmlBody: '<p><b>' + esc(p.nome || p.email) + '</b> enviou uma dúvida' + (enc ? ' ' + (NOME_ENC[enc] || 'no Encontro ' + enc) : '') + (ativ ? ', na atividade <b>' + esc(ativ) + '</b>' : '') + ', às ' + quando + '.</p>' +
        '<blockquote style="border-left:4px solid #E5662C;margin:0;padding:8px 14px;background:#FBEFE4">' + esc(perg) + '</blockquote>' +
        '<p><a href="' + SITE + 'painel.html">Responder no painel de dúvidas</a></p>'});
  } catch (x) {}
  return {ok: true, id: id, recebida: quando};
}

function minhasDuvidas(ss, p) {
  var l = linhasDuv(abaDuv(ss)).filter(function (d) { return normEmail(d.email) === p.email; }).map(function (d) {
    return {id: d.id, recebida: d.recebida, encontro: d.encontro, atividade: d.atividade, pergunta: d.pergunta, situacao: d.situacao, resposta: d.resposta, respondida: d.respondida,
            lida: d.lida, nova: d.situacao === 'Respondida' && !d.lida};
  });
  return {ok: true, duvidas: l, naoLidas: l.filter(function (d) { return d.nova; }).length};
}

function chavePainel() {
  var pr = PropertiesService.getScriptProperties(), k = pr.getProperty('CHAVE_PAINEL');
  if (!k) {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 12; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
    k = s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
    pr.setProperty('CHAVE_PAINEL', k);
  }
  return k;
}
function admin(req) {
  var cache = CacheService.getScriptCache(), f = Number(cache.get('falhas_painel') || 0);
  if (f >= 20) return false;
  var ok = String(req.chave || '').trim().toUpperCase() === chavePainel();
  if (!ok) cache.put('falhas_painel', String(f + 1), 900);
  return ok;
}
function enviarChave() {
  var cache = CacheService.getScriptCache();
  if (cache.get('chave_enviada')) return {ok: true, enviada: false, espera: true};
  var k = chavePainel();
  MailApp.sendEmail({to: AVISO, name: 'Workbook ONS · EI', subject: 'Workbook ONS · Chave do painel de dúvidas',
    htmlBody: '<p>A chave do painel de dúvidas do workbook é <b style="font-size:18px;letter-spacing:2px">' + k + '</b>.</p><p><a href="' + SITE + 'painel.html">Abrir o painel</a></p>'});
  cache.put('chave_enviada', '1', 600);
  return {ok: true, enviada: true};
}

// Avisos do menu. Participante: respostas ainda não lidas. Instrutor: também a contagem de dúvidas aguardando.
// Ler e responder as dúvidas da turma continua exigindo a chave do painel.
function pendentes(ss, p) {
  var l = linhasDuv(abaDuv(ss));
  var nl = l.filter(function (d) { return normEmail(d.email) === p.email && d.situacao === 'Respondida' && !d.lida; }).length;
  if (p.email !== normEmail(AVISO)) return {ok: true, instrutor: false, naoLidas: nl};
  return {ok: true, instrutor: true, n: l.filter(function (d) { return d.situacao !== 'Respondida'; }).length, naoLidas: nl};
}

// Leitura: o participante registra como lidas as respostas que apareceram na aba Dúvidas enviadas.
function marcarLidas(ss, p, req) {
  var ids = (req.ids || []).slice(0, 200).map(String), a = abaDuv(ss), quando = agora(), n = 0;
  linhasDuv(a).forEach(function (d) {
    if (ids.indexOf(d.id) >= 0 && normEmail(d.email) === p.email && d.situacao === 'Respondida' && !d.lida) {
      a.getRange(d.linha, CAB_DUV.length).setValue(quando); n++;
    }
  });
  return {ok: true, marcadas: n, lida: quando};
}

function painel(ss) {
  var l = linhasDuv(abaDuv(ss)).reverse();
  return {ok: true, duvidas: l.map(function (d) { delete d.linha; return d; }), agora: agora()};
}

function responder(ss, req) {
  var id = String(req.id || ''), resp = String(req.resposta || '').trim().slice(0, 6000);
  if (!id || resp.length < 2) return {ok: false, erro: 'resposta'};
  var a = abaDuv(ss), d = linhasDuv(a).filter(function (x) { return x.id === id; })[0];
  if (!d) return {ok: false, erro: 'id'};
  var quando = agora();
  a.getRange(d.linha, 8, 1, 4).setValues([['Respondida', seguro(resp), quando, '']]);
  var enviado = false;
  try {
    var nome1 = (d.nome || '').split(' ')[0] || 'Olá';
    MailApp.sendEmail({to: d.email, name: 'Gino Terentim', replyTo: AVISO,
      subject: 'Workbook ONS · Resposta à sua dúvida' + (d.atividade ? ': ' + d.atividade : ''),
      htmlBody: '<p>' + esc(nome1) + ',</p><p>Esta é a resposta à dúvida que você enviou' + (d.encontro ? ' ' + (NOME_ENC[d.encontro] || 'no Encontro ' + d.encontro) : '') + (d.atividade ? ', na atividade <b>' + esc(d.atividade) + '</b>' : '') + '.</p>' +
        '<p style="color:#6E6259"><b>A sua dúvida</b><br>' + esc(d.pergunta) + '</p>' +
        '<div style="border-left:4px solid #E5662C;padding:8px 14px;background:#FBEFE4">' + esc(resp) + '</div>' +
        '<p>A resposta também está no seu workbook, junto da atividade: <a href="' + SITE + (d.encontro ? 'e' + d.encontro + '.html' : '') + '">abrir o workbook</a>.</p>' +
        '<p>Um abraço,<br>Gino Terentim</p>'});
    enviado = true;
  } catch (x) {}
  return {ok: true, respondida: quando, email: enviado};
}


// ---------- A história do futuro em imagem: o Claude lê a história e escreve o pedido; o modelo de imagem da OpenAI desenha ----------
// As chaves ficam nas propriedades do script (ANTHROPIC_API_KEY e OPENAI_API_KEY), cadastradas pelo instrutor; nunca no código.
var MODELOS_TEXTO = ['claude-sonnet-5-5', 'claude-haiku-4-5-20251001'];
var MODELOS_IMAGEM = ['gpt-image-2.6-flare', 'gpt-image-2.5-flare'];
var LIM_IMG = 3;                                   // versões por pessoa e por tipo (história individual e história da sala)
var PASTA_IMG = 'ONS EI · Workbook · Imagens do futuro';
var ABA_IMG = 'Imagens';
var CAB_IMG = ['Quando', 'E-mail', 'Nome', 'Tipo', 'Cena', 'Arquivo', 'Situação'];
var SISTEMA_VISAO = [
  'Você é diretor de arte de um trabalho de visão de futuro com a Gerência Executiva de Estratégia e Inovação (EI) do ONS,',
  'o Operador Nacional do Sistema Elétrico brasileiro. Recebe a história que uma pessoa (ou uma sala) escreveu sobre a EI em 2028,',
  'no presente, como quem já está lá. Transforme a história numa única cena, a mais reveladora do estado futuro que ela descreve.',
  'Leia com atenção: lugar, momento do dia, quem está presente (sempre pelo papel), o que acontece, os objetos e sinais do que mudou',
  'em relação a hoje, o clima humano. Escolha os detalhes concretos da própria história; não invente um enredo diferente.',
  'Escreva o pedido para o modelo de imagem, em inglês, com: a cena e a ação; as pessoas (profissionais brasileiros diversos,',
  'sem semelhança com pessoas reais); o ambiente (sala de controle do sistema elétrico, escritório, campo, linhas de transmissão,',
  'conforme a história); a luz; o enquadramento amplo, horizontal; estilo de fotografia documental, natural, crível e otimista.',
  'Proibido na imagem: texto, letras, números legíveis, logotipos, marcas, bandeiras, uniformes com nome, rostos de pessoas reais,',
  'robôs humanoides, cérebros brilhantes, hologramas de ficção científica e outros clichês de tecnologia.',
  'Se houver um pedido de ajuste, aplique-o à mesma cena.',
  'Responda só com JSON: {"cena": "<a cena em uma frase, em português>", "prompt": "<o pedido em inglês, até 120 palavras>"}.'
].join(' ');

function chaveIA(nome) {
  var k = PropertiesService.getScriptProperties().getProperty(nome);
  if (!k) throw new Error('sem_chave');
  return k;
}

function abaImg(ss) {
  var a = ss.getSheetByName(ABA_IMG);
  if (!a) {
    a = ss.insertSheet(ABA_IMG);
    a.getRange(1, 1, 1, CAB_IMG.length).setValues([CAB_IMG]).setFontWeight('bold').setBackground('#2A211C').setFontColor('#FBEEE5');
    a.setFrozenRows(1); a.setColumnWidth(5, 420);
  }
  return a;
}

function imagensDe(ss, email, tipo) {
  var a = abaImg(ss), n = a.getLastRow();
  if (n < 2) return [];
  return a.getRange(2, 1, n - 1, CAB_IMG.length).getValues().filter(function (v) {
    return normEmail(v[1]) === email && String(v[3]) === tipo && String(v[6]) === 'ok';
  });
}

function pedirImagem(ss, p, req, trava) {
  var tipo = req.tipo === 'sala' ? 'sala' : 'historia';
  var texto = String(req.texto || '').trim().slice(0, 8000), ajuste = String(req.ajuste || '').trim().slice(0, 300);
  if (texto.length < 120) return {ok: false, erro: 'curta'};
  var feitas = imagensDe(ss, p.email, tipo).length;
  if (feitas >= LIM_IMG) return {ok: false, erro: 'limite', restantes: 0};
  try { chaveIA('ANTHROPIC_API_KEY'); chaveIA('OPENAI_API_KEY'); } catch (x) { return {ok: false, erro: 'sem_chave'}; }
  // As chamadas externas levam até um minuto: a trava é liberada para não atrasar a gravação das respostas dos demais.
  trava.releaseLock();
  var cena, b64;
  try {
    cena = cenaDaHistoria(texto, ajuste, tipo);
    b64 = desenhar(cena.prompt);
  } catch (err) {
    trava.waitLock(25000);
    var motivo = String(err).replace(/sk-[\w\-\*\.]+/g, 'sk-…').slice(0, 300);
    abaImg(ss).appendRow([agora(), p.email, seguro(p.nome || ''), tipo, seguro(motivo), '', 'falha']);
    return {ok: false, erro: /tempo|timeout|Timeout/.test(motivo) ? 'tempo' : (/sem_chave/.test(motivo) ? 'sem_chave' : 'imagem')};
  }
  var nome = (tipo === 'sala' ? 'Sala' : 'Historia') + ' · ' + (p.nome || p.email) + ' · ' + Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd-MM HH.mm') + '.jpg';
  var arq = pastaImg().createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', nome));
  trava.waitLock(25000);
  abaImg(ss).appendRow([agora(), p.email, seguro(p.nome || ''), tipo, seguro(cena.cena || ''), arq.getId(), 'ok']);
  return {ok: true, img: 'data:image/jpeg;base64,' + b64, cena: cena.cena || '', restantes: LIM_IMG - feitas - 1};
}

function verImagem(ss, p, req) {
  var tipo = req.tipo === 'sala' ? 'sala' : 'historia';
  var l = imagensDe(ss, p.email, tipo);
  if (!l.length) return {ok: true, img: '', restantes: LIM_IMG};
  var ult = l[l.length - 1];
  try {
    var b = DriveApp.getFileById(String(ult[5])).getBlob();
    return {ok: true, img: 'data:image/jpeg;base64,' + Utilities.base64Encode(b.getBytes()), cena: String(ult[4]).replace(/^'/, ''), restantes: Math.max(LIM_IMG - l.length, 0)};
  } catch (x) {
    return {ok: true, img: '', restantes: Math.max(LIM_IMG - l.length, 0)};
  }
}

function pastaImg() {
  var it = DriveApp.getFoldersByName(PASTA_IMG);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_IMG);
}

function cenaDaHistoria(texto, ajuste, tipo) {
  var msg = (tipo === 'sala' ? 'A história comum de uma sala' : 'A história de uma pessoa') + ', sobre a EI em 2028:\n\n' + texto +
            (ajuste ? '\n\nPedido de ajuste: ' + ajuste : '');
  var ult = '';
  for (var i = 0; i < MODELOS_TEXTO.length; i++) {
    var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: {'x-api-key': chaveIA('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01'},
      payload: JSON.stringify({model: MODELOS_TEXTO[i], max_tokens: 800, system: SISTEMA_VISAO, messages: [{role: 'user', content: msg}]})});
    var c = r.getResponseCode();
    if (c === 200) {
      var t = JSON.parse(r.getContentText()).content.map(function (x) { return x.text || ''; }).join('');
      var m = t.match(/\{[\s\S]*\}/);
      var j = JSON.parse(m ? m[0] : t);
      if (!j.prompt) throw new Error('claude_sem_prompt');
      return j;
    }
    ult = 'claude_' + c + ' ' + r.getContentText().slice(0, 200);
    if (c !== 404 && c !== 400) break;
  }
  throw new Error(ult);
}

function desenhar(prompt) {
  var ult = '';
  for (var i = 0; i < MODELOS_IMAGEM.length; i++) {
    var r = UrlFetchApp.fetch('https://api.openai.com/v1/images/generations', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: {Authorization: 'Bearer ' + chaveIA('OPENAI_API_KEY')},
      payload: JSON.stringify({model: MODELOS_IMAGEM[i], prompt: prompt, size: '1536x1024', quality: 'medium', output_format: 'jpeg',
                               output_compression: 82, n: 1})});
    var c = r.getResponseCode();
    if (c === 200) return JSON.parse(r.getContentText()).data[0].b64_json;
    ult = 'imagem_' + c + ' ' + r.getContentText().slice(0, 200);
    if (c !== 404 && c !== 400) break;
  }
  throw new Error(ult);
}

/** Executar uma vez, pelo editor, depois de colar esta versão: pede a autorização para a internet e o Drive. */
function autorizar() {
  pastaImg();
  UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {muteHttpExceptions: true});
  abaImg(SpreadsheetApp.openById(PLANILHA_ID));
  Logger.log('Autorização concluída.');
}

/** Executar pelo editor, depois de cadastrar as chaves: gera uma imagem de teste, sem gravar na planilha. */
function testarImagem() {
  var t0 = Date.now();
  var cena = cenaDaHistoria('É uma manhã de março de 2028. Na sala de reuniões da EI, a equipe abre o painel que reúne os ' +
    'projetos de inovação do ONS. Uma analista mostra à diretoria como o estudo de armazenamento de energia antecipou uma ' +
    'decisão de expansão. Ninguém precisa mais montar planilhas na véspera: os dados chegam sozinhos.', '', 'historia');
  var t1 = Date.now();
  var b64 = desenhar(cena.prompt);
  Logger.log('Cena: ' + cena.cena + ' | Claude ' + Math.round((t1 - t0) / 1000) + ' s | imagem ' + Math.round((Date.now() - t1) / 1000) + ' s | ' + Math.round(b64.length / 1024) + ' KB');
}
