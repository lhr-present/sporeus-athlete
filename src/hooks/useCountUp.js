import { useState, useEffect } from 'react'

export function useCountUp(target, duration = 600) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setV(Math.round(target * p))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}
