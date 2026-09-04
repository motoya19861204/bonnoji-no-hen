"""生成動画(キー色背景) → フレーム抽出 → キー抜き → 正規化 → コマ選別 → game/assets/anim/<clip>_NN.png + manifest.anims
使い方: python build_anims.py            (全クリップ)
        python build_anims.py hero_walk  (指定のみ)
"""
import json, os, subprocess, sys, glob
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID = os.path.join(ROOT, '99_素材制作', '生成動画')
FRAMES = os.path.join(ROOT, 'tools', 'work', 'frames')
CHECK = os.path.join(ROOT, '99_素材制作', 'アニメ検品')
OUT = os.path.join(ROOT, 'game', 'assets', 'anim')
MANIFEST = os.path.join(ROOT, 'game', 'assets', 'manifest.json')
for d in (FRAMES, CHECK, OUT): os.makedirs(d, exist_ok=True)

OUT_H = 480           # 出力コマの基準キャラ高さ（idle基準）
FPS = 24
LOOP = {'idle', 'walk'}
NFRAMES = {'idle': 8, 'walk': 8, 'punch1': 6, 'punch2': 6, 'punch3': 8, 'attack': 6, 'hit': 5, 'down': 6}

def extract(clip):
    d = os.path.join(FRAMES, clip)
    if not os.path.isdir(d) or not os.listdir(d):
        os.makedirs(d, exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(VID, clip + '.mp4'), '-vf', f'fps={FPS}', os.path.join(d, 'f_%04d.png')], check=True)
    return sorted(glob.glob(os.path.join(d, 'f_*.png')))

def key_color(img):
    # 縁の中央値をキー色にする
    b = np.concatenate([img[0], img[-1], img[:, 0], img[:, -1]]).astype(np.float32)
    return np.median(b, axis=0)

def keyout(img, key):
    """距離ベースのソフトキー。緑/マゼンタの突出度で判定"""
    r, g, b = [img[..., i].astype(np.float32) for i in range(3)]
    if key[1] > key[0] and key[1] > key[2]:   # 緑
        dom = g - np.maximum(r, b)
    else:                                       # マゼンタ
        dom = np.minimum(r, b) - g
    # dom が大きいほど背景。前景は dom<=t0 で不透明、dom>=t1 で透明
    t0, t1 = 40.0, 110.0
    alpha = np.clip((t1 - dom) / (t1 - t0), 0, 1)
    # スピル抑制
    out = img.astype(np.float32).copy()
    if key[1] > key[0] and key[1] > key[2]:
        mx = np.maximum(r, b); out[..., 1] = np.where(g > mx, mx + (g - mx) * 0.15, g)
    else:
        out[..., 0] = np.where(r > g + 30, np.minimum(r, g + 60), r); out[..., 2] = np.where(b > g + 30, np.minimum(b, g + 60), b)
    a = (alpha * 255).astype(np.uint8)
    # 小さなゴミ除去（アルファの弱い孤立画素）
    a[a < 25] = 0
    return np.dstack([out.clip(0, 255).astype(np.uint8), a])

def bbox(a, thr=40):
    ys, xs = np.where(a > thr)
    if len(ys) == 0: return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def main():
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    manifest.setdefault('anims', {})
    only = sys.argv[1:]
    clips = sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(VID, '*.mp4')))
    if only: clips = [c for c in clips if c in only]
    for clip in clips:
        ch, _, act = clip.partition('_')
        files = extract(clip)
        first = np.array(Image.open(files[0]).convert('RGB'))
        key = key_color(first)
        rgbas = [keyout(np.array(Image.open(f).convert('RGB')), key) for f in files]
        alphas = [x[..., 3] for x in rgbas]
        # 基準: 最初のコマの足元(bbox下端)と高さ
        b0 = bbox(alphas[0])
        if not b0: print('空', clip); continue
        foot0 = b0[3]; h0 = b0[3] - b0[1]
        # 動き量（最初のコマとのアルファ差）
        diffs = np.array([np.abs(a.astype(np.int16) - alphas[0].astype(np.int16)).mean() for a in alphas])
        n = len(files)
        want = NFRAMES.get(act, 6)
        if act in LOOP:
            # 1周期: 12〜40コマの範囲で最初のコマに最も近づくコマ
            lo, hi = 12, min(40, n - 1)
            period = lo + int(np.argmin(diffs[lo:hi + 1]))
            start = 0
            idx = [start + round(i * period / want) for i in range(want)]
        else:
            # 動作区間: 差分が閾値を超える最初〜最後（返し含む）
            thr = diffs.max() * 0.15
            moving = np.where(diffs > thr)[0]
            s, e = (int(moving[0]), int(moving[-1])) if len(moving) else (0, n - 1)
            s = max(0, s - 1); e = min(n - 1, e + 1)
            # 変化量の累積が等間隔になるコマを選ぶ（止まっている区間を詰める）
            step = np.array([0.0] + [np.abs(alphas[j].astype(np.int16) - alphas[j - 1].astype(np.int16)).mean() for j in range(s + 1, e + 1)])
            cum = np.cumsum(step); cum = cum / max(cum[-1], 1e-6)
            idx = sorted(set(s + int(np.searchsorted(cum, t)) for t in np.linspace(0, 1, want)))
            idx = [min(e, i) for i in idx]
        # 異常コマ除去: 前景面積が基準の1.5倍を超えるコマ（動画が足したフラッシュ等）は捨てる
        area0 = (alphas[0] > 40).sum()
        idx = [fi for fi in idx if (alphas[fi] > 40).sum() < area0 * 1.5]
        frames = []
        for i, fi in enumerate(idx):
            x = rgbas[fi]; a = x[..., 3]
            b = bbox(a)
            if not b: continue
            crop = x[b[1]:b[3], b[0]:b[2]]
            # 足元を基準コマの足元に合わせる（ジャンプ等で足が浮く分は offsetY に）
            scale = OUT_H / h0
            im = Image.fromarray(crop).resize((max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))), Image.LANCZOS)
            # アンカー: x=元画像の中心列, y=基準足元
            cx = (first.shape[1] / 2 - b[0]) / (b[2] - b[0])
            ay = (foot0 - b[1]) / (b[3] - b[1])
            name = f'{clip}_{i:02d}'
            im.save(os.path.join(OUT, name + '.png'))
            frames.append({'file': f'anim/{name}.png', 'anchorX': round(float(cx), 4), 'anchorY': round(float(ay), 4), 'charHeight': OUT_H})
        manifest['anims'][clip] = {'frames': frames, 'loop': act in LOOP}
        # 検品画像（暗背景に横並び）
        ims = [Image.open(os.path.join(OUT, f['file'].split('/')[-1])) for f in frames]
        cw = max(i.width for i in ims) + 10; chh = max(i.height for i in ims) + 10
        sheet = Image.new('RGBA', (cw * len(ims), chh), (25, 25, 35, 255))
        for k, im in enumerate(ims): sheet.alpha_composite(im, (k * cw + 5, chh - im.height - 5))
        sheet.save(os.path.join(CHECK, clip + '.png'))
        print(clip, 'frames', len(frames), 'idx', idx, 'key', key.astype(int).tolist())
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('manifest更新')

main()
