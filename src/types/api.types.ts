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
  trainCategory?: string;
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

export interface TripStop {
  id: number;
  stationId: number;
  stationCode?: string;
  stationName: string;
  stopOrder: number;
  scheduledArrivalTime?: string | null;
  scheduledDepartureTime?: string | null;
  estimatedArrivalTime?: string | null;
  estimatedDepartureTime?: string | null;
  actualArrivalTime?: string | null;
  actualDepartureTime?: string | null;
  distanceFromOriginKm?: number | null;
  status?: string;
  platform?: string | null;
  note?: string | null;
}

export interface TripSegmentPrice {
  id?: number;
  segmentId: number;
  carriageTypeId: number;
  carriageTypeCode?: string;
  carriageTypeName?: string;
  passengerType: string;
  price: number;
  currency?: string;
  status?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface TripSegment {
  id: number;
  segmentOrder: number;
  fromStopId: number;
  toStopId: number;
  fromStationId: number;
  fromStationCode?: string;
  fromStationName: string;
  toStationId: number;
  toStationCode?: string;
  toStationName: string;
  scheduledDepartureTime?: string | null;
  scheduledArrivalTime?: string | null;
  distanceKm?: number | null;
  status?: string;
  availableSeats?: number;
  prices?: TripSegmentPrice[];
}

export interface TripItinerary {
  tripId: number;
  trainCode?: string;
  trainCategory?: string;
  serviceDate?: string | null;
  originStationId?: number;
  originStationName?: string;
  destinationStationId?: number;
  destinationStationName?: string;
  scheduledDepartureTime?: string | null;
  scheduledArrivalTime?: string | null;
  status?: string;
  stops: TripStop[];
  segments: TripSegment[];
}

export interface TripFareQuote {
  tripId: number;
  departureStationId: number;
  departureStationName: string;
  arrivalStationId: number;
  arrivalStationName: string;
  carriageTypeId: number;
  carriageTypeCode?: string;
  carriageTypeName?: string;
  passengerType: string;
  totalPrice: number;
  currency?: string;
  availableSeats?: number;
  segmentIds: number[];
  segments: TripSegment[];
}

export interface TripStopRequest {
  stationId: number;
  stopOrder: number;
  scheduledArrivalTime?: string | null;
  scheduledDepartureTime?: string | null;
  estimatedArrivalTime?: string | null;
  estimatedDepartureTime?: string | null;
  actualArrivalTime?: string | null;
  actualDepartureTime?: string | null;
  distanceFromOriginKm?: number | null;
  status?: string;
  platform?: string | null;
  note?: string | null;
}

export interface TripStopsUpsertRequest {
  stops: TripStopRequest[];
}

export interface TripSegmentPriceRequest {
  segmentId: number;
  carriageTypeId: number;
  passengerType?: string;
  price: number;
  currency?: string;
  status?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface TripSegmentPricesUpsertRequest {
  prices: TripSegmentPriceRequest[];
}

// ============= Booking =============
export interface BookingRequest {
  tripId: number;
  departureStationId?: number;
  arrivalStationId?: number;
  ticketIds: number[];
  promoCode?: string;
  passengers: PassengerRequest[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactIdCard?: string;
}

export interface PassengerRequest {
  ticketId: number;
  name: string;
  idCard: string;
}

export interface BookingResponse {
  bookingId?: number;
  requestId?: string;
  orderNumber?: string;
  storageMonth?: string;
  status: string;
  originalPrice?: number;
  promoCode?: string | null;
  discountAmount?: number;
  totalPrice?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactIdCard?: string;
  expiredAt?: string;
  seatNumbers?: string[];
  ticketIds?: number[];
}

export interface MyBookingSummary {
  bookingId: number;
  requestId?: string;
  orderNumber?: string;
  storageMonth?: string;
  status: string;
  originalPrice?: number;
  promoCode?: string | null;
  discountAmount?: number;
  totalPrice: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactIdCard?: string;
  expiredAt?: string;
  createdAt?: string;
  tripId: number;
  trainCode: string;
  departureStationId?: number;
  departureStation: string;
  arrivalStationId?: number;
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
  departureStationId?: number;
  departureStation?: string;
  arrivalStationId?: number;
  arrivalStation?: string;
  segmentIds?: string;
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
  departureStationId?: number | null;
  arrivalStationId?: number | null;
  segmentIds?: string | number[] | null;
}

export interface UpdateBookingRequest {
  passengers: PassengerRequest[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactIdCard?: string;
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

// ============= Admin =============
export interface StationRequest {
  name: string;
  code: string;
  location: string;
}

export interface StationResponse extends StationRequest {
  id: number;
}

export interface TrainRequest {
  code: string;
  category: string;
  description?: string;
}

export interface TrainResponse extends TrainRequest {
  id: number;
}

export interface TripCreateRequest {
  trainId: number;
  departureStationId: number;
  arrivalStationId: number;
  departureTime: string;
  arrivalTime: string;
  status: string;
}

export interface AdminTripResponse {
  id: number;
  trainCode: string;
  trainCategory?: string;
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  arrivalTime?: string;
  duration?: number | string;
  price?: number | null;
  minPrice?: number | null;
  availableSeats?: number;
  totalSeats?: number;
  status?: string;
  carriages?: Carriage[] | null;
}

export interface TicketResponse {
  id: number;
  ticketId?: number;
  tripId?: number;
  trainCode?: string;
  seatNumber?: string;
  carriageNumber?: string | number;
  carriageTypeName?: string;
  price: number;
  status: string;
  bookingId?: number | null;
  passengerName?: string;
}

export interface TicketUpdateRequest {
  price: number;
  status: string;
}

export interface UserResponse extends User {
  isEmailVerified?: boolean;
}

export interface UserUpdateRequest {
  name?: string;
  phone?: string;
  roles: string[];
}

export interface PromotionRequest {
  title: string;
  description: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  startsAt: string;
  endsAt: string;
  conditions?: string;
  route?: string;
  categories: string[];
  usageLimit?: number | null;
  usedCount?: number | null;
  easeScore?: number;
  status: string;
}

export interface PromotionResponse extends PromotionRequest {
  id: number | string;
  createdAt?: string;
  active?: boolean;
  expiringSoon?: boolean;
  daysLeft?: number;
  discountLabel?: string;
}

export interface AdminPromotionQuery {
  q?: string;
  discount?: number;
  type?: string;
  category?: string;
  status?: string;
  route?: string;
  sort?: string;
}

export interface AdminStatusCount {
  status: string;
  count: number;
}

export interface AdminRouteStats {
  route: string;
  departureStation: string;
  arrivalStation: string;
  tripsCount: number;
  availableSeats: number;
  minPrice?: number | null;
}

export interface AdminStatsResponse {
  totalBookings: number;
  revenueBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  expiredBookings: number;
  revenue: number;
  averageBookingValue: number;
  totalTrips: number;
  activeTrips: number;
  totalSeats: number;
  availableSeats: number;
  occupiedSeats: number;
  totalStations: number;
  totalTrains: number;
  totalUsers: number;
  totalPromotions: number;
  activePromotions: number;
  bookingStatusCounts: AdminStatusCount[];
  topRoutes: AdminRouteStats[];
}
