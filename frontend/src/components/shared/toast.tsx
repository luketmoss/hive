import { toastMessage } from '../../state/board-store';

export function Toast() {
  const msg = toastMessage.value;

  return (
    <div
      class={msg ? `toast toast-${msg.type}` : 'toast toast-empty'}
      role="status"
      aria-live="polite"
    >
      {msg ? msg.text : ''}
    </div>
  );
}
