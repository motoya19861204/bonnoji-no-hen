import { fal } from '@fal-ai/client';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
process.loadEnvFile('D:/04_ゲーム/Kuroneko_Jinzya/03_開発/.env');
fal.config({ credentials: process.env.FAL_KEY });
const [promptFile, outPath, ...refs] = process.argv.slice(2);
const prompt = await readFile(promptFile, 'utf8');
const image_urls = [];
for (const r of refs) {
  const buf = await readFile(r);
  image_urls.push(await fal.storage.upload(new File([buf], path.basename(r), { type: 'image/png' })));
}
const result = await fal.subscribe('openai/gpt-image-2/edit', {
  input: { prompt, image_urls, image_size: { width: 1536, height: 1024 }, quality: 'high', output_format: 'png' },
});
const img = result.data.images?.[0];
if (!img?.url) throw new Error(JSON.stringify(result.data).slice(0, 300));
const buf = Buffer.from(await (await fetch(img.url)).arrayBuffer());
await writeFile(outPath, buf);
console.log('saved', outPath, img.width, img.height);
