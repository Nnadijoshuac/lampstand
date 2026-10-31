import { describe, it, expect } from 'vitest'
import { findVersion } from './versions'

const loaded = [
  { short: 'KJV', name: 'King James Version' },
  { short: 'AMP', name: 'Amplified Bible (2015)' },
  { short: 'AMPC', name: 'Amplified Bible, Classic Edition' },
  { short: 'ERV', name: 'Easy-to-Read Version (2005)' },
  { short: 'KJ2000', name: 'King James 2000 (2011)' },
  { short: 'NKJV', name: 'New King James Version' },
  { short: 'TPT', name: 'The Passion Translation' },
  { short: 'MSG', name: 'The Message Bible' },
  { short: 'NIV', name: 'New International Version' }
]

describe('findVersion', () => {
  it('amplified classic beats amplified', () => expect(findVersion('Genesis 1:1 in the Amplified Classic', loaded)).toBe('AMPC'))
  it('amplified', () => expect(findVersion("let's read it in the amplified", loaded)).toBe('AMP'))
  it('king james', () => expect(findVersion('switch to the King James', loaded)).toBe('KJV'))
  it('easy to read', () => expect(findVersion('from the easy to read version', loaded)).toBe('ERV'))
  it('ignores versions that are not installed', () => expect(findVersion('in the New Living Translation', loaded)).toBeUndefined())
  it('ignores ordinary speech', () => expect(findVersion('God is amplifying his message to us', loaded)).toBeUndefined())
})

describe('how people actually ask', () => {
  const asks: [string, string][] = [
    ['give us TPT', 'TPT'], ['TPT', 'TPT'], ['give us in TPT', 'TPT'], ['give us t p t', 'TPT'], ['in the passion', 'TPT'],
    ['KJV please', 'KJV'], ['read it in K J V', 'KJV'], ['NIV', 'NIV'], ['new king james please', 'NKJV'],
    ['give us message', 'MSG'], ['give it to us in the Message', 'MSG'], ['message version', 'MSG'], ['the message', 'MSG']
  ]
  for (const [said, short] of asks) it(said, () => expect(findVersion(said, loaded)).toBe(short))
  const sermon = ['the message of the cross is foolishness', 'the passion of Christ', 'I love the message', 'preach the good news']
  for (const said of sermon) it(`not a request: ${said}`, () => expect(findVersion(said, loaded)).toBeUndefined())
})

describe('codes spelled out and misheard', () => {
  it('"kg v" is KJV', () => expect(findVersion('kg v', [...loaded, { short: 'KJV', name: 'King James Version' }])).toBe('KJV'))
  it('"give us n l d" is NLT', () => expect(findVersion('give us n l d', [...loaded, { short: 'NLT', name: 'New Living Translation' }])).toBe('NLT'))
  it('leaves short words alone: "go to my house"', () => expect(findVersion('go to my house', loaded)).toBeUndefined())
  it('a different slip is not a match: "k x v"', () => expect(findVersion('k x v', [...loaded, { short: 'KJV', name: 'King James Version' }])).toBeUndefined())
})
