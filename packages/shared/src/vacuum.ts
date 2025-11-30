export interface VacuumHistory {
  id: string;
  tableName: string;
  vacuumType: string;
  duration: number;
  status: string;
  timestamp: Date;
}
