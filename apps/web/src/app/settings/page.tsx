'use client';

import { useTranslation } from 'react-i18next';
import AlertConfig from '@/components/Settings/AlertConfig';

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold text-white">{t('settingsPage.title')}</h2>
        <p className="text-gray-400">{t('settingsPage.subtitle')}</p>
      </header>

      <div className="max-w-4xl">
        <AlertConfig />
      </div>
    </div>
  );
}
