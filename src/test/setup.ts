import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import 'vitest-canvas-mock'

// Testing Library only auto-cleans when test globals are enabled; this project imports from 'vitest' explicitly.
afterEach(cleanup)

// Vitest's jsdom object URLs reject jsdom Blobs; use plain stubs that tests can spy on.
URL.createObjectURL = () => `blob:test/${Math.random().toString(36).slice(2)}`
URL.revokeObjectURL = () => {}
