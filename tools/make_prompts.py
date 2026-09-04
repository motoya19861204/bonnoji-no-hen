import os
os.makedirs('work/prompts', exist_ok=True)
V = 'Deep, low-pitched male voice, monotone, low energy, deadpan delivery, no emotion. Silent room, no music, no background noise, no ambience, no sound effects. Static camera, no camera movement. No on-screen text, no subtitles.'
prompts = {
    'v_tissue2': 'The young man in the reference image looks straight at the camera, expression flat and unimpressed, and says in Japanese: "ティッシュが". ' + V,
    'v_yamamori': 'The young man in the reference image looks straight at the camera, expression flat, and says slowly in Japanese, stretching the long vowel: "やまもーり". He says only this once. ' + V,
}
STYLE = 'Clean bold outlines, flat cel shading, chunky shapes, no fine loose hair strands, no wispy or semi-transparent elements, no thin lines. Background: COMPLETELY UNIFORM flat solid magenta (#FF00FF), no ground, no shadow, no gradient, no glow, no outline around the background. The character is fully inside the frame with generous margin and does not touch the edges. Full body, feet visible. Facing RIGHT (side / three-quarter view toward the right). Single character only, no text.'
STYLE_G = STYLE.replace('magenta (#FF00FF)', 'bright green (#00FF00)')
hero = 'Reference image 1 is the character design sheet. Draw EXACTLY this character, faithfully matching the sheet (same hair, same face, same hoodie, scarf, T-shirt lettering, jeans, sneakers). Do not redesign. Pose: '
H = {
    'hero_idle': 'fighting stance, fists raised, knees slightly bent, ready to fight.',
    'hero_walk_a': 'walking to the right, mid-stride, left foot forward, arms swinging naturally.',
    'hero_walk_b': 'walking to the right, mid-stride, right foot forward, arms swinging naturally.',
    'hero_punch1': 'throwing a quick left jab to the right, arm fully extended, body leaning in.',
    'hero_punch2': 'throwing a powerful right straight punch to the right, arm fully extended, twisting the torso.',
    'hero_punch3': 'delivering a massive rising uppercut to the right with the right fist, whole body launched upward, hair flying, dramatic finisher pose.',
    'hero_hit': 'flinching backward from being punched, head snapped back, eyes shut, arms flailing.',
    'hero_down': 'lying flat on his back on the ground, knocked out, arms spread, seen from the side.',
    'hero_jump': 'jumping high with a flying kick to the right, leg extended.',
}
for k, v in H.items():
    prompts[k] = hero + v + ' ' + STYLE
NOBG = STYLE.split('Background:')[0]
prompts['punk_design'] = 'Reference image 1 is a screenshot of a beat-em-up game. Redraw the street punk enemy with the PURPLE mohawk and black leather jacket from that screenshot as a clean character design sheet: left = full-body front standing pose, right = full-body side view facing right in a fighting stance. Same design as in the screenshot (purple mohawk, black leather jacket, red shirt, ripped blue jeans, black boots). No green in the outfit. Plain light gray background, no text. ' + NOBG
prompts['boss_design'] = 'Design a boss character for a Japanese beat-em-up game in the same anime art style as reference image 1 (character design sheet for style reference only). The boss: a huge, extremely muscular bald man, 2.5 times bulkier than the reference hero, wearing round dark sunglasses, a gold chain, a white tank top and dark red track pants, with a giant cardboard tissue box worn like a hat. Menacing grin. Left = full-body front pose, right = full-body side view facing right in a fighting stance. No green in the outfit. Plain light gray background, no text. ' + NOBG
enemy = 'Reference image 1 is the character design sheet. Draw EXACTLY this character, faithfully matching the sheet (same hair, face, clothes, colors). Do not redesign. Pose: '
E = {
    'idle': 'fighting stance facing right, fists raised, hunched and aggressive.',
    'walk_a': 'walking to the right, mid-stride, left foot forward.',
    'walk_b': 'walking to the right, mid-stride, right foot forward.',
    'attack': 'throwing a wide haymaker punch to the right, arm extended, body leaning in.',
    'hit': 'flinching backward from being punched, head snapped back, arms flailing.',
    'down': 'lying flat on his back on the ground, knocked out, arms spread, seen from the side.',
}
for k, v in E.items():
    prompts['punk_' + k] = enemy + v + ' ' + STYLE_G
    prompts['boss_' + k] = enemy + v + ' ' + STYLE_G
FX = 'Game visual effect sprite, anime arcade style, on a COMPLETELY UNIFORM flat solid magenta (#FF00FF) background, no gradient, fully inside the frame with margin, no text. '
prompts['fx_hit'] = FX + 'A sharp yellow-white impact spark burst with radiating jagged spikes and a few small stars, seen straight on.'
prompts['fx_big'] = FX + 'A huge explosive impact burst: orange-yellow core, white flash spikes, purple-blue shockwave ring, dramatic manga-style speed lines, seen straight on.'
prompts['fx_tissue'] = FX + 'A single white tissue paper sheet floating in the air, softly crumpled, drawn with bold outlines and flat cel shading.'
prompts['fx_tissuebox'] = FX + 'A rectangular cardboard tissue box, blue and white design, with a tissue sheet pulled out of the top, bold outlines, flat cel shading, three-quarter view.'
prompts['fx_tissue_mountain'] = FX + 'A giant mountain-shaped heap of countless white tissue papers piled up, dramatic, bold outlines, flat cel shading.'
prompts['ui_hud'] = 'Game HUD element for a 90s arcade beat-em-up, drawn on a COMPLETELY UNIFORM flat solid magenta (#FF00FF) background. A wide horizontal health bar frame: dark metal bezel with rounded corners and a thin gold trim, the inside of the bar is EMPTY flat black. To its left, a square portrait frame with the same bezel style, inside empty flat black. No text, no characters, no gradient background.'
prompts['ui_logo'] = 'Game title logo for a Japanese beat-em-up arcade game, on a COMPLETELY UNIFORM flat solid magenta (#FF00FF) background. The title text is exactly the Japanese characters "煩悩児の変" (render these characters exactly, no other text), in a bold, chunky, brushed 90s arcade logo style, dark navy letters with a thick white outline and a red accent, slight dramatic tilt, with a small stylized white tissue paper motif tucked behind the letters. No other text.'
BG = 'Reference image 1 is a game screenshot. Redraw the SAME night-time Japanese shopping arcade street background in the SAME pixel-art style, SAME perspective and SAME horizon line, but REMOVE all people, characters, HUD, health bar, score and portrait. Show only the empty street: shops, shutters, neon signs, vending machines, lanterns, ground. The bottom 35 percent of the image is walkable flat pavement. No text overlay. '
prompts['bg_a'] = BG + 'Keep the same layout of shops as the screenshot.'
prompts['bg_b'] = BG + 'This panel is the NEXT section of the same street further to the right: different shops (a karaoke bar, a small shrine gate, a game center with bright signs), same style, same perspective, same pavement height so it tiles seamlessly with the previous panel.'
prompts['bg_c'] = BG + 'This panel is the final section of the same street: a dead-end plaza with a big pachinko parlor facade, a stack of cardboard boxes and a dumpster, same style, same perspective, same pavement height.'
prompts['op_video'] = 'Cinematic anime opening for a retro beat-em-up game. Start on the hero from the reference image standing alone under flickering neon in a rainy Japanese shopping arcade at night, hood down, hair blowing, expression flat. A gang of mohawk punks appears behind him from the dark. He slowly raises his fists. Dramatic slow-motion, wide cinematic shot then push in to his face, rain particles, neon reflections on wet pavement. Tense dramatic drums and a low synth bass, then a hard hit at the end. No on-screen text, no subtitles, no captions.'
for k, v in prompts.items():
    open(f'work/prompts/{k}.txt', 'w', encoding='utf-8').write(v)
print(len(prompts))
