/**
 * Keeps the staff password for this browser tab only, so it is typed once per visit. It is never stored on the device.
 * The staff tools pages ask for it once (see StaffGate) and the forms use it without asking again.
 */
const KEY = 'nep-staff-password';
export const STAFF_LOCK_EVENT = 'nep-staff-lock';

const IDLE_MS = 30 * 60 * 1000; // asked for again after 30 minutes without use
const STAMP = 'nep-staff-password-used';

export function getStaffPassword(): string {
  try {
    const value = sessionStorage.getItem(KEY) ?? '';
    if (!value) return '';
    const used = Number(sessionStorage.getItem(STAMP) ?? 0);
    if (!used || Date.now() - used > IDLE_MS) { sessionStorage.removeItem(KEY); sessionStorage.removeItem(STAMP); return ''; }
    sessionStorage.setItem(STAMP, String(Date.now()));
    return value;
  } catch { return ''; }
}

export function setStaffPassword(value: string) {
  try {
    if (value) { sessionStorage.setItem(KEY, value); sessionStorage.setItem(STAMP, String(Date.now())); }
    else { sessionStorage.removeItem(KEY); sessionStorage.removeItem(STAMP); }
  } catch { /* private window: the password is just not remembered */ }
}

/** Forgets the password and shows the sign-in box again. */
export function lockStaff() {
  setStaffPassword('');
  window.dispatchEvent(new Event(STAFF_LOCK_EVENT));
}
