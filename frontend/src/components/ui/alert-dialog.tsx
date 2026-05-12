"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export const AlertDialogAction = AlertDialogPrimitive.Action;

export function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-40 bg-slate-950/40" />
      <AlertDialogPrimitive.Content
        className="dialog-content fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none"
        {...props}
      >
        <div
          className={cn(
            "dialog-panel relative rounded-lg border bg-white p-5 shadow-xl",
            className,
          )}
        >
          {children}
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-base font-semibold text-slate-950", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm leading-6 text-slate-500", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex justify-end gap-2", className)} {...props} />;
}

export function AlertDialogCancelButton({
  children = "Cancel",
}: {
  children?: React.ReactNode;
}) {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button variant="outline">{children}</Button>
    </AlertDialogPrimitive.Cancel>
  );
}

export function AlertDialogActionButton({
  children,
  variant = "danger",
  ...props
}: {
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
} & React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button variant={variant} {...props}>
        {children}
      </Button>
    </AlertDialogPrimitive.Action>
  );
}
