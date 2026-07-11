import { describe, expect, it } from 'vitest'
import {
  initialPetMachine,
  petMachineReducer,
  type GlobalInputEvent,
} from './petMachine'

const input = (
  overrides: Partial<GlobalInputEvent> = {},
): GlobalInputEvent => ({
  kind: 'key_down',
  keyCode: 0x41,
  hand: 'left',
  timestamp: 1,
  ...overrides,
})

describe('petMachineReducer', () => {
  it('routes keyboard input to the matching paw', () => {
    const left = petMachineReducer(initialPetMachine, {
      type: 'GLOBAL_INPUT',
      event: input(),
    })
    const right = petMachineReducer(initialPetMachine, {
      type: 'GLOBAL_INPUT',
      event: input({ keyCode: 0x4c, hand: 'right' }),
    })

    expect(left.state).toBe('type_left')
    expect(right.state).toBe('type_right')
  })

  it('maps enter and escape to feedback states', () => {
    const success = petMachineReducer(initialPetMachine, {
      type: 'GLOBAL_INPUT',
      event: input({ keyCode: 0x0d }),
    })
    const error = petMachineReducer(initialPetMachine, {
      type: 'GLOBAL_INPUT',
      event: input({ keyCode: 0x1b }),
    })

    expect(success.state).toBe('success')
    expect(error.state).toBe('error')
  })

  it('sleeps after inactivity and wakes on mouse movement', () => {
    const sleeping = petMachineReducer(initialPetMachine, {
      type: 'INACTIVITY',
    })
    const awake = petMachineReducer(sleeping, {
      type: 'GLOBAL_INPUT',
      event: input({ kind: 'mouse_move', keyCode: undefined, hand: undefined }),
    })

    expect(sleeping.state).toBe('sleep')
    expect(awake.state).toBe('idle')
  })

  it('returns transient animations to idle', () => {
    const clicked = petMachineReducer(initialPetMachine, { type: 'PET_CLICK' })
    expect(
      petMachineReducer(clicked, { type: 'ANIMATION_COMPLETE' }).state,
    ).toBe('idle')
  })

  it('waits for the press interaction to trigger click feedback', () => {
    const pressed = petMachineReducer(initialPetMachine, {
      type: 'GLOBAL_INPUT',
      event: input({
        kind: 'mouse_down',
        keyCode: undefined,
        hand: undefined,
        button: 'left',
      }),
    })

    expect(pressed.state).toBe('idle')
    expect(petMachineReducer(pressed, { type: 'PET_CLICK' }).state).toBe('click')
  })
})
