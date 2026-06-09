'use client'

import type React from 'react'

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  dark = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled: boolean
  active: boolean
  dark?: boolean
}) {
  if (dark) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 14px', minHeight: '44px',
          backgroundColor: active ? 'rgba(232,82,10,0.18)' : disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
          color: disabled ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
          border: 'none',
          borderLeft: `3px solid ${active ? '#E8520A' : 'transparent'}`,
          borderRadius: '8px',
          fontSize: '14px', fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        <Icon size={16} />
        {label}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 16px',
        minHeight: '44px',
        backgroundColor: active ? '#E8520A' : disabled ? '#F3F4F6' : '#FFFFFF',
        color: active ? '#FFFFFF' : disabled ? '#9CA3AF' : '#0D0D0D',
        border: `1px solid ${active ? '#E8520A' : '#E5E7EB'}`,
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
        transition: 'background-color 0.15s, color 0.15s',
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}
