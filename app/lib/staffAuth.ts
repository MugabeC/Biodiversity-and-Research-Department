/** Keeps the staff password for this browser tab only, so it is typed once per visit. It is never stored on the device. */
const KEY = 'nep-staff-password';

export function getStaffPassword(): string {
  try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function setStaffPassword(value: string) {
  try { if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY); } catch { /* private window: the password is just not remembered */ }
}
