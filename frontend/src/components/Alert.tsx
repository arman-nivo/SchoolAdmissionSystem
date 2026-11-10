import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Kind = 'error' | 'success' | 'info';

export function Alert({ kind = 'error', children, onClose }: { kind?: Kind; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'success' ? 'check' : 'info'} /><span>{children}</span>
      {onClose && (
        <button type="button" className="link" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
