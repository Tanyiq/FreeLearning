import { useState } from 'react'

interface ReviewDialogProps {
  onCancel(): void
  onStart(requirement: string, commitId: string): void
}

export function ReviewDialog({ onCancel, onStart }: ReviewDialogProps) {
  const [requirement, setRequirement] = useState('')
  const [commitId, setCommitId] = useState('')
  const canStart = requirement.trim().length > 0 && commitId.trim().length > 0

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">INDEPENDENT SESSION</span>
            <h2 id="review-title">Start Review</h2>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="关闭">×</button>
        </div>
        <label>
          原始需求
          <textarea
            autoFocus
            rows={7}
            value={requirement}
            onChange={(event) => setRequirement(event.target.value)}
            placeholder="粘贴 DEV 的原始需求…"
          />
        </label>
        <label>
          Target Commit
          <input value={commitId} onChange={(event) => setCommitId(event.target.value)} placeholder="例如 a1b2c3d" />
        </label>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onCancel}>取消</button>
          <button className="button primary" disabled={!canStart} onClick={() => onStart(requirement.trim(), commitId.trim())}>
            Start Review
          </button>
        </div>
      </section>
    </div>
  )
}

