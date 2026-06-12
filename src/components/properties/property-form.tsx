"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Property } from "@/lib/database.types";
import type { VerticalConfig, VerticalPropertyField } from "@/lib/verticals";

interface PropertyFormProps {
  orgId: string;
  customerId: string;
  verticalConfig: VerticalConfig | null;
  property?: Property | null;
  onSaved: (property: Property) => void;
  onCancel: () => void;
}

type VerticalData = Record<string, string | number | boolean>;

function buildInitialVerticalData(
  fields: VerticalPropertyField[],
  existing?: Record<string, unknown>
): VerticalData {
  const data: VerticalData = {};
  for (const field of fields) {
    const val = existing?.[field.key];
    if (field.type === "boolean") {
      data[field.key] = typeof val === "boolean" ? val : false;
    } else if (field.type === "number") {
      data[field.key] = typeof val === "number" ? val : "";
    } else {
      data[field.key] = typeof val === "string" ? val : "";
    }
  }
  return data;
}

export function PropertyForm({
  orgId,
  customerId,
  verticalConfig,
  property,
  onSaved,
  onCancel,
}: PropertyFormProps) {
  const isEdit = !!property;
  const fields = verticalConfig?.propertyFields ?? [];

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    address: property?.address ?? "",
    lat: property?.lat?.toString() ?? "",
    lng: property?.lng?.toString() ?? "",
    gate_code: property?.gate_code ?? "",
    access_notes: property?.access_notes ?? "",
  });
  const [verticalData, setVerticalData] = useState<VerticalData>(
    buildInitialVerticalData(fields, property?.vertical_data as Record<string, unknown> | undefined)
  );

  function setVerticalField(key: string, value: string | number | boolean) {
    setVerticalData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.address.trim()) {
      toast.error("Address is required");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    // Clean vertical data — remove empty strings
    const cleanedVerticalData: Record<string, unknown> = {};
    for (const field of fields) {
      const val = verticalData[field.key];
      if (val !== "" && val !== undefined) {
        cleanedVerticalData[field.key] = field.type === "number" ? Number(val) : val;
      }
    }

    const payload = {
      address: form.address.trim(),
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      gate_code: form.gate_code.trim() || null,
      access_notes: form.access_notes.trim() || null,
      vertical_data: cleanedVerticalData,
    };

    try {
      if (isEdit && property) {
        const { data, error } = await supabase
          .from("properties")
          .update(payload)
          .eq("id", property.id)
          .select()
          .single();
        if (error) throw error;
        toast.success(`${verticalConfig?.entitySingular ?? "Property"} updated`);
        onSaved(data as Property);
      } else {
        const { data, error } = await supabase
          .from("properties")
          .insert({ ...payload, org_id: orgId, customer_id: customerId })
          .select()
          .single();
        if (error) throw error;
        toast.success(`${verticalConfig?.entitySingular ?? "Property"} created`);
        onSaved(data as Property);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Standard fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Location
        </h3>
        <div className="space-y-2">
          <Label htmlFor="address">Address *</Label>
          <Input
            id="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Main St, City, State 00000"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              placeholder="e.g. 25.7617"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              placeholder="e.g. -80.1918"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gate_code">Gate Code</Label>
          <Input
            id="gate_code"
            value={form.gate_code}
            onChange={(e) => setForm({ ...form, gate_code: e.target.value })}
            placeholder="e.g. #1234"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="access_notes">Access Notes</Label>
          <Textarea
            id="access_notes"
            value={form.access_notes}
            onChange={(e) => setForm({ ...form, access_notes: e.target.value })}
            placeholder="e.g. Dog in backyard, ring bell twice"
            rows={2}
          />
        </div>
      </div>

      {/* Vertical-specific fields */}
      {fields.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {verticalConfig?.entitySingular ?? "Property"} Details
            </h3>
            {fields.map((field) => (
              <VerticalFieldInput
                key={field.key}
                field={field}
                value={verticalData[field.key]}
                onChange={(val) => setVerticalField(field.key, val)}
              />
            ))}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving
            ? "Saving..."
            : isEdit
            ? `Update ${verticalConfig?.entitySingular ?? "Property"}`
            : `Create ${verticalConfig?.entitySingular ?? "Property"}`}
        </Button>
      </div>
    </form>
  );
}

// ─── Vertical Field Input ─────────────────────────────────────────────────────

function VerticalFieldInput({
  field,
  value,
  onChange,
}: {
  field: VerticalPropertyField;
  value: string | number | boolean | undefined;
  onChange: (val: string | number | boolean) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Checkbox
          id={field.key}
          checked={!!value}
          onCheckedChange={(checked) => onChange(!!checked)}
        />
        <Label htmlFor={field.key} className="cursor-pointer">
          {field.label}
        </Label>
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.key}>{field.label}</Label>
        <Select
          value={(value as string) || null}
          onValueChange={(val) => onChange((val as string) ?? "")}
        >
          <SelectTrigger id={field.key} className="w-full">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.key}>
          {field.label}
          {field.unit && (
            <span className="text-muted-foreground ml-1 font-normal">({field.unit})</span>
          )}
        </Label>
        <Input
          id={field.key}
          type="number"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  // text
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type="text"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  );
}
