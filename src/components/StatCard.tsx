interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  colorClass?: string;
}

export default function StatCard({ title, value, subtitle, colorClass = 'text-gray-900' }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${colorClass}`}>{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

export const getAchievementColor = (percent: number): string => {
  if (percent < 70) return 'text-red-600';
  if (percent <= 90) return 'text-yellow-600';
  return 'text-green-600';
};

export const getAchievementBgColor = (percent: number): string => {
  if (percent < 70) return 'bg-red-100 text-red-800';
  if (percent <= 90) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};
