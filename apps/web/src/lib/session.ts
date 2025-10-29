export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'prizo_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
