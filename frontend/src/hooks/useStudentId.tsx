import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'school-admission.studentId';

function load(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

interface StudentIdState {
  /** The active birth registration number ('' when none entered yet). */
  studentId: string;
  setStudentId: (id: string) => void;
}

const StudentIdContext = createContext<StudentIdState | null>(null);

/**
 * Keeps the student's birth registration number for the whole app and in
 * localStorage, so it is still there after a refresh or reopening the browser.
 */
export function StudentIdProvider({ children }: { children: ReactNode }) {
  const [studentId, setState] = useState(load);

  const setStudentId = useCallback((id: string) => {
    setState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode: keep it in memory only */
    }
  }, []);

  return <StudentIdContext.Provider value={{ studentId, setStudentId }}>{children}</StudentIdContext.Provider>;
}

export function useStudentId(): StudentIdState {
  const ctx = useContext(StudentIdContext);
  if (!ctx) throw new Error('useStudentId must be used inside <StudentIdProvider>');
  return ctx;
}
