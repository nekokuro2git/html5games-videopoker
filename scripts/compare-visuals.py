from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
qa = root / 'qa'
reference = root / 'research/reference'
pairs = [
    ('hold', 'main.png', 'portrait-reference-hold-final.png'),
    ('win', 'win.png', 'portrait-reference-win.png'),
    ('double', 'double.png', 'portrait-reference-double.png'),
]
for label, source, implementation in pairs:
    a = Image.open(reference/source).convert('RGB')
    b = Image.open(qa/implementation).convert('RGB')
    if a.size != (640, 1136) or b.size != (640, 1136):
        raise RuntimeError('Comparison requires matching 640 x 1136 captures')
    output = Image.new('RGB', (1280, 1170), 'white')
    output.paste(a, (0, 34))
    output.paste(b, (640, 34))
    draw = ImageDraw.Draw(output)
    draw.text((10, 10), 'OFFICIAL REFERENCE', fill='black')
    draw.text((650, 10), 'LOCAL IMPLEMENTATION', fill='black')
    output.save(qa/('comparison-'+label+'-final.png'))
    crop = (0, 510, 640, 850) if label == 'hold' else (0, 320, 640, 925) if label == 'double' else (0, 510, 640, 925)
    focus = Image.new('RGB', (1280, crop[3]-crop[1]), 'white')
    focus.paste(a.crop(crop), (0, 0))
    focus.paste(b.crop(crop), (640, 0))
    focus.save(qa/('comparison-'+label+'-detail.png'))
print('Three full and three focused comparisons prepared.')
