// ============= Auth =============
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  nationality?: string;
  rewardPoints?: number;
  membershipRank?: string;
  isIdentityVerified?: boolean;
  tripsCount?: number;
  imageUrl?: string;
  createdAt?: string;
  roles?: string[];
}

export interface LoginResponse {
  accessToken: string | null;
  refreshToken: string | null;
  email: string;
  isEmailVerified?: boolean;
  requiresEmailVerification?: boolean;
  emailAlreadyRegistered?: boolean;
  code?: string;
  message?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  address?: string;
  nationality?: string;
  imageUrl?: string;
}

export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

export interface ResendVerificationOtpRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ForgotPasswordResponse {
  email: string;
  code?: string;
  message: string;
  otpExpiresAt: string | null;
}

export interface VerifyEmailResponse {
  email: string;
  isEmailVerified: boolean;
  code?: string;
  message: string;
  otpExpiresAt: string | null;
}

// ============= Trip =============
export type SeatStatus = 'AVAILABLE' | 'HOLD' | 'HELD' | 'PENDING' | 'BOOKED' | 'SOLD';

export interface Seat {
  id: number;
  trainCode: string;
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  seatNumber: string;
  price: number;
  status: SeatStatus;
  heldByCurrentBooking?: boolean;
  holdingBookingId?: number | null;
}

export interface Carriage {
  carriageNumber: number;
  carriageTypeName: string;
  seats: Seat[];
}

export interface Trip {
  id: number;
  trainCode: string;
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: number | string;
  price?: number | null;
  minPrice?: number | null;
  promoCode?: string | null;
  promotionDiscountLabel?: string | null;
  promotionApplied?: boolean;
  originalPrice?: number | null;
  discountAmount?: number | null;
  finalPrice?: number | null;
  promotionMessage?: string | null;
  availableSeats?: number;
  totalSeats?: number;
  status?: string;
  carriages: Carriage[] | null;
  seats?: Seat[];
}

export interface TripCategory {
  code: string;
  label: string;
  description?: string;
}

export interface PopularRoute {
  departureStationId: number;
  departureStation: string;
  departureStationCode?: string;
  arrivalStationId: number;
  arrivalStation: string;
  arrivalStationCode?: string;
  tripsCount: number;
  availableSeats: number;
  minPrice?: number | null;
  nextDepartureTime?: string;
  trainCategories?: string[];
}

export interface PopularDestination {
  stationId: number;
  stationName: string;
  stationCode?: string;
  location?: string;
  tripsCount: number;
  availableSeats: number;
  minPrice?: number | null;
  nextDepartureTime?: string;
  imageUrl?: string | null;
}

export interface TripSearchParams {
  departure: string;
  arrival: string;
  date?: string;
  trainCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  promoCode?: string;
}

// ============= Booking =============
export interface BookingRequest {
  tripId: number;
  ticketIds: number[];
  promoCode?: string;
  passengers: PassengerRequest[];
  passengerName?: string;
}

export interface PassengerRequest {
  ticketId: number;
  name: string;
  idCard: string;
}

export interface BookingResponse {
  bookingId: number;
  status: string;
  originalPrice?: number;
  promoCode?: string | null;
  discountAmount?: number;
  totalPrice: number;
  expiredAt: string;
  seatNumbers?: string[];
  ticketIds?: number[];
}

export interface MyBookingSummary {
  bookingId: number;
  status: string;
  originalPrice?: number;
  promoCode?: string | null;
  discountAmount?: number;
  totalPrice: number;
  expiredAt?: string;
  createdAt?: string;
  tripId: number;
  trainCode: string;
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: number | string;
  seatNumbers: string[];
  ticketIds?: number[];
  passengerCount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentTransactionId?: string;
  paidAt?: string;
}

export interface BookingDetailItem {
  bookingDetailId: number;
  ticketId: number;
  ticketStatus: string;
  seatNumber: string;
  carriageNumber?: string;
  carriageTypeName?: string;
  price: number;
  passengerName?: string;
  passengerIdCard?: string;
  passengerType?: string;
}

export interface BookingDetailResponse extends MyBookingSummary {
  details: BookingDetailItem[];
}

export interface SeatStatusEvent {
  tripId?: number;
  ticketId: number;
  seatNumber?: string;
  status: SeatStatus | string;
  bookingId?: number | null;
}

export interface UpdateBookingRequest {
  passengers: PassengerRequest[];
}

export interface PaymentRedirectResponse {
  bookingId?: number;
  momoOrderId?: string;
  requestId?: string;
  amount?: number;
  resultCode?: number;
  responseCode?: string;
  message?: string;
  payUrl?: string;
  paymentUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
  [key: string]: unknown;
}

// ============= Ticket QR =============
export interface TicketQrVerifyRequest {
  qrToken: string;
}

export interface TicketQrVerifyResponse {
  status?: string;
  code?: string;
  message?: string;
  valid?: boolean;
  ticketId?: number;
  bookingId?: number;
  trainCode?: string;
  departureStation?: string;
  arrivalStation?: string;
  departureTime?: string;
  arrivalTime?: string;
  seatNumber?: string;
  carriageNumber?: string;
  carriageTypeName?: string;
  passengerName?: string;
  passengerIdCard?: string;
  ticketStatus?: string;
  verifiedAt?: string;
  [key: string]: unknown;
}

export interface UserNotification {
  notificationId?: number;
  id?: number;
  userId: number;
  bookingId?: number;
  title: string;
  content: string;
  type: string;
  referenceId?: number;
  read?: boolean;
  isRead?: boolean;
  createdAt?: string;
}

// ============= Upload =============
export interface UploadResponse {
  imageUrl: string;
}
