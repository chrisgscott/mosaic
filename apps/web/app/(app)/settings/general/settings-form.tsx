"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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

  // Detect the type of a setting value
  const getSettingType = (value: any): 'boolean' | 'number' | 'string' => {
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      return 'boolean';
    }
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return 'number';
    }
    return 'string';
  };

  const handleToggle = (key: string, currentValue: boolean) => {
    setValues((prev) => ({
      ...prev,
      [key]: !currentValue,
    }));
  };

  const handleInputChange = (key: string, value: string, type: 'number' | 'string') => {
    setValues((prev) => ({
      ...prev,
      [key]: type === 'number' ? Number(value) : value,
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
    // Handle known acronyms
    const acronyms: { [key: string]: string } = {
      'llm': 'LLM',
    };
    
    if (acronyms[category.toLowerCase()]) {
      return acronyms[category.toLowerCase()];
    }
    
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
          <Card key={category}>
          <CardHeader>
            <CardTitle>{getCategoryTitle(category)} Settings</CardTitle>
            <CardDescription>
              Configure {getCategoryTitle(category).toLowerCase()} behavior for the entire system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categorySettings.map((setting) => {
              const settingType = getSettingType(setting.value);
              // Convert to Title Case with acronym handling: "useApiVlm" -> "Use API VLM"
              const acronyms = ['API', 'VLM', 'LLM', 'PDF'];
              const displayName = setting.key
                .split(".").pop()
                ?.replace(/([A-Z])/g, " $1")
                .trim()
                .split(' ')
                .map(word => {
                  const upperWord = word.toUpperCase();
                  return acronyms.includes(upperWord) ? upperWord : word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join(' ');

              return (
                <div key={setting.key} className="space-y-2">
                  <div className="flex items-center gap-3">
                    {settingType === 'boolean' ? (
                      <>
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
                        <Label htmlFor={setting.key} className="text-base font-medium cursor-pointer">
                          {displayName}
                        </Label>
                      </>
                    ) : (
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={setting.key} className="text-base font-medium">
                          {displayName}
                        </Label>
                        <Input
                          id={setting.key}
                          type={settingType === 'number' ? 'number' : 'text'}
                          value={values[setting.key]?.toString() || ''}
                          onChange={(e) => handleInputChange(setting.key, e.target.value, settingType)}
                          className="max-w-xs"
                        />
                      </div>
                    )}
                  </div>
                  {setting.description && (
                    <p className={`text-sm text-muted-foreground ${settingType === 'boolean' ? 'pl-14' : ''}`}>
                      {setting.description}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
