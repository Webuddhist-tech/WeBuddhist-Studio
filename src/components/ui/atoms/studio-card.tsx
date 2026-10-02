import pechaIcon from "../../../assets/icon/pecha_icon.png";

interface ContainerLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const ContainerLayout = ({ children, title }: ContainerLayoutProps) => {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#F5F5F5] px-4 py-10 dark:bg-[#0f0f10] sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-dots animate-drift absolute inset-0 opacity-60" />
        <div className="animate-blob absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber-300 opacity-40 blur-3xl dark:opacity-25" />
        <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-rose-300 opacity-30 blur-3xl dark:opacity-20" />
        <div className="animate-blob animation-delay-4000 absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-orange-300 opacity-30 blur-3xl dark:opacity-20" />
      </div>

      <div className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 relative z-10 w-full max-w-[440px] rounded-2xl border border-black/5 bg-white/75 p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15)] backdrop-blur-xl duration-700 dark:border-white/10 dark:bg-[#1b1b1b]/70 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-300 shadow-inner transition-transform duration-500 hover:rotate-[8deg] dark:from-amber-500/30 dark:to-orange-500/20">
            <img
              src={pechaIcon}
              alt="Pecha Studio Logo"
              className="h-7 w-7 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold font-inter text-sm">
              Webuddhist Studio
            </h1>
            <p className="text-left font-inter text-xs text-muted-foreground">
              Learn, live and share Buddhist wisdom daily
            </p>
          </div>
        </div>
        <p className="text-lg font-bold">Welcome to Webuddhist Studio</p>
        {title && (
          <div className="relative z-10 mb-6 w-full text-left text-sm text-[#919191]">
            {title}
          </div>
        )}
        <div className="relative z-10 w-full">{children}</div>
      </div>
    </div>
  );
};

export default ContainerLayout;
