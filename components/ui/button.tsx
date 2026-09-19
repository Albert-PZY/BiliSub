import type { ButtonHTMLAttributes, ReactNode } from "react"

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "danger" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

export function Button({
  className = "",
  variant = "default",
  size = "default",
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "button",
    variant !== "default" && `button--${variant}`,
    size !== "default" && `button--${size}`,
    className,
  ].filter(Boolean).join(" ")

  return <button className={classes} {...props}>{children}</button>
}
