import { useState } from 'react'

/** Place your PNG at `frontend/public/logo.png` — served as `/logo.png`. */
function BrandLogo({ size = 34 }: { size?: number }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-[11px] bg-brand text-xs font-bold text-white"
        style={{ width: size, height: size }}
      >
        SM
      </span>
    )
  }

  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export default BrandLogo
