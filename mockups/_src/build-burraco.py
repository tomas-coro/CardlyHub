# Ricostruisce mockups/11-burraco-tavolo.html: inserisce lo sprite delle carte (svg-cards) al posto di <!--SPRITE-->.
# Uso, dalla radice del progetto:  python3 -I mockups/_src/build-burraco.py
import re
sp = open('public/cards/french/svg-cards.svg', encoding='utf-8').read()
sp = re.sub(r'<\?xml[^>]*\?>', '', sp)
sp = re.sub(r'<!DOCTYPE[^>]*>', '', sp)
sp = re.sub(r'<svg ', '<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" ', sp, count=1)
src = open('mockups/_src/11-burraco-tavolo.src.html', encoding='utf-8').read()
open('mockups/11-burraco-tavolo.html', 'w', encoding='utf-8').write(src.replace('<!--SPRITE-->', sp))
