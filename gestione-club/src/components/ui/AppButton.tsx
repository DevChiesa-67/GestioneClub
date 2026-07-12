import { ButtonHTMLAttributes } from "react";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function AppButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: AppButtonProps) {
  const variants = {
    primary: "bg-[#d71920] text-white hover:bg-[#b9151b]",
    secondary: "bg-white/10 text-white hover:bg-white/15",
  };

  return (
    <button
      className={`rounded-xl px-4 py-2 font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}