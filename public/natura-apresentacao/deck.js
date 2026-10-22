
(function(){
var root=document.querySelector('.d3'); if(!root) return; root.classList.add('js');
var slides=[].slice.call(root.querySelectorAll('.slide'));
slides.forEach(function(s){[].slice.call(s.querySelectorAll('.rv')).forEach(function(e,i){e.style.setProperty('--i',i)})});
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function all(){slides.forEach(function(s){s.classList.add('seen')})}
function check(){var h=window.innerHeight||800; slides.forEach(function(s){if(s.classList.contains('seen'))return; var r=s.getBoundingClientRect(); if(r.top<h*0.88&&r.bottom>h*0.05) s.classList.add('seen')})}
window.addEventListener('scroll',check,{passive:true}); window.addEventListener('resize',check); setTimeout(check,60);
if(reduce||!('IntersectionObserver' in window)){all()} else {
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}})},{threshold:0,rootMargin:'0px 0px -12% 0px'});
  slides.forEach(function(s){io.observe(s)});
}
/* Dashboard tabs. The photos come from DASHBOARD_SCREENS (the JSON block with that id): swap each "src" there. */
var data=document.getElementById('DASHBOARD_SCREENS'); var fig=document.getElementById('dashtabs');
if(!data||!fig) return;
var DASHBOARD_SCREENS=JSON.parse(data.textContent).screens;
var bar=fig.querySelector('.tabs'), img=fig.querySelector('.tabimg'), prog=fig.querySelector('.tabprog i'), k=0, auto=!reduce, timer=null;
function show(i){k=i; img.src=DASHBOARD_SCREENS[i].src; img.alt=DASHBOARD_SCREENS[i].alt;
  [].slice.call(bar.children).forEach(function(b,j){b.setAttribute('aria-selected',j===i?'true':'false')});
  prog.classList.remove('run'); void prog.offsetWidth; if(auto) prog.classList.add('run');}
DASHBOARD_SCREENS.forEach(function(s,i){var b=document.createElement('button'); b.type='button'; b.setAttribute('role','tab'); b.textContent=s.label;
  b.addEventListener('click',function(){auto=false; clearInterval(timer); show(i)}); bar.appendChild(b)});
show(0);
if(auto) timer=setInterval(function(){ if(fig.closest('.slide').classList.contains('seen')) show((k+1)%DASHBOARD_SCREENS.length) },5000);
})();
