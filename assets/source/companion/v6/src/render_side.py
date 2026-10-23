# Targeted side inspection of the frozen actual model, using the same studio.
from pathlib import Path
exec((Path(__file__).parent/'render_review.py').read_text().split("pose('look',True);render")[0])
sc.cycles.samples=128;sc.render.resolution_x=800;sc.render.resolution_y=1000
pose('read');render('08-read-side-structure.png',(3,-1.8,1.2),(0,-.15,.66),1.15)
