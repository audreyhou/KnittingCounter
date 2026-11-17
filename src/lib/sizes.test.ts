import { describe, expect, it } from 'vitest'
import { detectSizeLabels, findSizeValues, findTerm } from './sizes'

const pick = (text: string, count: number, index: number) =>
  findSizeValues(text, count, index).map((m) => text.slice(m.start, m.end))

describe('size highlighting', () => {
  const cast = 'Cast on 31 (31) 33 (33) 35 (35) 35 (35) sts using 5 mm [US 8] circular needles.'

  it('picks one size from alternating groups', () => {
    expect(pick(cast, 8, 0)).toEqual(['31'])
    expect(pick(cast, 8, 2)).toEqual(['33'])
    expect(pick(cast, 8, 7)).toEqual(['35'])
  })

  it('handles decimals, groups split over lines and several groups per sentence', () => {
    const t =
      'Length: 57 (59) 60 (63) 68 (69) 70 (71) cm [22.5 (23.25) 23.5 (24.75) 26.75\n(27.25) 27.5 (28) inches]'
    expect(pick(t, 8, 3)).toEqual(['63', '24.75'])
  })

  it('does not match shorter groups or unrelated numbers', () => {
    expect(pick('5 mm [US 8] (80 or 100 cm) circular needles', 8, 0)).toEqual([])
    expect(pick('Work rows 1st - 4th a total of 5 (5) 5 (6) times', 8, 0)).toEqual([])
  })

  it('supports grouped and slash styles', () => {
    expect(pick('Cast on 31 (33, 35, 37) sts', 4, 2)).toEqual(['35'])
    expect(pick('Cast on 31/33/35/37 sts', 4, 3)).toEqual(['37'])
  })

  it('detects size labels', () => {
    expect(detectSizeLabels('SIZES XS (S) M (L) XL (2XL) 3XL (4XL) MEASUREMENT')).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
      '2XL',
      '3XL',
      '4XL',
    ])
    expect(detectSizeLabels('Sizes: S (M, L, XL)')).toEqual(['S', 'M', 'L', 'XL'])
    expect(detectSizeLabels('Knit to MM1, slip MM1')).toBeNull()
  })
})

describe('term highlighting', () => {
  it('matches whole words, case-insensitively by default', () => {
    const t = 'K to MM1, slip MM1, M1R, slip 1 st, MM10'
    expect(findTerm(t, 'mm1').length).toBe(2)
    expect(findTerm(t, 'M1R').length).toBe(1)
    expect(findTerm(t, 'mm1', true).length).toBe(0)
  })
})
