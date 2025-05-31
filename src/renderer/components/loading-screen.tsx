const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="text-6xl font-bold text-[#FFA500]">CP</div>
        <div className="text-xl font-medium text-foreground">configPilot</div>
        <div className="mt-4 h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full animate-loading-bar bg-[#FFA500] transition-all"></div>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen