# Genera mockups/13-home-casino.html (home responsive) e 13-home-casino-confronto.html (desktop + mobile affiancati)
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent

GAMES = [
 ('briscola','Briscola','2-4 giocatori'),
 ('uno','UNO','2-10 giocatori'),
 ('burraco','Burraco','2 giocatori'),
 ('machiavelli','Machiavelli','2-6 giocatori'),
 ('dadi','Dadi','Yahtzee, 2-6 giocatori'),
]
UNO={'red':'#e4261f','blue':'#1f6fd1','yellow':'#f7c600'}
def uno_face(color,val):
    fill=UNO[color]; ink='#16181d' if color=='yellow' else '#fff'; rev=val=='rev'
    arrow=lambda x,y,size,col:f'<g transform="translate({x} {y}) scale({size/24})" fill="none" stroke="{col}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5"/></g>'
    idx=lambda rot:'<g'+(' transform="rotate(180 100 150)"' if rot else '')+'>'+(arrow(10,8,56,ink) if rev else f'<text x="16" y="56" font-size="54" font-weight="900" fill="{ink}">{val}</text>')+'</g>'
    mid=arrow(42,112,116,'#16181d' if color=='yellow' else fill) if rev else f'<text x="100" y="205" text-anchor="middle" font-size="120" font-weight="900" letter-spacing="-6" fill="{"#16181d" if color=="yellow" else fill}">{val}</text>'
    return (f'<svg class="it uno" viewBox="0 0 200 300" aria-hidden="true"><rect width="200" height="300" rx="18" fill="#fff"/>'
      f'<clipPath id="uf-{color}"><rect x="10" y="10" width="180" height="280" rx="16"/></clipPath>'
      f'<g clip-path="url(#uf-{color})"><rect x="10" y="10" width="180" height="280" fill="{fill}"/><circle cx="168" cy="268" r="62" fill="#000" fill-opacity=".16"/><circle cx="163" cy="39" r="11" fill="#fff" fill-opacity=".3"/></g>'
      f'<ellipse cx="100" cy="168" rx="92" ry="93" fill="#fff" transform="rotate(-28 100 168)"/>{mid}{idx(False)}{idx(True)}</svg>')

def items(g):
    if g=='briscola':   return ''.join(f'<img class="it" src="../src/assets/cards/napoletane/{n}.jpg" alt="">' for n in ('denari-07','bastoni-03','coppe-01'))
    if g=='burraco':    return ''.join(f'<img class="it" src="assets/fr/{n}.png" alt="">' for n in ('club_10','heart_8','joker_red'))
    if g=='machiavelli':return ''.join(f'<img class="it" src="assets/fr/{n}.png" alt="">' for n in ('heart_7','club_3','diamond_9'))
    if g=='uno':        return ''.join(uno_face(c,v) for c,v in (('blue','5'),('yellow','rev'),('red','7')))
    pip=lambda on:'<i class="it die">'+''.join(f'<s class="{"on" if k in on else ""}"></s>' for k in range(9))+'</i>'
    return pip({0,2,4,6,8})+pip({0,4,8})

BYID={g:(g,n,m) for g,n,m in GAMES}
CATS=[('Carte francesi',['burraco','machiavelli']),('Carte da briscola',['briscola']),('Carte UNO',['uno']),('Dadi',['dadi'])]
def spot(g,n,m): return (f'<button type="button" class="spot" data-game="{g}" aria-pressed="false"><span class="chip">Scelto</span><span class="art art-{g}" aria-hidden="true">{items(g)}</span><span class="gname">{n}</span></button>')
cats=''.join(
 f'<section class="cat" style="--n:{len(ids)}" data-n="{len(ids)}" aria-label="{t}"><h2>{t}</h2><div class="cat-spots">'+''.join(spot(*BYID[i]) for i in ids)+'</div></section>'
 for t,ids in CATS)

PAGE = r'''<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Home CardlyHub - Salotto casinò</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Hanken+Grotesk:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{
  --gold:#d4af5a; --gold-soft:rgba(212,175,90,.38); --ivory:#f6ecd6;
  --felt-1:#1a6d4b; --felt-2:#0e4b34; --felt-3:#08301f;
  --wood-1:#4a2c18; --wood-2:#2c190d;
  --cw:clamp(52px,5vw,78px);
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:var(--wood-2);color:var(--ivory);font-family:"Hanken Grotesk",sans-serif;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:3px solid var(--gold);outline-offset:3px}

/* bordo in legno + filo oro */
.rim{min-height:100vh;min-height:100dvh;padding:14px;
  background:repeating-linear-gradient(94deg,rgba(0,0,0,.14) 0 2px,transparent 2px 9px),linear-gradient(180deg,var(--wood-1),var(--wood-2))}
/* feltro: luce dall'alto + grana */
.felt{position:relative;min-height:calc(100vh - 28px);min-height:calc(100dvh - 28px);border-radius:26px;overflow:hidden;
  display:flex;flex-direction:column;padding:0 clamp(18px,4vw,64px) 0;
  background:radial-gradient(90% 70% at 50% 18%,var(--felt-1) 0,var(--felt-2) 55%,var(--felt-3) 100%);
  box-shadow:inset 0 0 0 2px var(--gold),inset 0 0 0 7px rgba(0,0,0,.28),inset 0 0 80px rgba(0,0,0,.45)}
.felt::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.felt>*{position:relative}

/* barra in alto */
.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:26px 0 0}
.logo{font-family:"Gloock",serif;font-size:1.5rem;color:var(--gold);letter-spacing:.01em;text-decoration:none}
.bar nav{display:flex;gap:10px;align-items:center}
.btn-line{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--gold-soft);background:transparent;font-weight:600;font-size:.86rem;transition:background .15s,border-color .15s}
.btn-line:hover{background:rgba(212,175,90,.12);border-color:var(--gold)}

/* titolo */
.hero{text-align:center;padding:clamp(22px,5vh,56px) 0 clamp(18px,3.5vh,40px)}
.kick{margin:0 0 10px;font-size:.72rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);font-weight:700}
h1{margin:0;font-family:"Gloock",serif;font-weight:400;font-size:clamp(2.7rem,6.4vw,5.4rem);line-height:.95;text-wrap:balance}
.lead{margin:16px auto 0;max-width:46ch;font-size:clamp(.9rem,1.4vw,1.05rem);line-height:1.55;opacity:.78;text-wrap:pretty}

/* postazioni sul feltro */
.cats{display:flex;flex-wrap:wrap;gap:clamp(18px,2.4vw,34px) clamp(14px,2vw,28px);max-width:1180px;width:100%;margin:0 auto}
.cat{flex:var(--n) 1 calc(var(--n)*170px);min-width:0;display:flex;flex-direction:column;gap:24px}
.cat h2{margin:0;display:flex;align-items:center;gap:12px;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700}
.cat h2::after{content:"";flex:1;min-width:12px;height:1px;background:var(--gold-soft)}
.cat-spots{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:clamp(10px,1.4vw,18px);flex:1}
.spot{position:relative;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:4px;padding:18px 10px 16px;border-radius:26px;
  border:1.5px dashed var(--gold-soft);background:rgba(4,30,19,.22);text-align:center;
  transition:transform .2s ease,border-color .2s,background .2s,box-shadow .2s;--k:1}
.spot:hover{transform:translateY(-5px);--k:1.45;border-color:var(--gold)}
.spot[aria-pressed="true"]{--k:1.3;border:1.5px solid var(--gold);background:radial-gradient(80% 70% at 50% 35%,rgba(212,175,90,.22),rgba(4,30,19,.3));
  box-shadow:0 0 0 4px rgba(212,175,90,.12),0 16px 30px rgba(0,0,0,.35)}
.chip{position:absolute;top:-11px;left:50%;margin-left:-32px;width:64px;text-align:center;padding:3px 9px;border-radius:999px;background:var(--gold);color:#2a1a0c;font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:0;transform:scale(.8);transition:opacity .15s,transform .15s}
.spot{padding-top:26px}
.spot[aria-pressed="true"] .chip{opacity:1;transform:none}
.gname{font-family:"Gloock",serif;font-size:clamp(1.15rem,1.8vw,1.6rem)}
.gmeta{font-size:.74rem;opacity:.7}

/* carte, dadi e UNO appoggiati sul tavolo */
.art{position:relative;display:block;width:100%;height:calc(var(--cw)*1.75);margin-bottom:8px}
.it{position:absolute;left:50%;top:50%;display:block;margin:0;
  transform:translate(calc(-50% + var(--d,0px)*var(--k)),calc(-50% + var(--y,0px))) rotate(calc(var(--a,0deg)*var(--k)));
  transition:transform .25s cubic-bezier(.2,.8,.3,1)}
img.it{width:var(--cw);height:auto;border-radius:4px;background:#fff;box-shadow:0 6px 12px rgba(0,0,0,.45)}
.it:nth-child(1){--d:calc(var(--cw)*-.56);--a:-11deg;--y:calc(var(--cw)*.06)}
.it:nth-child(2){--d:0px;--a:0deg;--y:calc(var(--cw)*-.08);z-index:2}
.it:nth-child(3){--d:calc(var(--cw)*.56);--a:11deg;--y:calc(var(--cw)*.06)}
.it.uno{width:var(--cw);height:calc(var(--cw)*1.5);font-family:"Hanken Grotesk",sans-serif;filter:drop-shadow(0 6px 6px rgba(0,0,0,.45))}
.uc{width:var(--cw);height:calc(var(--cw)*1.5);border-radius:calc(var(--cw)*.12);border:3px solid #fff;display:grid;place-items:center;box-shadow:0 6px 12px rgba(0,0,0,.45);overflow:hidden}
.uc::before{content:"";position:absolute;width:150%;height:60%;border-radius:50%;background:#fff;transform:rotate(-28deg)}
.uc span{position:relative;font-weight:800;font-size:calc(var(--cw)*.55);letter-spacing:-.04em;line-height:1}
.uc.r{background:#e4261f}.uc.r span{color:#e4261f}
.uc.b{background:#1f6fd1}.uc.b span{color:#1f6fd1}
.uc.y{background:#f7c600}.uc.y span{color:#16181d}
.die{width:calc(var(--cw)*.95);height:calc(var(--cw)*.95);display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--cw)*.05);padding:calc(var(--cw)*.14);border-radius:calc(var(--cw)*.2);
  background:linear-gradient(145deg,#d93a2d,#a81f17);box-shadow:0 6px 12px rgba(0,0,0,.5),inset 0 2px 3px rgba(255,255,255,.3)}
.die s{border-radius:50%}.die s.on{background:#f6ecd6;box-shadow:inset 0 -1px 2px rgba(0,0,0,.35)}
.art-dadi .it:nth-child(1){--d:calc(var(--cw)*-.55);--a:-14deg;--y:calc(var(--cw)*.1)}
.art-dadi .it:nth-child(2){--d:calc(var(--cw)*.55);--a:18deg;--y:calc(var(--cw)*-.1)}

.art-uno .it:nth-child(1){--d:calc(var(--cw)*-.66)}
.art-uno .it:nth-child(3){--d:calc(var(--cw)*.66)}

/* barra azioni */
.dock{margin:auto auto 0;padding:clamp(20px,4vh,40px) 0 26px;display:flex;flex-direction:column;align-items:center;gap:14px;width:100%}
.dock-row{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
.main{min-height:52px;padding:0 30px;border:0;border-radius:999px;background:var(--gold);color:#2a1a0c;font-family:"Gloock",serif;font-size:1.15rem;
  box-shadow:0 6px 0 #8a6a2b,0 12px 22px rgba(0,0,0,.35);transition:transform .12s,box-shadow .12s}
.main:hover{transform:translateY(-2px);box-shadow:0 8px 0 #8a6a2b,0 16px 26px rgba(0,0,0,.35)}
.main:active{transform:translateY(4px);box-shadow:0 2px 0 #8a6a2b,0 4px 10px rgba(0,0,0,.35)}
.trust{margin:0;font-size:.74rem;letter-spacing:.04em;color:var(--gold);opacity:.85;text-align:center}

/* mobile */
@media (max-width:760px){
  .rim{padding:8px}
  .felt{border-radius:20px;min-height:calc(100dvh - 16px);padding:0 14px;--cw:48px}
  .bar{padding-top:18px}
  .logo{font-size:1.25rem}
  .btn-line.code{display:none}
  .hero{padding:22px 0 20px}
  .cats{flex-direction:column;gap:18px}
  .cat{flex:none;gap:14px}
  .cat-spots{gap:10px}
  .spot{padding:22px 8px 12px;border-radius:20px}
  .cat[data-n="1"] .spot{display:grid;grid-template-columns:52% 1fr;grid-template-rows:1fr 1fr;gap:0 10px;padding:20px 16px 14px;text-align:left;justify-items:start}
  .cat[data-n="1"] .art{grid-row:1/3;margin:0}
  .cat[data-n="1"] .gname{grid-row:1/3;align-self:center}
  .spot:hover{transform:none}
  .art{height:calc(var(--cw)*1.7)}
  .dock{position:sticky;bottom:0;width:auto;margin:12px -14px 0;padding:22px 14px calc(14px + env(safe-area-inset-bottom));gap:10px;
    background:linear-gradient(180deg,rgba(8,48,31,0),rgba(8,48,31,.96) 34%)}
  .dock-row{width:100%}
  .main{width:100%}
  .dock-row .btn-line{flex:1}
  .trust{display:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>
<div class="rim"><main class="felt">
  <header class="bar">
    <a class="logo" href="#" aria-label="CardlyHub, pagina iniziale">CardlyHub</a>
    <nav aria-label="Account"><button type="button" class="btn-line code">Ho un codice</button><button type="button" class="btn-line">Accedi con Google</button></nav>
  </header>
  <section class="hero">
    <p class="kick">Sala da gioco</p>
    <h1>Un tavolo per due.<br>Scegli il gioco.</h1>
    <p class="lead">Appoggia il gioco sul feltro, apri il tavolo e manda il link. Chi entra non ha bisogno di un account.</p>
  </section>
  <div class="cats" role="group" aria-label="Scegli il gioco">%%CATS%%</div>
  <footer class="dock">
    <div class="dock-row">
      <button type="button" class="main" data-cta>Siediti a Briscola</button>
      <button type="button" class="btn-line code2">Ho un codice</button>
    </div>
    <p class="trust">Nessun download · Invita con un link · Gli ospiti entrano senza account</p>
  </footer>
</main></div>
<script>
// Interazione finta: scegli un gioco, il pulsante cambia nome. Salvato in localStorage (con try/catch).
(function(){
  const N={briscola:'Briscola',uno:'UNO',burraco:'Burraco',machiavelli:'Machiavelli',dadi:'Dadi'};
  let sel='briscola'; try{sel=localStorage.getItem('mock-casino-sel')||sel}catch(_){}
  function apply(){
    document.querySelectorAll('.spot').forEach(b=>b.setAttribute('aria-pressed',b.dataset.game===sel));
    document.querySelector('[data-cta]').textContent='Siediti a '+N[sel];
  }
  document.querySelectorAll('.spot').forEach(b=>b.addEventListener('click',()=>{sel=b.dataset.game;try{localStorage.setItem('mock-casino-sel',sel)}catch(_){};apply()}));
  apply();
})();
</script>
</body>
</html>
'''
(ROOT/'13-home-casino.html').write_text(PAGE.replace('%%CATS%%',cats))

# pagina di confronto: la stessa home dentro due cornici, desktop (scalato) e telefono
CMP = r'''<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Home casinò - desktop e mobile</title>
<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Hanken+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{--gold:#d4af5a}
*{box-sizing:border-box}
body{margin:0;background:#14100c;color:#f6ecd6;font-family:"Hanken Grotesk",sans-serif;padding:24px 18px 60px}
h1{font-family:"Gloock",serif;font-weight:400;font-size:1.6rem;margin:0 0 4px}
.sub{margin:0 0 22px;opacity:.7;font-size:.9rem}
.row{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}
.cap{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:700;margin:0 0 8px}
.desk{width:880px;height:560px;border-radius:12px;border:1px solid #3a2f24;overflow:hidden;background:#000}
.desk iframe{width:1440px;height:915px;border:0;transform:scale(.611);transform-origin:0 0}
.mob{width:390px;height:780px;border-radius:30px;border:6px solid #2a2118;overflow:hidden;background:#000}
.mob iframe{width:100%;height:100%;border:0}
.note{margin-top:22px;font-size:.85rem;opacity:.75;max-width:70ch;line-height:1.5}
@media (max-width:900px){.desk{width:100%;height:auto;aspect-ratio:1440/915}.desk iframe{transform:none;width:100%;height:100%}}
</style></head><body>
<h1>Salotto casinò - desktop e mobile</h1>
<p class="sub">È la stessa pagina (<code>13-home-casino.html</code>) vista in due larghezze. Toccate i giochi dentro le cornici.</p>
<div class="row">
  <div><p class="cap">Desktop 1440px (ridotto)</p><div class="desk"><iframe src="13-home-casino.html" title="Home desktop"></iframe></div></div>
  <div><p class="cap">Telefono 390px</p><div class="mob"><iframe src="13-home-casino.html" title="Home mobile"></iframe></div></div>
</div>
<p class="note">Per vedere la pagina a grandezza vera aprite <b>13-home-casino.html</b> e ridimensionate la finestra.</p>
</body></html>
'''
(ROOT/'13-home-casino-confronto.html').write_text(CMP)
print('ok')
