export function getPredictionAllowance(clerkUserId) {
  const ownerId = process.env.DRAWLYTICS_OWNER_CLERK_USER_ID?.trim();

  if (ownerId && clerkUserId === ownerId) {
    return { tier: 'full', limit: null, limits_disabled: true };
  }

  return { tier: 'free', limit: 50, limits_disabled: false };
}
