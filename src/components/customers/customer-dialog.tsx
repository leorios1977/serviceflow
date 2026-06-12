"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Customer } from "@/lib/database.types";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  customer?: Customer | null;
  onSaved: (customer: Customer) => void;
}

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "web", label: "Website" },
  { value: "missed_call", label: "Missed Call" },
  { value: "manual", label: "Manual Entry" },
  { value: "other", label: "Other" },
];

export function CustomerDialog({
  open,
  onOpenChange,
  orgId,
  customer,
  onSaved,
}: CustomerDialogProps) {
  const isEdit = !!customer;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    notes: string;
    source: string;
  }>({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    notes: customer?.notes ?? "",
    source: customer?.source ?? "",
  });

  // Reset form when dialog opens with new customer data
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setForm({
        name: customer?.name ?? "",
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        notes: customer?.notes ?? "",
        source: customer?.source ?? "",
      });
    }
    onOpenChange(val);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    try {
      if (isEdit && customer) {
        const { data, error } = await supabase
          .from("customers")
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            notes: form.notes.trim() || null,
            source: form.source || null,
          })
          .eq("id", customer.id)
          .select()
          .single();

        if (error) throw error;
        toast.success("Customer updated");
        onSaved(data as Customer);
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            org_id: orgId,
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            notes: form.notes.trim() || null,
            source: form.source || null,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("Customer created");
        onSaved(data as Customer);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(555) 000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={form.source || null}
              onValueChange={(val) => setForm({ ...form, source: (val as string) ?? "" })}
            >
              <SelectTrigger id="source">
                <SelectValue placeholder="How did they find you?" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
