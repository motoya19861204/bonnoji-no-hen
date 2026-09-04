// 汎用FAL呼び出し。使い方:
//   node fal.mjs image <prompt.txt> <out.png> [--size WxH] [--quality high] [ref1.png ref2.png ...]
//   node fal.mjs video <prompt.txt> <out.mp4> [--dur 5] [--res 480P|768P] [--ar 16:9] [--image ref.png] [--end ref.png]
import { fal } from '@fal-ai/client';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
process.loadEnvFile('D:/04_ゲーム/Kuroneko_Jinzya/03_開発/.env');
fal.config({ credentials: process.env.FAL_KEY });

const args = process.argv.slice(2);
const mode = args.shift();
const promptFile = args.shift();
const outPath = args.shift();
const opt = {}; const refs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else refs.push(args[i]);
}
const prompt = await readFile(promptFile, 'utf8');
async function upload(p) {
  const buf = await readFile(p);
  return fal.storage.upload(new File([buf], path.basename(p), { type: 'image/png' }));
}
await mkdir(path.dirname(outPath), { recursive: true });
const t0 = Date.now();
if (mode === 'image') {
  const [w, h] = (opt.size ?? '1024x1024').split('x').map(Number);
  const image_urls = [];
  for (const r of refs) image_urls.push(await upload(r));
  const endpoint = image_urls.length ? 'openai/gpt-image-2/edit' : 'openai/gpt-image-2';
  const input = { prompt, image_size: { width: w, height: h }, quality: opt.quality ?? 'high', output_format: 'png' };
  if (image_urls.length) input.image_urls = image_urls;
  const r = await fal.subscribe(endpoint, { input });
  const img = r.data.images?.[0];
  if (!img?.url) throw new Error(JSON.stringify(r.data).slice(0, 300));
  await writeFile(outPath, Buffer.from(await (await fetch(img.url)).arrayBuffer()));
} else if (mode === 'video') {
  const input = { prompt, duration: Number(opt.dur ?? 5), resolution: opt.res ?? '480P', prompt_expansion_mode: opt.expand ?? 'balanced' };
  let endpoint = 'minimax/h3-max-turbo/text-to-video';
  if (opt.image) { input.image_url = await upload(opt.image); endpoint = 'minimax/h3-max-turbo/image-to-video'; }
  else input.aspect_ratio = opt.ar ?? '16:9';
  if (opt.end) input.end_image_url = await upload(opt.end);
  const r = await fal.subscribe(endpoint, { input });
  const v = r.data.video;
  if (!v?.url) throw new Error(JSON.stringify(r.data).slice(0, 300));
  await writeFile(outPath, Buffer.from(await (await fetch(v.url)).arrayBuffer()));
  if (r.data.expanded_prompt) await writeFile(outPath + '.prompt.txt', r.data.expanded_prompt);
}
console.log('saved', outPath, ((Date.now() - t0) / 1000).toFixed(0) + 's');
