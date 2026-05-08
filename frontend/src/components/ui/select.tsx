"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const EMPTY_OPTION_VALUE = "__native_select_empty_option__";

type NativeSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "defaultValue" | "onChange" | "value"
> & {
  children: React.ReactNode;
  defaultValue?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  value?: string | number;
};

function optionText(label: React.ReactNode) {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  return "";
}

function getOptions(children: React.ReactNode) {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) {
      return [];
    }
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    const label = props.children;
    return [
      {
        value: props.value === undefined ? optionText(label) : String(props.value),
        label,
        disabled: props.disabled,
      },
    ];
  });
}

function makeChangeEvent(value: string) {
  return {
    target: { value },
    currentTarget: { value },
  } as React.ChangeEvent<HTMLSelectElement>;
}

function toRadixValue(value: string) {
  return value === "" ? EMPTY_OPTION_VALUE : value;
}

function fromRadixValue(value: string) {
  return value === EMPTY_OPTION_VALUE ? "" : value;
}

export function NativeSelect({
  className,
  children,
  defaultValue,
  disabled,
  id,
  name,
  onChange,
  value,
  ...props
}: NativeSelectProps) {
  const options = getOptions(children);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(String(defaultValue ?? ""));
  const selectedValue = isControlled ? String(value ?? "") : internalValue;
  const radixValue = toRadixValue(selectedValue);
  const selectedOption = options.find((option) => option.value === selectedValue);
  const placeholder = options.find((option) => option.value === "")?.label || "Select";

  function handleValueChange(nextRadixValue: string) {
    const nextValue = fromRadixValue(nextRadixValue);
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(makeChangeEvent(nextValue));
  }

  return (
    <SelectPrimitive.Root
      value={radixValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <SelectPrimitive.Trigger
        id={id}
        aria-label={props["aria-label"]}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-left text-sm text-slate-950 shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 data-[placeholder]:text-slate-500",
          className,
        )}
      >
        <SelectPrimitive.Value>
          <span className={cn(!selectedValue && "text-slate-500")}>
            {selectedOption?.label || placeholder}
          </span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-white shadow-lg"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={`${option.value}-${optionText(option.label)}`}
                value={toRadixValue(option.value)}
                disabled={option.disabled}
                className="relative flex min-h-9 cursor-default select-none items-center rounded px-8 py-2 text-sm text-slate-700 outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-900"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="h-4 w-4 text-emerald-700" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
