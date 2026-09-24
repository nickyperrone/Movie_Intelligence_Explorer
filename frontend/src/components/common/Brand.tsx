import { AR, BR, CL, CO, EC, MX, PE, VE } from 'country-flag-icons/react/3x2'
import {
  siAppletv,
  siCrunchyroll,
  siHbomax,
  siMubi,
  siNetflix,
  siParamountplus,
  siPlex,
  siTubi,
  type SimpleIcon,
} from 'simple-icons'
import {
  Eye,
  Film,
  Fingerprint,
  Ghost,
  Heart,
  KeyRound,
  Landmark,
  Laugh,
  Mic,
  Mountain,
  Music,
  Music2,
  Palette,
  Rocket,
  Swords,
  Tent,
  Theater,
  Trophy,
  Tv,
  UserRound,
  Users,
  Video,
  WandSparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

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

const LOGOS: Record<string, SimpleIcon> = {
  Netflix: siNetflix,
  'HBO Max': siHbomax,
  'Apple TV': siAppletv,
  Crunchyroll: siCrunchyroll,
  'Paramount+': siParamountplus,
  Plex: siPlex,
  Tubi: siTubi,
  MUBI: siMubi,
}

// Platforms whose logos are not in simple-icons get a monogram on their brand color.
const MONOGRAMS: Record<string, { text: string; color: string }> = {
  Amazon: { text: 'a', color: '#00A8E1' },
  'Amazon Prime Video': { text: 'a', color: '#00A8E1' },
  'Amazon Other': { text: 'a', color: '#232F3E' },
  'Disney+': { text: 'D+', color: '#113CCF' },
  'Claro Video': { text: 'C', color: '#DA291C' },
  Filmzie: { text: 'F', color: '#6C2BD9' },
  Globoplay: { text: 'G', color: '#FB0234' },
  MercadoLibre: { text: 'M', color: '#FFE600' },
  'Pluto TV': { text: 'P', color: '#FFF200' },
  ViX: { text: 'V', color: '#FF6600' },
  'ViX+': { text: 'V+', color: '#FF6600' },
  Viki: { text: 'V', color: '#1E90FF' },
}

function isLight(hex: string): boolean {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const logo = LOGOS[platform]
  const box = cn('inline-grid size-[18px] shrink-0 place-items-center rounded-[4px]', className)
  if (logo) {
    const background = logo.hex === '000000' ? '#2a2a2a' : `#${logo.hex}`
    return (
      <span className={box} style={{ background }} title={platform}>
        <svg
          viewBox="0 0 24 24"
          className="size-[70%]"
          aria-hidden
          fill={isLight(background) ? '#000' : '#fff'}
        >
          <path d={logo.path} />
        </svg>
      </span>
    )
  }
  const monogram = MONOGRAMS[platform] ?? { text: platform.charAt(0), color: '#2a2a2a' }
  return (
    <span
      className={cn(box, 'text-[9px] font-black leading-none')}
      style={{ background: monogram.color, color: isLight(monogram.color) ? '#000' : '#fff' }}
      title={platform}
      aria-hidden
    >
      {monogram.text}
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

const GENRE_ICONS: Record<string, LucideIcon> = {
  Action: Zap,
  Adventure: Mountain,
  Animation: Palette,
  Biography: UserRound,
  Comedy: Laugh,
  Crime: Fingerprint,
  Documentary: Video,
  Drama: Theater,
  Family: Users,
  Fantasy: WandSparkles,
  History: Landmark,
  Horror: Ghost,
  Music: Music,
  Musical: Music2,
  Mystery: KeyRound,
  'Reality-TV': Tv,
  Romance: Heart,
  'Sci-Fi': Rocket,
  Sport: Trophy,
  'Talk-Show': Mic,
  Thriller: Eye,
  War: Swords,
  Western: Tent,
}

export function GenreLabel({ genre }: { genre: string }) {
  const Icon = GENRE_ICONS[genre] ?? Film
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-subtle" aria-hidden />
      {genre}
    </span>
  )
}
