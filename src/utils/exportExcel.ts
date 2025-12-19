import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface CollectionData {
  date: string;
  branchName: string;
  targetQty: number;
  achQty: number;
  cashQty: number;
  balance: number;
  achievementPercent: number;
}

export const exportToExcel = (data: CollectionData[], filename: string) => {
  const worksheetData = data.map(row => ({
    'Date': row.date,
    'Branch': row.branchName,
    'Target': row.targetQty,
    'ACH': row.achQty,
    'Cash': row.cashQty,
    'Balance': row.balance,
    'Achievement %': `${row.achievementPercent.toFixed(1)}%`
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Branch
    { wch: 10 }, // Target
    { wch: 10 }, // ACH
    { wch: 10 }, // Cash
    { wch: 10 }, // Balance
    { wch: 15 }, // Achievement %
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
};

export const generateFilename = (startDate: string, endDate?: string): string => {
  if (!endDate || startDate === endDate) {
    return `Daily_Collection_${startDate}`;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    const monthName = start.toLocaleString('default', { month: 'short' });
    return `Monthly_Collection_${monthName}_${start.getFullYear()}`;
  }
  return `Collection_${startDate}_to_${endDate}`;
};
