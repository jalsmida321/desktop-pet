import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PET_SCALE,
  MAX_PET_SCALE,
  MIN_PET_SCALE,
  normalizePetScale,
  petScaleFromWheel,
} from './petScale'

describe('petScale', () => {
  it('clamps invalid and out-of-range values', () => {
    expect(normalizePetScale(Number.NaN)).toBe(DEFAULT_PET_SCALE)
    expect(normalizePetScale(0.2)).toBe(MIN_PET_SCALE)
    expect(normalizePetScale(2.4)).toBe(MAX_PET_SCALE)
  })

  it('rounds scale values to stable percentages', () => {
    expect(normalizePetScale(1.249)).toBe(1.25)
  })

  it('uses the wheel direction to zoom in and out', () => {
    expect(petScaleFromWheel(1, -120)).toBe(1.1)
    expect(petScaleFromWheel(1, 120)).toBe(0.9)
    expect(petScaleFromWheel(MAX_PET_SCALE, -120)).toBe(MAX_PET_SCALE)
    expect(petScaleFromWheel(MIN_PET_SCALE, 120)).toBe(MIN_PET_SCALE)
  })
})
