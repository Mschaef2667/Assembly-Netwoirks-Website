'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, Trash2, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface LogoUploadProps {
  orgId: string
  initialLogoUrl: string | null
  onChange?: (url: string | null) => void
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
const ACCEPT_ATTR = '.png,.jpg,.jpeg,.svg'
const MAX_BYTES = 4 * 1024 * 1024 // 4MB

function extFromFile(file: File): string {
  if (file.type === 'image/svg+xml') return 'svg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') return 'jpg'
  const name = file.name.toLowerCase()
  if (name.endsWith('.svg')) return 'svg'
  if (name.endsWith('.png')) return 'png'
  return 'jpg'
}

export default function LogoUpload({ orgId, initialLogoUrl, onChange }: LogoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function openPicker() {
    if (state === 'uploading') return
    fileRef.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setErrorMsg(null)

    if (!ACCEPTED_TYPES.includes(file.type) && !/\.(png|jpe?g|svg)$/i.test(file.name)) {
      setState('error')
      setErrorMsg('Logo must be a PNG, JPG, or SVG file')
      return
    }
    if (file.size > MAX_BYTES) {
      setState('error')
      setErrorMsg('Logo must be 4MB or smaller')
      return
    }

    setState('uploading')
    try {
      const ext = extFromFile(file)
      const objectPath = `${orgId}/logo.${ext}`

      const contentType = file.type || (ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : 'image/jpeg')

      const { error: uploadErr } = await supabase.storage
        .from('org-logos')
        .upload(objectPath, file, { upsert: true, contentType, cacheControl: '3600' })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(objectPath)
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}`

      const { error: updateErr } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', orgId)
      if (updateErr) throw updateErr

      setLogoUrl(publicUrl)
      onChange?.(publicUrl)
      setState('success')
      setTimeout(() => setState('idle'), 2500)
    } catch (err) {
      console.error('[LogoUpload] upload failed =>', err)
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setState('error')
    }
  }

  async function handleRemove() {
    if (state === 'uploading' || !logoUrl) return
    setErrorMsg(null)
    setState('uploading')
    try {
      const { data: list } = await supabase.storage.from('org-logos').list(orgId)
      if (list && list.length > 0) {
        const paths = list.map(f => `${orgId}/${f.name}`)
        await supabase.storage.from('org-logos').remove(paths)
      }

      const { error: updateErr } = await supabase
        .from('organizations')
        .update({ logo_url: null })
        .eq('id', orgId)
      if (updateErr) throw updateErr

      setLogoUrl(null)
      onChange?.(null)
      setState('idle')
    } catch (err) {
      console.error('[LogoUpload] remove failed =>', err)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove logo')
      setState('error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={openPicker}
          disabled={state === 'uploading'}
          aria-label={logoUrl ? 'Change logo' : 'Upload logo'}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '12px',
            border: '2px dashed rgba(255,255,255,0.25)',
            backgroundColor: '#1A3050',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: state === 'uploading' ? 'wait' : 'pointer',
            overflow: 'hidden',
            padding: 0,
            position: 'relative',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Company logo"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                backgroundColor: '#FFFFFF',
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.55)' }}>
              <ImageIcon size={28} strokeWidth={1.6} />
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Upload Logo</span>
            </div>
          )}
          {state === 'uploading' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(10,22,40,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={openPicker}
            disabled={state === 'uploading'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '44px',
              padding: '0 18px',
              backgroundColor: state === 'uploading' ? 'rgba(255,255,255,0.1)' : '#E8520A',
              color: state === 'uploading' ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: state === 'uploading' ? 'not-allowed' : 'pointer',
            }}
          >
            <Upload size={14} strokeWidth={2} />
            {logoUrl ? 'Replace logo' : 'Upload logo'}
          </button>

          {logoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={state === 'uploading'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '0 18px',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: state === 'uploading' ? 'not-allowed' : 'pointer',
              }}
            >
              <Trash2 size={14} strokeWidth={2} />
              Remove logo
            </button>
          )}

          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0, maxWidth: '320px' }}>
            PNG, JPG, or SVG. Max 4MB. Shown in the sidebar, the public survey page, and on Strategic Plan exports.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {state === 'success' && (
        <p style={{ fontSize: '13px', color: '#4ADE80', margin: 0 }}>Logo updated.</p>
      )}
      {state === 'error' && errorMsg && (
        <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{errorMsg}</p>
      )}
    </div>
  )
}
