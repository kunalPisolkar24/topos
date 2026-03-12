"use client"

import type { ReactNode } from "react"
import { toast as sonnerToast } from "sonner"

type SonnerToastOptions = NonNullable<Parameters<typeof sonnerToast>[1]>

type ToastVariant = "default" | "destructive"

type ToastInput = Omit<SonnerToastOptions, "description"> & {
  title?: ReactNode
  description?: ReactNode
  variant?: ToastVariant
}

function toast({
  title,
  description,
  variant = "default",
  ...options
}: ToastInput) {
  const message = title ?? description ?? "Notification"
  const resolvedOptions = title ? { description, ...options } : options

  if (variant === "destructive") {
    return sonnerToast.error(message, resolvedOptions)
  }

  return sonnerToast(message, resolvedOptions)
}

function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
  }
}

export { useToast, toast }
