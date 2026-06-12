"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2 } from "lucide-react";
import type { Quote, Customer } from "@/lib/database.types";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  quote?: Quote | null;
  onSaved: () => void;
}

function emptyLineItem(): LineItem {
  return { description: "", quantity: 1, unit_price: 0 };
}

export function QuoteDialog({
  open,
  onOpenChange,
  orgId,
  quote,
  onSaved,
}: QuoteDialogProps) {
  const isEdit = !!quote;
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>(
    quote?.customer_id ?? ""
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    quote?.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0
      ? (quote.line_items as LineItem[])
      : [emptyLineItem()]
  );

  const total = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const loadCustomers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, name, email, phone, org_id, notes, source, created_at")
      .eq("org_id", orgId)
      .order("name");
    if (data) setCustomers(data as Customer[]);
  }, [orgId]);

  useEffect(() => {
    if (open) {
      loadCustomers();
      setCustomerId(quote?.customer_id ?? "");
      setLineItems(
        quote?.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0
          ? (quote.line_items as LineItem[])
          : [emptyLineItem()]
      );
    }
  }, [open, quote, loadCustomers]);

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(sendNow: boolean) {
    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (lineItems.length === 0 || lineItems.every((i) => !i.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    try {
      if (isEdit && quote) {
        const updatePayload: Record<string, unknown> = {
          customer_id: customerId,
          line_items: lineItems,
          total,
          status: sendNow ? "sent" : quote.status,
        };
        const { error } = await supabase
          .from("quotes")
          .update(updatePayload)
          .eq("id", quote.id);
        if (error) throw error;
        toast.success(sendNow ? "Quote sent" : "Quote updated");
      } else {
        const payload = {
          org_id: orgId,
          customer_id: customerId,
          line_items: lineItems,
          total,
          status: sendNow ? "sent" : "draft",
        };
        const { error } = await supabase.from("quotes").insert(payload);
        if (error) throw error;
        toast.success(sendNow ? "Quote sent" : "Quote saved as draft");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Quote" : "New Quote"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Customer selector */}
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex h-8 w-full items-center justify-between rounded-lg border border-border bg-background px-2.5 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={selectedCustomer ? "" : "text-muted-foreground"}>
                      {selectedCustomer ? selectedCustomer.name : "Select customer..."}
                    </span>
                    <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </button>
                }
              />
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search customers..." />
                  <CommandList>
                    <CommandEmpty>No customers found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setCustomerId(c.id);
                            setCustomerPopoverOpen(false);
                          }}
                        >
                          <span>{c.name}</span>
                          {c.email && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.email}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            <div className="space-y-2">
              {/* Header row */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_90px_32px] gap-2 text-xs text-muted-foreground px-1">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_80px_100px_90px_32px] items-center"
                >
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(index, "description", e.target.value)
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)
                    }
                    className="w-20 sm:w-auto"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)
                    }
                    className="w-24 sm:w-auto"
                  />
                  <div className="hidden sm:flex items-center justify-end text-sm font-medium">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Line Item
            </Button>
          </div>

          {/* Total */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <span className="text-sm text-muted-foreground">Quote Total</span>
            <span className="text-xl font-semibold">${total.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {saving ? "Sending..." : "Send Quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
