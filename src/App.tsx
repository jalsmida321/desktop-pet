import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import './App.css'
import {
  initialPetMachine,
  petMachineReducer,
  type GlobalInputEvent,
} from './petMachine'
import { loadPetPack, type PetPack } from './petPack'

const PET_PACK_BASE = '/assets/pets/default-cat'
const SLEEP_AFTER_MS = 15_000
const CHARGE_TO_REBOUND_MS = 900

type ReboundKind = 'quick' | 'charged' | null

const runningInTauri = () => '__TAURI_INTERNALS__' in window

function App() {
  const [pack, setPack] = useState<PetPack | null>(null)
  const [machine, dispatch] = useReducer(petMachineReducer, initialPetMachine)
  const [frameIndex, setFrameIndex] = useState(0)
  const [pressProgress, setPressProgress] = useState(0)
  const [reboundKind, setReboundKind] = useState<ReboundKind>(null)
  const lastActivityAt = useRef(Date.now())
  const leftButtonHeld = useRef(false)
  const chargeTriggered = useRef(false)
  const chargeStartedAt = useRef(0)
  const chargeFrame = useRef<number | null>(null)

  useEffect(() => {
    loadPetPack(`${PET_PACK_BASE}/pet.json`)
      .then((loadedPack) => {
        setPack(loadedPack)
        dispatch({ type: 'PACK_READY' })
      })
      .catch(() => dispatch({ type: 'PACK_ERROR' }))
  }, [])

  useEffect(() => {
    if (!runningInTauri()) return

    let unlisten: (() => void) | undefined
    void listen<GlobalInputEvent>('global-input', (event) => {
      lastActivityAt.current = Date.now()

      if (event.payload.kind === 'mouse_down' && event.payload.button === 'left') {
        if (!leftButtonHeld.current) {
          leftButtonHeld.current = true
          chargeTriggered.current = false
          chargeStartedAt.current = performance.now()
          setReboundKind(null)
          setPressProgress(0)

          const updateCharge = (now: number) => {
            if (!leftButtonHeld.current || chargeTriggered.current) return

            const progress = Math.min(
              1,
              (now - chargeStartedAt.current) / CHARGE_TO_REBOUND_MS,
            )
            setPressProgress(progress)

            if (progress >= 1) {
              chargeTriggered.current = true
              setReboundKind('charged')
              dispatch({ type: 'PET_CLICK' })
              return
            }

            chargeFrame.current = window.requestAnimationFrame(updateCharge)
          }

          chargeFrame.current = window.requestAnimationFrame(updateCharge)
        }
      }

      if (event.payload.kind === 'mouse_up' && event.payload.button === 'left') {
        leftButtonHeld.current = false
        if (chargeFrame.current !== null) {
          window.cancelAnimationFrame(chargeFrame.current)
          chargeFrame.current = null
        }

        if (!chargeTriggered.current) {
          setReboundKind('quick')
          dispatch({ type: 'PET_CLICK' })
        }
      }

      dispatch({ type: 'GLOBAL_INPUT', event: event.payload })
    }).then((dispose) => {
      unlisten = dispose
    })

    return () => {
      unlisten?.()
      if (chargeFrame.current !== null) {
        window.cancelAnimationFrame(chargeFrame.current)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityAt.current >= SLEEP_AFTER_MS) {
        dispatch({ type: 'INACTIVITY' })
      }
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const animation = pack?.animations[machine.state]
  const frames = animation?.frames ?? []

  useEffect(() => {
    setFrameIndex(0)
    if (!animation || frames.length < 2) return

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1
        if (next < frames.length) return next
        return animation.loop ? 0 : current
      })
    }, Math.max(30, Math.floor(1_000 / animation.fps)))

    return () => window.clearInterval(timer)
  }, [animation, frames.length, machine.state])

  useEffect(() => {
    if (!animation?.durationMs) return
    const timer = window.setTimeout(
      () => dispatch({ type: 'ANIMATION_COMPLETE' }),
      animation.durationMs,
    )
    return () => window.clearTimeout(timer)
  }, [animation?.durationMs, machine.state])

  const frame = frames[Math.min(frameIndex, Math.max(0, frames.length - 1))]
  const frameUrl = frame ? `${PET_PACK_BASE}/${frame}` : ''
  const motionStyle = {
    '--press-scale-x': (1 + pressProgress * 0.18).toFixed(3),
    '--press-scale-y': (1 - pressProgress * 0.42).toFixed(3),
  } as CSSProperties

  const startDragging = () => {
    if (runningInTauri()) {
      void invoke('start_dragging')
    }
  }

  const handlePetClick = () => {
    lastActivityAt.current = Date.now()
    dispatch({ type: 'PET_CLICK' })
  }

  return (
    <main
      className={`pet-stage state-${machine.state}`}
      aria-label={pack?.name ?? 'Desktop pet'}
      onPointerDown={startDragging}
      onDoubleClick={handlePetClick}
    >
      <div
        className={[
          'pet-motion',
          leftButtonHeld.current && !chargeTriggered.current
            ? 'is-charging'
            : '',
          reboundKind ? `is-${reboundKind}-rebound` : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={motionStyle}
        onAnimationEnd={() => {
          setReboundKind(null)
          setPressProgress(0)
        }}
      >
        {frameUrl ? (
          <img
            className="pet-sprite"
            src={frameUrl}
            alt=""
            draggable={false}
            onError={() => dispatch({ type: 'PACK_ERROR' })}
          />
        ) : (
          <div className="pet-loading" aria-hidden="true" />
        )}
      </div>
      <output className="state-label" aria-live="polite">
        {machine.state.replace('_', ' ')}
      </output>
    </main>
  )
}

export default App
