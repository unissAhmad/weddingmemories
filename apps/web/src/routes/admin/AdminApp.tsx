import { Navigate, Route, Routes } from 'react-router';
import { AdminLogin } from './AdminLogin';
import { AdminShell } from './AdminShell';
import { AdminHome } from './AdminHome';
import { EventAdminLayout } from './EventAdminLayout';
import { OverviewPage } from './OverviewPage';
import { AccessPage } from './AccessPage';
import { PhotosPage } from './PhotosPage';
import { GuestsPage } from './GuestsPage';
import { DownloadsPage } from './DownloadsPage';
import { SettingsPage } from './SettingsPage';
import { WelcomeSettingsPage } from './WelcomeSettingsPage';
import { AuditPage } from './AuditPage';
import { TeamPage } from './TeamPage';

/** The admin panel, loaded as its own chunk so guests never download it. */
export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route element={<AdminShell />}>
        <Route index element={<AdminHome />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="e/:eventId" element={<EventAdminLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="welcome" element={<WelcomeSettingsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
