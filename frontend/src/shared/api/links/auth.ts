type ErrorLike = {
  message?: string;
  statusCode?: number;
  status?: number;
};

export function buildAuthHeaders(token?: string | null) {
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function hasUnauthorizedGraphQLError(
  errors?: readonly ErrorLike[] | null,
) {
  return (
    errors?.some((error) => /unauthorized/i.test(error.message ?? "")) ?? false
  );
}

export function hasUnauthorizedNetworkError(error?: ErrorLike | null) {
  const statusCode = (error?.statusCode as number | undefined) ?? (error?.status as number | undefined);
  return statusCode === 401 || statusCode === 403;
}
