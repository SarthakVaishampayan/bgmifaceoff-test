'use client'

import React from 'react'
import Link from 'next/link'
import { Crown, Trophy, Star, Monitor, Mic, Users, Camera } from 'lucide-react'
import styles from './HomePrizePool.module.css'
import { homePrizePoolConfig, formatINR, type PrizePoolConfig } from '@/lib/data/homePrizePoolData'

interface HomePrizePoolProps {
  config?: PrizePoolConfig
  winningPhotoUrl?: string | null
}

export default function HomePrizePool({
  config = homePrizePoolConfig,
  winningPhotoUrl,
}: HomePrizePoolProps) {
  // Allow prop override or fallback to config value
  const activeWinningPhoto = winningPhotoUrl !== undefined ? winningPhotoUrl : config.championsWall.winningPhotoUrl

  // Helper to render icon for perks
  const renderPerkIcon = (iconName: string) => {
    switch (iconName) {
      case 'trophy':
        return <Trophy size={20} strokeWidth={1.8} aria-hidden="true" />
      case 'screen':
        return <Monitor size={20} strokeWidth={1.8} aria-hidden="true" />
      case 'mic':
        return <Mic size={20} strokeWidth={1.8} aria-hidden="true" />
      case 'users':
        return <Users size={20} strokeWidth={1.8} aria-hidden="true" />
      case 'star':
        return <Star size={20} strokeWidth={1.8} aria-hidden="true" />
      default:
        return <Trophy size={20} strokeWidth={1.8} aria-hidden="true" />
    }
  }

  return (
    <section className={styles.wrap} aria-labelledby="home-pp-title">
      {/* ── 1. HEADER ROW ── */}
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{config.seasonLabel}</p>
          <h2 className={styles.title} id="home-pp-title">
            {config.heading} <em className={styles.titleHighlight}>{config.headingHighlight}</em>
          </h2>
        </div>
        <div className={styles.paid}>
          <span className={styles.dot} aria-hidden="true" />
          <div>
            <small>{config.paidOutRound}</small>
            <strong>{formatINR(config.paidOutAmount)}</strong>
            <span>{config.paidOutLabel}</span>
          </div>
        </div>
      </div>

      <p className={styles.lede}>{config.introText}</p>

      {/* ── 2. BOARD ── */}
      <div className={styles.board}>
        {/* 1st Place Card + Trophy Aside */}
        <div className={styles.champ}>
          <div className={styles.crest} aria-hidden="true">
            <Crown size={40} strokeWidth={1.8} />
          </div>

          <div>
            <div className={styles.tag}>{config.firstPlace.tag}</div>
            <div className={styles.place}>{config.firstPlace.place}</div>
          </div>

          <div className={styles.amt}>
            {formatINR(config.firstPlace.amount)}
          </div>

          {/* Trophy Aside */}
          <aside className={styles.reward} aria-label="Winners trophy">
            <div className={styles.stage}>
              <img
                className={styles.trophyImg}
                src={config.firstPlace.trophyImageSrc}
                alt={config.firstPlace.trophyImageAlt}
                width={524}
                height={1000}
                loading="lazy"
              />
              <div className={styles.refl} aria-hidden="true">
                <img
                  className={styles.reflImg}
                  src={config.firstPlace.trophyImageSrc}
                  alt=""
                  width={524}
                  height={1000}
                  loading="lazy"
                />
              </div>
            </div>

            <div className={styles.rewardCopy}>
              <p className={styles.eyebrow}>{config.firstPlace.trophyEyebrow}</p>
              <h4 className={styles.rewardHeading}>{config.firstPlace.trophyHeading}</h4>
              <p className={styles.rewardText}>{config.firstPlace.trophyText}</p>
            </div>
          </aside>
        </div>

        {/* ── 3. CHAMPIONS WALL BLOCK (SEPARATE BLOCK UNDER 1ST PLACE) ── */}
        <div className={styles.hall}>
          <div className={styles.wallHeader}>
            <h3 className={styles.wallTitle}>{config.championsWall.heading}</h3>
            <p className={styles.wallLabel}>{config.championsWall.label}</p>
          </div>

          <div className={styles.banner}>
            {activeWinningPhoto ? (
              <img
                className={styles.bannerPhoto}
                src={activeWinningPhoto}
                alt={config.championsWall.title}
                loading="lazy"
              />
            ) : (
              <div className={styles.slot} aria-hidden="true">
                <div>
                  <Camera size={34} strokeWidth={1.6} />
                  Winning team photo goes here
                </div>
              </div>
            )}

            <div className={styles.bannerCopy}>
              <span className={styles.chip}>{config.championsWall.chipText}</span>
              <h4 className={styles.bannerTitle}>{config.championsWall.title}</h4>
              <p className={styles.bannerText}>{config.championsWall.description}</p>
              <Link className={styles.btnGhost} href={config.championsWall.buttonHref}>
                {config.championsWall.buttonText}
              </Link>
            </div>
          </div>
        </div>

        {/* ── 4. FOUR SMALLER PAYOUT CARDS (2x2 GRID) ── */}
        <div className={styles.grid2}>
          {config.payoutsGrid.map((payout) => {
            let tileClass = styles.tile
            if (payout.tint === 'silver') tileClass = `${styles.tile} ${styles.tileSilver}`
            else if (payout.tint === 'bronze') tileClass = `${styles.tile} ${styles.tileBronze}`
            else if (payout.tint === 'neutral') tileClass = `${styles.tile} ${styles.tileFourth}`
            else if (payout.tint === 'gold') tileClass = `${styles.tile} ${styles.tileMvp}`

            return (
              <div key={payout.id} className={tileClass}>
                <div>
                  {payout.tag && (
                    <div className={styles.tag}>
                      {payout.isMvp && (
                        <Star size={16} strokeWidth={1.8} aria-hidden="true" />
                      )}
                      {payout.tag}
                    </div>
                  )}
                  <div className={styles.place}>{payout.place}</div>
                </div>
                <div className={styles.amt}>{formatINR(payout.amount)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 5. PERKS ("WHAT YOU'RE PLAYING FOR") ── */}
      <div className={styles.perksHeader}>
        <h3 className={styles.perksTitle}>{config.perksHeading}</h3>
        <p className={styles.perksLabel}>{config.perksLabel}</p>
      </div>

      <ul className={styles.perksList}>
        {config.perks.map((perk) => (
          <li key={perk.id} className={styles.perkItem}>
            <i className={styles.perkIconWrap} aria-hidden="true">
              {renderPerkIcon(perk.icon)}
            </i>
            <span className={styles.perkText}>{perk.text}</span>
          </li>
        ))}
      </ul>

    </section>
  )
}
