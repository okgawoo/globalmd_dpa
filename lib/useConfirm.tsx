import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export function ConfirmModal({ title, message, confirmText = '확인', cancelText = '취소', danger = false, onConfirm, onCancel }: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="dpa-modal-overlay" onClick={onCancel}>
      <div className="dpa-modal" onClick={e => e.stopPropagation()}>
        {title && <div className="dpa-modal-title">{title}</div>}
        <div className="dpa-modal-msg">{message}</div>
        <div className="dpa-modal-btns">
          <button className="dpa-modal-btn-cancel" onClick={onCancel}>{cancelText}</button>
          <button className={danger ? "dpa-modal-btn-danger" : "dpa-modal-btn-confirm"} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const [modal, setModal] = useState<null | { options: ConfirmOptions; resolve: (v: boolean) => void }>(null)

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise(resolve => {
      setModal({ options: opts, resolve })
    })
  }, [])

  const handleConfirm = () => { modal?.resolve(true); setModal(null) }
  const handleCancel = () => { modal?.resolve(false); setModal(null) }

  const ConfirmDialog = modal ? (
    <ConfirmModal {...modal.options} onConfirm={handleConfirm} onCancel={handleCancel} />
  ) : null

  return { confirm, ConfirmDialog }
}
