import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import './index.css';
// WalkerFeed was replaced with FeedLayout + Pages
import { useMouseIdle } from './hooks/useMouseIdle';
import { useAuth } from '@eb-packages/logic/src/hooks/useAuth';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPage } from './pages/AdminPage';
import { PostcardDetailPage } from './pages/PostcardDetailPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initAnalytics, analytics } from './lib/analytics';
import { AlbumPage } from './pages/AlbumPage';
import { GameModeProvider } from './contexts/GameModeContext';
import { StampProvider } from './contexts/StampContext';
import { OnboardingProvider } from './contexts/OnboardingContext';

import { FeedLayout } from './pages/feed/FeedLayout';
import { FeedGridPage } from './pages/feed/FeedGridPage';
import { FeedCarouselPage } from './pages/feed/FeedCarouselPage';
import { CollectionPage } from './pages/feed/CollectionPage';
import { ProfilePage } from './pages/feed/ProfilePage';
import { GamePage } from './pages/GamePage';

import { GlobeExplorerPage } from './pages/feed/GlobeExplorerPage';

// ── Admin sub-pages ────────────────────────────────────────────────────
import { AdminDashboard }  from './pages/admin/AdminDashboard';
import { AdminGeneration } from './pages/admin/AdminGeneration';
import { AdminQueuePage }  from './pages/admin/AdminQueuePage';
import { AdminBrowser }    from './pages/admin/AdminBrowser';
import { AdminPostcards }  from './pages/admin/AdminPostcards';
import { AdminAlbums }     from './pages/admin/AdminAlbums';
import { AdminSync }       from './pages/admin/AdminSync';
import { AdminSettings }   from './pages/admin/AdminSettings';
import { AdminStamps }     from './pages/admin/AdminStamps';
import { AdminInstagram }  from './pages/admin/AdminInstagram';

// ── Feed (main app) ────────────────────────────────────────────────────

function FeedApp({
  user,
  isAdmin,
  signOut,
}: {
  user: ReturnType<typeof useAuth>['user'];
  isAdmin: boolean;
  signOut: () => void;
}) {
  const navigate = useNavigate();
  const isIdle = useMouseIdle(5000);
  const [showLogin, setShowLogin] = useState(false);
  const [isOnWelcome, setIsOnWelcome] = useState(false);
  const { signIn } = useAuth();

  // --- Footer click: single = /admin (if admin), triple = login/logout ---
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFooterClick = useCallback(() => {
    clickCount.current += 1;

    if (clickTimer.current) clearTimeout(clickTimer.current);

    if (clickCount.current >= 3) {
      clickCount.current = 0;
      if (user) {
        signOut();
      } else {
        setShowLogin(true);
      }
      return;
    }

    clickTimer.current = setTimeout(() => {
      // Single click as admin → go to /admin
      if (clickCount.current === 1 && isAdmin) {
        navigate('/admin');
      }
      clickCount.current = 0;
    }, 400);
  }, [user, isAdmin, signOut, navigate]);

  return (
    <div className='w-screen h-[100dvh] relative overflow-hidden flex flex-col'>
      {/* Walker Feed Fullscreen */}
      <div className='flex-1 w-full h-full relative'>
        <FeedLayout
          isIdle={isIdle}
          isAdmin={isAdmin}
          user={user}
          onWelcomeChange={setIsOnWelcome}
        />
      </div>

      {/* Footer */}
      <footer
        className={`absolute bottom-4 left-0 right-0 text-center z-50 text-white/30 text-[10px] md:text-xs font-light tracking-widest uppercase transition-all duration-1000 ${isIdle || isOnWelcome ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}
      >
        <span
          onClick={handleFooterClick}
          className='cursor-default select-none inline-flex items-center gap-1.5'
        >
          Powered by{' '}
          <strong className='text-white/60 font-medium'>Entity Builders</strong>
          {isAdmin && (
            <span className='inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
          )}
        </span>
      </footer>

      {/* Secret Admin Login Modal */}
      {showLogin && (
        <AdminLoginModal
          onLogin={async (email: string, password: string) => {
            await signIn(email, password);
            setShowLogin(false);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}

function ShareRedirect() {
  const { id } = useParams();
  return <Navigate to={`/postcard/${id}`} replace />;
}

// ── App root ───────────────────────────────────────────────────────────

function App() {
  const { user, isAdmin, loading, signOut } = useAuth();

  // Initialize PostHog analytics once on mount
  useEffect(() => {
    initAnalytics();
  }, []);

  // Identify user in PostHog when auth state changes
  useEffect(() => {
    if (user) {
      analytics.identify(user.id, {
        email: user.email,
        created_at: user.created_at,
      });
    } else {
      analytics.reset();
    }
  }, [user]);

  // Don't render routes until auth state is resolved
  // (prevents /admin from redirecting to /feed during initial session check)
  if (loading) {
    return (
      <div
        className='h-screen w-screen flex items-center justify-center'
        style={{ background: '#0a0a12' }}
      >
        <div className='w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin' />
      </div>
    );
  }

  const feedElement = (
    <FeedApp user={user} isAdmin={isAdmin} signOut={signOut} />
  );

  return (
    <ErrorBoundary>
      <GameModeProvider>
        <StampProvider userId={user?.id}>
          <OnboardingProvider>
            <Routes>
              {/* SEO-friendly feed route AND Postcard view use the same layout */}
              <Route element={feedElement}>
                {/* The new 3D Globe Explorer Mode is the default root */}
                <Route path='/' element={<GlobeExplorerPage />} />

                <Route path='/feed'>
                  <Route index element={<FeedGridPage />} />
                  <Route path='country/:country' element={<FeedGridPage />} />
                  <Route path='carousel' element={<FeedCarouselPage />} />
                  <Route path='collection' element={<CollectionPage />} />
                  <Route path='album/:albumId' element={<AlbumPage />} />
                  <Route path='profile' element={<ProfilePage />} />
                </Route>
                
                {/* Public Postcard View — needs the FeedLayout context */}
                <Route path='/postcard/:id' element={<FeedCarouselPage />} />
                
                {/* Public Album View */}
                <Route path='/album/:albumId' element={<AlbumPage />} />
              </Route>

              {/* Dedicated Game Route */}
              <Route path='/game/:shortcode' element={<GamePage />} />

              {/* ── Admin console (protected, nested routes) ── */}
              {isAdmin ? (
                <Route
                  path='/admin'
                  element={<AdminPage user={user} onPostcardGenerated={() => {}} />}
                >
                  <Route index            element={<AdminDashboard />} />
                  <Route path='generation' element={<AdminGeneration />} />
                  <Route path='queue'      element={<AdminQueuePage />} />
                  <Route path='browser'    element={<AdminBrowser />} />
                  <Route path='postcards'  element={<AdminPostcards />} />
                  <Route path='albums'     element={<AdminAlbums />} />
                  <Route path='sync'       element={<AdminSync />} />
                  <Route path='settings'   element={<AdminSettings />} />
                  <Route path='stamps'     element={<AdminStamps />} />
                  <Route path='instagram'  element={<AdminInstagram />} />
                </Route>
              ) : (
                <Route path='/admin/*' element={<Navigate to='/feed' replace />} />
              )}

              {/* Postcard admin detail — /preview/:id */}
              <Route path='/preview/:id' element={<PostcardDetailPage />} />

              {/* Share link — /:id redirects to /postcard/:id */}
              <Route path='/:id' element={<ShareRedirect />} />
            </Routes>
          </OnboardingProvider>
        </StampProvider>
      </GameModeProvider>
    </ErrorBoundary>
  );
}

export default App;
