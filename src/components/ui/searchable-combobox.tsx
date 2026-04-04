import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type SearchableComboboxItem = {
  value: string;
  label: string;
};

type SearchableComboboxProps = {
  value: string;
  items: SearchableComboboxItem[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  clearLabel?: string;
  createActionLabel?: string;
  disabled?: boolean;
  className?: string;
  onValueChange: (value: string) => void;
  onCreateActionClick?: () => void;
};

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  value,
  items,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  clearLabel,
  createActionLabel,
  disabled,
  className,
  onValueChange,
  onCreateActionClick,
}) => {
  const [open, setOpen] = React.useState(false);
  const selectedItem = React.useMemo(() => items.find((item) => item.value === value), [items, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selectedItem && "text-muted-foreground", className)}
          disabled={disabled}
        >
          {selectedItem?.label || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command
          // Comentário: filtro case-insensitive por qualquer parte do texto para manter busca mais rápida com muitos itens.
          filter={(candidate, search) => {
            const normalizedCandidate = candidate.toLocaleLowerCase("pt-BR");
            const normalizedSearch = search.toLocaleLowerCase("pt-BR").trim();
            if (!normalizedSearch) return 1;
            return normalizedCandidate.includes(normalizedSearch) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>
              <div className="space-y-2 px-2">
                <p>{emptyMessage}</p>
                {createActionLabel && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => {
                      onCreateActionClick?.();
                      setOpen(false);
                    }}
                  >
                    {createActionLabel}
                  </button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {clearLabel && (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  {clearLabel}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
