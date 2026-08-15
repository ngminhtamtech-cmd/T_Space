import type { TSpaceApi } from './index'

declare global {
  interface Window {
    tspace: TSpaceApi
  }
}

export {}
