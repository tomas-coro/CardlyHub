# Genera mockups/15-home-categorie.html: 3 direzioni per la nuova home a categorie (feltro verde mantenuto)
import pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
TPL = pathlib.Path.home() / '.claude/skills/mockup/viewer-template.html'
# riuso uno_face dal builder della home 13
src = (ROOT / '_src/build-home-casino.py').read_text()
ns = {}
exec(src[src.index('UNO={'):src.index('def items')], ns)
uno_face = ns['uno_face']

def img(p): return f'<img class="it" src="{p}" alt="">'
def pip(on): return '<i class="it die">' + ''.join(f'<s class="{"on" if k in on else ""}"></s>' for k in range(9)) + '</i>'
ART = {
 'colored': ''.join(uno_face(c, v) for c, v in (('blue', '5'), ('yellow', 'rev'), ('red', '7'))),
 'poker':   ''.join(img(f'assets/fr/{n}.png') for n in ('spade_queen', 'heart_8', 'diamond_king')),
 'italian': ''.join(img(f'../src/assets/cards/napoletane/{n}.jpg') for n in ('denari-07', 'bastoni-03', 'coppe-01')),
 'dice':    pip({2, 6}) + pip({2, 4, 6}) + pip({0, 2, 4, 6, 8}),
}
CATS = [
 ('colored', 'Carte colorate', 'Il mazzo UNO, dai duelli rapidi alle sfide simultanee.',
  ['UNO'], ['Sprint', 'Colore Proibito', 'Roulette', 'Catena', 'Bersaglio', 'Guerra Cromatica', 'Ultima Carta', 'Caos']),
 ('poker', 'Mazzo Poker', 'Carte francesi per velocità, combinazioni e memoria.',
  ['Machiavelli', 'Burraco'], ['Speed', 'Slapjack', 'Irish Snap', 'Durak', 'Trentuno', 'Poker Lampo', 'Scala Flash', 'Golf']),
 ('italian', 'Mazzo italiano', 'Quaranta carte, prese, scope e giochi della tradizione.',
  ['Briscola'], ['Briscola Bersaglio', 'Briscola 151', 'Sette e Mezzo', 'Scopa', 'Scopa Flash', 'Rubamazzo', 'Presa Comune', 'I Quattro Semi']),
 ('dice', 'Dadi', 'Rischio, obiettivi e combinazioni da uno a cinque dadi.',
  ['Yahtzee'], ['Mira 100', 'Spaccato!', 'Poker di Dadi', 'Banco Rotto', 'Cambio Faccia', 'Codice Comune', 'Linea Storta', 'Te lo Passo', 'Faccia Segreta']),
]
def meta(ready, soon): return f'{len(ready)} {"pronto" if len(ready)==1 else "pronti"} · {len(soon)} presto'

def bar():
    return ('<div class="bar"><span class="logo">CardlyHub</span><nav>'
            '<button type="button" class="btn-line">Statistiche</button>'
            '<button type="button" class="btn-line">Abbina account</button>'
            '<button type="button" class="btn-line">Accedi con Google</button></nav></div>')

def cat_screen(c):
    cid, name, note, ready, soon = c
    games = ''.join(
        f'<div class="g-card"><span class="g-art fan">{ART[cid]}</span><span class="g-name">{r}</span>'
        f'<span class="g-act"><button type="button" class="btn-gold" data-play>Gioca</button>'
        f'<button type="button" class="btn-q" aria-label="Regole di {r}">?</button></span></div>' for r in ready)
    pills = ''.join(f'<li>{s}</li>' for s in soon)
    return (f'<div class="scr scr-cat" data-for="{cid}" hidden>{bar()}'
            f'<div class="cat-head"><button type="button" class="back" data-back>← Sala</button>'
            f'<h2>{name}</h2><p>{note}</p></div>'
            f'<div class="g-grid" data-n="{len(ready)}">{games}</div>'
            f'<div class="soon"><h3>Prossimamente · {len(soon)}</h3><ul>{pills}</ul></div></div>')

def screens(): return ''.join(cat_screen(c) for c in CATS)

# ---------- A: quattro tavoli 2x2 ----------
def dir_a():
    tiles = ''.join(
        f'<button type="button" class="tile" data-cat="{c[0]}"><span class="fan">{ART[c[0]]}</span>'
        f'<span class="t-name">{c[1]}</span><span class="t-meta">{meta(c[3], c[4])}</span></button>' for c in CATS)
    return (f'<div class="d d-a felt">'
            f'<div class="scr scr-home">{bar()}<div class="hero"><p class="kick">Sala da gioco</p><h1>Scegli un mazzo.</h1></div>'
            f'<div class="tiles">{tiles}</div>'
            f'<div class="tour"><button type="button" class="btn-gold">Crea torneo</button><span>Sfide a punti tra due account, con regole su misura.</span></div></div>'
            f'{screens()}</div>')

# ---------- B: pannelli verticali che si aprono ----------
def dir_b():
    cols = ''.join(
        f'<button type="button" class="col" data-cat="{c[0]}"><span class="col-n">0{i+1}</span><span class="fan">{ART[c[0]]}</span>'
        f'<span class="t-name">{c[1]}</span><span class="t-meta">{meta(c[3], c[4])}</span>'
        f'<span class="col-more">{"".join(f"<b>{g}</b>" for g in c[3])}<em>+ {len(c[4])} in arrivo</em><u>Entra →</u></span></button>' for i, c in enumerate(CATS))
    return (f'<div class="d d-b felt">'
            f'<div class="scr scr-home">{bar()}<div class="hero"><h1>Quattro mazzi. <i>Una sala.</i></h1>'
            f'<button type="button" class="btn-gold">Crea torneo</button></div><div class="cols">{cols}</div></div>'
            f'{screens()}</div>')

# ---------- C: indice numerato ----------
def dir_c():
    rows = ''.join(
        f'<button type="button" class="row" data-cat="{c[0]}"><span class="r-n">0{i+1}</span>'
        f'<span class="r-txt"><span class="t-name">{c[1]}</span><span class="r-note">{c[2]}</span></span>'
        f'<span class="t-meta">{meta(c[3], c[4])}</span><span class="fan">{ART[c[0]]}</span></button>' for i, c in enumerate(CATS))
    return (f'<div class="d d-c felt">'
            f'<div class="scr scr-home">{bar()}<div class="idx">{rows}'
            f'<div class="row-tour"><span class="r-n">★</span><span class="t-name">Torneo</span><button type="button" class="btn-gold">Crea torneo</button></div></div></div>'
            f'{screens()}</div>')

CSS = r'''
<style>
.wrap{max-width:1180px}
.dir-body{padding:0!important}
.d{--gold:#d4af5a;--gold-soft:rgba(212,175,90,.38);--ivory:#f6ecd6;--felt-1:#1a6d4b;--felt-2:#0e4b34;--felt-3:#08301f;--cw:clamp(50px,5.2vw,78px);
  position:relative;min-height:640px;color:var(--ivory);font-family:"Hanken Grotesk",sans-serif;overflow:hidden;
  background:radial-gradient(90% 70% at 50% 18%,var(--felt-1),var(--felt-2) 55%,var(--felt-3));
  box-shadow:inset 0 0 0 2px var(--gold),inset 0 0 0 7px rgba(0,0,0,.28),inset 0 0 80px rgba(0,0,0,.45)}
.d::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.d .scr{position:relative;padding:0 clamp(18px,3.4vw,52px) 28px;min-height:640px;display:flex;flex-direction:column}
.d .scr[hidden]{display:none}
.d button{font:inherit;color:inherit;cursor:pointer}
.d :focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.d .bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:24px 0 0;flex-wrap:wrap}
.d .logo{font-family:"Gloock",serif;font-size:1.5rem;color:var(--gold)}
.d .bar nav{display:flex;gap:8px;flex-wrap:wrap}
.d .btn-line{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--gold-soft);background:transparent;font-weight:600;font-size:.84rem;transition:background .15s,border-color .15s}
.d .btn-line:hover{background:rgba(212,175,90,.12);border-color:var(--gold)}
.d .btn-gold{min-height:46px;padding:0 24px;border:0;border-radius:999px;background:var(--gold);color:#2a1a0c;font-family:"Gloock",serif;font-size:1.05rem;transition:transform .15s,filter .15s}
.d .btn-gold:hover{transform:translateY(-2px);filter:brightness(1.08)}
.d .kick{margin:0 0 8px;font-size:.72rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);font-weight:700}
.d h1{margin:0;font-family:"Gloock",serif;font-weight:400;line-height:.98;text-wrap:balance}
.d .t-name{font-family:"Gloock",serif;line-height:1.05}
.d .t-meta{font-size:.76rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold)}
/* carte a ventaglio */
.d .fan{display:flex;justify-content:center;align-items:center;--sp:.2;pointer-events:none}
.d .fan .it{width:var(--cw);height:auto;aspect-ratio:2/3;object-fit:cover;border-radius:7px;flex:none;margin:0 calc(var(--cw)*-.16);filter:drop-shadow(0 6px 6px rgba(0,0,0,.45));
  transform:translateY(var(--y,0)) rotate(var(--a,0deg));transition:transform .3s cubic-bezier(.2,.8,.2,1),margin .3s cubic-bezier(.2,.8,.2,1)}
.d .fan .it:nth-child(1){--a:-13deg;--y:calc(var(--cw)*.06)}
.d .fan .it:nth-child(3){--a:13deg;--y:calc(var(--cw)*.06)}
.d .fan .it.die{width:calc(var(--cw)*.95);height:calc(var(--cw)*.95);aspect-ratio:auto;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:calc(var(--cw)*.05);padding:calc(var(--cw)*.14);border-radius:calc(var(--cw)*.2);
  background:linear-gradient(145deg,#d93a2d,#a81f17);box-shadow:0 6px 12px rgba(0,0,0,.5),inset 0 2px 3px rgba(255,255,255,.3);margin:0 calc(var(--cw)*.06)}
.d .fan .die s{display:block;border-radius:50%}.d .fan .die s.on{background:#f6ecd6;box-shadow:inset 0 -1px 2px rgba(0,0,0,.35)}
.d .fan .die:nth-child(1){--a:-14deg}.d .fan .die:nth-child(2){--a:10deg;--y:calc(var(--cw)*-.1)}.d .fan .die:nth-child(3){--a:20deg;--y:calc(var(--cw)*.08)}
.d [data-cat]:hover .fan .it,.d [data-cat]:focus-visible .fan .it{margin:0 calc(var(--cw)*-.02)}
.d .hov:hover .fan .it.die,.d [data-cat]:hover .fan .it.die,.d [data-cat]:focus-visible .fan .it.die{margin:0 calc(var(--cw)*.1)}
/* schermata categoria */
.d .cat-head{padding:22px 0 8px}
.d .back{min-height:44px;padding:0 16px;border:1px solid var(--gold-soft);border-radius:999px;background:transparent;font-weight:600;font-size:.84rem;margin-bottom:14px}
.d .back:hover{border-color:var(--gold);background:rgba(212,175,90,.12)}
.d .cat-head h2{margin:0;font:400 clamp(2.2rem,4.4vw,3.8rem)/1 "Gloock",serif;color:var(--gold)}
.d .cat-head p{margin:8px 0 0;opacity:.78;max-width:56ch}
.d .g-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),340px));gap:18px;margin:22px 0 26px}
.d .g-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:26px 16px 18px;border:1.5px solid var(--gold);border-radius:26px;background:radial-gradient(80% 70% at 50% 35%,rgba(212,175,90,.18),rgba(4,30,19,.3));box-shadow:0 16px 30px rgba(0,0,0,.3)}
.d .g-card .fan{--cw:62px}
.d .g-name{font:400 1.6rem "Gloock",serif}
.d .g-act{display:flex;gap:10px;align-items:center}
.d .btn-q{width:46px;height:46px;border-radius:50%;border:1px solid var(--gold);background:rgba(4,30,19,.5);color:var(--gold);font-weight:800}
.d .btn-q:hover{background:var(--gold);color:#08301f}
.d .soon{margin-top:auto;padding-top:16px;border-top:1px solid var(--gold-soft)}
.d .soon h3{margin:0 0 10px;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
.d .soon ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.d .soon li{padding:6px 12px;border:1px dashed var(--gold-soft);border-radius:999px;font-size:.8rem;opacity:.55}

/* ---- A: quattro tavoli ---- */
.d-a .hero{text-align:center;padding:clamp(14px,3vh,30px) 0 clamp(14px,2.4vh,24px)}
.d-a h1{font-size:clamp(2.2rem,4.6vw,3.8rem)}
.d-a .tiles{display:grid;grid-template-columns:1fr 1fr;gap:clamp(12px,1.6vw,22px);flex:1}
.d-a .tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:22px 14px 18px;border-radius:26px;border:1.5px dashed var(--gold-soft);background:rgba(4,30,19,.24);text-align:center;transition:transform .2s,border-color .2s,background .2s,box-shadow .2s}
.d-a .tile:hover{transform:translateY(-4px);border:1.5px solid var(--gold);background:radial-gradient(80% 70% at 50% 35%,rgba(212,175,90,.2),rgba(4,30,19,.3));box-shadow:0 16px 30px rgba(0,0,0,.35)}
.d-a .tile .fan{--cw:clamp(54px,5.4vw,80px);margin-bottom:12px}
.d-a .t-name{font-size:clamp(1.6rem,2.6vw,2.4rem)}
.d-a .tour{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:18px;opacity:.95}
.d-a .tour span{opacity:.72;font-size:.9rem}

/* ---- B: pannelli verticali ---- */
.d-b .hero{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:clamp(14px,3vh,28px) 0}
.d-b h1{font-size:clamp(2rem,3.8vw,3.2rem)}.d-b h1 i{color:var(--gold)}
.d-b .cols{display:flex;gap:12px;flex:1;min-height:400px}
.d-b .col{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;padding:20px 12px 20px;border-radius:26px;border:1.5px solid var(--gold-soft);background:linear-gradient(180deg,rgba(4,30,19,.15),rgba(4,30,19,.5));text-align:center;overflow:hidden;transition:flex-grow .45s cubic-bezier(.2,.8,.2,1),border-color .2s,background .2s}
.d-b .col:hover,.d-b .col:focus-visible{flex-grow:2.1;border-color:var(--gold);background:linear-gradient(180deg,rgba(212,175,90,.16),rgba(4,30,19,.5))}
.d-b .col-n{position:absolute;top:14px;left:18px;font:400 1rem "Gloock",serif;color:var(--gold);opacity:.8}
.d-b .col .fan{--cw:clamp(46px,4.6vw,70px);margin:auto 0 18px}
.d-b .t-name{font-size:clamp(1.4rem,2vw,1.9rem)}
.d-b .col-more{display:flex;flex-direction:column;gap:3px;max-height:0;opacity:0;overflow:hidden;transition:max-height .4s,opacity .3s;font-size:.88rem}
.d-b .col-more b{font-weight:600}.d-b .col-more em{opacity:.6;font-style:normal;font-size:.8rem}.d-b .col-more u{margin-top:6px;color:var(--gold);font-weight:700;text-decoration:none}
.d-b .col:hover .col-more,.d-b .col:focus-visible .col-more{max-height:120px;opacity:1}

/* ---- C: indice numerato ---- */
.d-c .idx{display:flex;flex-direction:column;flex:1;padding-top:clamp(14px,3vh,28px)}
.d-c .row{display:grid;grid-template-columns:64px 1fr auto minmax(150px,24%);align-items:center;gap:clamp(10px,2vw,28px);padding:clamp(12px,2.2vh,22px) 4px;border:0;border-top:1px solid var(--gold-soft);background:transparent;text-align:left;transition:background .25s,padding .25s}
.d-c .row:hover,.d-c .row:focus-visible{background:linear-gradient(90deg,rgba(212,175,90,.14),transparent);padding-left:18px}
.d-c .r-n{font:400 1.1rem "Gloock",serif;color:var(--gold)}
.d-c .r-txt{display:flex;flex-direction:column;gap:6px;min-width:0}
.d-c .t-name{font-size:clamp(2rem,4.6vw,4rem)}
.d-c .r-note{font-size:.9rem;opacity:.7;max-width:48ch}
.d-c .row .fan{--cw:clamp(40px,4vw,60px)}
.d-c .row-tour{display:flex;align-items:center;gap:28px;border-top:1px solid var(--gold-soft);padding:16px 4px 0;margin-top:auto}
.d-c .row-tour .t-name{font-size:1.6rem;flex:1}
.d-c .row-tour .r-n{width:36px;text-align:left}

@media(max-width:760px){
  .d-a .tiles{grid-template-columns:1fr 1fr}
  .d-b .cols{flex-direction:column}.d-b .col{flex-direction:row;justify-content:flex-start;gap:14px;padding:14px 16px;min-height:96px}.d-b .col .fan{margin:0;--cw:38px}.d-b .col-n,.d-b .col-more{display:none}.d-b .col:hover{flex-grow:1}
  .d-c .row{grid-template-columns:36px 1fr;}.d-c .row .fan,.d-c .row .t-meta{display:none}
}
@media(prefers-reduced-motion:reduce){.d *{transition:none!important}}
</style>'''

JS = r'''
<script>
(function(){
  document.addEventListener('click',function(e){
    var d=e.target.closest('.d'); if(!d) return;
    var cat=e.target.closest('[data-cat]');
    if(cat){ d.querySelector('.scr-home').hidden=true; d.querySelectorAll('.scr-cat').forEach(function(s){s.hidden=s.dataset.for!==cat.dataset.cat}); d.scrollIntoView({block:'nearest'}); return; }
    if(e.target.closest('[data-back]')){ d.querySelectorAll('.scr-cat').forEach(function(s){s.hidden=true}); d.querySelector('.scr-home').hidden=false; return; }
    var p=e.target.closest('[data-play]');
    if(p){ var t=p.textContent; p.textContent='Tavolo in apertura…'; setTimeout(function(){p.textContent=t},1200); }
  });
})();
</script>'''

def panel(name, mood, why, body, hidden=False):
    return (f'<section class="dir-panel" data-name="{name}" data-mood="{mood}" data-why="{why}" data-role=""{" hidden" if hidden else ""}>{body}</section>')

panels = '\n'.join([
 panel('Quattro tavoli', 'griglia 2x2 · tavoli da gioco con carte a ventaglio',
       'Tutta la sala sta in una schermata senza scroll: quattro bersagli grandi e uguali, la scelta è immediata.', dir_a()),
 panel('Pannelli che si aprono', 'colonne alte · hover che espande, alla porta di un casinò',
       'Passando sopra una colonna vedi subito i giochi dentro: capisci cosa c’è prima ancora di entrare.', dir_b(), True),
 panel('Indice di sala', 'righe numerate · editoriale, titoli enormi',
       'I nomi giganti sono la gerarchia: leggi 4 titoli e scegli, le carte sono solo un accento che si apre al passaggio.', dir_c(), True),
])

html = TPL.read_text()
html = re.sub(r'(<main id="stage">\s*<div id="panels">).*?(</div>\s*</main>)', lambda m: m.group(1) + '\n' + panels + '\n' + m.group(2), html, flags=re.S)
html = html.replace('<title>Direzioni · mockup</title>', '<title>Home a categorie · mockup</title>' + '\n<link href="https://fonts.googleapis.com/css2?family=Gloock&display=swap" rel="stylesheet">' + CSS)
html = html.replace('Mockup — esempio', 'Home CardlyHub a categorie')
html = html.replace('</body>', JS + '\n</body>')
out = ROOT / '15-home-categorie.html'
out.write_text(html)
print(out)
