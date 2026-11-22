(function(){
"use strict";
var C=window.CM4AI||{},API=C.api,ENC=C.encontro||0;
function $(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function sessao(){try{return JSON.parse(localStorage.getItem("onsei:sessao")||"null")}catch(e){return null}}
function chamar(d){return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d),redirect:"follow"}).then(function(r){return r.json()})}
function esc(t){return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}
var caixas=$("[data-duvida]"),todas=$("[data-duvidas-todas]");
if(!caixas.length&&!todas.length)return;
var s=sessao(),lista=[],vistas={},marcando=false,primeira=true;
// Nesta página, a consulta das dúvidas também atualiza o aviso do menu.
if(s)window.CM4AI_DUV=true;

// ---------- abas da Mentoria: Nova dúvida e Dúvidas enviadas ----------
var abas=$("[data-aba]");
function abaAtual(){var b=abas.filter(function(x){return x.getAttribute("aria-selected")==="true"})[0];return b?b.getAttribute("data-aba"):""}
function abrir(nome,foco){
  abas.forEach(function(b){var on=b.getAttribute("data-aba")===nome;b.setAttribute("aria-selected",on?"true":"false");b.tabIndex=on?0:-1;if(on&&foco)b.focus()});
  $("[data-painel-aba]").forEach(function(p){p.hidden=p.getAttribute("data-painel-aba")!==nome});
  try{history.replaceState(null,"",nome==="enviadas"?"#enviadas":location.pathname+location.search)}catch(e){}
  marcarLidas();
}
abas.forEach(function(b,i){
  b.addEventListener("click",function(){abrir(b.getAttribute("data-aba"))});
  b.addEventListener("keydown",function(ev){
    if(ev.key!=="ArrowRight"&&ev.key!=="ArrowLeft")return;
    var j=(i+(ev.key==="ArrowRight"?1:abas.length-1))%abas.length;abrir(abas[j].getAttribute("data-aba"),true);ev.preventDefault();
  });
});
document.addEventListener("click",function(ev){var a=ev.target.closest&&ev.target.closest("[data-ir-enviadas]");if(a&&abas.length){ev.preventDefault();abrir("enviadas");window.scrollTo({top:0,behavior:"smooth"})}});
if(abas.length&&location.hash==="#enviadas")abrir("enviadas");

// ---------- aviso de respostas não lidas ----------
function naoLidas(){return lista.filter(function(d){return d.nova}).length}
function avisar(){
  var n=naoLidas();
  $("[data-naolidas-aba]").forEach(function(b){b.textContent=n>99?"99+":String(n);b.hidden=!(n>0)});
  try{document.dispatchEvent(new CustomEvent("onsei:naolidas",{detail:n}))}catch(e){}
}
// Conta como lida a resposta que aparece na aba Dúvidas enviadas, com a página à vista.
function marcarLidas(){
  if(!s||marcando||document.hidden||abaAtual()!=="enviadas")return;
  var ids=lista.filter(function(d){return d.nova}).map(function(d){return d.id});
  if(!ids.length)return;
  marcando=true;
  ids.forEach(function(id){vistas[id]=1});
  chamar({acao:"lidas",email:s.email,token:s.token,ids:ids}).then(function(r){
    marcando=false;
    if(r&&r.ok){lista.forEach(function(d){if(ids.indexOf(d.id)>=0){d.nova=false;d.lida=r.lida||d.lida}});avisar()}
  }).catch(function(){marcando=false});
}
document.addEventListener("visibilitychange",function(){if(!document.hidden)marcarLidas()});

function resposta(d,completa){
  if(!d.resposta)return '<div class="duvida__e">'+(completa?'Aguardando resposta. Ela aparece aqui e chega no seu e-mail.':'Aguardando resposta.')+'</div>';
  var nova=d.nova||vistas[d.id];
  return '<div class="duvida__r"><span>RESPOSTA DE GINO TERENTIM · '+esc(d.respondida)+(nova?'<em class="selo-nova">NOVA</em>':'')+'</span>'+esc(d.resposta)+'</div>';
}
function desenhar(){
  caixas.forEach(function(cx){
    var at=cx.getAttribute("data-duvida"),alvo=cx.querySelector(".duvidas__lista");
    var minhas=lista.filter(function(d){return d.atividade===at&&(!ENC||+d.encontro===ENC)});
    alvo.innerHTML=minhas.map(function(d){
      return '<div class="duvida'+(d.nova?" duvida--nova":"")+'"><div class="duvida__p"><span>A SUA DÚVIDA · '+esc(d.recebida)+'</span>'+esc(d.pergunta)+'</div>'+resposta(d,true)+'</div>';
    }).join("");
  });
}
function desenharTodas(){
  todas.forEach(function(el){
    if(!s){el.innerHTML='<p class="duvidas__msg"><a href="index.html">Entre com o seu e-mail</a> para ver as suas dúvidas e as respostas.</p>';return}
    if(!lista.length){el.innerHTML='<p class="duvidas__msg">Você ainda não enviou dúvidas.</p>';return}
    var ord=lista.slice().reverse().sort(function(a,b){return (b.nova||vistas[b.id]?1:0)-(a.nova||vistas[a.id]?1:0)});
    el.innerHTML=ord.map(function(d){
      var onde=(d.encontro?"ENCONTRO "+d.encontro+" · ":"")+esc(String(d.atividade||"").toUpperCase());
      return '<div class="duvida'+(d.nova||vistas[d.id]?" duvida--nova":"")+'"><div class="duvida__p"><span>'+onde+' · '+esc(d.recebida)+'</span>'+esc(d.pergunta)+'</div>'+resposta(d,false)+'</div>';
    }).join("");
  });
}
function carregar(){
  desenharTodas();
  if(!s)return;
  chamar({acao:"duvidas",email:s.email,token:s.token}).then(function(r){
    if(!r||!r.ok)return;
    lista=r.duvidas||[];
    if(primeira&&abas.length&&naoLidas()>0)abrir("enviadas");
    primeira=false;
    desenhar();desenharTodas();avisar();marcarLidas();
  }).catch(function(){});
}

caixas.forEach(function(cx){
  var bt=cx.querySelector("[data-duvida-abrir]"),fm=cx.querySelector(".duvidas__form"),tx=fm.querySelector("textarea"),
      env=fm.querySelector("[data-duvida-enviar]"),can=fm.querySelector("[data-duvida-cancelar]"),msg=cx.querySelector(".duvidas__msg");
  bt.addEventListener("click",function(){
    if(!s){msg.innerHTML='Para enviar a dúvida, <a href="index.html">entre com o seu e-mail</a>: a resposta volta para a sua página e para o seu e-mail.';return}
    fm.hidden=false;bt.hidden=true;msg.textContent="";tx.focus();
  });
  can.addEventListener("click",function(){fm.hidden=true;bt.hidden=false});
  env.addEventListener("click",function(){
    var p=tx.value.trim();
    if(p.length<3){msg.textContent="Escreva a sua dúvida antes de enviar.";return}
    env.disabled=true;msg.textContent="Enviando…";
    chamar({acao:"duvida",email:s.email,token:s.token,encontro:ENC,atividade:cx.getAttribute("data-duvida"),pergunta:p}).then(function(r){
      env.disabled=false;
      if(r&&r.ok){tx.value="";fm.hidden=true;bt.hidden=false;
        if(abas.length)msg.innerHTML='Dúvida enviada ao Gino Terentim. Acompanhe a resposta em <a href="#enviadas" data-ir-enviadas>Dúvidas enviadas</a>; ela também chega no seu e-mail.';
        else msg.textContent="Dúvida enviada ao Gino Terentim. A resposta aparece aqui e chega no seu e-mail.";
        lista.push({id:r.id,recebida:r.recebida,encontro:ENC,atividade:cx.getAttribute("data-duvida"),pergunta:p,situacao:"Aguardando",resposta:"",respondida:"",nova:false});desenhar();desenharTodas()}
      else if(r&&r.erro==="sessao"){msg.innerHTML='A sua sessão terminou. <a href="index.html">Entre de novo</a> e envie a dúvida.'}
      else{msg.textContent="Não foi possível enviar agora. Tente de novo em alguns segundos."}
    }).catch(function(){env.disabled=false;msg.textContent="Sem conexão com o serviço. Confira a internet e tente de novo."});
  });
});
carregar();
setInterval(function(){if(!document.hidden)carregar()},120000);
})();
