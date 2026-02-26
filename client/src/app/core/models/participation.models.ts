/**
 * Participation Models
 * Matches backend DTOs exactly for type safety
 */

// ============================================
// Participation Status Enum
// ============================================

/**
 * Status of a participation.
 * Matches backend ParticipationStatus enum.
 */
export type ParticipationStatus = 'Registered' | 'Attended' | 'Completed' | 'Cancelled';

/**
 * Allocation type for bulk point allocation.
 * - Individual: Each user receives the full points amount
 * - Total: Points are divided evenly among users
 */
export type AllocationType = 'Individual' | 'Total';

/**
 * Maps participation status to user-friendly display text
 */
export const ParticipationStatusLabels: Record<ParticipationStatus, string> = {
  'Registered': 'Registered',
  'Attended': 'Attended',
  'Completed': 'Completed',
  'Cancelled': 'Cancelled'
};

/**
 * Maps participation status to CSS class for styling
 */
export const ParticipationStatusClasses: Record<ParticipationStatus, string> = {
  'Registered': 'status-registered',
  'Attended': 'status-attended',
  'Completed': 'status-completed',
  'Cancelled': 'status-cancelled'
};

// ============================================
// Participation Response Models
// ============================================

/**
 * Event participation response from API.
 * Matches backend EventParticipationResponse DTO.
 */
export interface EventParticipationResponse {
  id: string;
  eventId: string;
  eventName: string;
  userId: string;
  userName: string;
  participatedAt: string;
  status: ParticipationStatus;
}

/**
 * Participation status check response.
 * Matches backend ParticipationStatusResponse DTO.
 */
export interface ParticipationStatusResponse {
  isParticipating: boolean;
  participationId: string | null;
  participatedAt: string | null;
  status: ParticipationStatus | null;
}

/**
 * Participant count response.
 * Matches backend ParticipantCountResponse DTO.
 */
export interface ParticipantCountResponse {
  eventId: string;
  count: number;
}

// ============================================
// Paginated Participation Response
// ============================================

/**
 * Paginated participations response.
 * Uses existing PagedResponse structure.
 */
export interface PagedParticipationsResponse {
  items: EventParticipationResponse[];
  totalCount: number;
  skip: number;
  take: number;
}

// ============================================
// Request Models
// ============================================

/**
 * Request to participate in an event.
 */
export interface ParticipateInEventRequest {
  eventId: string;
}

// ============================================
// Participant User Models (for Admin allocation)
// ============================================

/**
 * Participant user info for allocation dropdown.
 * Matches backend ParticipantUserResponse DTO.
 */
export interface ParticipantUserResponse {
  userId: string;
  fullName: string;
  email: string;
  hasReceivedPoints: boolean;
}

/**
 * Extended participant user with selection state for bulk allocation
 */
export interface SelectableParticipant extends ParticipantUserResponse {
  selected: boolean;
}

// ============================================
// Bulk Points Award Models
// ============================================

/**
 * Request to earn points with team name support.
 * Matches backend EarnPointsWithTeamRequest.
 */
export interface EarnPointsWithTeamRequest {
  userIds: string[];
  eventId: string;
  points: number;
  teamName?: string | null;
  validateParticipation?: boolean;
}

/**
 * Request to earn points for all participants.
 * Matches backend EarnPointsForParticipantsRequest.
 */
export interface EarnPointsForParticipantsRequest {
  eventId: string;
  points: number;
  teamName?: string | null;
}

/**
 * Response for bulk points award with team.
 * Matches backend BulkEarnWithTeamResponse.
 */
export interface BulkEarnWithTeamResponse {
  pointsAwardId: string;
  successCount: number;
  failureCount: number;
  totalPointsAwarded: number;
  teamName: string | null;
  errors: string[];
}

// ============================================
// New Allocation Request Models
// ============================================

/**
 * Request to allocate points to a single participant.
 * Matches backend AllocatePointsRequest.
 */
export interface AllocatePointsRequest {
  eventId: string;
  userId: string;
  points: number;
}

/**
 * Request for bulk allocation with allocation type.
 * Matches backend BulkAllocatePointsRequest.
 */
export interface BulkAllocatePointsRequest {
  eventId: string;
  userIds: string[];
  points: number;
  allocationType: AllocationType;
  teamName?: string | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get display label for participation status
 */
export function getParticipationStatusLabel(status: ParticipationStatus): string {
  return ParticipationStatusLabels[status] || status;
}

/**
 * Get CSS class for participation status
 */
export function getParticipationStatusClass(status: ParticipationStatus): string {
  return ParticipationStatusClasses[status] || 'status-default';
}

/**
 * Format participation date for display
 */
export function formatParticipationDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Check if user can cancel participation (only if status is 'Registered')
 */
export function canCancelParticipation(status: ParticipationStatus): boolean {
  return status === 'Registered';
}
