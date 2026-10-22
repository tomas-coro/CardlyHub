# Assembla mockups/12-home.html dal template della skill mockup (solo #panels e titoli cambiano).
import re, pathlib
T = pathlib.Path.home()/'.claude/skills/mockup/viewer-template.html'
OUT = pathlib.Path(__file__).resolve().parent.parent/'12-home.html'

GAMES = [
 ('briscola','Briscola','2-4 giocatori'),
 ('uno','UNO','2-10 giocatori'),
 ('burraco','Burraco','2 giocatori'),
 ('machiavelli','Machiavelli','2-6 giocatori'),
 ('dadi','Dadi','Yahtzee, 2-6 giocatori'),
]
def art(g):
    if g=='briscola':
        return ''.join(f'<img src="../src/assets/cards/napoletane/{n}.jpg" alt="">' for n in ('denari-07','bastoni-03','coppe-01'))
    if g=='burraco':
        return ''.join(f'<img src="assets/fr/{n}.png" alt="">' for n in ('club_10','heart_8','joker_red'))
    if g=='machiavelli':
        return ''.join(f'<img src="assets/fr/{n}.png" alt="">' for n in ('heart_7','club_3','diamond_9'))
    if g=='uno':
        return '<b class="uc r">5</b><b class="uc b">7</b><b class="uc y">+2</b>'
    pips = lambda n: '<i class="die">'+''.join(f'<s class="{"on" if k in n else ""}"></s>' for k in range(9))+'</i>'
    return pips({0,2,4,6,8})+pips({0,4,8})
def gart(g): return f'<span class="art art-{g}" aria-hidden="true">{art(g)}</span>'

def rows(cls):
    return ''.join(
      f'<button type="button" class="{cls}" data-game="{g}"><span class="gname">{n}</span><span class="gmeta">{m}</span>{gart(g)}</button>'
      for g,n,m in GAMES)

panels = f'''
<section class="dir-panel" data-name="Attuale" data-role="Attuale" data-mood="carta, viola e lime · come è oggi" data-why="Serve da metro: tre colori che litigano e dati finti (128 tavoli, +3 amici) su una pagina che non è la tua.">
 <div class="phone h-now">
  <div class="top"><b class="logo">◆ CardlyHub</b><button type="button" class="pill">Accedi con Google</button></div>
  <span class="st"><i></i>Giochi di carte, senza distanza</span>
  <h2>Il tavolo<br>è già pronto.</h2>
  <p class="lead">Apri una stanza, scegli il gioco e condividi il link. Gli altri entrano senza account.</p>
  <div class="acts"><button type="button" class="main">Apri un tavolo</button><a class="plain">Esplora i giochi</a></div>
  <span class="fake">128 tavoli aperti</span>
  <div class="grid">{rows("tile")}</div>
 </div>
</section>

<section class="dir-panel" data-name="Attuale, sistemata" data-role="Variante +" data-mood="stessa carta e viola · pulita e usabile" data-why="Stessa identità, ma via il finto, un titolo che chiede 'a cosa giochiamo?' e una lista dove scegli e poi apri.">
 <div class="phone h-fix" data-sel="briscola">
  <div class="top"><b class="logo">◆ CardlyHub</b><button type="button" class="pill">Accedi</button></div>
  <h2>A cosa giochiamo<br>stasera?</h2>
  <div class="list">{rows("row")}</div>
  <div class="dock"><button type="button" class="main" data-cta>Apri un tavolo di Briscola</button><button type="button" class="ghost">Ho un codice</button></div>
 </div>
</section>

<section class="dir-panel" data-name="Salotto casinò" data-mood="feltro verde, legno e filo oro · come i tuoi tavoli" data-why="Fa sembrare la home il tavolo su cui poi giochi: stesso verde, stesso oro, quindi niente salto tra home e partita.">
 <div class="phone h-casino" data-sel="briscola">
  <div class="top"><b class="logo">CardlyHub</b><button type="button" class="pill">Accedi</button></div>
  <p class="kick">Sala da gioco</p>
  <h2>Un tavolo<br>per due.</h2>
  <div class="list">{rows("plaque")}</div>
  <div class="dock"><button type="button" class="main" data-cta>Siediti a Briscola</button><button type="button" class="ghost">Ho un codice</button></div>
 </div>
</section>

<section class="dir-panel" data-name="Serata in due" data-mood="lume calda su fondo scuro · intimo, un gioco alla volta" data-why="Per due persone basta scegliere una cosa: un gioco grande al centro, gli altri a un tocco. Meno elenco, più voglia di sedersi.">
 <div class="phone h-sera" data-sel="briscola">
  <div class="top"><b class="logo">CardlyHub</b><button type="button" class="pill">Accedi</button></div>
  <p class="kick">Stasera, in due</p>
  <div class="stage">
   {''.join(f'<div class="show show-{g}"><h2>{n}</h2><p>{m}</p>{gart(g)}</div>' for g,n,m in GAMES)}
  </div>
  <div class="picks" role="group" aria-label="Scegli il gioco">
   {''.join(f'<button type="button" class="pick" data-game="{g}" aria-label="{n}">{gart(g)}</button>' for g,n,m in GAMES)}
  </div>
  <div class="dock"><button type="button" class="main" data-cta>Apri un tavolo di Briscola</button><button type="button" class="ghost">Ho un codice</button></div>
 </div>
</section>
'''

CSS = r'''
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=Gloock&family=Sora:wght@400;600;700&family=Hedvig+Letters+Serif&display=swap" rel="stylesheet">
<style>
/* ---- comune ---- */
.dir-body{padding:18px 10px}
.phone{width:min(100%,390px);margin:0 auto;border-radius:22px;padding:18px 16px 16px;position:relative;overflow:hidden}
.phone .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.phone .logo{font-size:1.05rem}
.phone button{font:inherit;cursor:pointer}
.phone h2{margin:0}
.pill,.ghost,.main{min-height:44px;border-radius:999px;padding:0 16px;font-weight:700;font-size:.8rem}
.main{width:100%;border:0}
.ghost{width:100%;background:transparent}
.dock{display:grid;gap:8px;margin-top:16px}
.art{display:flex;align-items:center;justify-content:center}
.art img{display:block;width:34px;height:auto;border-radius:3px;box-shadow:0 2px 5px rgba(0,0,0,.35);background:#fff}
.art img+img,.art .uc+.uc{margin-left:-14px}
.art img:nth-child(1),.art .uc:nth-child(1){transform:rotate(-9deg)}
.art img:nth-child(3),.art .uc:nth-child(3){transform:rotate(9deg)}
.art img:nth-child(2),.art .uc:nth-child(2){position:relative;z-index:1;transform:translateY(-3px)}
.uc{display:grid;place-items:center;width:30px;height:44px;border-radius:5px;border:2px solid #fff;color:#fff;font-weight:900;font-size:.8rem;box-shadow:0 2px 5px rgba(0,0,0,.35)}
.uc.r{background:#e4261f}.uc.b{background:#1f6fd1}.uc.y{background:#f7c600;color:#16181d}
.die{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;width:30px;height:30px;padding:4px;border-radius:7px;background:#c4281f;box-shadow:0 2px 5px rgba(0,0,0,.35)}
.die+.die{margin-left:6px;transform:rotate(12deg)}
.die s{border-radius:50%}.die s.on{background:#f6ecd6}
.art-dadi{gap:0}

/* ---- 1 Attuale ---- */
.h-now{background:#f5f2e9;color:#17152b;font-family:"Archivo",sans-serif}
.h-now .pill{border:0;background:#6754e9;color:#fff}
.h-now .st{display:flex;gap:8px;align-items:center;font-size:.68rem;font-weight:700;margin-bottom:12px}
.h-now .st i{width:8px;height:8px;border-radius:50%;background:#c8ef62;box-shadow:0 0 0 4px rgba(200,239,98,.25)}
.h-now h2{font-weight:900;font-size:2.7rem;line-height:.88;letter-spacing:-.07em}
.h-now .lead{font-size:.85rem;opacity:.72;margin:14px 0 16px}
.h-now .acts{display:flex;gap:16px;align-items:center}
.h-now .main{width:auto;border-radius:7px;background:#6754e9;color:#fff;box-shadow:4px 4px 0 #17152b}
.h-now .plain{font-weight:700;font-size:.8rem;border-bottom:1px solid;padding:6px 0}
.h-now .fake{display:inline-block;margin:18px 0 10px;padding:6px 12px;border-radius:99px;background:#c8ef62;font-size:.7rem;font-weight:800;border:1.5px solid #17152b}
.h-now .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.h-now .tile{display:grid;text-align:left;gap:2px;padding:12px;border:1.5px solid #17152b;border-radius:12px;color:#17152b;min-height:112px;align-content:space-between}
.h-now .tile:nth-child(3n+1){background:#ff6557}.h-now .tile:nth-child(3n+2){background:#c8ef62}.h-now .tile:nth-child(3n){background:#a99cff}
.h-now .gname{font-weight:900;font-size:1rem}.h-now .gmeta{font-size:.66rem;opacity:.75}
.h-now .art{justify-content:flex-start;margin-top:8px}

/* ---- 2 Attuale sistemata ---- */
.h-fix{background:#f5f2e9;color:#17152b;font-family:"Archivo",sans-serif}
.h-fix .pill{border:1.5px solid #17152b;background:transparent}
.h-fix h2{font-weight:900;font-size:2.1rem;line-height:.95;letter-spacing:-.06em;margin-bottom:16px}
.h-fix .list{display:grid;gap:8px}
.h-fix .row{display:grid;grid-template-columns:1fr auto;grid-template-areas:"n a" "m a";align-items:center;text-align:left;padding:10px 14px;min-height:64px;border:1.5px solid rgba(23,21,43,.2);border-radius:12px;background:#fff;color:#17152b;transition:transform .12s,border-color .12s}
.h-fix .row .gname{grid-area:n;font-weight:900;font-size:1.05rem}.h-fix .row .gmeta{grid-area:m;font-size:.68rem;opacity:.65}.h-fix .row .art{grid-area:a}
.h-fix .row:hover{transform:translateY(-1px)}
.h-fix .row.sel{border-color:#6754e9;box-shadow:4px 4px 0 #6754e9}
.h-fix .main{border-radius:8px;background:#6754e9;color:#fff;box-shadow:4px 4px 0 #17152b}
.h-fix .ghost{border:1.5px solid #17152b;color:#17152b;border-radius:8px}

/* ---- 3 Salotto casino ---- */
.h-casino{background:radial-gradient(120% 70% at 50% 0%,#17694a 0,#0d4a33 55%,#093626 100%);color:#f6ecd6;font-family:"Hanken Grotesk",sans-serif;border:6px solid #3a2415;box-shadow:inset 0 0 0 2px #d4af5a}
.h-casino .logo{font-family:"Gloock",serif;font-size:1.2rem;color:#d4af5a}
.h-casino .pill{border:1px solid #d4af5a;background:transparent;color:#f6ecd6}
.h-casino .kick{margin:0 0 4px;font-size:.66rem;letter-spacing:.24em;text-transform:uppercase;color:#d4af5a;font-weight:700}
.h-casino h2{font-family:"Gloock",serif;font-weight:400;font-size:2.6rem;line-height:.95;margin-bottom:16px}
.h-casino .list{display:grid;gap:9px}
.h-casino .plaque{display:grid;grid-template-columns:1fr auto;grid-template-areas:"n a" "m a";align-items:center;text-align:left;padding:10px 14px;min-height:68px;border-radius:12px;border:1px solid rgba(212,175,90,.35);background:rgba(8,40,28,.55);color:#f6ecd6;transition:border-color .12s,background .12s}
.h-casino .plaque .gname{grid-area:n;font-family:"Gloock",serif;font-size:1.25rem}.h-casino .plaque .gmeta{grid-area:m;font-size:.68rem;opacity:.7}.h-casino .plaque .art{grid-area:a}
.h-casino .plaque.sel{border-color:#d4af5a;background:rgba(212,175,90,.14);box-shadow:0 0 0 1px #d4af5a}
.h-casino .main{background:#d4af5a;color:#2a1a0c;font-family:"Gloock",serif;font-size:1rem;font-weight:400}
.h-casino .ghost{border:1px solid rgba(246,236,214,.5);color:#f6ecd6}

/* ---- 4 Serata in due ---- */
.h-sera{background:#1b1320;color:#f3e7d6;font-family:"Sora",sans-serif;min-height:640px;display:flex;flex-direction:column}
.h-sera .logo{font-weight:700;letter-spacing:-.02em}
.h-sera .pill{border:1px solid rgba(243,231,214,.35);background:transparent;color:#f3e7d6}
.h-sera .kick{margin:0;font-size:.74rem;opacity:.65}
.h-sera .stage{flex:1;display:grid;align-content:center;padding:6px 0 16px}
.h-sera .show{display:none;flex-direction:column;align-items:flex-start;gap:4px;animation:in .3s ease}
@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.h-sera[data-sel=briscola] .show-briscola,.h-sera[data-sel=uno] .show-uno,.h-sera[data-sel=burraco] .show-burraco,.h-sera[data-sel=machiavelli] .show-machiavelli,.h-sera[data-sel=dadi] .show-dadi{display:flex}
.h-sera .show h2{font-family:"Hedvig Letters Serif",serif;font-weight:400;font-size:3.4rem;line-height:1}
.h-sera .show p{margin:0 0 18px;font-size:.78rem;opacity:.7}
.h-sera .show .art{align-self:center;transform:scale(2.3);transform-origin:center;margin:46px 0 40px;height:70px}
.h-sera .picks{display:flex;gap:8px;justify-content:space-between}
.h-sera .pick{flex:1;min-height:56px;border-radius:14px;border:1px solid rgba(243,231,214,.2);background:rgba(243,231,214,.05);display:grid;place-items:center;padding:0;overflow:hidden;transition:border-color .12s,background .12s}
.h-sera .pick .art{transform:scale(.55)}
.h-sera .pick.sel{border-color:#f2b45a;background:rgba(242,180,90,.14)}
.h-sera .main{background:#f2b45a;color:#2a1608}
.h-sera .ghost{border:1px solid rgba(243,231,214,.35);color:#f3e7d6}

button:focus-visible{outline:3px solid #f2b45a;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.show{animation:none!important}}
</style>
'''

JS = r'''
<script>
// Interazione chiave (uguale in ogni tile): scegli un gioco, il pulsante principale cambia nome. Salvato in localStorage (dato finto).
(function(){
  const NAMES={briscola:'Briscola',uno:'UNO',burraco:'Burraco',machiavelli:'Machiavelli',dadi:'Dadi'};
  const CTA={'h-fix':'Apri un tavolo di ','h-sera':'Apri un tavolo di ','h-casino':'Siediti a '};
  let sel='briscola'; try{sel=localStorage.getItem('mock-home-sel')||sel}catch(_){}
  function apply(){
    document.querySelectorAll('.phone[data-sel]').forEach(p=>{
      p.dataset.sel=sel;
      p.querySelectorAll('[data-game]').forEach(b=>{b.classList.toggle('sel',b.dataset.game===sel);b.setAttribute('aria-pressed',b.dataset.game===sel)});
      const k=Object.keys(CTA).find(c=>p.classList.contains(c));
      p.querySelectorAll('[data-cta]').forEach(c=>c.textContent=CTA[k]+NAMES[sel]);
    });
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(!b)return;sel=b.dataset.game;try{localStorage.setItem('mock-home-sel',sel)}catch(_){};apply()});
  apply();
})();
</script>
'''

t = T.read_text()
t = re.sub(r'<main id="stage">\s*<div id="panels">.*?</div>\s*</main>', '<main id="stage">\n<div id="panels">'+panels+'</div>\n  </main>', t, flags=re.S)
t = t.replace('<title>Direzioni · mockup</title>','<title>Home CardlyHub</title>'+CSS)
t = t.replace('Mockup — esempio','Home di CardlyHub - 4 direzioni')
t = t.replace('</body>', JS+'</body>')
OUT.write_text(t)
print(OUT, len(t))
