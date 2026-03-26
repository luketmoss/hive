import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { ThemeToggle } from '../board/theme-toggle';
import { isDemoMode } from '../../demo/is-demo-mode';
import type { UserInfo } from '../../api/types';

interface UserDropdownProps {
  user: UserInfo;
  displayName: string;
  onSignOut: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

/**
 * AC1: User dropdown replaces separate header controls.
 * Avatar + Name button opens a floating panel with email, theme toggle, and sign out.
 */
export function UserDropdown({ user, displayName, onSignOut, onOpenProfile, onOpenSettings }: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleToggle = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  const handleSignOut = useCallback(() => {
    closeDropdown();
    onSignOut();
  }, [closeDropdown, onSignOut]);

  const handleOpenProfile = useCallback(() => {
    closeDropdown();
    onOpenProfile?.();
  }, [closeDropdown, onOpenProfile]);

  const handleOpenSettings = useCallback(() => {
    closeDropdown();
    onOpenSettings?.();
  }, [closeDropdown, onOpenSettings]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeDropdown]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, closeDropdown]);

  // Focus first interactive element when opened
  useEffect(() => {
    if (open && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [open]);

  // Tab trap: Tab on last item closes dropdown
  const handlePanelKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      // Shift+Tab on first item: close dropdown
      e.preventDefault();
      closeDropdown();
    } else if (!e.shiftKey && document.activeElement === last) {
      // Tab on last item: close dropdown and move focus forward
      e.preventDefault();
      closeDropdown();
    }
  }, [closeDropdown]);

  return (
    <div class="user-dropdown" data-testid="user-dropdown">
      <button
        ref={triggerRef}
        class="user-dropdown-trigger"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="user-dropdown-trigger"
      >
        {user.picture ? (
          <img src={user.picture} alt="" class="user-avatar" />
        ) : (
          <span class="user-avatar-placeholder" aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span class="user-dropdown-name">{displayName}</span>
        <span class="user-dropdown-caret" aria-hidden="true">&#9662;</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          class="user-dropdown-panel"
          role="menu"
          onKeyDown={handlePanelKeyDown}
          data-testid="user-dropdown-panel"
        >
          <span class="user-dropdown-email">{user.email}</span>
          <hr class="user-dropdown-divider" />
          <ThemeToggle />
          <hr class="user-dropdown-divider" />
          {!isDemoMode() && onOpenProfile && (
            <>
              <button
                class="user-dropdown-edit-profile"
                role="menuitem"
                onClick={handleOpenProfile}
                data-testid="user-dropdown-edit-profile"
              >
                Edit profile
              </button>
              <hr class="user-dropdown-divider" />
            </>
          )}
          {onOpenSettings && (
            <>
              <button
                class="user-dropdown-settings"
                role="menuitem"
                onClick={handleOpenSettings}
                data-testid="user-dropdown-settings"
              >
                Settings
              </button>
              <hr class="user-dropdown-divider" />
            </>
          )}
          <button
            class="user-dropdown-signout"
            role="menuitem"
            onClick={handleSignOut}
            data-testid="user-dropdown-signout"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
