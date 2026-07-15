import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const root = join(process.cwd(), 'public', 'assets', 'pets', 'usagi-desk')
const sprites = join(root, 'sprites')

const WIDTH = 520
const HEIGHT = 430

const stateFrames = {
  idle: 4,
  type_left: 4,
  type_right: 4,
  click: 4,
  sleep: 4,
  error: 4,
  success: 4,
}

const palette = {
  outline: '#33252b',
  fur: '#fff2be',
  furShadow: '#f1d995',
  ear: '#f397aa',
  cheek: '#f7a5af',
  desk: '#f1ae67',
  deskEdge: '#c87543',
  deskDark: '#9f5435',
  white: '#fffdf5',
  red: '#e75263',
  green: '#53a96c',
  gold: '#ffd653',
  blue: '#6fa9db',
}

function eyes(state) {
  if (state === 'sleep') {
    return `
      <path d="M201 179q18 15 36 0" fill="none" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round"/>
      <path d="M283 179q18 15 36 0" fill="none" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round"/>`
  }

  if (state === 'error') {
    return `
      <g fill="none" stroke="${palette.outline}" stroke-width="8" stroke-linecap="round">
        <path d="M204 163l29 31m0-31-29 31"/>
        <path d="M287 163l29 31m0-31-29 31"/>
      </g>`
  }

  if (state === 'success') {
    return `
      <g fill="${palette.gold}" stroke="${palette.outline}" stroke-width="5" stroke-linejoin="round">
        <path d="M219 157l7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z"/>
        <path d="M301 157l7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z"/>
      </g>`
  }

  return `
    <ellipse cx="219" cy="178" rx="24" ry="29" fill="${palette.white}" stroke="${palette.outline}" stroke-width="7"/>
    <ellipse cx="301" cy="178" rx="24" ry="29" fill="${palette.white}" stroke="${palette.outline}" stroke-width="7"/>`
}

function mouth(state, frame) {
  if (state === 'sleep') {
    return `<path d="M247 221q13 8 26 0" fill="none" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round"/>`
  }

  if (state === 'error') {
    return `
      <path d="M242 229q18-18 36 0" fill="${palette.white}" stroke="${palette.outline}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M343 139q8-14 16 0t16 0" fill="none" stroke="${palette.blue}" stroke-width="7" stroke-linecap="round"/>`
  }

  if (state === 'success') {
    return `
      <path d="M239 217q21 31 42 0-7 41-21 41t-21-41z" fill="${palette.red}" stroke="${palette.outline}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M250 244q10-10 20 0" fill="none" stroke="#ff9cab" stroke-width="6" stroke-linecap="round"/>`
  }

  if (state === 'type_left' || state === 'type_right') {
    return `<path d="M249 222q11 9 22 0" fill="none" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round"/>`
  }

  if (state === 'click') {
    return `
      <ellipse cx="260" cy="229" rx="14" ry="${17 + (frame % 2) * 3}" fill="${palette.red}" stroke="${palette.outline}" stroke-width="7"/>
      <path d="M254 235q6-6 12 0" fill="none" stroke="#ff9cab" stroke-width="5" stroke-linecap="round"/>`
  }

  return `
    <path d="M247 215q13 14 26 0" fill="none" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round"/>
    <path d="M254 224q6 11 12 0" fill="${palette.red}" stroke="${palette.outline}" stroke-width="5" stroke-linejoin="round"/>`
}

function arm(state, side, frame) {
  const active =
    (state === 'type_left' && side === 'left') ||
    (state === 'type_right' && side === 'right')
  const clicking = state === 'click' && side === 'right'
  const pulse = frame % 2

  if (side === 'left') {
    const handY = active ? 325 + pulse * 8 : 300
    return `
      <path d="M155 245q-49 20-56 63-4 27 25 31 27 4 38-23l21-49"
        fill="${palette.fur}" stroke="${palette.outline}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(0 ${handY - 300})">
        <ellipse cx="132" cy="306" rx="31" ry="25" fill="${palette.fur}" stroke="${palette.outline}" stroke-width="8"/>
        <path d="M116 302q7-9 14 0m3-1q7-9 14 0" fill="none" stroke="${palette.furShadow}" stroke-width="5" stroke-linecap="round"/>
      </g>`
  }

  const handX = clicking ? 425 : 388
  const handY = clicking ? 316 + pulse * 5 : active ? 325 + pulse * 8 : 300
  return `
    <path d="M365 245q49 20 56 63 4 27-25 31-27 4-38-23l-21-49"
      fill="${palette.fur}" stroke="${palette.outline}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(${handX - 388} ${handY - 300})">
      <ellipse cx="388" cy="306" rx="31" ry="25" fill="${palette.fur}" stroke="${palette.outline}" stroke-width="8"/>
      <path d="M372 302q7-9 14 0m3-1q7-9 14 0" fill="none" stroke="${palette.furShadow}" stroke-width="5" stroke-linecap="round"/>
    </g>`
}

function accents(state, frame) {
  if (state === 'success') {
    const rise = frame % 2 === 0 ? 0 : -5
    return `
      <g transform="translate(0 ${rise})" fill="${palette.green}" stroke="${palette.outline}" stroke-width="3">
        <path d="M111 123h9v-12h8v12h12v8h-12v12h-8v-12h-9z"/>
        <path d="M390 109h8v-10h7v10h10v7h-10v10h-7v-10h-8z"/>
      </g>`
  }

  if (state === 'sleep') {
    const opacity = 0.55 + frame * 0.12
    return `
      <g fill="none" stroke="${palette.blue}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">
        <path d="M355 143h22l-22 20h22"/>
        <path d="M380 113h17l-17 16h17"/>
      </g>`
  }

  if (state === 'error') {
    return `
      <g stroke="${palette.red}" stroke-width="7" stroke-linecap="round">
        <path d="M127 137l-18-20m284 20 18-20"/>
        <path d="M139 117l-9-24m251 24 9-24"/>
      </g>`
  }

  return ''
}

function sceneSvg(state, frame) {
  const leftPressed = state === 'type_left'
  const rightPressed = state === 'type_right'
  const keyboardGlow =
    leftPressed || rightPressed
      ? `<path d="M${leftPressed ? 172 : 278} 335h78v35h-78z" fill="${palette.gold}" opacity="${0.16 + (frame % 2) * 0.1}"/>`
      : ''

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <g stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="260" cy="381" rx="242" ry="43" fill="${palette.deskDark}" opacity="0.18"/>

        <path d="M181 143q-22-100-8-126 8-15 23-8 19 9 28 112"
          fill="${palette.fur}" stroke="${palette.outline}" stroke-width="9"/>
        <path d="M296 121q9-103 28-112 15-7 23 8 14 26-8 126"
          fill="${palette.fur}" stroke="${palette.outline}" stroke-width="9"/>
        <path d="M193 104q-9-70-1-80 7-7 13 2 9 15 13 82" fill="${palette.ear}" opacity="0.88"/>
        <path d="M327 108q4-67 13-82 6-9 13-2 8 10-1 80" fill="${palette.ear}" opacity="0.88"/>

        <path d="M129 191q0-106 131-106t131 106q0 121-131 121T129 191z"
          fill="${palette.fur}" stroke="${palette.outline}" stroke-width="10"/>
        <path d="M152 238q23 83 108 83t108-83q31 28 31 77H121q0-49 31-77z"
          fill="${palette.fur}" stroke="${palette.outline}" stroke-width="9"/>

        ${eyes(state)}
        <ellipse cx="171" cy="220" rx="31" ry="19" fill="${palette.cheek}" opacity="0.72"/>
        <ellipse cx="349" cy="220" rx="31" ry="19" fill="${palette.cheek}" opacity="0.72"/>
        <g stroke="${palette.outline}" stroke-width="5">
          <path d="M158 217l-5 11m18-11-5 11m18-9-4 10"/>
          <path d="M336 217l-5 11m18-11-5 11m18-9-4 10"/>
        </g>
        ${mouth(state, frame)}
        ${accents(state, frame)}

        <path d="M28 322q18-44 77-44h310q59 0 77 44l18 62q5 24-21 29H31q-26-5-21-29z"
          fill="${palette.desk}" stroke="${palette.outline}" stroke-width="9"/>
        <path d="M27 375q99 20 233 20t233-20l5 22q2 14-18 18H40q-20-4-18-18z"
          fill="${palette.deskEdge}" opacity="0.82"/>

        ${arm(state, 'left', frame)}
        ${arm(state, 'right', frame)}
        ${keyboardGlow}
      </g>
    </svg>`
}

await mkdir(sprites, { recursive: true })

for (const [state, count] of Object.entries(stateFrames)) {
  for (let frame = 0; frame < count; frame += 1) {
    await sharp(Buffer.from(sceneSvg(state, frame)))
      .png()
      .toFile(join(sprites, `${state}-${frame}.png`))
  }
}

const petJson = {
  id: 'usagi-desk',
  name: 'Usagi Desk Sync',
  version: 1,
  canvas: { width: WIDTH, height: HEIGHT },
  animations: Object.fromEntries(
    Object.entries(stateFrames).map(([state, count]) => [
      state,
      {
        fps: state === 'sleep' ? 2 : 8,
        loop: state === 'idle' || state === 'sleep',
        ...(state === 'idle' || state === 'sleep'
          ? {}
          : {
              durationMs:
                state.startsWith('type_') ? 420 : state === 'success' ? 1400 : 850,
            }),
        frames: Array.from(
          { length: count },
          (_, index) => `sprites/${state}-${index}.png`,
        ),
      },
    ]),
  ),
}

await writeFile(join(root, 'pet.json'), `${JSON.stringify(petJson, null, 2)}\n`)

await sharp(Buffer.from(sceneSvg('idle', 0)))
  .resize(512, 424, { fit: 'contain' })
  .extend({
    top: 44,
    bottom: 44,
    left: 0,
    right: 0,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(join(root, 'app-icon.png'))
