export const DEFAULT_PET_SCALE = 1
export const MIN_PET_SCALE = 0.5
export const MAX_PET_SCALE = 2
export const PET_SCALE_STEP = 0.1

export const normalizePetScale = (scale: number) => {
  const finiteScale = Number.isFinite(scale) ? scale : DEFAULT_PET_SCALE
  const clampedScale = Math.min(
    MAX_PET_SCALE,
    Math.max(MIN_PET_SCALE, finiteScale),
  )

  return Math.round(clampedScale * 100) / 100
}

export const petScaleFromWheel = (currentScale: number, deltaY: number) => {
  if (deltaY === 0) return normalizePetScale(currentScale)

  return normalizePetScale(
    currentScale + (deltaY < 0 ? PET_SCALE_STEP : -PET_SCALE_STEP),
  )
}
