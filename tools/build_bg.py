import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, '99_素材制作', '背景'); out = os.path.join(ROOT, 'game', 'assets', 'bg'); os.makedirs(out, exist_ok=True)
mp = os.path.join(ROOT, 'game', 'assets', 'manifest.json'); m = json.load(open(mp, encoding='utf-8'))
for n in ('bg_a', 'bg_b', 'bg_c'):
    p = os.path.join(src, n + '.png')
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB'); im = im.resize((1215, 810), Image.LANCZOS); im.save(os.path.join(out, n + '.jpg'), quality=88)
    m['images'][n] = f'bg/{n}.jpg'; print(n)
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
