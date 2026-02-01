'use client';

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  const tabs = [
    { id: 'general', label: '일반' },
    { id: 'alerts', label: '알림' },
    { id: 'vacuum', label: 'Vacuum' },
    { id: 'retention', label: '보존 정책' },
  ];

  return (
    <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200
            ${
              activeTab === tab.id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-slate-800'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
