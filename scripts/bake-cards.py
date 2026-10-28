"""Rasterize the source Spine triangle meshes using their real positions and UVs."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

root = Path('public/assets')
atlas = Image.open(root / 'videopoker-atlas.webp').convert('RGBA')
plans = json.loads(Path('research/evidence/source/card-render-plan.json').read_text())
dest = root / 'deck'
dest.mkdir(exist_ok=True)

def coefficients(xy, values):
    (x1,y1),(x2,y2),(x3,y3) = xy
    z1,z2,z3 = values
    d = x1*(y2-y3)+x2*(y3-y1)+x3*(y1-y2)
    if abs(d)<1e-8:
        return None
    a=(z1*(y2-y3)+z2*(y3-y1)+z3*(y1-y2))/d
    b=(z1*(x3-x2)+z2*(x1-x3)+z3*(x2-x1))/d
    c=(z1*(x2*y3-x3*y2)+z2*(x3*y1-x1*y3)+z3*(x1*y2-x2*y1))/d
    return a,b,c

for plan in plans:
    parts=[p for p in plan['parts'] if p['alpha']>0.001]
    if not parts:
        raise RuntimeError('No face-up attachments for '+plan['skin'])
    vertices=[p['vertices'] for p in parts]
    xs=[v for vs in vertices for v in vs[0::2]]
    ys=[v for vs in vertices for v in vs[1::2]]
    left,right,bottom,top=min(xs),max(xs),min(ys),max(ys)
    scale=2
    width,height=round((right-left)*scale),round((top-bottom)*scale)
    canvas=Image.new('RGBA',(width,height))
    for p in parts:
        v,u,t=p['vertices'],p['uvs'],p['triangles']
        # Collect a whole attachment before compositing so adjacent triangles do
        # not darken shared edges on semi-transparent artwork.
        layer=Image.new('RGBA',canvas.size)
        for i in range(0,len(t),3):
            ids=t[i:i+3]
            xy=[((v[j*2]-left)*scale,(v[j*2+1]-bottom)*scale) for j in ids]
            sx=[u[j*2]*atlas.width for j in ids]
            sy=[u[j*2+1]*atlas.height for j in ids]
            cx,cy=coefficients(xy,sx),coefficients(xy,sy)
            if cx is None or cy is None:
                continue
            tile=atlas.transform(canvas.size,Image.Transform.AFFINE,cx+cy,resample=Image.Resampling.BILINEAR)
            mask=Image.new('L',canvas.size)
            ImageDraw.Draw(mask).polygon(xy,fill=255)
            tile.putalpha(ImageChops.multiply(tile.getchannel('A'),mask))
            layer.paste(tile,(0,0),mask)
        if p['alpha']<1:
            layer.putalpha(layer.getchannel('A').point(lambda a:round(a*p['alpha'])))
        canvas.alpha_composite(layer)
    canvas.save(dest/(plan['skin']+'.png'))

# Shared main-bundle logo, located by its published SpriteFrame metadata.
c=json.loads(Path('research/evidence/source/assets/main/config.335c5.json').read_text(encoding='utf-8'))
p=json.loads(Path('research/evidence/source/assets/main/pack.json').read_text(encoding='utf-8'))
meta=p[5][c['packs']['0ddb19405'].index(54)][0][0]
r=meta['rect']
im=Image.open(root/'main-atlas-3.webp')
im.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height'])).save(root/'logo.png')
print(json.dumps({'cards':len(plans),'firstBounds':[width,height]}))
