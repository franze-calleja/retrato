import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import 'vitest-canvas-mock'

// Testing Library only auto-cleans when test globals are enabled; this project imports from 'vitest' explicitly.
afterEach(cleanup)

// jsdom has no object URLs; tests spy on these.
if (!URL.createObjectURL) URL.createObjectURL = () => `blob:test/${Math.random().toString(36).slice(2)}`
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
