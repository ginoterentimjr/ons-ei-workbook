(function(){
"use strict";
var API=(window.CM4AI||{}).api,K="onsei:painel:chave";
function $(s,r){return (r||document).querySelector(s)}
function chamar(d){return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d),redirect:"follow"}).then(function(r){return r.json()})}
function esc(t){return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\n/g,"<br>")}
var chave="",dados=[],assin="",filtro="aguardando",enc="0",rasc={},editando={},timer=null;
try{chave=sessionStorage.getItem(K)||""}catch(e){}
var ent=$("[data-p-entrada]"),qd=$("[data-p-quadro]"),msg=$("[data-p-msg]");

function entrar(k){
  msg.textContent="Conferindo a chave…";
  chamar({acao:"painel",chave:k}).then(function(r){
    if(r&&r.ok){chave=k;try{sessionStorage.setItem(K,k)}catch(e){}ent.hidden=true;qd.hidden=false;msg.textContent="";receber(r);iniciar()}
    else{msg.textContent=r&&r.erro==="chave"?"A chave não confere. Confira o e-mail com a chave do painel.":"O serviço não respondeu. Tente de novo em alguns segundos."}
  }).catch(function(){msg.textContent="Sem conexão com o serviço."});
}
$("[data-p-entrar]").addEventListener("click",function(){entrar($("[data-p-chave]").value.trim())});
$("[data-p-chave]").addEventListener("keydown",function(ev){if(ev.key==="Enter")entrar(this.value.trim())});
$("[data-p-enviar-chave]").addEventListener("click",function(){
  msg.textContent="Enviando a chave para o seu e-mail…";
  chamar({acao:"chave"}).then(function(r){msg.textContent=r&&r.ok?(r.espera?"A chave já foi enviada há pouco. Confira a caixa de entrada.":"A chave foi enviada para o seu e-mail."):"Não foi possível enviar a chave agora."}).catch(function(){msg.textContent="Sem conexão com o serviço."});
});
$("[data-p-sair]").addEventListener("click",function(){try{sessionStorage.removeItem(K)}catch(e){}location.reload()});
Array.prototype.forEach.call(document.querySelectorAll("[data-p-filtro]"),function(b){b.addEventListener("click",function(){filtro=b.getAttribute("data-p-filtro");desenhar()})});
$("[data-p-enc]").addEventListener("change",function(){enc=this.value;desenhar()});

function receber(r){
  var nova=JSON.stringify(r.duvidas||[]);
  $("[data-p-hora]").textContent="Atualizado às "+String(r.agora||"").slice(11,19);
  if(nova===assin)return;
  assin=nova;dados=r.duvidas||[];desenhar();
}
function atualizar(){
  if(!chave)return;
  chamar({acao:"painel",chave:chave}).then(function(r){if(r&&r.ok)receber(r);else if(r&&r.erro==="chave"){try{sessionStorage.removeItem(K)}catch(e){}location.reload()}}).catch(function(){});
}
function iniciar(){if(timer)clearInterval(timer);timer=setInterval(function(){if(!document.hidden)atualizar()},15000)}
document.addEventListener("visibilitychange",function(){if(!document.hidden)atualizar()});

function desenhar(){
  var ag=dados.filter(function(d){return d.situacao!=="Respondida"}).length,rp=dados.length-ag;
  $("[data-p-ag]").textContent=ag;$("[data-p-rp]").textContent=rp;
  document.title=(ag?"("+ag+") ":"")+"Painel de dúvidas · Encontro extra EI";
  Array.prototype.forEach.call(document.querySelectorAll("[data-p-filtro]"),function(b){b.classList.toggle("ativo",b.getAttribute("data-p-filtro")===filtro)});
  var foco=document.activeElement&&document.activeElement.getAttribute&&document.activeElement.getAttribute("data-p-resp");
  var l=dados.filter(function(d){
    var resp=d.situacao==="Respondida";
    if(filtro==="aguardando"&&resp)return false;
    if(filtro==="respondidas"&&!resp)return false;
    if(enc!=="0"&&String(d.encontro)!==enc)return false;
    return true;
  });
  if(filtro==="aguardando")l.reverse();
  $("[data-p-lista]").innerHTML=l.length?l.map(function(d){
    var resp=d.situacao==="Respondida",ed=editando[d.id];
    var cab='<div class="pd__cab"><b>'+esc(d.nome||d.email)+'</b><span>'+esc(d.email)+'</span><span>'+(d.encontro?({3:"Encontro extra"}[d.encontro]||"Encontro "+d.encontro)+" · ":"")+esc(d.atividade||"Dúvida geral")+'</span><span>'+esc(d.recebida)+'</span></div>';
    var corpo='<div class="pd__p">'+esc(d.pergunta)+'</div>';
    if(resp&&!ed){corpo+='<div class="pd__r"><span>A SUA RESPOSTA · '+esc(d.respondida)+'</span>'+esc(d.resposta)+'</div>'+
      (d.lida?'<p class="pd__leitura pd__leitura--ok">Lida pelo participante em '+esc(d.lida)+'</p>':'<p class="pd__leitura">Ainda não lida pelo participante</p>')+'<button type="button" class="btn btn--sec" data-p-editar="'+esc(d.id)+'">Editar a resposta</button>'}
    else{var v=rasc[d.id]!=null?rasc[d.id]:(resp?d.resposta:"");
      corpo+='<textarea rows="4" data-p-resp="'+esc(d.id)+'" placeholder="Escreva a resposta. Ela aparece no workbook do participante e vai para o e-mail dele.">'+esc(v).replace(/<br>/g,"\n")+'</textarea>'+
        '<div class="pd__acoes"><button type="button" class="btn" data-p-responder="'+esc(d.id)+'">Enviar a resposta</button>'+(ed?'<button type="button" class="btn btn--sec" data-p-cancelar="'+esc(d.id)+'">Cancelar</button>':'')+'<span class="pd__ok" data-p-ok="'+esc(d.id)+'"></span></div>'}
    return '<article class="pd'+(resp?" pd--ok":"")+'">'+cab+corpo+'</article>';
  }).join(""):'<p class="pd__vazio">'+(filtro==="aguardando"?"Nenhuma dúvida aguardando resposta.":"Nenhuma dúvida neste filtro.")+'</p>';
  if(foco){var t=document.querySelector('[data-p-resp="'+foco+'"]');if(t){t.focus();t.selectionStart=t.selectionEnd=t.value.length}}
}
document.addEventListener("input",function(ev){var id=ev.target.getAttribute&&ev.target.getAttribute("data-p-resp");if(id)rasc[id]=ev.target.value});
document.addEventListener("click",function(ev){
  var b=ev.target.closest&&ev.target.closest("button");if(!b)return;
  var ide=b.getAttribute("data-p-editar"),idc=b.getAttribute("data-p-cancelar"),idr=b.getAttribute("data-p-responder");
  if(ide){editando[ide]=1;desenhar();return}
  if(idc){delete editando[idc];delete rasc[idc];desenhar();return}
  if(idr){
    var t=document.querySelector('[data-p-resp="'+idr+'"]'),ok=document.querySelector('[data-p-ok="'+idr+'"]'),v=t?t.value.trim():"";
    if(v.length<2){ok.textContent="Escreva a resposta antes de enviar.";return}
    b.disabled=true;ok.textContent="Enviando…";
    chamar({acao:"responder",chave:chave,id:idr,resposta:v}).then(function(r){
      b.disabled=false;
      if(r&&r.ok){delete rasc[idr];delete editando[idr];
        dados.forEach(function(d){if(d.id===idr){d.situacao="Respondida";d.resposta=v;d.respondida=r.respondida}});assin="";desenhar();atualizar()}
      else{ok.textContent="Não foi possível enviar agora. Tente de novo."}
    }).catch(function(){b.disabled=false;ok.textContent="Sem conexão com o serviço."});
  }
});
if(chave)entrar(chave);
})();
