import { render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { useBooth } from '../store/booth'
import { resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import { Editor } from './Editor'

afterEach(() => useBooth.setState(useBooth.getInitialState(), true))

function open(revealed: boolean) {
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      screen: 'editor',
      templateId: 'ticket',
      edition: 'holo',
      values: resolveDefaults(getTemplate('ticket')),
      capture: { source: document.createElement('canvas'), w: 480, h: 512 },
      revealed,
    },
    true,
  )
  return render(<Editor />)
}

test('a card picked from a pack starts revealed', () => {
  const { container } = open(true)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('shown')
})

test('a direct capture still plays the flip', () => {
  const { container } = open(false)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('back')
})
