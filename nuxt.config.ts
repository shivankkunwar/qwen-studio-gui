// Polyfill ECMAScript Set methods for Node < 22 (required by cssnano / postcss plugins)
if (!('difference' in Set.prototype)) {
  ;(Set.prototype as any).difference = function (other: any) {
    const result = new Set(this)
    for (const elem of other) {
      result.delete(elem)
    }
    return result
  }
}
if (!('intersection' in Set.prototype)) {
  ;(Set.prototype as any).intersection = function (other: any) {
    const result = new Set()
    for (const elem of other) {
      if (this.has(elem)) result.add(elem)
    }
    return result
  }
}
if (!('union' in Set.prototype)) {
  ;(Set.prototype as any).union = function (other: any) {
    const result = new Set(this)
    for (const elem of other) {
      result.add(elem)
    }
    return result
  }
}
if (!('isDisjointFrom' in Set.prototype)) {
  ;(Set.prototype as any).isDisjointFrom = function (other: any) {
    for (const elem of this) {
      if (other.has(elem)) return false
    }
    return true
  }
}
if (!('isSubsetOf' in Set.prototype)) {
  ;(Set.prototype as any).isSubsetOf = function (other: any) {
    for (const elem of this) {
      if (!other.has(elem)) return false
    }
    return true
  }
}
if (!('isSupersetOf' in Set.prototype)) {
  ;(Set.prototype as any).isSupersetOf = function (other: any) {
    for (const elem of other) {
      if (!this.has(elem)) return false
    }
    return true
  }
}
if (!('symmetricDifference' in Set.prototype)) {
  ;(Set.prototype as any).symmetricDifference = function (other: any) {
    const result = new Set(this)
    for (const elem of other) {
      if (result.has(elem)) result.delete(elem)
      else result.add(elem)
    }
    return result
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/styles/main.scss'],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/_variables.scss" as *;\n'
        }
      }
    }
  },

  runtimeConfig: {
    // Private keys on server side
    modalApiUrl: process.env.MODAL_API_URL || 'https://shivankkunwar100--qwen-image-21-api.modal.run',
    modalKey: process.env.MODAL_KEY || '',
    modalSecret: process.env.MODAL_SECRET || '',
    localProxyUrl: process.env.LOCAL_PROXY_URL || 'http://127.0.0.1:8787',
    // Video models: separate Modal apps, same proxy-token keys (video-modal/)
    ltxApiUrl: process.env.LTX_API_URL || 'https://shivankkunwar100--ltx-25-video-api.modal.run',
    fastwanApiUrl: process.env.FASTWAN_API_URL || 'https://shivankkunwar100--fastwan-22-video-api.modal.run',

    // Public keys exposed to client
    public: {
      apiDefaultMode: 'nitro'
    }
  }
})
