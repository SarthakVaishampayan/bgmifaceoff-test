import Link from 'next/link'
import styles from '@/app/page.module.css'

export default function HeroCTA() {
  return (
    <div className={styles.heroCta}>
      <Link href="/slots" className={styles.registerCta}>
        BOOK A SLOT NOW
      </Link>
    </div>
  )
}
