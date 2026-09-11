'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Shield, Lock, Edit3, KeyRound, Check, AlertCircle, ArrowLeft, FlaskConical, LogOut, Calendar, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

interface Props {
  user: {
    id: string
    email: string
    created_at: string
  }
  team: {
    team_id: string
    team_name: string
    captain_user_id: string
    name_changed?: boolean
  }
  isCaptain: boolean
  isTestAccount: boolean
}

export default function ProfileClient({ user, team, isCaptain, isTestAccount }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Team name edit state
  const [currentTeamName, setCurrentTeamName] = useState(team.team_name)
  const [hasChangedName, setHasChangedName] = useState(!!team.name_changed)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newTeamNameInput, setNewTeamNameInput] = useState(team.team_name)
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [renameSuccessMsg, setRenameSuccessMsg] = useState('')

  // UPI payout state
  const [upiId, setUpiId] = useState('')
  const [upiHolderName, setUpiHolderName] = useState('')
  const [isEditingUpi, setIsEditingUpi] = useState(false)
  const [upiLoading, setUpiLoading] = useState(false)
  const [upiErr, setUpiErr] = useState('')
  const [upiSuccessMsg, setUpiSuccessMsg] = useState('')

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passErr, setPassErr] = useState('')
  const [passMsg, setPassMsg] = useState('')

  // Load saved UPI info
  useEffect(() => {
    fetch('/api/team/upi')
      .then(res => res.json())
      .then(data => {
        if (data.upi_id) setUpiId(data.upi_id)
        if (data.upi_holder_name) setUpiHolderName(data.upi_holder_name)
        if (!data.upi_id && !data.upi_holder_name) setIsEditingUpi(true)
      })
      .catch(() => {})
  }, [])

  // Sign out
  const handleSignOut = async () => {
    window.dispatchEvent(new Event('app:showLoader'))
    await supabase.auth.signOut()
    router.push('/')
  }

  // Handle Team Name Submit
  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamNameInput.trim()) return
    setRenameError('')
    setRenameSuccessMsg('')
    setRenameLoading(true)

    try {
      const res = await fetch('/api/team/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_team_name: newTeamNameInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRenameError(data.error || 'Failed to update.')
        setRenameLoading(false)
        return
      }
      setCurrentTeamName(data.new_team_name)
      setHasChangedName(true)
      setIsEditingName(false)
      setRenameSuccessMsg('Team name updated successfully! (Locked for tournament integrity)')
      setRenameLoading(false)
    } catch (err: any) {
      setRenameError(err.message || 'Network error')
      setRenameLoading(false)
    }
  }

  // Handle UPI Submit
  async function handleUpiSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUpiErr('')
    setUpiSuccessMsg('')
    setUpiLoading(true)

    try {
      const res = await fetch('/api/team/upi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi_id: upiId, upi_holder_name: upiHolderName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUpiErr(data.error || 'Failed to save UPI details.')
        setUpiLoading(false)
        return
      }
      setUpiSuccessMsg('UPI details saved successfully for prize payouts!')
      setIsEditingUpi(false)
      setUpiLoading(false)
    } catch (err: any) {
      setUpiErr(err.message || 'Network error')
      setUpiLoading(false)
    }
  }

  // Handle Password Submit
  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPassErr('')
    setPassMsg('')

    if (newPass.length < 6) {
      setPassErr('Password must be at least 6 characters.')
      return
    }
    if (newPass !== confirmPass) {
      setPassErr('Passwords do not match.')
      return
    }

    setPassLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setPassLoading(false)

    if (error) {
      setPassErr(error.message)
      return
    }

    setPassMsg('Password updated successfully!')
    setNewPass('')
    setConfirmPass('')
    setTimeout(() => {
      setIsChangingPassword(false)
      setPassMsg('')
    }, 2500)
  }

  return (
    <main className={styles.page}>
      <div className="container">
        {/* Navigation Breadcrumb */}
        <div className={styles.topNav}>
          <Link href="/dashboard" className={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>

        {/* Page Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Profile & Settings</h1>
            <p className={styles.subtitle}>Manage your team identity, payout credentials, and security</p>
          </div>
          <div className={styles.headerBadges}>
            {isCaptain && <span className={styles.captainBadge}>CAPTAIN</span>}
            {isTestAccount && (
              <span className={styles.testBadge}>
                <FlaskConical size={12} /> TEST ACCOUNT
              </span>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className={styles.grid}>
          {/* LEFT COLUMN: Team, UPI & Security */}
          <div className={styles.mainCol}>
            {/* Card 1: Team Settings */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <User size={18} color="#facc15" />
                <h2 className={styles.cardTitle}>TEAM IDENTITY</h2>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.sectionRow}>
                  <div className={styles.labelCol}>
                    <span className={styles.labelTitle}>Team Name</span>
                    <span className={styles.labelSub}>Your official team display name on leaderboards & brackets</span>
                  </div>

                  {!isEditingName ? (
                    <div className={styles.valueRow}>
                      <span className={styles.displayTeamName}>{currentTeamName}</span>
                      {!hasChangedName ? (
                        <button
                          onClick={() => {
                            setIsEditingName(true)
                            setRenameError('')
                            setRenameSuccessMsg('')
                          }}
                          className={styles.editBtn}
                        >
                          <Edit3 size={13} /> Edit Name
                        </button>
                      ) : (
                        <span className={styles.lockedBadge}>
                          <Lock size={12} /> Locked (1-time change used)
                        </span>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleRenameSubmit} className={styles.formBlock}>
                      <div className={styles.inputWrap}>
                        <input
                          type="text"
                          value={newTeamNameInput}
                          onChange={e => setNewTeamNameInput(e.target.value)}
                          placeholder="Enter new team name"
                          className={styles.inputField}
                          autoFocus
                          required
                          maxLength={30}
                        />
                      </div>
                      <div className={styles.formActions}>
                        <button type="submit" disabled={renameLoading} className={styles.saveBtn}>
                          {renameLoading ? 'Saving...' : 'Save Name'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingName(false)
                            setRenameError('')
                          }}
                          className={styles.cancelBtn}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className={styles.formNote}>
                        <AlertCircle size={12} /> Team names can only be updated once for tournament integrity.
                      </div>
                    </form>
                  )}
                </div>

                {renameError && <div className={styles.alertError}>{renameError}</div>}
                {renameSuccessMsg && <div className={styles.alertSuccess}>✓ {renameSuccessMsg}</div>}
              </div>
            </div>

            {/* Card 2: UPI Payout Details */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <CreditCard size={18} color="#facc15" />
                <h2 className={styles.cardTitle}>PAYOUT DETAILS (UPI)</h2>
              </div>
              <div className={styles.cardBody}>
                {/* Disclaimer Alert Box */}
                <div className={styles.upiDisclaimer}>
                  <AlertCircle size={18} className={styles.upiDisclaimerIcon} />
                  <div className={styles.upiDisclaimerText}>
                    <strong>Important Notice:</strong> Kindly provide the correct UPI ID and correct UPI ID holder name for smooth processing of payments. There may be a delay or withholding of payment if the information does not match.
                  </div>
                </div>

                {!isEditingUpi && upiId ? (
                  <div className={styles.upiDisplayBlock}>
                    <div className={styles.upiDisplayRow}>
                      <span className={styles.upiDisplayLabel}>UPI ID</span>
                      <span className={styles.upiDisplayVal}>{upiId}</span>
                    </div>
                    <div className={styles.upiDisplayRow}>
                      <span className={styles.upiDisplayLabel}>Account Holder Name</span>
                      <span className={styles.upiDisplayVal}>{upiHolderName || '—'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingUpi(true)
                        setUpiErr('')
                        setUpiSuccessMsg('')
                      }}
                      className={styles.editBtn}
                      style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                    >
                      <Edit3 size={13} /> Update UPI Details
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleUpiSubmit} className={styles.formBlock}>
                    <div className={styles.formGroup}>
                      <label className={styles.fieldLabel}>UPI ID (VPA)</label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={e => setUpiId(e.target.value)}
                        placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                        className={styles.inputField}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.fieldLabel}>UPI ID Holder Name</label>
                      <input
                        type="text"
                        value={upiHolderName}
                        onChange={e => setUpiHolderName(e.target.value)}
                        placeholder="e.g. Rahul Sharma (as per bank / UPI app)"
                        className={styles.inputField}
                        required
                      />
                    </div>

                    <div className={styles.formActions}>
                      <button type="submit" disabled={upiLoading} className={styles.saveBtn}>
                        {upiLoading ? 'Saving...' : 'Save UPI Details'}
                      </button>
                      {upiId && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingUpi(false)
                            setUpiErr('')
                          }}
                          className={styles.cancelBtn}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {upiErr && <div className={styles.alertError}>{upiErr}</div>}
                {upiSuccessMsg && <div className={styles.alertSuccess}>✓ {upiSuccessMsg}</div>}
              </div>
            </div>

            {/* Card 3: Security & Password */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Shield size={18} color="#facc15" />
                <h2 className={styles.cardTitle}>SECURITY & CREDENTIALS</h2>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.sectionRow}>
                  <div className={styles.labelCol}>
                    <span className={styles.labelTitle}>Account Password</span>
                    <span className={styles.labelSub}>Ensure your account is protected with a secure password</span>
                  </div>

                  {!isChangingPassword ? (
                    <button
                      onClick={() => {
                        setIsChangingPassword(true)
                        setPassErr('')
                        setPassMsg('')
                      }}
                      className={styles.passwordBtn}
                    >
                      <KeyRound size={14} /> Change Password
                    </button>
                  ) : (
                    <form onSubmit={handleChangePasswordSubmit} className={styles.formBlock}>
                      <div className={styles.formGroup}>
                        <label className={styles.fieldLabel}>New Password</label>
                        <input
                          type="password"
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          placeholder="Min 6 characters"
                          minLength={6}
                          className={styles.inputField}
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.fieldLabel}>Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPass}
                          onChange={e => setConfirmPass(e.target.value)}
                          placeholder="Repeat new password"
                          minLength={6}
                          className={styles.inputField}
                          required
                        />
                      </div>

                      <div className={styles.formActions}>
                        <button type="submit" disabled={passLoading} className={styles.saveBtn}>
                          {passLoading ? 'Updating...' : 'Update Password'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingPassword(false)
                            setPassErr('')
                          }}
                          className={styles.cancelBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {passErr && <div className={styles.alertError}>{passErr}</div>}
                {passMsg && <div className={styles.alertSuccess}>✓ {passMsg}</div>}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Account Info & Actions */}
          <div className={styles.sideCol}>
            {/* Account Info Card (Team ID removed per user request) */}
            <div className={styles.sideCard}>
              <h3 className={styles.sideCardTitle}>ACCOUNT DETAILS</h3>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoVal}>{user.email}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Account Role</span>
                  <span className={styles.infoVal}>{isCaptain ? 'Team Captain' : 'Player'}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className={styles.sideCard}>
              <h3 className={styles.sideCardTitle}>QUICK ACTIONS</h3>
              <div className={styles.actionList}>
                <Link href="/dashboard" className={styles.actionLink}>
                  <span>Go to Dashboard</span>
                  <span>→</span>
                </Link>
                <Link href="/slots" className={styles.actionLink}>
                  <span><Calendar size={13} style={{ display: 'inline', marginRight: '6px' }} /> Register Slots</span>
                  <span>→</span>
                </Link>
                <button onClick={handleSignOut} className={styles.signOutBtn}>
                  <LogOut size={14} /> Sign Out of BGFS
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
