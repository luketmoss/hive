import { toastMessage } from '../../state/board-store';

export function Toast() {
  const msg = toastMessage.value;
  if (!msg) return null;

  return (
    <div class={`toast toast-${msg.type}`}>
      {msg.text}
    </div>
  );
}
