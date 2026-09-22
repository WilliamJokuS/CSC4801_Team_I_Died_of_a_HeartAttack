import { useState } from 'react';
import { AppShell } from '@/layouts/AppShell';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { companyProfile } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function EmployerCompanyProfilePage({ user }: { user: AuthUser }) {
  const [companyName, setCompanyName] = useState(companyProfile.company_name);
  const [description, setDescription] = useState(companyProfile.description);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    // TODO: Replace with real API call
    await new Promise((r) => setTimeout(r, 400));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell user={user}>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Company Profile</h1>
      <Card className="flex flex-col gap-4">
        <Input
          label="Company name"
          name="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
        <Textarea
          label="Description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <Button size="sm" className="self-start" onClick={handleSave}>
          Save
        </Button>
        {saved && <p className="text-sm text-success">Profile saved.</p>}
      </Card>
    </AppShell>
  );
}
