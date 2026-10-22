# Genera mockups/14-uno-fronti.html: 3 direzioni per il fronte delle carte UNO (struttura reale: bordo, ovale inclinato, numero, indici agli angoli).
import re, pathlib
T = pathlib.Path.home()/'.claude/skills/mockup/viewer-template.html'
OUT = pathlib.Path(__file__).resolve().parent.parent/'14-uno-fronti.html'

STYLES = {
 'A': dict(border='#fff', bw=10, rx=16, colors=dict(red='#ed1c24',yellow='#ffde00',green='#00a651',blue='#0072bc'), black='#17171a',
           oval='#fff', ova=(66,112,32), ring=None, font="'Lilita One',sans-serif", fs=120, skew=-8, outline=True, idx_fill='#fff', idx_outline=True, shade=False, inner_line=False),
 'B': dict(border='#fff', bw=8, rx=18, colors=dict(red='#e63a2e',yellow='#f5c315',green='#2fa35b',blue='#2b6fd6'), black='#1b1b20',
           oval='#fff', ova=(74,108,24), ring=None, font="'Sora',sans-serif", fs=116, skew=0, outline=False, idx_fill='#fff', idx_outline=False, shade=True, inner_line=False),
 'C': dict(border='#f4ecd8', bw=14, rx=12, colors=dict(red='#c8352b',yellow='#e8a914',green='#3b8f4e',blue='#2a5fa6'), black='#201c18',
           oval='#f7efdc', ova=(70,106,30), ring=3, font="'Young Serif',serif", fs=108, skew=0, outline=False, idx_fill='#f4ecd8', idx_outline=False, shade=False, inner_line=True),
}
WILDQ = ['#e4261f','#1f6fd1','#2f9e44','#f7c600']  # TR, BR, BL, TL

def arrows(x,y,size,col,sw=2.6):
    return f'<g transform="translate({x} {y}) scale({size/24})" fill="none" stroke="{col}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5"/></g>'
def noslash(cx,cy,r,col,sw):
    d=r*0.7071
    return f'<g fill="none" stroke="{col}" stroke-width="{sw}" stroke-linecap="round"><circle cx="{cx}" cy="{cy}" r="{r}"/><path d="M{cx-d:.1f} {cy+d:.1f} L{cx+d:.1f} {cy-d:.1f}"/></g>'
def quad(rx,ry):
    return (f'<path d="M0 0L0 {-ry} A{rx} {ry} 0 0 1 {rx} 0Z" fill="{WILDQ[0]}"/><path d="M0 0L{rx} 0 A{rx} {ry} 0 0 1 0 {ry}Z" fill="{WILDQ[1]}"/>'
            f'<path d="M0 0L0 {ry} A{rx} {ry} 0 0 1 {-rx} 0Z" fill="{WILDQ[2]}"/><path d="M0 0L{-rx} 0 A{rx} {ry} 0 0 1 0 {-ry}Z" fill="{WILDQ[3]}"/>')

def card(style, color, val):
    s=STYLES[style]; wild = color=='wild'
    col = s['black'] if wild else s['colors'][color]
    bw=s['bw']; rx,ry,ang=s['ova']
    o=[f'<svg viewBox="0 0 200 300" class="ucard" role="img" aria-label="UNO {color} {val}">',
       f'<rect width="200" height="300" rx="{bw+8}" fill="{s["border"]}"/>',
       f'<rect x="{bw}" y="{bw}" width="{200-2*bw}" height="{300-2*bw}" rx="{s["rx"]}" fill="{col}"/>']
    if s['inner_line']:
        o.append(f'<rect x="{bw+6}" y="{bw+6}" width="{200-2*bw-12}" height="{300-2*bw-12}" rx="6" fill="none" stroke="{s["border"]}" stroke-opacity=".55" stroke-width="1.5"/>')
    if s['shade']:
        o.append(f'<path d="M{200-bw} 190 L{200-bw} {300-bw-s["rx"]} Q{200-bw} {300-bw} {200-bw-s["rx"]} {300-bw} L90 {300-bw} Q175 270 {200-bw} 190Z" fill="#000" fill-opacity=".14"/>')
    # ovale inclinato
    o.append(f'<g transform="translate(100 150) rotate({ang})">')
    if wild:
        o.append(f'<ellipse rx="{rx+5}" ry="{ry+5}" fill="{s["oval"]}"/>'+quad(rx,ry))
    else:
        o.append(f'<ellipse rx="{rx}" ry="{ry}" fill="{s["oval"]}"'+(f' stroke="{col}" stroke-width="{s["ring"]}" stroke-opacity=".5"' if s['ring'] else '')+'/>')
    o.append('</g>')
    ink = col
    fs=s['fs']; font=s['font']
    def text(t,x,y,size,fill,outline=False,extra=''):
        st=f' stroke="#000" stroke-width="{size*0.07:.1f}" paint-order="stroke" stroke-linejoin="round"' if outline else ''
        return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="{font}" font-weight="800" font-size="{size}" fill="{fill}"{st}{extra}>{t}</text>'
    sk=f' transform="translate(100 150) skewX({s["skew"]}) translate(-100 -150)"' if s['skew'] else ''
    centre=''
    if val in '0123456789' and not wild:
        shadow = f'<text x="104" y="{150+fs*0.36+4:.0f}" text-anchor="middle" font-family="{font}" font-weight="800" font-size="{fs}" fill="#000" fill-opacity=".35">{val}</text>' if s['outline'] else ''
        centre=f'<g{sk}>{shadow}{text(val,100,round(150+fs*0.36),fs,ink,s["outline"])}</g>'
    elif val=='skip': centre=noslash(100,150,44,ink,16)
    elif val=='rev': centre=arrows(48,98,104,ink,2.8)
    elif val=='+2':
        centre=(f'<g transform="rotate(-12 92 150)"><rect x="68" y="108" width="46" height="68" rx="6" fill="{ink}" stroke="#fff" stroke-width="4"/></g>'
                f'<g transform="rotate(12 112 150)"><rect x="90" y="118" width="46" height="68" rx="6" fill="{ink}" stroke="#fff" stroke-width="4"/></g>')
    elif val=='+4':
        centre=text('+4',100,round(150+fs*0.3),round(fs*0.8),'#fff',True)
    o.append(centre)
    # indici agli angoli
    def idx(rot):
        f=s['idx_fill']; g=[]
        if val in '0123456789' and not wild: g.append(text(val,31,54,46,f,s['idx_outline']))
        elif val=='skip': g.append(noslash(32,34,15,f,5))
        elif val=='rev': g.append(arrows(14,16,38,f,2.8))
        elif val=='+2': g.append(text('+2',33,54,42,f,s['idx_outline']))
        elif val=='+4': g.append(text('+4',33,54,42,f,s['idx_outline']))
        elif val=='wild': g.append('<g><rect x="14" y="18" width="14" height="14" fill="'+WILDQ[3]+'"/><rect x="28" y="18" width="14" height="14" fill="'+WILDQ[0]+'"/><rect x="14" y="32" width="14" height="14" fill="'+WILDQ[2]+'"/><rect x="28" y="32" width="14" height="14" fill="'+WILDQ[1]+'"/></g>')
        return '<g'+(' transform="rotate(180 100 150)"' if rot else '')+'>'+''.join(g)+'</g>'
    o.append(idx(False)+idx(True)+'</svg>')
    return ''.join(o)

SET=[('red','5'),('blue','7'),('green','2'),('yellow','9'),('red','skip'),('blue','rev'),('green','+2'),('wild','wild'),('wild','+4')]
def panel(style,name,mood,why):
    thumbs=''.join(f'<button type="button" class="t{" on" if i==0 else ""}" aria-label="UNO {c} {v}">{card(style,c,v)}</button>' for i,(c,v) in enumerate(SET))
    return (f'<section class="dir-panel" data-name="{name}" data-mood="{mood}" data-why="{why}" data-role=""{"" if style=="A" else " hidden"}>'
            f'<div class="uset"><div class="feat">{card(style,*SET[0])}</div><div class="thumbs">{thumbs}</div></div></section>')

panels = panel('A','Classica fedele','Mattel anni 90 · numeri col contorno nero','È la carta che tutti riconoscono: ovale inclinato, numero pesante col contorno, colori pieni. Tua morosa capisce subito come si gioca.') \
       + panel('B','Moderna pulita','UNO recente · colori piatti, numeri netti','Numeri puliti e senza contorno si leggono bene anche piccoli sul tavolo e dal telefono, e restano fedeli alla struttura vera.') \
       + panel('C','Vintage avorio','Prima edizione · bordo avorio, serif','Il bordo avorio e il serif stanno bene sul feltro verde e danno un tono da sala da gioco, senza perdere la struttura di UNO.')

CSS='''
<link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Sora:wght@600;800&family=Young+Serif&display=swap" rel="stylesheet">
<style>
.dir-body{padding:12px}
.uset{border-radius:14px;padding:22px 16px 18px;background:radial-gradient(100% 80% at 50% 0%,#17694a,#0d4a33 60%,#08301f);box-shadow:inset 0 0 0 2px rgba(212,175,90,.7);display:grid;gap:20px;justify-items:center}
.feat{width:min(60vw,240px)}
.feat .ucard{width:100%;height:auto;display:block;filter:drop-shadow(0 12px 14px rgba(0,0,0,.5))}
.thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:14px;width:100%;max-width:620px}
.t{padding:6px;border:2px solid transparent;border-radius:10px;background:transparent;cursor:pointer;min-height:44px;transition:transform .15s,border-color .15s}
.t:hover{transform:translateY(-4px)}
.t.on{border-color:#d4af5a;background:rgba(212,175,90,.12)}
.t .ucard{width:100%;height:auto;display:block;filter:drop-shadow(0 4px 5px rgba(0,0,0,.45))}
button:focus-visible{outline:3px solid #d4af5a;outline-offset:2px}
@media (min-width:760px){.uset{grid-template-columns:auto 1fr;align-items:center;gap:36px;padding:28px}.feat{width:260px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
'''
JS='''<script>
// Tocca una carta piccola: la vedi in grande a sinistra. Scelta ricordata per direzione non serve, e' solo anteprima.
document.addEventListener('click',e=>{
  const b=e.target.closest('.t'); if(!b) return;
  const set=b.closest('.uset');
  set.querySelectorAll('.t').forEach(x=>x.classList.toggle('on',x===b));
  set.querySelector('.feat').innerHTML=b.innerHTML;
});
</script>'''
t=T.read_text()
t=re.sub(r'<main id="stage">\s*<div id="panels">.*?</div>\s*</main>','<main id="stage">\n<div id="panels">'+panels+'</div>\n  </main>',t,flags=re.S)
t=t.replace('<title>Direzioni · mockup</title>','<title>UNO fronti</title>'+CSS).replace('Mockup — esempio','Fronte delle carte UNO - 3 direzioni').replace('</body>',JS+'</body>')
OUT.write_text(t); print(OUT,len(t))
