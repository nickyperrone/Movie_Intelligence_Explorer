import { AR, BR, CL, CO, EC, MX, PE, VE } from 'country-flag-icons/react/3x2'
import { createElement, useState } from 'react'
import { cn } from '@/lib/cn'
import { genreIcon } from '@/lib/genres'

const FLAGS: Record<string, typeof AR> = {
  Argentina: AR,
  Brazil: BR,
  Chile: CL,
  Colombia: CO,
  Ecuador: EC,
  Mexico: MX,
  Peru: PE,
  Venezuela: VE,
}

export function CountryFlag({ country, className }: { country: string; className?: string }) {
  const Flag = FLAGS[country]
  if (!Flag) return null
  return (
    <Flag
      title={country}
      className={cn('inline-block h-3 w-[18px] shrink-0 rounded-[2px]', className)}
    />
  )
}

// Official app icons, fetched by domain from Google's favicon service so every platform shows
// its real logo. A monogram on the brand color is the fallback when an icon cannot load.
const PLATFORMS: Record<string, { domain: string; monogram: string; color: string }> = {
  Netflix: { domain: 'netflix.com', monogram: 'N', color: '#E50914' },
  Amazon: { domain: 'primevideo.com', monogram: 'a', color: '#00A8E1' },
  'Amazon Prime Video': { domain: 'primevideo.com', monogram: 'a', color: '#00A8E1' },
  'Amazon Other': { domain: 'amazon.com', monogram: 'a', color: '#232F3E' },
  'Disney+': { domain: 'disneyplus.com', monogram: 'D+', color: '#113CCF' },
  'HBO Max': { domain: 'hbomax.com', monogram: 'M', color: '#002BE7' },
  'Apple TV': { domain: 'tv.apple.com', monogram: 'tv', color: '#2a2a2a' },
  'Claro Video': { domain: 'clarovideo.com', monogram: 'C', color: '#DA291C' },
  Crunchyroll: { domain: 'crunchyroll.com', monogram: 'C', color: '#FF5E00' },
  Filmzie: { domain: 'filmzie.com', monogram: 'F', color: '#6C2BD9' },
  Globoplay: { domain: 'globoplay.globo.com', monogram: 'G', color: '#FB0234' },
  MUBI: { domain: 'mubi.com', monogram: 'M', color: '#2a2a2a' },
  MercadoLibre: { domain: 'mercadolibre.com', monogram: 'M', color: '#FFE600' },
  'Paramount+': { domain: 'paramountplus.com', monogram: 'P+', color: '#0064FF' },
  Plex: { domain: 'plex.tv', monogram: 'P', color: '#EBAF00' },
  'Pluto TV': { domain: 'pluto.tv', monogram: 'P', color: '#FFF200' },
  Tubi: { domain: 'tubitv.com', monogram: 'T', color: '#7408FF' },
  ViX: { domain: 'vix.com', monogram: 'V', color: '#FF6600' },
  'ViX+': { domain: 'vix.com', monogram: 'V+', color: '#FF6600' },
  Viki: { domain: 'viki.com', monogram: 'V', color: '#1E90FF' },
}

function isLight(hex: string): boolean {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const brand = PLATFORMS[platform]
  const box = cn(
    'inline-grid size-[18px] shrink-0 place-items-center overflow-hidden rounded-[4px]',
    className,
  )
  if (brand && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${brand.domain}&sz=64`}
        alt=""
        title={platform}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(box, 'object-contain')}
      />
    )
  }
  const color = brand?.color ?? '#2a2a2a'
  return (
    <span
      className={cn(box, 'text-[9px] font-black leading-none')}
      style={{ background: color, color: isLight(color) ? '#000' : '#fff' }}
      title={platform}
      aria-hidden
    >
      {brand?.monogram ?? platform.charAt(0)}
    </span>
  )
}

export function CountryLabel({ country }: { country: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CountryFlag country={country} />
      {country}
    </span>
  )
}

export function PlatformLabel({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <PlatformIcon platform={platform} />
      {platform}
    </span>
  )
}

export function GenreLabel({ genre }: { genre: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {createElement(genreIcon(genre), {
        className: 'size-3.5 shrink-0 text-subtle',
        'aria-hidden': true,
      })}
      {genre}
    </span>
  )
}
