(function(){
"use strict";
var C=window.CM4AI||{},API=C.api,ENC=C.encontro||0,S="onsei:sessao";
function $(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function sessao(){try{return JSON.parse(localStorage.getItem(S)||"null")}catch(e){return null}}
function guardar(o){try{localStorage.setItem(S,JSON.stringify(o))}catch(e){}}
function limpar(){try{Object.keys(localStorage).forEach(function(k){if(k.indexOf("onsei:")===0&&k!==S)localStorage.removeItem(k)})}catch(e){}}
function sair(){limpar();try{localStorage.removeItem(S)}catch(e){}location.href="index.html"}
function chamar(dados){
  return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(dados),redirect:"follow"})
    .then(function(r){return r.json()});
}
function hora(){return new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
function status(t,ok){$("[data-salvo]").forEach(function(el){el.textContent=t;el.classList.toggle("barra__s--ok",!!ok)})}
var MSG={email:"Confira o e-mail: o endereço parece incompleto.",codigo_formato:"O código tem quatro números.",
  codigo:"O código não confere com o deste e-mail. Se você esqueceu o código, avise o Gino Terentim no chat: ele libera um novo.",
  bloqueado:"Muitas tentativas com código errado. Avise o Gino Terentim no chat para liberar o acesso.",
  servico:"O serviço não respondeu. Tente de novo em alguns segundos.",rede:"Sem conexão com o serviço. Confira a internet e tente de novo."};

// ---------- topo: quem está conectado ----------
var s=sessao();
$("[data-conta]").forEach(function(el){
  if(s){el.innerHTML='<span>'+(s.nome?s.nome.split(" ")[0]:s.email)+'</span><button type="button" class="conta__sair">Sair</button>';
    el.querySelector("button").addEventListener("click",sair)}
  else{el.innerHTML='<a href="index.html">Entrar</a>'}
});

// ---------- avisos do menu: respostas não lidas e, para o instrutor, dúvidas aguardando ----------
// O serviço reconhece o instrutor pela sessão; o site não guarda e-mail algum.
var relogio=null,ritmo=0;
function seloMentoria(n){
  $('.nav a[href="mentoria.html"]').forEach(function(a){
    var b=a.querySelector("[data-naolidas]");
    if(!b){b=document.createElement("span");b.className="selo-n";b.setAttribute("data-naolidas","");b.hidden=true;a.appendChild(b);a.classList.add("nav-selo")}
    b.textContent=n>99?"99+":String(n);b.hidden=!(n>0);
    a.setAttribute("aria-label","Mentoria"+(n>0?", "+n+(n>1?" respostas novas":" resposta nova"):""));
  });
}
document.addEventListener("onsei:naolidas",function(ev){seloMentoria(+ev.detail||0)});
function itemInstrutor(n){
  $(".nav").forEach(function(nav){
    var a=nav.querySelector("[data-instrutor]");
    if(!a){a=document.createElement("a");a.href="painel.html";a.setAttribute("data-instrutor","");
      a.innerHTML='Responder dúvidas<span class="selo-n" data-pend hidden></span>';
      var m=nav.querySelector('a[href="mentoria.html"]');if(m&&m.nextSibling)nav.insertBefore(a,m.nextSibling);else nav.appendChild(a);
      if(document.body.getAttribute("data-pg")==="painel")a.classList.add("ativo")}
    if(n!==undefined){var b=a.querySelector("[data-pend]");b.textContent=n>99?"99+":String(n);b.hidden=!(n>0);
      a.setAttribute("aria-label","Responder dúvidas"+(n>0?", "+n+" aguardando resposta":""))}
  });
}
function semInstrutor(){$("[data-instrutor]").forEach(function(a){a.parentNode.removeChild(a)})}
// Nas páginas com dúvidas, a própria consulta das dúvidas atualiza o aviso do participante (CM4AI_DUV).
function pendentes(){
  if(document.hidden&&relogio)return;
  if(s.instr===false&&window.CM4AI_DUV)return;
  chamar({acao:"pendentes",email:s.email,token:s.token}).then(function(r){
    if(!r||!r.ok)return;
    if(s.instr!==!!r.instrutor){s.instr=!!r.instrutor;guardar(s)}
    if(r.instrutor)itemInstrutor(r.n);else semInstrutor();
    if(typeof r.naoLidas==="number"&&!window.CM4AI_DUV)seloMentoria(r.naoLidas);
    var q=r.instrutor?60000:(window.CM4AI_DUV?0:120000);
    if(q!==ritmo){if(relogio)clearInterval(relogio);relogio=q?setInterval(pendentes,q):null;ritmo=q}
  }).catch(function(){});
}
if(s){if(s.instr)itemInstrutor();setTimeout(pendentes,0)}

// ---------- página inicial: entrada e mapa ----------
var ent=document.querySelector("[data-entrada]"),mapa=document.querySelector("[data-mapa-curso]");
function mostrarMapa(){
  if(ent)ent.hidden=true;if(!mapa)return;
  $("[data-ola-bloco]").forEach(function(el){el.hidden=false});
  $("[data-ola]").forEach(function(el){el.textContent=s.nome?s.nome.split(" ")[0]:"bem-vindo"});
  chamar({acao:"mapa",email:s.email,token:s.token}).then(function(r){
    if(!r.ok){if(r.erro==="sessao")sair();return}
    Object.keys(r.mapa).forEach(function(n){
      var q=r.mapa[n];$('[data-parada="'+n+'"]').forEach(function(el){
        el.classList.toggle("parada--feita",q>0);
        var b=el.querySelector("[data-cont]");if(b)b.textContent=q>0?(q===1?"1 registro":q+" registros"):"Ainda sem registro";
      });
    });
  }).catch(function(){});
}
var VOLTA=(/[?&]volta=((?:preparacao|e3|mentoria)\.html)/.exec(location.search)||[])[1];
if(ent){
  if(s&&VOLTA){location.replace(VOLTA);return}
  if(s){mostrarMapa()}else{ent.hidden=false}
  var f=ent.querySelector("form"),av=ent.querySelector("[data-aviso]");
  f&&f.addEventListener("submit",function(ev){
    ev.preventDefault();av.textContent="Abrindo a sua página…";av.className="entrada__aviso";
    var d={acao:"entrar",email:f.email.value,codigo:f.codigo.value,nome:f.nome.value};
    chamar(d).then(function(r){
      if(!r.ok){av.textContent=MSG[r.erro]||MSG.servico;av.className="entrada__aviso entrada__aviso--erro";return}
      var em=d.email.trim().toLowerCase(),ult="";try{ult=localStorage.getItem("onsei:ultimo")||""}catch(e){}
      if(ult&&ult!==em)limpar();
      s={email:em,token:r.token,nome:r.nome||d.nome,instr:!!r.instrutor};guardar(s);try{localStorage.setItem("onsei:ultimo",em)}catch(e){}
      if(VOLTA){location.href=VOLTA}else{location.reload()}
    }).catch(function(){av.textContent=MSG.rede;av.className="entrada__aviso entrada__aviso--erro"});
  });
}

// ---------- páginas dos encontros: carregar e gravar ----------
if(!ENC)return;
var campos=$("[data-k]");
function rotulo(el){
  var a=el.closest(".atividade"),t=a&&a.querySelector("h3"),c=el.closest(".campo"),l=c&&c.querySelector("label");
  var tt=t?t.textContent.trim():(el.closest(".completar")?"Complete a frase":"Registro");
  var r=tt+" · "+((l&&l.textContent.trim())||el.getAttribute("aria-label")||el.getAttribute("data-k"));
  return r.slice(0,190);
}
if(!s){
  $("[data-aviso-conta]").forEach(function(el){el.hidden=false;var a=el.querySelector("a");
    if(a)a.href="index.html?volta="+encodeURIComponent(location.pathname.split("/").pop()||"index.html")});
  return;
}
status("Abrindo as suas respostas…");
var outros={};$("[data-espelho]").forEach(function(el){var m=/^e(\d)\./.exec(el.getAttribute("data-espelho")||"");if(m&&+m[1]!==ENC)outros[m[1]]=1});
Object.keys(outros).forEach(function(n){
  chamar({acao:"carregar",email:s.email,token:s.token,encontro:+n}).then(function(r){
    if(!r.ok)return;Object.keys(r.respostas).forEach(function(k){try{localStorage.setItem("onsei:"+k,r.respostas[k])}catch(e){}});
    if(window.CM4AI_atualizar)window.CM4AI_atualizar();
  }).catch(function(){});
});
chamar({acao:"carregar",email:s.email,token:s.token,encontro:ENC}).then(function(r){
  if(!r.ok){if(r.erro==="sessao"){sair();return}status("As respostas ficam neste navegador até o serviço voltar.");return}
  var pend={};
  campos.forEach(function(el){
    var k=el.getAttribute("data-k"),v=r.respostas[k];
    if(v!==undefined&&v!==""){el.value=v;try{localStorage.setItem("onsei:"+k,v)}catch(e){}el.dispatchEvent(new Event("onsei:carregado"))}
    else if(el.value){pend[k]=el.value}
  });
  if(window.CM4AI_atualizar)window.CM4AI_atualizar();
  status("Respostas da sua página abertas às "+hora()+".",true);
  if(Object.keys(pend).length){fila=pend;enviar()}
}).catch(function(){status("Sem conexão: as respostas ficam neste navegador e seguem para a sua página na próxima alteração.")});

var fila={},timer=null,enviando=false;
function enviar(){
  if(enviando||!Object.keys(fila).length)return;
  var lote=fila,rot={};fila={};enviando=true;
  Object.keys(lote).forEach(function(k){var el=document.querySelector('[data-k="'+k+'"]');rot[k]=el?rotulo(el):k});
  chamar({acao:"salvar",email:s.email,token:s.token,encontro:ENC,respostas:lote,rotulos:rot}).then(function(r){
    enviando=false;
    if(!r.ok){Object.keys(lote).forEach(function(k){if(!(k in fila))fila[k]=lote[k]});if(r.erro==="sessao"){sair();return}status("Não foi possível gravar agora. Tento de novo na próxima alteração.");return}
    status("Gravado na sua página às "+hora()+".",true);
    if(Object.keys(fila).length)agendar();
  }).catch(function(){enviando=false;Object.keys(lote).forEach(function(k){if(!(k in fila))fila[k]=lote[k]});status("Sem conexão: as respostas ficam neste navegador e seguem na próxima alteração.")});
}
function agendar(){clearTimeout(timer);timer=setTimeout(enviar,1500)}
campos.forEach(function(el){
  function mudou(){fila[el.getAttribute("data-k")]=el.value;status("Gravando…");agendar()}
  el.addEventListener("input",mudou);el.addEventListener("change",mudou);
});
window.addEventListener("pagehide",function(){
  if(!Object.keys(fila).length||!navigator.sendBeacon)return;
  var rot={};Object.keys(fila).forEach(function(k){var el=document.querySelector('[data-k="'+k+'"]');rot[k]=el?rotulo(el):k});
  try{navigator.sendBeacon(API,new Blob([JSON.stringify({acao:"salvar",email:s.email,token:s.token,encontro:ENC,respostas:fila,rotulos:rot})],{type:"text/plain;charset=utf-8"}));fila={}}catch(e){}
});
})();
