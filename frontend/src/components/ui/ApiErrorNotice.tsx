

interface ApiErrorNoticeProps {
  status?: number;
  message?: string;
  onRetry?: () => void;
}

export function ApiErrorNotice({ status, message, onRetry }: ApiErrorNoticeProps) {
  let text = message ?? 'Something went wrong. Please try again.';
  if (status === 403) text = 'You do not have permission to perform this action.';
  if (status === 404) text = 'The requested resource was not found.';
  if (status === 409) text = message ?? 'Conflict. Please try again.';

  return (
    <div
      className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger"
      role="alert"
    >
      <p>{text}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
