export type SubscriptionStatusLike =
  | 'none'
  | 'active'
  | 'authenticated'
  | 'trialing'    // card authenticated, first charge delayed (trial)
  | 'pending'
  | 'halted'
  | 'past_due'
  | 'cancelled'
  | 'expired';
