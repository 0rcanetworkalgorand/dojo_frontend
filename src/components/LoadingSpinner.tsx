export function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dojo-bg">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-dojo-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
