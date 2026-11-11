import { useContext } from 'react';
import { StudentIdContext, type StudentIdState } from './studentIdContext';

export function useStudentId(): StudentIdState {
  const context = useContext(StudentIdContext);
  if (!context) throw new Error('useStudentId must be used inside <StudentIdProvider>');
  return context;
}
