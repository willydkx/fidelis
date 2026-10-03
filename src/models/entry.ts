import { ISODate } from '@/utils/dateUtils';

export interface DailyEntry {
  id: number;
  objectiveId: number;
  entryDate: ISODate;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  value: number | null;
  note: string | null;
}
