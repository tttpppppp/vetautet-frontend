import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Train } from 'lucide-react'
import { HelmetProvider, Helmet } from 'react-helmet-async'
import ScrollToTop from './components/ScrollToTop'
import './App.css'

// Lazy load pages
const Home = lazy(() => import('./pages/Home.tsx'))
const TicketDetails = lazy(() => import('./pages/TicketDetails.tsx'))
const Login = lazy(() => import('./pages/Login.tsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.tsx'))
const Register = lazy(() => import('./pages/Register'))
const Explore = lazy(() => import('./pages/Explore'))
const Orders = lazy(() => import('./pages/Orders'))
const Profile = lazy(() => import('./pages/Profile'))
const SearchResults = lazy(() => import('./pages/SearchResults.tsx'))
const Schedules = lazy(() => import('./pages/Schedules.tsx'))
const Promotions = lazy(() => import('./pages/Promotions.tsx'))
const PaymentReturn = lazy(() => import('./pages/PaymentReturn.tsx'))
const TicketQrVerify = lazy(() => import('./pages/TicketQrVerify.tsx'))

const PageLoader: React.FC = () => (
  <div className="fixed inset-0 bg-white/70 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center overflow-hidden">
    <div className="relative flex flex-col items-center">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-tet-red rounded-full animate-spin border-t-transparent" />
        <div className="absolute inset-4 bg-gradient-to-br from-tet-red to-[#D32F2F] rounded-full flex items-center justify-center">
          <Train size={24} className="text-white animate-pulse" />
        </div>
      </div>
      <div className="mt-8 text-center">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.4em]">VÉ TÀU VIỆT NAM</h3>
      </div>
    </div>
  </div>
)

function App() {
  return (
    <HelmetProvider>
      <Router>
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
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/register" element={<Register />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/promotions" element={<Promotions />} />
              <Route path="/payment/momo-return" element={<PaymentReturn provider="momo" />} />
              <Route path="/payment/vnpay-return" element={<PaymentReturn provider="vnpay" />} />
              <Route path="/staff/verify-qr" element={<TicketQrVerify />} />
              <Route path="/admin/verify-qr" element={<TicketQrVerify />} />
            </Routes>
          </div>
        </Suspense>
      </Router>
    </HelmetProvider>
  )
}

export default App
