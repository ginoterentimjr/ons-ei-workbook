// ---------- A história falada e o norte: o serviço envia o áudio à OpenAI, que o transforma em texto, e a história ao Claude, que propõe os itens do norte ----------
// O áudio não fica guardado: só o texto volta para o campo e é gravado como qualquer resposta.
(function(){
"use strict";
var C=window.CM4AI||{},API=C.api,S="onsei:sessao",MAX=300;
function $(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function sessao(){try{return JSON.parse(localStorage.getItem(S)||"null")}catch(e){return null}}
function chamar(d){return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d),redirect:"follow"}).then(function(r){return r.json()})}
function mmss(n){return Math.floor(n/60)+":"+("0"+(n%60)).slice(-2)}
var MSG={sessao:"Entre com o seu e-mail, no Meu mapa, para usar o microfone e o botão Organizar no norte.",
  suporte:"Este navegador não grava áudio. Use o Chrome, o Edge ou o Safari atualizados, ou escreva no campo.",
  microfone:"O navegador não liberou o microfone. Autorize o acesso ao microfone para esta página e tente de novo.",
  curto:"A gravação ficou curta demais. Tente de novo, falando por alguns segundos.",
  grande:"A gravação ficou longa demais para enviar. Grave em partes menores.",
  curta:"Escreva ou fale um pouco mais antes de organizar: algumas linhas, com o lugar, as pessoas e o que acontece.",
  limite:"O limite de uso de hoje foi atingido. O seu texto está gravado; tente de novo amanhã.",
  sem_chave:"Este recurso ainda não está disponível. O seu texto está gravado.",
  tempo:"O serviço demorou mais que o esperado. Tente de novo em instantes; o seu texto está gravado.",
  ia:"O serviço não respondeu. Tente de novo em instantes; o seu texto está gravado.",
  rede:"Sem conexão com o serviço. Confira a internet e tente de novo."};
function formato(){
  var op=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"];
  for(var i=0;i<op.length;i++){try{if(MediaRecorder.isTypeSupported(op[i]))return op[i]}catch(e){}}
  return "";
}
$("[data-voz]").forEach(function(bx){
  var alvo=document.querySelector('[data-k="'+bx.getAttribute("data-voz")+'"]'),norte=[];
  try{norte=JSON.parse(bx.getAttribute("data-norte")||"[]")}catch(e){}
  var btG=bx.querySelector("[data-voz-gravar]"),btO=bx.querySelector("[data-voz-organizar]"),msg=bx.querySelector("[data-voz-msg]"),
      rot=bx.querySelector("[data-voz-roteiro]"),tempo=bx.querySelector("[data-voz-tempo]"),rotuloG=btG.innerHTML;
  var s=sessao();
  if(!alvo)return;
  if(!s||!API){btG.disabled=true;btO.disabled=true;msg.textContent=MSG.sessao;return}
  var podeGravar=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
  var rec=null,partes=[],t0=0,relogio=null;
  function ocupado(on){bx.classList.toggle("voz--ocupado",on)}
  function gravando(on){
    bx.classList.toggle("voz--gravando",on);rot.hidden=!on;btO.disabled=on;
    btG.innerHTML=on?btG.innerHTML.replace(/<\/svg>[\s\S]*$/,"</svg> Concluir a gravação"):rotuloG;
    if(!on)tempo.textContent="";
  }
  function acrescentar(t){
    var v=alvo.value.replace(/\s+$/,"");alvo.value=(v?v+"\n\n":"")+t;
    alvo.dispatchEvent(new Event("input"));
  }
  function enviarAudio(b){
    if(b.size<3000){msg.textContent=MSG.curto;return}
    if(b.size>9000000){msg.textContent=MSG.grande;return}
    btG.disabled=true;btO.disabled=true;ocupado(true);msg.textContent="Transformando a sua fala em texto. Leva alguns segundos.";
    var fr=new FileReader();
    fr.onload=function(){
      var b64=String(fr.result).split(",")[1]||"";
      chamar({acao:"transcrever",email:s.email,token:s.token,audio:b64,mime:b.type||""}).then(function(r){
        ocupado(false);btG.disabled=false;btO.disabled=false;
        if(!r.ok){msg.textContent=MSG[r.erro]||MSG.ia;if(r.erro==="sessao")msg.textContent=MSG.sessao;return}
        if(!r.texto){msg.textContent=MSG.curto;return}
        acrescentar(r.texto);
        msg.textContent="Pronto: a sua fala entrou no campo, logo acima. Revise o texto e, se quiser, organize no norte.";
      }).catch(function(){ocupado(false);btG.disabled=false;btO.disabled=false;msg.textContent=MSG.rede});
    };
    fr.readAsDataURL(b);
  }
  if(!podeGravar){btG.disabled=true;msg.textContent=MSG.suporte}
  btG.addEventListener("click",function(){
    if(rec&&rec.state==="recording"){rec.stop();return}
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){
      var mt=formato(),op={audioBitsPerSecond:32000};if(mt)op.mimeType=mt;
      try{rec=new MediaRecorder(st,op)}catch(e){rec=new MediaRecorder(st)}
      partes=[];
      rec.ondataavailable=function(ev){if(ev.data&&ev.data.size)partes.push(ev.data)};
      rec.onstop=function(){
        clearInterval(relogio);st.getTracks().forEach(function(t){t.stop()});gravando(false);
        enviarAudio(new Blob(partes,{type:(rec.mimeType||mt||"audio/webm").split(";")[0]}));
      };
      rec.start(1000);t0=Date.now();gravando(true);
      msg.textContent="Gravando. Fale com calma; ao terminar, clique em Concluir a gravação. Limite de cinco minutos.";
      tempo.textContent="0:00 de 5:00";
      relogio=setInterval(function(){
        var n=Math.floor((Date.now()-t0)/1000);tempo.textContent=mmss(Math.min(n,MAX))+" de 5:00";
        if(n>=MAX&&rec.state==="recording")rec.stop();
      },500);
    }).catch(function(){msg.textContent=MSG.microfone});
  });
  btO.addEventListener("click",function(){
    var t=alvo.value.trim();
    if(t.length<80){msg.textContent=MSG.curta;return}
    btO.disabled=true;btG.disabled=true;ocupado(true);msg.textContent="Organizando a sua história nos itens do norte.";
    chamar({acao:"organizar",email:s.email,token:s.token,texto:t}).then(function(r){
      ocupado(false);btO.disabled=false;btG.disabled=!podeGravar;
      if(!r.ok){msg.textContent=MSG[r.erro]||MSG.ia;if(r.erro==="sessao")msg.textContent=MSG.sessao;return}
      var feitos=[],mantidos=[],faltam=[],c=r.campos||{};
      norte.forEach(function(n){
        var el=document.querySelector('[data-k="'+n[0]+'"]'),v=String(c[n[0].split(".").pop()]||"").trim();
        if(!el)return;
        if(el.value.trim()){mantidos.push(n[1]);return}
        if(!v){faltam.push(n[1]);return}
        el.value=v;el.dispatchEvent(new Event("input"));
        el.classList.add("sugerido");el.addEventListener("input",function(){el.classList.remove("sugerido")},{once:true});
        var d=el.closest("details");if(d)d.open=true;
        feitos.push(n[1]);
      });
      var o=[];
      if(feitos.length)o.push("Propostos a partir da sua história, em destaque: "+feitos.join(", ")+".");
      if(mantidos.length)o.push("Mantidos como você escreveu: "+mantidos.join(", ")+".");
      if(faltam.length)o.push("A sua história ainda não fala de: "+faltam.join(", ")+". Vale acrescentar.");
      if(feitos.length)o.push("Revise cada item: o texto é seu.");
      msg.textContent=o.join(" ");
    }).catch(function(){ocupado(false);btO.disabled=false;btG.disabled=!podeGravar;msg.textContent=MSG.rede});
  });
});
})();
