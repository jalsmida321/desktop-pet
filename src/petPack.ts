import type { PetState } from './petMachine'

export interface PetAnimation {
  fps: number
  loop: boolean
  durationMs?: number
  frames: string[]
}

export interface PetPack {
  id: string
  name: string
  version: number
  canvas: {
    width: number
    height: number
  }
  animations: Record<PetState, PetAnimation>
}

const requiredStates: PetState[] = [
  'idle',
  'type_left',
  'type_right',
  'click',
  'sleep',
  'error',
  'success',
]

export async function loadPetPack(url: string): Promise<PetPack> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to load pet pack: ${response.status}`)
  }

  const pack = (await response.json()) as PetPack
  for (const state of requiredStates) {
    const animation = pack.animations?.[state]
    if (!animation || animation.frames.length === 0 || animation.fps <= 0) {
      throw new Error(`Invalid animation: ${state}`)
    }
  }
  return pack
}
