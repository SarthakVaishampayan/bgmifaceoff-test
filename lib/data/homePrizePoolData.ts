export interface PayoutItem {
  id: string
  place: string
  tag?: string
  amount: number
  tint: 'gold' | 'silver' | 'bronze' | 'neutral'
  isMvp?: boolean
}

export interface PerkItem {
  id: string
  icon: 'trophy' | 'screen' | 'mic' | 'users' | 'star'
  text: string
}

export interface PrizePoolConfig {
  seasonLabel: string
  heading: string
  headingHighlight: string
  paidOutRound: string
  paidOutAmount: number
  paidOutLabel: string
  introText: string
  firstPlace: {
    tag: string
    place: string
    amount: number
    trophyEyebrow: string
    trophyHeading: string
    trophyText: string
    trophyImageSrc: string
    trophyImageAlt: string
  }
  championsWall: {
    heading: string
    label: string
    chipText: string
    title: string
    description: string
    buttonText: string
    buttonHref: string
    winningPhotoUrl: string | null
  }
  payoutsGrid: PayoutItem[]
  perksHeading: string
  perksLabel: string
  perks: PerkItem[]
  cta?: {
    title: string
    description: string
    buttonText: string
    buttonHref: string
  }
}

export const homePrizePoolConfig: PrizePoolConfig = {
  seasonLabel: '// SEASON 1 REWARDS',
  heading: 'PRIZE',
  headingHighlight: 'POOL',
  paidOutRound: 'ROUND 1 · ALREADY PAID OUT',
  paidOutAmount: 12000,
  paidOutLabel: 'prize pool',
  introText: 'Placement, eliminations and performance decide every payout. Here is what the Season 1 Grand Finals pays out.',
  firstPlace: {
    tag: 'Champions',
    place: '1st place',
    amount: 2200,
    trophyEyebrow: 'Champions take home',
    trophyHeading: 'Official BGFS Trophy',
    trophyText: 'The winning team takes home this trophy. It is shown here so squads can see what they are playing for. It does not appear on the website.',
    trophyImageSrc: '/trophy.webp',
    trophyImageAlt: 'The BGFS Season 1 Champions trophy',
  },
  championsWall: {
    heading: 'Champions wall',
    label: "Winner's recognition",
    chipText: 'BGFS',
    title: 'Season 1 Champions',
    description: "The winning squad's photo goes on the BGFS homepage as soon as the Grand Finals end, with the trophy and the ₹2,200 prize.",
    buttonText: 'View winners wall',
    buttonHref: '/leaderboard',
    winningPhotoUrl: '/winning-team.webp',
  },
  payoutsGrid: [
    {
      id: '2nd-place',
      place: '2nd place',
      tag: 'Silver',
      amount: 1100,
      tint: 'silver',
    },
    {
      id: '3rd-place',
      place: '3rd place',
      tag: 'Bronze',
      amount: 800,
      tint: 'bronze',
    },
    {
      id: '4th-place',
      place: '4th place',
      amount: 500,
      tint: 'neutral',
    },
    {
      id: 'mvp',
      place: 'MVP',
      tag: 'Player award',
      amount: 400,
      tint: 'gold',
      isMvp: true,
    },
  ],
  perksHeading: "What you're playing for",
  perksLabel: 'Perks',
  perks: [
    {
      id: 'trophy',
      icon: 'trophy',
      text: 'Trophy for the winning team',
    },
    {
      id: 'screen',
      icon: 'screen',
      text: 'Champions featured on the website homepage',
    },
    {
      id: 'mic',
      icon: 'mic',
      text: 'Finals live-streamed with a dedicated caster',
    },
    {
      id: 'users',
      icon: 'users',
      text: 'Live watch party for the finals',
    },
    {
      id: 'star',
      icon: 'star',
      text: 'MVP featured on the website MVP list',
    },
  ],
  cta: {
    title: 'Semi Finals registrations are live',
    description: 'Teams 9–16 and open squads still have a shot at the Grand Finals.',
    buttonText: 'Register for Semi Finals →',
    buttonHref: '/slots',
  },
}

/**
 * Format an amount in INR format with ₹ symbol and tabular-safe spacing
 */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}
