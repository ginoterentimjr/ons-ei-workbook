// ---------- A história do futuro em imagem: o serviço envia o texto ao Claude, que descreve a cena, e ao modelo de imagem da OpenAI ----------
(function(){
"use strict";
var C=window.CM4AI||{},API=C.api,S="onsei:sessao";
function $(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function sessao(){try{return JSON.parse(localStorage.getItem(S)||"null")}catch(e){return null}}
function chamar(d){return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d),redirect:"follow"}).then(function(r){return r.json()})}
var MSG={curta:"Escreva um pouco mais antes de pedir a imagem: algumas linhas, com o lugar, as pessoas e o que acontece.",
  limite:"As três versões desta imagem já foram usadas.",
  sem_chave:"A geração de imagem ainda não está disponível. O seu texto está gravado.",
  tempo:"O desenho demorou mais que o esperado. Tente de novo em instantes; o seu texto está gravado.",
  imagem:"O serviço de imagem não respondeu. Tente de novo em instantes; o seu texto está gravado.",
  sessao:"Entre com o seu e-mail, no Meu mapa, para pedir a imagem.",
  rede:"Sem conexão com o serviço. Confira a internet e tente de novo."};
$("[data-imagem]").forEach(function(bx){
  var tipo=bx.getAttribute("data-imagem"),de=(bx.getAttribute("data-de")||"").split(" "),rot=(bx.getAttribute("data-rotulos")||"").split("|");
  var bt=bx.querySelector("[data-img-pedir]"),aj=bx.querySelector("[data-img-ajuste]"),msg=bx.querySelector("[data-img-msg]"),
      fig=bx.querySelector("[data-img-fig]"),im=fig.querySelector("img"),dl=bx.querySelector("[data-img-baixar]"),
      cena=bx.querySelector("[data-img-cena]"),rest=bx.querySelector("[data-img-rest]");
  function texto(){
    return de.map(function(k,i){var el=document.querySelector('[data-k="'+k+'"]'),v=el?el.value.trim():"";return v?(rot[i]?rot[i]+": ":"")+v:""})
      .filter(Boolean).join("\n\n");
  }
  function mostrar(r){
    if(r.img){im.src=r.img;dl.href=r.img;fig.hidden=false;cena.textContent=r.cena?("A cena: "+r.cena):""}
    if(typeof r.restantes==="number"){
      rest.textContent=r.restantes>0?("Você ainda pode pedir "+r.restantes+(r.restantes>1?" versões.":" versão.")):"As três versões desta imagem já foram usadas.";
      bt.disabled=r.restantes<=0;
    }
  }
  var s=sessao();
  if(!s||!API){bt.disabled=true;msg.textContent=MSG.sessao;return}
  chamar({acao:"imagem_ver",email:s.email,token:s.token,tipo:tipo}).then(function(r){if(r&&r.ok)mostrar(r)}).catch(function(){});
  bt.addEventListener("click",function(){
    var t=texto();
    if(t.length<120){msg.textContent=MSG.curta;return}
    bt.disabled=true;bx.classList.add("imagem--gerando");msg.textContent="Desenhando a cena. Leva até um minuto.";
    chamar({acao:"imagem",email:s.email,token:s.token,tipo:tipo,texto:t,ajuste:aj?aj.value:""}).then(function(r){
      bx.classList.remove("imagem--gerando");
      if(!r.ok){msg.textContent=MSG[r.erro]||MSG.imagem;bt.disabled=(r.erro==="limite"||r.erro==="sessao");return}
      msg.textContent="Pronto. A imagem fica gravada na sua página; o botão abaixo dela baixa o arquivo.";
      mostrar(r);if(aj)aj.value="";
    }).catch(function(){bx.classList.remove("imagem--gerando");bt.disabled=false;msg.textContent=MSG.rede});
  });
});
})();
