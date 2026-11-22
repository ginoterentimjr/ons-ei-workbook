# -*- coding: utf-8 -*-
"""Gera o workbook digital do encontro extra de missão e visão · Workshop EI · ONS (30/11/2026).
   python3 build.py            -> site do participante em docs/
   python3 build.py professor  -> arquivo único da versão do professor em professor/
"""
import sys, os, base64, html, json, shutil

RAIZ0 = os.path.dirname(os.path.abspath(__file__))
_c = json.load(open(os.path.join(RAIZ0, "conteudo.json"), encoding="utf-8"))
ENCONTROS, CAMINHO, PREP = _c["encontros"], _c["caminho"], _c.get("preparacao")
_n = os.path.join(RAIZ0, "professor_notas.json")
if os.path.exists(_n):
    _notas = json.load(open(_n, encoding="utf-8"))
    for _e in ENCONTROS + ([PREP] if PREP else []):
        for _b in _e["blocos"]:
            for _i in _b["itens"]:
                _i.update(_notas.get(_i.get("id"), {}))

PROF = len(sys.argv) > 1 and sys.argv[1] == "professor"
REPO = "https://github.com/ginoterentimjr/ons-ei-workbook"
TITULO = "Encontro extra EI"
RAIZ = os.path.dirname(os.path.abspath(__file__))
CSS = open(os.path.join(RAIZ, "src", "estilo.css"), encoding="utf-8").read()
JS = "\n".join(open(os.path.join(RAIZ, "src", f), encoding="utf-8").read() for f in ("app.js", "conta.js", "duvidas.js", "imagem.js"))
PAINEL_JS = open(os.path.join(RAIZ, "src", "painel.js"), encoding="utf-8").read()
API = open(os.path.join(RAIZ, "api.txt"), encoding="utf-8").read().strip() if os.path.exists(os.path.join(RAIZ, "api.txt")) else ""
ICON_DIR = os.path.join(RAIZ, "src", "icons")

def img_url(nome):
    """Endereço da imagem: arquivo no site, embutida na versão do professor."""
    if PROF:
        return "data:image/jpeg;base64," + base64.b64encode(open(os.path.join(RAIZ, "src", "img", nome), "rb").read()).decode()
    return f"img/{nome}"


def icone(nome, cor="#FFFFFF", tam=28, sw=1.8):
    import re as _re
    t = open(os.path.join(ICON_DIR, nome + ".svg"), encoding="utf-8").read()
    t = _re.sub(r"<!--.*?-->", "", t, flags=_re.S)
    t = t.replace('width="24"', f'width="{tam}"', 1).replace('height="24"', f'height="{tam}"', 1)
    return t.replace('stroke="currentColor"', f'stroke="{cor}"').replace('stroke-width="2"', f'stroke-width="{sw}"').replace("\n", "")

IC_BLOCO = {"Abertura e resgate": "door-open", "Propósito e missão": "compass", "Decisão por consentimento": "split",
            "Missão da EI": "feather", "Visão 2028": "sunrise", "Fechamento": "handshake", "Antes do encontro": "sunrise"}
IC_ENC = {1: "door-open", 2: "users", 3: "sunrise"}
FOTO_ENC = {3: "e3.jpg"}
e = html.escape


def campo(c):
    """c = dict(k, rotulo, tipo, dica, ...) -> html do campo."""
    k, tipo = c.get("k", ""), c.get("tipo", "area")
    rot = f'<label for="{k}"><b>{e(c["rotulo"])}</b></label>' if c.get("rotulo") else ""
    dica = f'<p class="dica">{e(c["dica"])}</p>' if c.get("dica") else ""
    if tipo == "area":
        corpo = f'<textarea id="{k}" data-k="{k}" rows="{c.get("linhas", 3)}" placeholder="{e(c.get("ph", ""))}"></textarea>'
    elif tipo == "texto":
        corpo = f'<input type="text" id="{k}" data-k="{k}" placeholder="{e(c.get("ph", ""))}">'
    elif tipo == "escolha":
        ops = "".join(f"<option>{e(o)}</option>" for o in [""] + c["opcoes"])
        corpo = f'<select id="{k}" data-k="{k}">{ops}</select>'
    elif tipo == "espelho":
        vz = c.get("vazio", "Ainda sem registro no Encontro 1.")
        return f'<div class="campo espelho">{rot}{dica}<div class="espelho__v" data-espelho="{c["de"]}" data-vazio="{e(vz)}">{e(vz)}</div></div>'
    elif tipo == "notas":  # cinco dimensões, nota de 1 a 5
        cels = "".join(
            f'<div class="nota"><label for="{k}.{d}"><b>{e(n)}</b></label><select id="{k}.{d}" data-k="{k}.{d}">'
            + "".join(f"<option>{o}</option>" for o in ["", "1", "2", "3", "4", "5"]) + "</select></div>"
            for d, n in c["dims"])
        corpo = f'<div class="notas">{cels}</div>'
    elif tipo == "lacunas":  # frases com lacuna e banco de números
        linhas = "".join(
            f'<li><input class="lacuna" type="text" inputmode="numeric" data-k="{k}.{i}" data-gab="{e(g)}" aria-label="lacuna {i + 1}"> <span>{e(fr)}</span></li>'
            for i, (g, fr) in enumerate(c["frases"]))
        corpo = (f'<p class="banco"><b>Banco de Números:</b> {e(c["banco"])}. Cada número entra uma vez, e três sobram.</p>'
                 f'<ol class="lacunas">{linhas}</ol>'
                 f'<button type="button" class="btn btn--sec" data-conferir>Conferir as respostas</button>')
    elif tipo == "associar":
        linhas = "".join(
            f'<li><span>{e(s)}</span><select data-k="{k}.{i}" data-gab="{e(g)}">'
            + "".join(f"<option>{e(o)}</option>" for o in [""] + c["opcoes"]) + "</select></li>"
            for i, (s, g) in enumerate(c["pares"]))
        corpo = f'<ol class="associar">{linhas}</ol><button type="button" class="btn btn--sec" data-conferir>Conferir as respostas</button>'
    elif tipo == "detalhes":  # campos agrupados, recolhíveis
        return (f'<details class="campo campo--det"><summary>{e(c["rotulo"])}</summary>' + "".join(campo(x) for x in c["campos"])
                + "</details>")
    elif tipo == "imagem":  # a história em imagem: o serviço chama o Claude e o modelo de imagem
        if PROF:
            return (f'<div class="campo">{rot}<p class="dica">Na página do participante, o botão “{e(c["botao"])}” envia o texto '
                    f'ao serviço, que devolve a imagem da cena (até três versões).</p></div>')
        return (f'<div class="campo imagem" data-imagem="{e(c["img"])}" data-de="{e(" ".join(c["de"]))}" data-rotulos="{e("|".join(c["rot"]))}">'
                f'{rot}<p class="dica">{e(c["aviso"])}</p>'
                f'<label class="imagem__aj"><span>Ajuste, se quiser (opcional)</span><input type="text" data-img-ajuste maxlength="300" placeholder="Por exemplo: à noite, na sala de controle, com mais pessoas"></label>'
                f'<p class="imagem__acoes"><button type="button" class="btn" data-img-pedir>{icone("image", "#FFFFFF", 20, 2)} {e(c["botao"])}</button>'
                f'<span class="imagem__rest" data-img-rest></span></p><p class="imagem__msg" data-img-msg aria-live="polite"></p>'
                f'<figure class="imagem__fig" data-img-fig hidden><img alt="A imagem gerada a partir do texto"><figcaption data-img-cena></figcaption>'
                f'<a class="btn btn--sec" data-img-baixar download="historia-do-futuro.jpg" href="#">Baixar a imagem</a></figure></div>')
    elif tipo == "tabela":
        cab = "".join(f"<th>{e(h['t'])}</th>" for h in c["colunas"])
        lin = ""
        for r in range(c["n"]):
            tds = ""
            for j, h in enumerate(c["colunas"]):
                kk = f"{k}.{r}.{j}"
                if h.get("opcoes"):
                    inp = f'<select data-k="{kk}" aria-label="{e(h["t"])}">' + "".join(f"<option>{e(o)}</option>" for o in [""] + h["opcoes"]) + "</select>"
                else:
                    inp = f'<textarea data-k="{kk}" rows="2" aria-label="{e(h["t"])}" placeholder="{e(h.get("ph", ""))}"></textarea>'
                tds += f'<td data-th="{e(h["t"])}">{inp}</td>'
            lin += f"<tr>{tds}</tr>"
        extra = ('<div class="mapa" data-mapa="' + k + '"></div>' if c.get("mapa") else "") + ('<div class="curva" data-curva="' + k + '"></div>' if c.get("curva") else "")
        corpo = f'<div class="tabela-w"><table class="tabela" data-tabela="{k}"><thead><tr>{cab}</tr></thead><tbody>{lin}</tbody></table></div>{extra}'
    return f'<div class="campo">{rot}{dica}{corpo}</div>'


def bloco_html(b, enc):
    tom = b["tom"]
    o = f'<section class="bloco" id="{b["id"]}" style="--tom:{tom}">'
    rot = f'{e(b["num"])} · {e(b["nome"].upper())}' if b.get("num") else e(b["nome"].upper())
    o += f'<div class="eyebrow"><span>{rot}</span><i></i></div>'
    ic = IC_BLOCO.get(b["nome"])
    o += (f'<div class="bloco__t"><span class="disco">{icone(ic)}</span><h2>{b["titulo"]}</h2></div>' if ic else f'<h2>{b["titulo"]}</h2>')
    if b.get("aviso"):
        o += f'<p class="caminho-aviso">{e(b["aviso"])}</p>'
    if b.get("pergunta"):
        o += f'<p class="pergunta">{e(b["pergunta"])}</p>'
    if b.get("capaz"):
        o += '<div class="capaz"><b>Ao término deste bloco, você será capaz de:</b><ol>' + "".join(f"<li>{e(x)}</li>" for x in b["capaz"]) + "</ol></div>"
    for it in b["itens"]:
        t = it["t"]
        if t == "conceito":
            o += f'<article class="conceito"><h3>{e(it["titulo"])}</h3>{it["html"]}'
            if it.get("fonte"):
                o += f'<p class="fonte">Fonte: {e(it["fonte"])}</p>'
            o += "</article>"
        elif t == "regua":
            o += f'<article class="regua"><h3>{e(it["titulo"])}</h3>{it["html"]}</article>'
        elif t == "atividade":
            meta = "".join(f"<div><span>{e(a)}</span><b>{e(v)}</b></div>" for a, v in it["meta"])
            passos = "".join(f"<li>{p}</li>" for p in it["passos"])
            titq = it["titulo"].replace('"', "")
            o += f'<article class="atividade" id="{it["id"]}">'
            o += f'<div class="atividade__cab"><span class="selo">ATIVIDADE · {e(it["tempo"])}</span>'
            if it.get("area"):
                o += f'<a class="selo selo--miro" href="{enc["miro"]}" target="_blank" rel="noopener">Miro · {e(it["area"])}</a>'
            o += f'</div><h3>{e(it["titulo"])}</h3>'
            if it.get("aviso_at"):
                o += f'<p class="caminho-aviso">{e(it["aviso_at"])}</p>'
            if it.get("perg"):
                o += f'<p class="pergunta pergunta--at">{e(it["perg"])}</p>'
            if it.get("pergs"):
                o += '<ol class="pergs">' + "".join(f"<li>{e(x)}</li>" for x in it["pergs"]) + "</ol>"
            o += f'<ol class="passos">{passos}</ol><div class="meta">{meta}</div>'
            if it.get("nota_at"):
                o += f'<p class="caminho-aviso caminho-aviso--neutro">{it["nota_at"]}</p>'
            if it.get("pontos") and it.get("pontos_aberto"):
                o += (f'<details class="pontos" open><summary>{e(it.get("pontos_titulo", "Os pontos que não podem faltar"))}'
                      '</summary><ul>' + "".join(f"<li>{p}</li>" for p in it["pontos"]) + "</ul></details>")
            if it.get("exemplo"):
                o += f'<div class="exemplo"><span>EXEMPLO, APENAS ILUSTRATIVO</span>{it["exemplo"]}</div>'
            if it["campos"]:
                o += '<div class="registro"><span class="registro__t">O SEU REGISTRO</span>' + "".join(campo(c) for c in it["campos"]) + "</div>"
            if it.get("aviso"):
                o += f'<p class="caminho-aviso caminho-aviso--neutro">{e(it["aviso"])}</p>'
            if it.get("pontos") and not it.get("pontos_aberto"):
                o += '<details class="pontos"><summary>Os pontos que não podem faltar</summary><ul>' + "".join(f"<li>{p}</li>" for p in it["pontos"]) + "</ul></details>"
            if not PROF:
                o += caixa_duvida(titq)
            if PROF:
                o += '<div class="prof"><span>VERSÃO DO PROFESSOR · CONDUÇÃO</span>'
                o += "<ul>" + "".join(f"<li>{p}</li>" for p in it.get("conducao", [])) + "</ul>"
                if it.get("resposta"):
                    o += f'<div class="prof__resp"><b>Resposta</b>{it["resposta"]}</div>'
                if it.get("debrief"):
                    o += '<div class="prof__resp"><b>Perguntas de fechamento da atividade</b><ul>' + "".join(f"<li>{p}</li>" for p in it["debrief"]) + "</ul></div>"
                o += "</div>"
            o += "</article>"
    o += "</section>"
    return o


PUBLICADOS = {3}
FASES = (("O caminho da EI", 3),)


def caminho_html(atual, grande=False):
    """Mapa do caminho: três paradas ligadas por uma rota, com foto, ícone e produto; só o encontro extra tem página."""
    o = f'<div class="rota rota--3{" rota--grande" if grande else ""}">'
    o += ('<svg class="rota__linha" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">'
          '<path d="M166,62 C300,62 360,138 500,138 S700,62 834,62"/></svg>')
    for n, nome, data, tom, prod, grupo in CAMINHO:
        cls = "feito" if n < 3 else ("aqui" if n == atual else "")
        pub = n in PUBLICADOS
        tag = "a" if pub and not PROF else "span"
        href = f' href="e{n}.html"' if tag == "a" else ""
        foto = f'background-image:url({img_url(f"p{n}.jpg")})'
        rod = ("Você está aqui" if n == atual else ("Abrir o encontro" if pub else "Concluído"))
        o += (f'<{tag} class="parada {cls}{"" if pub else " parada--feita"}" data-parada="{n}" style="--tom:{tom}"{href}>'
              f'<span class="parada__foto" style="{foto}"><span class="parada__n">{n}</span><span class="parada__ic">{icone(IC_ENC[n], tam=22)}</span></span>'
              f'<span class="parada__k">{e(grupo.upper())} · {e(data.split(" · ")[0])}</span>'
              f'<b>{e(nome)}</b><em>{e(prod)}</em><small class="parada__c">{rod}</small></{tag}>')
    o += '<div class="rota__fases">' + "".join(f'<span style="grid-column:span {c}">{e(f)}</span>' for f, c in FASES) + "</div>"
    return o + "</div>"


def pagina(titulo, corpo, pg, fontes_css, extra_js="", n_enc=None):
    nav = "" if PROF else ('<nav class="nav"><a href="index.html">Meu mapa</a><a href="preparacao.html">Antes do encontro</a>'
                           '<a href="e3.html">Encontro extra</a><a href="mentoria.html">Mentoria</a></nav><span class="conta" data-conta></span>')
    if n_enc is None:
        n_enc = int(pg[1:]) if pg.startswith("e") and pg[1:].isdigit() else 0
    cfg = "" if PROF else f'<script>window.CM4AI={{api:{json.dumps(API)},encontro:{n_enc}}};</script>'
    selo = '<span class="selo-prof">VERSÃO DO PROFESSOR</span>' if PROF else ""
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(titulo)}</title><meta name="robots" content="noindex">
<style>{fontes_css}{CSS}{CSS_ONS}</style></head>
<body data-pg="{pg}">
<header class="topo"><a class="marca" href="{'#' if PROF else 'index.html'}"><img src="{MARCA}" alt=""><span><b>GINO TERENTIM</b><i>RETHINKING LEARNING</i></span></a>{selo}{nav}</header>
<main>{corpo}</main>
<footer class="rodape"><span>Workshop EI · ONS · Encontro extra de missão e visão · 30 de novembro de 2026</span><span>Rethinking Learning</span></footer>
{cfg}<script>{JS}{extra_js}</script></body></html>"""


CSS_ONS = """
.rota--3{grid-template-columns:repeat(3,1fr)}.rota--3 .rota__fases{grid-template-columns:repeat(3,1fr)}
.caminho-aviso{display:inline-block;margin:6px 0 10px;padding:6px 14px;border-radius:14px;background:#FBEEE5;color:#B04A1C;
  font-weight:700;font-size:14px;letter-spacing:.4px}
.caminho-aviso--neutro{background:#F1ECE4;color:#5A5045}
ol.pergs{margin:4px 0 12px;padding-left:22px}ol.pergs li{font-weight:700;margin:4px 0;line-height:1.4}
.campo--det{border:1.5px solid #E2D9CD;border-radius:12px;padding:8px 14px;margin:10px 0;background:#FBF8F3}
.campo--det summary{cursor:pointer;font-weight:700;color:#B04A1C;padding:4px 0}
.imagem{border:2px dashed #E7B59C;border-radius:14px;padding:12px 16px;background:#FDF6F1}
.imagem__aj{display:block;margin:8px 0}.imagem__aj span{display:block;font-size:14px;color:#6E6259;margin-bottom:4px}
.imagem__acoes{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:8px 0 4px}
.imagem__acoes .btn svg{vertical-align:-4px}.imagem__rest{font-size:14px;color:#6E6259}
.imagem__msg{font-size:15px;color:#B04A1C;font-weight:700;min-height:1px;margin:4px 0}
.imagem--gerando .imagem__msg::after{content:"";display:inline-block;width:14px;height:14px;margin-left:8px;border:2px solid #B04A1C;
  border-right-color:transparent;border-radius:50%;animation:gira .8s linear infinite;vertical-align:-2px}
@keyframes gira{to{transform:rotate(360deg)}}
.imagem__fig{margin:10px 0 4px}.imagem__fig img{width:100%;border-radius:12px;display:block;box-shadow:none}
.imagem__fig figcaption{font-size:14px;color:#6E6259;margin:6px 0 8px;font-style:italic}
"""


def caixa_duvida(atividade, rotulo="Perguntar ao mentor sobre esta atividade"):
    return (f'<div class="duvidas" data-duvida="{e(atividade)}"><p class="mentor"><button type="button" class="btn btn--mentor" data-duvida-abrir>{rotulo}</button></p>'
            '<div class="duvidas__form" hidden><label class="duvidas__l">A sua dúvida para o Gino Terentim<textarea rows="4" placeholder="Escreva a dúvida com o contexto da atividade. Use o papel das pessoas, e não o nome."></textarea></label>'
            '<div class="duvidas__acoes"><button type="button" class="btn" data-duvida-enviar>Enviar a dúvida</button><button type="button" class="btn btn--sec" data-duvida-cancelar>Cancelar</button></div></div>'
            '<p class="duvidas__msg" aria-live="polite"></p><div class="duvidas__lista"></div></div>')


def barra():
    return ('<div class="aviso-conta" data-aviso-conta hidden><b>Entre com o seu e-mail para gravar as respostas na sua página do encontro.</b> Sem entrar, elas ficam só neste navegador. <a class="btn" href="index.html">Entrar</a></div>'
            '<div class="barra"><span class="barra__s" data-salvo>As respostas ficam gravadas na sua página do encontro.</span>'
            '<button type="button" class="btn btn--sec" data-exportar>Exportar as minhas respostas</button>'
            '<button type="button" class="btn btn--sec" data-imprimir>Imprimir ou salvar em PDF</button></div>')


def encontro_html(enc):
    foto = FOTO_ENC.get(enc["n"])
    fst = f';--foto:url({img_url(foto)})' if foto else ""
    o = f'<section class="capa capa--foto" style="--tom:{enc["tom"]}{fst}"><p class="capa__k">ENCONTRO EXTRA · {e(enc["data"].upper())}</p><h1>{enc["titulo"]}</h1>'
    o += f'<p class="capa__l">{e(enc["lede"])}</p></section>'
    o += '<section class="bloco bloco--abre"><div class="capaz"><b>Ao término deste encontro, os participantes serão capazes de:</b><ol>' + "".join(f"<li>{e(x)}</li>" for x in enc["capaz"]) + "</ol></div>"
    o += "<h3>Onde estamos no caminho</h3>" + caminho_html(enc["n"])
    o += '<h3>Neste encontro</h3><ol class="indice">' + "".join(f'<li style="--tom:{b["tom"]}"><a href="#{b["id"]}"><b>{e(b["num"])}</b> {e(b["nome"])}</a><span>{e(b.get("constroi", ""))}</span></li>' for b in enc["blocos"]) + "</ol>"
    if not PROF:
        o += barra()
    o += "</section>"
    for b in enc["blocos"]:
        o += bloco_html(b, enc)
    if not PROF:
        o += '<section class="bloco">' + barra() + "</section>"
    return o


def preparacao_html(p):
    o = ('<section class="capa capa--foto" style="--tom:#B04A1C;--foto:url(' + img_url("e3.jpg") + ')"><p class="capa__k">ANTES DO ENCONTRO · ATÉ 29 DE NOVEMBRO DE 2026</p>'
         '<h1>A história <em>do futuro</em></h1><p class="capa__l">Uma manhã de 2028 na EI, contada por você, no presente e com os detalhes que quiser. '
         'A história é o ponto de partida da visão 2028 no encontro de 30 de novembro: na sala, cada um lê o trecho mais forte, e o grupo escreve a história comum.</p></section>')
    o += '<section class="bloco bloco--abre">' + ("" if PROF else barra()) + "</section>"
    for b in p["blocos"]:
        o += bloco_html(b, p)
    if not PROF:
        o += '<section class="bloco">' + barra() + "</section>"
    return o


def fontes(inline):
    o = ""
    for peso, arq in ((400, "Poppins-Regular.ttf"), (500, "Poppins-Medium.ttf"), (700, "Poppins-Bold.ttf")):
        if inline:
            b = base64.b64encode(open(os.path.join(RAIZ, "src", "fonts", arq), "rb").read()).decode()
            src = f"url(data:font/ttf;base64,{b})"
        else:
            src = f"url(fonts/{arq})"
        o += f"@font-face{{font-family:Poppins;font-weight:{peso};src:{src} format('truetype');font-display:swap}}"
    return o


if PROF:
    MARCA = "data:image/png;base64," + base64.b64encode(open(os.path.join(RAIZ, "src", "logo-gt-mark.png"), "rb").read()).decode()
    corpo = ('<section class="capa" style="--tom:#E5662C"><p class="capa__k">VERSÃO DO PROFESSOR · ENCONTRO EXTRA · 30/11/2026</p>'
             '<h1>Missão e <em>visão 2028</em></h1><p class="capa__l">O mesmo workbook da equipe da EI, com a condução, as respostas e as perguntas de fechamento de cada atividade. '
             'Arquivo único, para uso fora da internet. Não publicar.</p></section>')
    if PREP:
        corpo += preparacao_html(PREP)
    for enc in ENCONTROS:
        corpo += encontro_html(enc)
    os.makedirs(os.path.join(RAIZ, "professor"), exist_ok=True)
    VER = sys.argv[2] if len(sys.argv) > 2 else "v3"
    open(os.path.join(RAIZ, "professor", f"Workshop_EI_ONS_Encontro-Extra_Workbook-Professor_{VER}.html"), "w", encoding="utf-8").write(
        pagina(f"{TITULO} · Workbook · Versão do professor", corpo, "prof", fontes(True)))
    print("professor ok")
else:
    MARCA = "logo-gt-mark.png"
    D = os.path.join(RAIZ, "docs")
    shutil.rmtree(D, ignore_errors=True); os.makedirs(os.path.join(D, "fonts"))
    for f in os.listdir(os.path.join(RAIZ, "src", "fonts")):
        shutil.copy(os.path.join(RAIZ, "src", "fonts", f), os.path.join(D, "fonts", f))
    shutil.copy(os.path.join(RAIZ, "src", "logo-gt-mark.png"), D)
    shutil.copytree(os.path.join(RAIZ, "src", "img"), os.path.join(D, "img"))
    if os.path.isdir(os.path.join(RAIZ, "src", "miro")):   # imagens do quadro do Miro, servidas ao Miro por endereço
        shutil.copytree(os.path.join(RAIZ, "src", "miro"), os.path.join(D, "miro"))
    open(os.path.join(D, ".nojekyll"), "w").close()
    F = fontes(False)
    for enc in ENCONTROS:
        open(os.path.join(D, f"e{enc['n']}.html"), "w", encoding="utf-8").write(
            pagina(f"{TITULO} · Workbook · 30 de novembro", encontro_html(enc), f"e{enc['n']}", F))
    if PREP:
        open(os.path.join(D, "preparacao.html"), "w", encoding="utf-8").write(
            pagina(f"{TITULO} · Antes do encontro · A história do futuro", preparacao_html(PREP), "preparacao", F, n_enc=PREP["n"]))
    idx = ('<section class="capa capa--foto" style="--tom:#E5662C;--foto:url(img/capa.jpg)"><p class="capa__k">WORKSHOP EI · ONS · ENCONTRO EXTRA · 30 DE NOVEMBRO DE 2026</p>'
           '<h1>O seu mapa de <em>navegação</em></h1><p class="capa__l">A página de cada participante no encontro extra de missão e visão. Aqui ficam as instruções de cada atividade, '
           'com o mesmo texto dos slides e do quadro do Miro, e o registro das suas respostas.</p></section>')
    idx += ('<section class="entrada" data-entrada hidden><div class="entrada__f"><div class="eyebrow" style="--tom:#E5662C"><span>ACESSO · A SUA PÁGINA DO ENCONTRO</span><i></i></div>'
            '<h2>Entre com o seu <em>e-mail</em></h2>'
            '<form novalidate><label for="f-email"><b>E-mail corporativo</b></label><input id="f-email" name="email" type="email" autocomplete="email" required placeholder="nome@ons.org.br">'
            '<label for="f-codigo"><b>Código de quatro números</b></label><input id="f-codigo" name="codigo" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="current-password" required placeholder="••••">'
            '<label for="f-nome"><b>Nome, no primeiro acesso</b></label><input id="f-nome" name="nome" type="text" autocomplete="name" placeholder="Nome e sobrenome">'
            '<button class="btn btn--grande" type="submit">Abrir a minha página</button><p class="entrada__aviso" data-aviso aria-live="polite"></p></form></div>'
            '<ol class="entrada__passos">'
            f'<li><span class="disco" style="--tom:#B04A1C">{icone("mail")}</span><div><b>O e-mail corporativo</b><p>O mesmo endereço do convite do encontro.</p></div></li>'
            f'<li><span class="disco" style="--tom:#2F6B6F">{icone("key-round")}</span><div><b>Um código seu</b><p>No primeiro acesso, você escolhe quatro números. Nos acessos seguintes, o mesmo código abre a sua página, em qualquer aparelho.</p></div></li>'
            f'<li><span class="disco" style="--tom:#5E7D52">{icone("map-pin")}</span><div><b>O seu registro, atividade a atividade</b><p>Cada resposta é gravada na sua página assim que você escreve e fica disponível em qualquer aparelho.</p></div></li></ol></section>')
    idx += ('<section class="mapa-curso" data-mapa-curso><div class="mapa-curso__cab"><div><div class="eyebrow" style="--tom:#E5662C"><span>O CAMINHO DA EI</span><i></i></div>'
            '<h2><span data-ola-bloco hidden>Olá, <span data-ola></span>. </span>O seu <em>caminho</em></h2>'
            '<p>Encontro on-line em 30 de novembro, das 14h às 17h, horário de Brasília. A parada do encontro extra abre o workbook com as instruções e o seu registro.</p></div>'
            f'<span class="rosa" aria-hidden="true">{icone("compass", "#C9A24D", 120, 1.1)}</span></div>' + caminho_html(0, True) +
            '<div class="cards3 cards3--claro"><div><b>Como usar</b><p>Abra o encontro do dia e registre as suas respostas à medida que cada atividade acontece. Sem conexão, o registro fica neste navegador e segue para a sua página na alteração seguinte.</p></div>'
            '<div><b>O fio da imersão</b><p>O encontro extra completa a sexta construção da imersão de 22 e 23 de outubro: a missão e a visão 2028 da EI.</p></div>'
            '<div><b>Reserva dos seus dados</b><p>As respostas ficam na planilha privada do encontro, aberta apenas ao Gino Terentim, e na sua página, protegida pelo seu código. Use o papel das pessoas, e não o nome.</p></div></div>'
            f'<a class="cartao cartao--mentor" href="preparacao.html" style="--tom:#B04A1C"><span class="disco" style="--tom:#E5662C">{icone("sunrise")}</span><span><span class="cartao__k">ANTES DO ENCONTRO · ATÉ 29 DE NOVEMBRO</span><b>A história do futuro</b><i>Uma manhã de 2028 na EI, contada por você; o workbook desenha a cena da sua história</i></span></a>'
            f'<a class="cartao cartao--mentor" href="mentoria.html" style="--tom:#2A211C"><span class="disco" style="--tom:#E5662C">{icone("messages-square")}</span><span><span class="cartao__k">DEPOIS DO ENCONTRO</span><b>Dúvidas para o Gino Terentim</b><i>Pergunte sobre o método e as atividades; a resposta volta para a sua página e para o seu e-mail</i></span></a></section>')
    open(os.path.join(D, "index.html"), "w", encoding="utf-8").write(pagina(f"{TITULO} · Workbook digital", idx, "index", F))
    m = ('<section class="capa" style="--tom:#E5662C"><p class="capa__k">DEPOIS DO ENCONTRO</p><h1>Dúvidas para o <em>Gino Terentim</em></h1>'
         '<p class="capa__l">Pergunte sobre o método e sobre as atividades do encontro. A dúvida chega ao Gino Terentim, e a resposta volta para a sua página do workbook e para o seu e-mail.</p></section>'
         '<section class="bloco bloco--abre"><div class="abas" role="tablist" aria-label="Dúvidas para o Gino Terentim">'
         f'<button type="button" class="aba" role="tab" id="aba-nova" aria-controls="painel-nova" aria-selected="true" data-aba="nova">{icone("message-square-plus", "currentColor", 22, 2)}Nova dúvida</button>'
         f'<button type="button" class="aba" role="tab" id="aba-enviadas" aria-controls="painel-enviadas" aria-selected="false" tabindex="-1" data-aba="enviadas">{icone("inbox", "currentColor", 22, 2)}Dúvidas enviadas<span class="selo-n" data-naolidas-aba hidden></span></button></div>'
         '<div class="aba__painel" role="tabpanel" id="painel-nova" aria-labelledby="aba-nova" data-painel-aba="nova">'
         '<h2>Como <em>perguntar</em></h2><ol class="passos">'
         '<li>Entre no workbook com o e-mail da inscrição e o seu código de quatro números.</li>'
         '<li>Em cada atividade, use o botão <b>Perguntar ao mentor sobre esta atividade</b>. Para uma dúvida geral, use o botão abaixo.</li>'
         '<li>A resposta aparece na aba <b>Dúvidas enviadas</b> e junto da atividade, e chega no seu e-mail. No menu, o item Mentoria mostra quantas respostas você ainda não leu.</li></ol>'
         + caixa_duvida("Dúvida geral", "Escrever uma dúvida geral") +
         '<div class="cards3"><div><b>Reserva</b><p>As dúvidas ficam na planilha privada do encontro, aberta apenas ao Gino Terentim. Use o papel das pessoas, e não o nome, e mantenha fora do texto os dados reservados da sua organização.</p></div>'
         '<div><b>Uma boa pergunta</b><p>Traz o contexto, o que você já tentou e o ponto exato da dúvida.</p></div>'
         '<div><b>Prazo</b><p>As dúvidas ficam abertas até 14 de dezembro de 2026, duas semanas depois do encontro.</p></div></div>'
         '<article class="regua"><h3>Exemplo de pergunta, apenas ilustrativo</h3><p>“No teste da missão, como saber se um verbo de ação se entende fora da área? '
         'Na minha sala, “habilitar” dividiu o grupo.”</p></article></div>'
         '<div class="aba__painel" role="tabpanel" id="painel-enviadas" aria-labelledby="aba-enviadas" data-painel-aba="enviadas" hidden>'
         '<h2>As suas <em>dúvidas</em></h2><p class="aba__nota">Cada resposta nova chega com o selo <b>Nova</b> e passa a constar como lida quando você abre esta aba.</p>'
         '<div class="duvidas__todas" data-duvidas-todas></div></div></section>')
    pn = ('<section class="capa" style="--tom:#2A211C"><p class="capa__k">ÁREA DO PROFESSOR</p><h1>Painel de <em>dúvidas</em></h1>'
          '<p class="capa__l">As dúvidas da equipe chegam aqui em tempo real. A resposta aparece no workbook do participante e vai para o e-mail dele.</p></section>'
          '<section class="bloco bloco--abre painel">'
          '<div class="painel__entrada" data-p-entrada><label class="duvidas__l">Chave do painel<input type="password" autocomplete="current-password" data-p-chave></label>'
          '<div class="duvidas__acoes"><button type="button" class="btn" data-p-entrar>Abrir o painel</button><button type="button" class="btn btn--sec" data-p-enviar-chave>Receber a chave no e-mail</button></div></div>'
          '<p class="duvidas__msg" data-p-msg aria-live="polite"></p>'
          '<div data-p-quadro hidden><div class="painel__topo"><div class="painel__n"><b data-p-ag>0</b><span>aguardando</span></div><div class="painel__n painel__n--ok"><b data-p-rp>0</b><span>respondidas</span></div>'
          '<div class="painel__f"><button type="button" class="chip-f" data-p-filtro="aguardando">Aguardando</button><button type="button" class="chip-f" data-p-filtro="respondidas">Respondidas</button><button type="button" class="chip-f" data-p-filtro="todas">Todas</button>'
          '<select data-p-enc><option value="0">Todos os encontros</option>' + '<option value="3">Encontro extra</option>' + '</select></div>'
          '<div class="painel__h"><span data-p-hora></span><button type="button" class="btn btn--sec" data-p-sair>Sair</button></div></div>'
          '<div data-p-lista></div></div></section>')
    open(os.path.join(D, "painel.html"), "w", encoding="utf-8").write(pagina(f"Painel de dúvidas · {TITULO}", pn, "painel", F, PAINEL_JS))
    open(os.path.join(D, "mentoria.html"), "w", encoding="utf-8").write(pagina(f"{TITULO} · Mentoria", m, "mentoria", F))
    print("site ok")
