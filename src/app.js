(function(){
"use strict";
var P="onsei:",mem={};
function ler(k){try{var v=localStorage.getItem(P+k);return v===null?(mem[k]||""):v}catch(e){return mem[k]||""}}
function gravar(k,v){mem[k]=v;try{localStorage.setItem(P+k,v)}catch(e){}}
function $(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
var salvo=$("[data-salvo]");
function aviso(){if(localStorage.getItem("onsei:sessao"))return;var h=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});salvo.forEach(function(el){el.textContent="Respostas gravadas neste navegador às "+h+"."})}
function espelhos(){$("[data-espelho]").forEach(function(el){var v=ler(el.getAttribute("data-espelho"));el.textContent=v||el.getAttribute("data-vazio")||"Ainda sem registro."})}
function altura(t){if(t.tagName!=="TEXTAREA")return;t.style.height="auto";t.style.height=(t.scrollHeight+4)+"px"}
// restaura e grava
$("[data-k]").forEach(function(el){
  var k=el.getAttribute("data-k"),v=ler(k);if(v){el.value=v}altura(el);
  el.addEventListener("input",function(){gravar(k,el.value);altura(el);aviso();mapas()});
  el.addEventListener("change",function(){gravar(k,el.value);aviso();mapas()});
});
// conferência das respostas
function norm(s){return String(s).replace(/[%\s]/g,"").toLowerCase()}
$("[data-conferir]").forEach(function(b){b.addEventListener("click",function(){
  $("[data-gab]",b.parentNode).forEach(function(el){
    el.classList.remove("certo","errado");if(!el.value)return;
    el.classList.add(norm(el.value)===norm(el.getAttribute("data-gab"))?"certo":"errado");
  });
})});
// mapa de pessoas a partir da tabela
var COR={"Apoia":"#BFE3B4","Ainda não se posicionou":"#FFF6B6","Tem ressalvas":"#F8C9A0"};
function mapas(){$("[data-mapa]").forEach(function(m){
  var k=m.getAttribute("data-mapa"),tb=document.querySelector('[data-tabela="'+k+'"]');if(!tb)return;
  m.innerHTML='<span class="mapa__q" style="left:0;top:0">Muita influência · pouco afetada</span><span class="mapa__q" style="right:0;top:0;text-align:right">Muita influência · muito afetada</span>'+
    '<span class="mapa__q" style="left:0;bottom:0">Pouca influência · pouco afetada</span><span class="mapa__q" style="right:0;bottom:0;text-align:right">Pouca influência · muito afetada</span>';
  var cont={};
  $("tbody tr",tb).forEach(function(tr){
    var c=$("[data-k]",tr).map(function(x){return x.value});if(!c[0]||!c[1]||!c[2])return;
    var dir=c[1]==="Muito afetada",alto=c[2]==="Muita influência",q=(dir?1:0)+"-"+(alto?1:0);cont[q]=(cont[q]||0)+1;var i=cont[q]-1;
    var n=document.createElement("div");n.className="mapa__n";n.textContent=(c[4]?"⭐ ":"")+c[0];n.style.background=COR[c[3]]||"#EEE8DF";
    n.style.left=((dir?52:3)+(i%2)*22)+"%";n.style.top=((alto?9:57)+Math.floor(i/2)*11)+"%";m.appendChild(n);
  });
})}
// curva de adoção (Rogers) a partir da tabela
var SEG=[["Inovadores","2,5%","#7A4E6D"],["Adotantes iniciais","13,5%","#35608F"],["Maioria inicial","34%","#2F6B6F"],["Maioria tardia","34%","#B5781E"],["Últimos adotantes","16%","#8D8377"]];
function curvas(){$("[data-curva]").forEach(function(m){
  var k=m.getAttribute("data-curva"),tb=document.querySelector('[data-tabela="'+k+'"]');if(!tb)return;
  var por={};SEG.forEach(function(s){por[s[0]]=[]});
  $("tbody tr",tb).forEach(function(tr){var c=$("[data-k]",tr).map(function(x){return x.value});if(c[0]&&por[c[1]])por[c[1]].push((c[3]?"⭐ ":"")+c[0])});
  var pts=[],i,x,z;for(i=0;i<=100;i++){z=(i-50)/16.5;pts.push((i*6)+","+(120-100*Math.exp(-z*z/2)).toFixed(1))}
  var lim=[0,17,33.5,50,66.5,100],svg='<svg viewBox="0 0 600 124" preserveAspectRatio="none" class="curva__svg">';
  SEG.forEach(function(s,j){var a=lim[j],b=lim[j+1],pp=[(a*6)+",120"];for(i=Math.ceil(a);i<=Math.floor(b);i++)pp.push(pts[i]);pp.push((b*6)+",120");svg+='<polygon points="'+pp.join(" ")+'" fill="'+s[2]+'" opacity=".85"/>'});
  svg+="</svg>";
  m.innerHTML=svg+'<div class="curva__cols">'+SEG.map(function(s){return '<div class="curva__col" style="--c:'+s[2]+'"><b>'+s[0]+'</b><span>'+s[1]+'</span>'+por[s[0]].map(function(n){return '<i>'+n.replace(/</g,"&lt;")+'</i>'}).join("")+'</div>'}).join("")+'</div>';
})}
var _mapas=mapas;mapas=function(){_mapas();curvas()};
mapas();espelhos();
(function(){var hoje=new Date();function dia(x){return new Date(x+"T00:00:00-03:00")}
$("[data-ate]").forEach(function(el){if(hoje>=dia(el.getAttribute("data-ate")))el.hidden=true});
$("[data-desde]").forEach(function(el){if(hoje>=dia(el.getAttribute("data-desde")))el.hidden=false});
$("[data-aqui-ate]").forEach(function(el){if(hoje>=dia(el.getAttribute("data-aqui-ate"))){el.classList.remove("aqui");el.classList.add("feito");var c=el.querySelector(".parada__c");if(c)c.textContent=el.getAttribute("data-depois-txt")}});
$("[data-aqui-desde]").forEach(function(el){if(hoje>=dia(el.getAttribute("data-aqui-desde"))){el.classList.add("aqui");var c=el.querySelector(".parada__c");if(c&&document.body.getAttribute("data-pg")==="index")c.textContent="Você está aqui · abrir o encontro"}})})();
(function(){var hoje=new Date();$("[data-abre]").forEach(function(el){var d=new Date(el.getAttribute("data-abre")+"T00:00:00-03:00");if(hoje<d){el.removeAttribute("href");el.classList.add("parada--breve");var c=el.querySelector(".parada__c");if(c){c.removeAttribute("data-cont");c.textContent=el.getAttribute("data-abre-txt")}}})})();
window.CM4AI_atualizar=function(){$("[data-k]").forEach(altura);mapas();espelhos()};
// exportar
function texto(){
  var o=[document.title,"Exportado em "+new Date().toLocaleString("pt-BR"),""];
  $(".atividade").forEach(function(a){
    var t=a.querySelector("h3");o.push("## "+(t?t.textContent:""));
    $(".campo",a).forEach(function(c){
      var r=c.querySelector("label");var vals=$("[data-k]",c).map(function(x){return x.value}).filter(Boolean);
      var tb=c.querySelector("[data-tabela]");
      if(tb){o.push((r?r.textContent:"")+":");$("tbody tr",tb).forEach(function(tr){var l=$("[data-k]",tr).map(function(x){return x.value});if(l.join("").trim())o.push("  - "+l.join(" | "))})}
      else if(vals.length){o.push((r?r.textContent:"")+": "+vals.join(" · "))}
    });o.push("");
  });return o.join("\n");
}
$("[data-exportar]").forEach(function(b){b.addEventListener("click",function(){
  var blob=new Blob([texto()],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="onsei-"+(document.body.getAttribute("data-pg")||"workbook")+"-respostas.txt";document.body.appendChild(a);a.click();a.remove();
})});
$("[data-imprimir]").forEach(function(b){b.addEventListener("click",function(){$("details").forEach(function(d){d.open=true});window.print()})});
var pg=document.body.getAttribute("data-pg");$(".nav a").forEach(function(a){if(a.getAttribute("href")===pg+".html")a.classList.add("ativo")});
})();
