export type PetState =
  | 'idle'
  | 'type_left'
  | 'type_right'
  | 'click'
  | 'sleep'
  | 'error'
  | 'success'

export interface GlobalInputEvent {
  kind:
    | 'key_down'
    | 'key_up'
    | 'mouse_down'
    | 'mouse_up'
    | 'mouse_move'
    | 'mouse_wheel'
  keyCode?: number
  button?: 'left' | 'right' | 'middle' | 'other'
  hand?: 'left' | 'right'
  x?: number
  y?: number
  delta?: number
  timestamp: number
}

export interface PetMachine {
  state: PetState
  packReady: boolean
}

export type PetAction =
  | { type: 'PACK_READY' }
  | { type: 'PACK_ERROR' }
  | { type: 'GLOBAL_INPUT'; event: GlobalInputEvent }
  | { type: 'PET_CLICK' }
  | { type: 'INACTIVITY' }
  | { type: 'ANIMATION_COMPLETE' }

export const initialPetMachine: PetMachine = {
  state: 'idle',
  packReady: false,
}

export function petMachineReducer(
  machine: PetMachine,
  action: PetAction,
): PetMachine {
  switch (action.type) {
    case 'PACK_READY':
      return { state: 'idle', packReady: true }
    case 'PACK_ERROR':
      return { ...machine, state: 'error' }
    case 'PET_CLICK':
      return { ...machine, state: 'click' }
    case 'INACTIVITY':
      return machine.state === 'sleep'
        ? machine
        : { ...machine, state: 'sleep' }
    case 'ANIMATION_COMPLETE':
      return { ...machine, state: 'idle' }
    case 'GLOBAL_INPUT': {
      const { event } = action
      if (event.kind === 'key_down') {
        if (event.keyCode === 0x0d) {
          return { ...machine, state: 'success' }
        }
        if (event.keyCode === 0x1b) {
          return { ...machine, state: 'error' }
        }
        return {
          ...machine,
          state: event.hand === 'left' ? 'type_left' : 'type_right',
        }
      }
      if (machine.state === 'sleep') {
        return { ...machine, state: 'idle' }
      }
      return machine
    }
  }
}
