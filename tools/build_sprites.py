"""生成原本(キー色背景) → キー抜き → 足元基準の正規化 → game/assets/sprites/*.png + manifest.json
使い方: python build_sprites.py            (全部)
        python build_sprites.py hero_idle  (指定のみ)
"""
import json, os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '99_素材制作', '生成原本')
KEYED = os.path.join(ROOT, '99_素材制作', '透過済み')
OUT = os.path.join(ROOT, 'game', 'assets', 'sprites')
MANIFEST = os.path.join(ROOT, 'game', 'assets', 'manifest.json')
KEYOUT = r'D:\04_ゲーム\Kuroneko_Jinzya\99_開発ツール\sprite-transparency\scripts\keyout.py'
os.makedirs(KEYED, exist_ok=True); os.makedirs(OUT, exist_ok=True)

MAX_H = 480          # 出力スプライトの最大高さ（表示は最大300px）
STANDING = {'idle', 'walk_a', 'walk_b', 'punch1', 'punch2', 'punch3', 'hit', 'attack', 'jump'}

def keyout(name):
    src = os.path.join(RAW, name + '.png'); dst = os.path.join(KEYED, name + '.png')
    if os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(src):
        return dst
    r = subprocess.run([sys.executable, KEYOUT, '--input', src, '--out', dst, '--force', '--edge-contract', '1'], capture_output=True)
    if r.returncode != 0:
        print('keyout失敗', name, r.stderr.decode('utf-8', 'ignore')[-300:]); return None
    return dst

def bbox_alpha(im):
    a = im.split()[3]
    return a.point(lambda v: 255 if v > 40 else 0).getbbox()

manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {'frames': {}, 'images': {}, 'voices': {}}
only = sys.argv[1:]
names = sorted(n[:-4] for n in os.listdir(RAW) if n.endswith('.png'))
if only: names = [n for n in names if n in only]

# キャラごとの基準高さ（idle の bbox 高さ）
refH = {}
for n in names:
    ch, _, pose = n.partition('_')
    if pose == 'idle' and ch in ('hero', 'punk', 'boss'):
        p = keyout(n)
        if p: refH[ch] = bbox_alpha(Image.open(p).convert('RGBA'))[3] - bbox_alpha(Image.open(p).convert('RGBA'))[1]
for ch in ('hero', 'punk', 'boss'):
    if ch not in refH:
        p = os.path.join(KEYED, ch + '_idle.png')
        if os.path.exists(p):
            b = bbox_alpha(Image.open(p).convert('RGBA')); refH[ch] = b[3] - b[1]
print('基準高さ', refH)

for n in names:
    ch, _, pose = n.partition('_')
    p = keyout(n)
    if not p: continue
    im = Image.open(p).convert('RGBA')
    b = bbox_alpha(im)
    if not b: print('空', n); continue
    im = im.crop(b)
    w, h = im.size
    if ch in refH:
        R = refH[ch]
        if pose in STANDING: s = R / h
        elif pose == 'down': s = (R * 0.95) / max(w, h)
        else: s = R / h
        # 出力は基準高さ MAX_H に揃える
        s *= MAX_H / R
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        charH = MAX_H
        anchorX, anchorY = 0.5, 1.0
        entry = {'file': f'sprites/{n}.png', 'charHeight': charH, 'anchorX': anchorX, 'anchorY': anchorY}
        manifest['frames'][n] = entry
    else:
        # エフェクト・UI: 幅1024以内に縮小して images に登録
        if max(w, h) > 1024:
            s = 1024 / max(w, h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        manifest['images'][n] = f'sprites/{n}.png'
    im.save(os.path.join(OUT, n + '.png'))
    print(n, im.size)

json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('manifest更新')
