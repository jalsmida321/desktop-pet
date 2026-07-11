import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const root = join(process.cwd(), 'public', 'assets', 'pets', 'default-cat')
const sprites = join(root, 'sprites')

const stateFrames = {
  idle: 3,
  type_left: 3,
  type_right: 3,
  click: 3,
  sleep: 3,
  error: 3,
  success: 3,
}

const palette = {
  outline: '#332f35',
  fur: '#fff8eb',
  patch: '#f3b29e',
  ear: '#ef9e9a',
  collar: '#4ca69b',
  gold: '#f3c75f',
  red: '#df6370',
  green: '#45a574',
}

function face(state, frame) {
  if (state === 'sleep') {
    return `
      <path d="M93 122q9 8 18 0" fill="none" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round"/>
      <path d="M145 122q9 8 18 0" fill="none" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round"/>
      <path d="M121 139q7 5 14 0" fill="none" stroke="${palette.outline}" stroke-width="5" stroke-linecap="round"/>
      <g fill="none" stroke="${palette.collar}" stroke-width="5" stroke-linecap="round" opacity="${0.55 + frame * 0.2}">
        <path d="M179 91h15l-15 15h15"/>
        <path d="M193 70h12l-12 12h12"/>
      </g>`
  }

  if (state === 'error') {
    return `
      <g stroke="${palette.red}" stroke-width="6" stroke-linecap="round">
        <path d="M91 116l15 15m0-15-15 15"/>
        <path d="M149 116l15 15m0-15-15 15"/>
      </g>
      <path d="M119 145q9-8 18 0" fill="none" stroke="${palette.outline}" stroke-width="5" stroke-linecap="round"/>`
  }

  if (state === 'success') {
    return `
      <g fill="${palette.gold}" stroke="${palette.outline}" stroke-width="3">
        <path d="M98 112l4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 10-1z"/>
        <path d="M156 112l4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 10-1z"/>
      </g>
      <path d="M119 141q9 12 20 0" fill="none" stroke="${palette.outline}" stroke-width="5" stroke-linecap="round"/>`
  }

  const blinking = state === 'idle' && frame === 2
  return `
    ${
      blinking
        ? `<path d="M91 124h16m42 0h16" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round"/>`
        : `<ellipse cx="99" cy="124" rx="7" ry="9" fill="${palette.outline}"/>
           <ellipse cx="157" cy="124" rx="7" ry="9" fill="${palette.outline}"/>`
    }
    <path d="M120 139q8 9 16 0" fill="none" stroke="${palette.outline}" stroke-width="5" stroke-linecap="round"/>`
}

function paw(state, side, frame) {
  const active =
    (state === 'type_left' && side === 'left') ||
    (state === 'type_right' && side === 'right')
  const x = side === 'left' ? 74 : 160
  const y = active ? 184 + (frame % 2) * 9 : 180
  return `
    <g transform="translate(${x} ${y})">
      <ellipse cx="12" cy="20" rx="28" ry="22" fill="${palette.fur}" stroke="${palette.outline}" stroke-width="6"/>
      <path d="M-1 12q5-8 10 0m4-2q5-8 10 0" fill="none" stroke="${palette.patch}" stroke-width="4" stroke-linecap="round"/>
    </g>`
}

function catSvg(state, frame) {
  const bob = state === 'idle' ? [0, -1, 0][frame] : 0
  const squish = state === 'click' ? [0.98, 0.72, 1.05][frame] : 1
  const bodyTranslate = state === 'click' ? 214 * (1 - squish) : 0
  const moodAccent =
    state === 'error'
      ? `<path d="M62 99l-13-13m146 13 13-13" stroke="${palette.red}" stroke-width="6" stroke-linecap="round"/>`
      : state === 'success'
        ? `<g fill="${palette.green}"><path d="M53 82h7v-8h6v8h8v6h-8v8h-6v-8h-7z"/><path d="M190 77h6v-7h5v7h7v5h-7v7h-5v-7h-6z"/></g>`
        : ''

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="translate(0 ${bob + bodyTranslate}) scale(1 ${squish})">
        <ellipse cx="128" cy="225" rx="77" ry="13" fill="#4d4140" opacity="0.12"/>
        <path d="M67 104q19-31 61-31t61 31q18 25 18 55 0 55-79 55t-79-55q0-31 18-55z"
          fill="${palette.fur}" stroke="${palette.outline}" stroke-width="7" stroke-linejoin="round"/>
        <path d="M77 95q20-17 40-18-14 17-17 35-13-11-23-17z" fill="${palette.patch}" opacity="0.72"/>
        ${face(state, frame)}
        <path d="M82 169q46 17 92 0" fill="none" stroke="${palette.collar}" stroke-width="9" stroke-linecap="round"/>
        <circle cx="128" cy="181" r="10" fill="${palette.gold}" stroke="${palette.outline}" stroke-width="4"/>
        ${paw(state, 'left', frame)}
        ${paw(state, 'right', frame)}
        ${moodAccent}
      </g>
    </svg>`
}

await mkdir(sprites, { recursive: true })

for (const [state, count] of Object.entries(stateFrames)) {
  for (let frame = 0; frame < count; frame += 1) {
    await sharp(Buffer.from(catSvg(state, frame)))
      .png()
      .toFile(join(sprites, `${state}-${frame}.png`))
  }
}

const petJson = {
  id: 'default-cat',
  name: 'Mochi Cat',
  version: 1,
  canvas: { width: 256, height: 256 },
  animations: Object.fromEntries(
    Object.entries(stateFrames).map(([state, count]) => [
      state,
      {
        fps: state === 'sleep' ? 2 : 7,
        loop: state === 'idle' || state === 'sleep',
        ...(state === 'idle' || state === 'sleep'
          ? {}
          : { durationMs: state.startsWith('type_') ? 360 : 650 }),
        frames: Array.from(
          { length: count },
          (_, index) => `sprites/${state}-${index}.png`,
        ),
      },
    ]),
  ),
}

await writeFile(join(root, 'pet.json'), `${JSON.stringify(petJson, null, 2)}\n`)

await sharp(Buffer.from(catSvg('idle', 0)))
  .resize(512, 512)
  .png()
  .toFile(join(root, 'app-icon.png'))
