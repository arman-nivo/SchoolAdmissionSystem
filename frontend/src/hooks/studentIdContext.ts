import { createContext } from 'react';

export interface StudentIdState {
  studentId: string;
  setStudentId: (id: string) => void;
}

export const StudentIdContext = createContext<StudentIdState | null>(null);
