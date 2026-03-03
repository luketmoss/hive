import { toastMessage } from '../../state/board-store';

export function Toast() {
  const msg = toastMessage.value;
  if (!msg) return null;

  return (
    <div class={`toast toast-${msg.type}`} role="status" aria-live="polite">
      {msg.text}
    </div>
  );
}
