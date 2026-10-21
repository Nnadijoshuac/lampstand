import { describe, it, expect } from 'vitest'
import { findVersion } from './versions'

const loaded = [
  { short: 'KJV', name: 'King James Version' },
  { short: 'AMP', name: 'Amplified Bible (2015)' },
  { short: 'AMPC', name: 'Amplified Bible, Classic Edition' },
  { short: 'ERV', name: 'Easy-to-Read Version (2005)' },
  { short: 'KJ2000', name: 'King James 2000 (2011)' }
]

describe('findVersion', () => {
  it('amplified classic beats amplified', () => expect(findVersion('Genesis 1:1 in the Amplified Classic', loaded)).toBe('AMPC'))
  it('amplified', () => expect(findVersion("let's read it in the amplified", loaded)).toBe('AMP'))
  it('king james', () => expect(findVersion('switch to the King James', loaded)).toBe('KJV'))
  it('easy to read', () => expect(findVersion('from the easy to read version', loaded)).toBe('ERV'))
  it('ignores versions that are not installed', () => expect(findVersion('in the New Living Translation', loaded)).toBeUndefined())
  it('ignores ordinary speech', () => expect(findVersion('God is amplifying his message to us', loaded)).toBeUndefined())
})
