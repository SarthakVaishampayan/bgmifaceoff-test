import Link from 'next/link'
import styles from '@/app/page.module.css'

export default function HeroCTA() {
  return (
    <div className={styles.heroCta}>
      <Link href="/register" className={styles.registerCta}>
        REGISTER NOW
      </Link>
    </div>
  )
}

