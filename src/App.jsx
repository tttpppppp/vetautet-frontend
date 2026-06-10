import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Train } from 'lucide-react'
import { HelmetProvider, Helmet } from 'react-helmet-async'
import ScrollToTop from './components/ScrollToTop'
import './App.css'

// Lazy load pages
const Home = lazy(() => import('./pages/Home'))
const TicketDetails = lazy(() => import('./pages/TicketDetails'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Explore = lazy(() => import('./pages/Explore'))
const Orders = lazy(() => import('./pages/Orders'))
const Profile = lazy(() => import('./pages/Profile'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const Schedules = lazy(() => import('./pages/Schedules'))

// Premium Loading Component with Tet Theme
const PageLoader = () => (
  <div className="fixed inset-0 bg-white/70 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center overflow-hidden">
    {/* Animated background elements */}
    <div className="absolute top-1/4 -left-20 w-64 h-64 bg-tet-red/5 rounded-full blur-3xl animate-pulse" />
    <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-tet-yellow/10 rounded-full blur-3xl animate-pulse delay-700" />

    <div className="relative flex flex-col items-center">
      {/* Outer Ring */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-tet-red rounded-full animate-spin border-t-transparent shadow-lg shadow-tet-red/20" />

        {/* Inner pulsing circle with Train Icon */}
        <div className="absolute inset-4 bg-gradient-to-br from-tet-red to-[#D32F2F] rounded-full flex items-center justify-center shadow-inner group">
          <div className="w-10 h-10 border-2 border-white/20 rounded-full animate-ping absolute" />
          <Train size={24} className="text-white fill-white/10 animate-pulse relative z-10" />
        </div>
      </div>

      <div className="mt-8 text-center space-y-3 relative">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.4em] translate-x-[0.2em] relative inline-block">
          VÉ TÀU VIỆT NAM
          <div className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-tet-red to-transparent scale-x-0 animate-expand-lines" />
        </h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] animate-pulse">
          Khởi hành hành trình mới...
        </p>
      </div>

      {/* Progress Bar Style decoration */}
      <div className="mt-6 w-48 h-1 bg-gray-100 rounded-full overflow-hidden relative">
        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-tet-red to-tet-yellow w-1/3 rounded-full animate-loading-bar" />
      </div>
    </div>

    {/* Custom Animation Keyframes (Inline Style for demo, ideally in App.css) */}
    <style dangerouslySetInnerHTML={{
      __html: `
      @keyframes expand-lines {
        0%, 100% { transform: scaleX(0); opacity: 0; }
        50% { transform: scaleX(1); opacity: 1; }
      }
      @keyframes loading-bar {
        0% { left: -40%; }
        100% { left: 100%; }
      }
      .animate-expand-lines {
        animation: expand-lines 2s ease-in-out infinite;
      }
      .animate-loading-bar {
        animation: loading-bar 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
    `}} />
  </div>
)

function App() {
  return (
    <HelmetProvider>
      <Router shadow-red-500>
        <Helmet>
          <title>Vé Tàu Việt Nam - Đặt vé trực tuyến nhanh chóng</title>
          <meta name="description" content="Hệ thống đặt vé tàu hỏa trực tuyến hàng đầu Việt Nam. An toàn, tiện lợi, giá tốt." />
        </Helmet>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <div className="bg-[#fcfcfc] min-h-screen">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/ticket/:id" element={<TicketDetails />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<Schedules />} />
              <Route path="/schedules" element={<SearchResults />} />
            </Routes>
          </div>
        </Suspense>
      </Router>
    </HelmetProvider>
  )
}

export default App
