export default function LoadingSpinner({ size = "md", text }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-accent border-t-transparent`}
      />
      {text && <p className="text-sm text-muted">{text}</p>}
    </div>
  );
}
