import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import 'vitest-canvas-mock'

// Testing Library only auto-cleans when test globals are enabled; this project imports from 'vitest' explicitly.
afterEach(cleanup)
