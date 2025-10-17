"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Setting = {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
};

type SettingsByCategory = {
  [category: string]: Setting[];
};

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState<{ [key: string]: any }>(
    settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as { [key: string]: any })
  );

  // Group settings by category
  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as SettingsByCategory);

  const handleToggle = (key: string, currentValue: boolean) => {
    setValues((prev) => ({
      ...prev,
      [key]: !currentValue,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings: values }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast.success("Settings saved successfully");
      router.refresh();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryTitle = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{getCategoryTitle(category)} Settings</CardTitle>
            <CardDescription>
              Configure {category} behavior for the entire system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categorySettings.map((setting) => (
              <div key={setting.key} className="flex items-start justify-between space-x-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={setting.key} className="text-base">
                    {setting.key.split(".").pop()?.replace(/([A-Z])/g, " $1").trim()}
                  </Label>
                  {setting.description && (
                    <p className="text-sm text-muted-foreground">
                      {setting.description}
                    </p>
                  )}
                </div>
                <Switch
                  id={setting.key}
                  checked={values[setting.key] === true || values[setting.key] === "true"}
                  onCheckedChange={() =>
                    handleToggle(
                      setting.key,
                      values[setting.key] === true || values[setting.key] === "true"
                    )
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
