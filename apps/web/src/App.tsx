import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { FullPageSpinner } from './components/FullPageSpinner';
import { EventLayout } from './routes/guest/EventLayout';
import { EventLanding } from './routes/guest/EventLanding';
import { JoinPage } from './routes/guest/JoinPage';
import { GuestShell } from './routes/guest/GuestShell';
import { HomePage } from './routes/HomePage';
import { NotFoundPage } from './routes/NotFoundPage';

// Keep Uppy, PhotoSwipe and the admin panel out of the landing-page bundle for guests on 3G.
const UploadPage = lazy(() =>
  import('./routes/guest/UploadPage').then((m) => ({ default: m.UploadPage })),
);
const GalleryPage = lazy(() =>
  import('./routes/guest/GalleryPage').then((m) => ({ default: m.GalleryPage })),
);
const FriendsPage = lazy(() =>
  import('./routes/guest/FriendsPage').then((m) => ({ default: m.FriendsPage })),
);
const FriendPhotosPage = lazy(() =>
  import('./routes/guest/FriendPhotosPage').then((m) => ({ default: m.FriendPhotosPage })),
);
const AdminApp = lazy(() => import('./routes/admin/AdminApp'));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/e/:slug" element={<EventLayout />}>
            <Route index element={<EventLanding />} />
            <Route path="join" element={<JoinPage />} />
            <Route element={<GuestShell />}>
              <Route path="upload" element={<UploadPage />} />
              <Route path="gallery" element={<GalleryPage />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="friends/:guestId" element={<FriendPhotosPage />} />
            </Route>
          </Route>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
