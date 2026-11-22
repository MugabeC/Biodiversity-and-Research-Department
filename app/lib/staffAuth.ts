/**
 * Keeps the staff password for this browser tab only, so it is typed once per visit. It is never stored on the device.
 * The staff tools pages ask for it once (see StaffGate) and the forms use it without asking again.
 */
const KEY = 'nep-staff-password';
export const STAFF_LOCK_EVENT = 'nep-staff-lock';

export function getStaffPassword(): string {
  try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function setStaffPassword(value: string) {
  try { if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY); } catch { /* private window: the password is just not remembered */ }
}

/** Forgets the password and shows the sign-in box again. */
export function lockStaff() {
  setStaffPassword('');
  window.dispatchEvent(new Event(STAFF_LOCK_EVENT));
}
