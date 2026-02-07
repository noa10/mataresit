import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { PaidBy } from "@/types/receipt";
import { fetchUserPayers } from "@/services/paidByService";
import { PayerFormModal } from "@/components/payers/PayerFormModal";
import { useTeam } from "@/contexts/TeamContext";

interface PaidBySelectorProps {
  value?: string | null;
  onSelect: (payerId: string | null, payerName?: string) => void;
  disabled?: boolean;
  allowCreate?: boolean;
  className?: string;
}

export function PaidBySelector({
  value,
  onSelect,
  disabled = false,
  allowCreate = true,
  className,
}: PaidBySelectorProps) {
  const [open, setOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalInitialName, setModalInitialName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const { currentTeam } = useTeam();
  const queryClient = useQueryClient();

  const {
    data: payers = [],
    isLoading,
  } = useQuery({
    queryKey: ["payers", currentTeam?.id],
    queryFn: () => fetchUserPayers({ currentTeam }),
  });

  const selectedPayer = payers.find((p) => p.id === value);

  const handleSelect = (payerId: string | null) => {
    if (payerId === null) {
      onSelect(null);
    } else {
      const payer = payers.find((p) => p.id === payerId);
      if (payer) {
        onSelect(payer.id, payer.name);
      }
    }
    setOpen(false);
  };

  const handleOpenCreateModal = (prefillName?: string) => {
    setOpen(false);
    setModalInitialName(prefillName?.trim() || "");
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["payers", currentTeam?.id] });
    setIsCreateModalOpen(false);
    setSearchValue("");
  };

  const handleCreated = (payerId: string, payerName: string) => {
    onSelect(payerId, payerName);
  };

  const showInlineCreate =
    allowCreate &&
    searchValue.trim() !== "" &&
    !payers.some(
      (p) => p.name.toLowerCase() === searchValue.trim().toLowerCase()
    );

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            {selectedPayer ? (
              <span className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedPayer.name}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Select payer...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search payers..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {showInlineCreate ? (
                  <button
                    onClick={() => handleOpenCreateModal(searchValue)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm cursor-pointer text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create "{searchValue.trim()}"</span>
                  </button>
                ) : (
                  "No payers found."
                )}
              </CommandEmpty>

              {value && (
                <>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleSelect(null)}
                      className="text-muted-foreground"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove payer
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              <CommandGroup heading="Payers">
                {payers.map((payer) => (
                  <CommandItem
                    key={payer.id}
                    value={payer.name}
                    onSelect={() => handleSelect(payer.id)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{payer.name}</span>
                      {payer.receipt_count !== undefined && payer.receipt_count > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {payer.receipt_count}
                        </Badge>
                      )}
                    </div>
                    {value === payer.id && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              {showInlineCreate && payers.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleOpenCreateModal(searchValue)}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create "{searchValue.trim()}"
                    </CommandItem>
                  </CommandGroup>
                </>
              )}

              {allowCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleOpenCreateModal()}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add new payer
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <PayerFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        onCreated={handleCreated}
        initialName={modalInitialName}
      />
    </>
  );
}
