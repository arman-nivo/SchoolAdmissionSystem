import { useCallback, useState, type ReactNode } from 'react';
import { StudentIdContext } from './studentIdContext';

const STORAGE_KEY = 'school-admission.studentId';

function savedStudentId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Keep the selected student across pages and browser restarts. */
export function StudentIdProvider({ children }: { children: ReactNode }) {
  const [studentId, setState] = useState(savedStudentId);

  const setStudentId = useCallback((id: string) => {
    setState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be disabled. The student stays selected for this tab.
    }
  }, []);

  return <StudentIdContext.Provider value={{ studentId, setStudentId }}>{children}</StudentIdContext.Provider>;
}
