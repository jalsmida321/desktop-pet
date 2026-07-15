import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './App.css'
import {
  initialPetMachine,
  petMachineReducer,
  type GlobalInputEvent,
} from './petMachine'
import { loadPetPack, type PetPack } from './petPack'
import {
  DEFAULT_PET_SCALE,
  MAX_PET_SCALE,
  MIN_PET_SCALE,
  normalizePetScale,
  petScaleFromWheel,
} from './petScale'

const PET_PACK_BASE = '/assets/pets/usagi-desk'
const SLEEP_AFTER_MS = 12_000
const CHARGE_TO_REBOUND_MS = 900
const SCALE_STORAGE_KEY = 'desktop-pet-scale'
const SCALE_FEEDBACK_MS = 900

type ReboundKind = 'quick' | 'charged' | null

interface KeyDefinition {
  code: number
  label: string
  width?: number
}

const keyboardRows: KeyDefinition[][] = [
  [
    { code: 0x51, label: 'Q' },
    { code: 0x57, label: 'W' },
    { code: 0x45, label: 'E' },
    { code: 0x52, label: 'R' },
    { code: 0x54, label: 'T' },
    { code: 0x59, label: 'Y' },
    { code: 0x55, label: 'U' },
    { code: 0x49, label: 'I' },
    { code: 0x4f, label: 'O' },
    { code: 0x50, label: 'P' },
  ],
  [
    { code: 0x41, label: 'A' },
    { code: 0x53, label: 'S' },
    { code: 0x44, label: 'D' },
    { code: 0x46, label: 'F' },
    { code: 0x47, label: 'G' },
    { code: 0x48, label: 'H' },
    { code: 0x4a, label: 'J' },
    { code: 0x4b, label: 'K' },
    { code: 0x4c, label: 'L' },
    { code: 0x0d, label: 'ENTER', width: 1.55 },
  ],
  [
    { code: 0x10, label: 'SHIFT', width: 1.45 },
    { code: 0x5a, label: 'Z' },
    { code: 0x58, label: 'X' },
    { code: 0x43, label: 'C' },
    { code: 0x56, label: 'V' },
    { code: 0x42, label: 'B' },
    { code: 0x4e, label: 'N' },
    { code: 0x4d, label: 'M' },
    { code: 0x20, label: 'SPACE', width: 2.25 },
  ],
]

const runningInTauri = () => '__TAURI_INTERNALS__' in window

const loadStoredPetScale = () => {
  const storedValue = window.localStorage.getItem(SCALE_STORAGE_KEY)
  if (storedValue === null) return DEFAULT_PET_SCALE

  const storedScale = Number(storedValue)
  return Number.isFinite(storedScale)
    ? normalizePetScale(storedScale)
    : DEFAULT_PET_SCALE
}

function App() {
  const [pack, setPack] = useState<PetPack | null>(null)
  const [machine, dispatch] = useReducer(petMachineReducer, initialPetMachine)
  const [frameIndex, setFrameIndex] = useState(0)
  const [petScale, setPetScale] = useState(loadStoredPetScale)
  const [showScaleFeedback, setShowScaleFeedback] = useState(false)
  const [pressProgress, setPressProgress] = useState(0)
  const [reboundKind, setReboundKind] = useState<ReboundKind>(null)
  const [activeKeyCode, setActiveKeyCode] = useState<number | null>(null)
  const [activeMouseButton, setActiveMouseButton] = useState<string | null>(null)
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const lastActivityAt = useRef(Date.now())
  const leftButtonHeld = useRef(false)
  const chargeTriggered = useRef(false)
  const chargeStartedAt = useRef(0)
  const chargeFrame = useRef<number | null>(null)
  const petScaleRef = useRef(petScale)
  const scaleFeedbackTimer = useRef<number | null>(null)
  const controlKeyHeld = useRef(false)

  const rememberPetScale = (scale: number, showFeedback = true) => {
    const normalizedScale = normalizePetScale(scale)
    petScaleRef.current = normalizedScale
    setPetScale(normalizedScale)
    window.localStorage.setItem(SCALE_STORAGE_KEY, String(normalizedScale))

    if (!showFeedback) return normalizedScale

    setShowScaleFeedback(true)
    if (scaleFeedbackTimer.current !== null) {
      window.clearTimeout(scaleFeedbackTimer.current)
    }
    scaleFeedbackTimer.current = window.setTimeout(() => {
      setShowScaleFeedback(false)
      scaleFeedbackTimer.current = null
    }, SCALE_FEEDBACK_MS)

    return normalizedScale
  }

  const requestPetScale = (scale: number) => {
    const normalizedScale = rememberPetScale(scale)
    if (runningInTauri()) {
      void invoke<number>('set_pet_scale', { scale: normalizedScale })
    }
  }

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
      const input = event.payload
      lastActivityAt.current = Date.now()

      if (
        input.kind === 'mouse_move' &&
        input.x !== undefined &&
        input.y !== undefined &&
        input.windowX !== undefined &&
        input.windowY !== undefined &&
        input.windowWidth !== undefined &&
        input.windowHeight !== undefined
      ) {
        const centerX = input.windowX + input.windowWidth / 2
        const centerY = input.windowY + input.windowHeight * 0.42
        setGaze({
          x: Math.max(-1, Math.min(1, (input.x - centerX) / 420)),
          y: Math.max(-1, Math.min(1, (input.y - centerY) / 320)),
        })
      }

      if (input.kind === 'key_down' && input.keyCode !== undefined) {
        setActiveKeyCode(input.keyCode)
      }

      if (input.keyCode === 0x11) {
        controlKeyHeld.current = input.kind === 'key_down'
      }

      if (
        input.kind === 'key_down' &&
        controlKeyHeld.current &&
        input.keyCode !== undefined
      ) {
        let nextScale: number | null = null
        if (input.keyCode === 0xbb || input.keyCode === 0x6b) {
          nextScale = petScaleFromWheel(petScaleRef.current, -1)
        } else if (input.keyCode === 0xbd || input.keyCode === 0x6d) {
          nextScale = petScaleFromWheel(petScaleRef.current, 1)
        } else if (input.keyCode === 0x30 || input.keyCode === 0x60) {
          nextScale = DEFAULT_PET_SCALE
        }

        if (nextScale !== null && nextScale !== petScaleRef.current) {
          requestPetScale(nextScale)
        }
      }

      if (input.kind === 'key_up') {
        setActiveKeyCode((current) =>
          current === input.keyCode ? null : current,
        )
      }

      if (input.kind === 'mouse_down') {
        setActiveMouseButton(input.button ?? null)
      }

      if (input.kind === 'mouse_up') {
        setActiveMouseButton((current) =>
          current === input.button ? null : current,
        )
      }

      if (input.kind === 'mouse_down' && input.button === 'left') {
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

      if (input.kind === 'mouse_up' && input.button === 'left') {
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

      dispatch({ type: 'GLOBAL_INPUT', event: input })
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
    if (!runningInTauri()) return

    let disposed = false
    let unlisten: (() => void) | undefined

    void listen<number>('pet-scale-changed', (event) => {
      rememberPetScale(event.payload)
    }).then((dispose) => {
      if (disposed) {
        dispose()
        return
      }

      unlisten = dispose
      void invoke<number>('set_pet_scale', {
        scale: petScaleRef.current,
      }).then((scale) => rememberPetScale(scale, false))
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    const handleScaleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return

      event.preventDefault()
      const nextScale = petScaleFromWheel(petScaleRef.current, event.deltaY)
      if (nextScale === petScaleRef.current) return

      requestPetScale(nextScale)
    }

    window.addEventListener('wheel', handleScaleWheel, { passive: false })
    return () => {
      window.removeEventListener('wheel', handleScaleWheel)
      if (scaleFeedbackTimer.current !== null) {
        window.clearTimeout(scaleFeedbackTimer.current)
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
    '--gaze-x': `${(gaze.x * 8).toFixed(2)}px`,
    '--gaze-y': `${(gaze.y * 7).toFixed(2)}px`,
    '--head-shift-x': `${(gaze.x * 3).toFixed(2)}px`,
    '--head-shift-y': `${(gaze.y * 2).toFixed(2)}px`,
  } as CSSProperties
  const stageStyle = {
    '--pet-window-scale': petScale,
  } as CSSProperties

  const startDragging = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as Element).closest('[data-pet-control]')) return

    if (runningInTauri()) {
      void invoke('start_dragging')
    }
  }

  const handleScalePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    scale: number,
  ) => {
    event.stopPropagation()
    if (event.button !== 0) return

    event.preventDefault()
    requestPetScale(scale)
  }

  const handlePetClick = () => {
    lastActivityAt.current = Date.now()
    dispatch({ type: 'PET_CLICK' })
  }

  const hidePupils =
    machine.state === 'sleep' ||
    machine.state === 'error' ||
    machine.state === 'success'

  return (
    <main
      className={`pet-stage state-${machine.state}`}
      style={stageStyle}
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
          <>
            <img
              className="pet-sprite"
              src={frameUrl}
              alt=""
              draggable={false}
              onError={() => dispatch({ type: 'PACK_ERROR' })}
            />
            <div className={`pet-eyes${hidePupils ? ' are-hidden' : ''}`}>
              <span className="pupil pupil-left" />
              <span className="pupil pupil-right" />
            </div>
            <div className="keyboard" aria-hidden="true">
              {keyboardRows.map((row, rowIndex) => (
                <div className="keyboard-row" key={rowIndex}>
                  {row.map((key) => (
                    <kbd
                      className={
                        activeKeyCode === key.code ? 'is-active' : undefined
                      }
                      key={`${rowIndex}-${key.code}`}
                      style={{ flex: key.width ?? 1 }}
                    >
                      {key.label}
                    </kbd>
                  ))}
                </div>
              ))}
            </div>
            <div
              className={`desk-mouse${activeMouseButton ? ' is-active' : ''}`}
              aria-hidden="true"
            >
              <span
                className={
                  activeMouseButton === 'left' ? 'is-pressed' : undefined
                }
              />
              <span
                className={
                  activeMouseButton === 'right' ? 'is-pressed' : undefined
                }
              />
            </div>
          </>
        ) : (
          <div className="pet-loading" aria-hidden="true" />
        )}
      </div>
      <output className="state-label" aria-live="polite">
        {machine.state.replace('_', ' ')}
      </output>
      <output
        className={`scale-label${showScaleFeedback ? ' is-visible' : ''}`}
        aria-live="polite"
      >
        {Math.round(petScale * 100)}%
      </output>
      <div
        className="scale-controls"
        data-pet-control
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="缩小桌宠"
          title="缩小桌宠"
          disabled={petScale <= MIN_PET_SCALE}
          onPointerDown={(event) =>
            handleScalePointerDown(
              event,
              petScaleFromWheel(petScaleRef.current, 1),
            )
          }
          onClick={(event) => {
            if (event.detail === 0) {
              requestPetScale(
                petScaleFromWheel(petScaleRef.current, 1),
              )
            }
          }}
        >
          -
        </button>
        <button
          type="button"
          aria-label="恢复 100%"
          title="恢复 100%"
          disabled={petScale === DEFAULT_PET_SCALE}
          onPointerDown={(event) =>
            handleScalePointerDown(event, DEFAULT_PET_SCALE)
          }
          onClick={(event) => {
            if (event.detail === 0) {
              requestPetScale(DEFAULT_PET_SCALE)
            }
          }}
        >
          ↺
        </button>
        <button
          type="button"
          aria-label="放大桌宠"
          title="放大桌宠"
          disabled={petScale >= MAX_PET_SCALE}
          onPointerDown={(event) =>
            handleScalePointerDown(
              event,
              petScaleFromWheel(petScaleRef.current, -1),
            )
          }
          onClick={(event) => {
            if (event.detail === 0) {
              requestPetScale(
                petScaleFromWheel(petScaleRef.current, -1),
              )
            }
          }}
        >
          +
        </button>
      </div>
    </main>
  )
}

export default App
